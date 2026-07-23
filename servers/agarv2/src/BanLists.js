const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const DEFAULT_FP2_URL = 'https://emupedia.net/emupedia-game-agar.io/fp2BanList.txt';
const DEFAULT_IP_URL = 'https://emupedia.net/emupedia-game-agar.io/ipBanList.txt';
const DEFAULT_REFRESH_MS = 15 * 60 * 1000;
const DEFAULT_JITTER_MS = 3 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 10 * 1000;
const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024;
const DEFAULT_AUTOBAN_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_AUTOBAN_MAX_IN_WINDOW = 20;
const DEFAULT_MAX_REDIRECTS = 3;

const DEFAULT_DATA_DIR = path.resolve(__dirname, '../data/banlists');

/**
 * Parse the ban-list wire format: a single line (or arbitrary whitespace/newlines around it) of
 * comma-separated entries. Matches the real, already-deployed format used by the client's own
 * fp2BanList.txt consumption (docs/agarv2/assets/js/main.js) and confirmed directly against the
 * real docs/fp2BanList.txt in this repo.
 * @param {string} text
 * @returns {string[]}
 */
function parseList(text) {
	return String(text || '')
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);
}

/**
 * @param {string} filePath
 * @param {string} content
 */
function atomicWriteFileSync(filePath, content) {
	const tmpPath = filePath + '.tmp' + process.pid;
	fs.writeFileSync(tmpPath, content, 'utf-8');
	fs.renameSync(tmpPath, filePath);
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @param {(err: Error|null, body?: string) => void} cb
 * @param {number} redirectsLeft
 */
function fetchOnce(url, timeoutMs, cb, redirectsLeft) {
	let settled = false;

	function finish(err, body) {
		if (settled) return;
		settled = true;
		cb(err, body);
	}

	let req;

	try {
		req = https.get(url, res => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.resume();

				if (redirectsLeft <= 0) {
					return finish(new Error('too many redirects'));
				}

				settled = true; // the request for THIS hop is done; a fresh one starts below
				const nextUrl = new URL(res.headers.location, url).toString();
				fetchOnce(nextUrl, timeoutMs, cb, redirectsLeft - 1);
				return;
			}

			if (res.statusCode < 200 || res.statusCode >= 300) {
				res.resume();
				return finish(new Error(`HTTP ${res.statusCode}`));
			}

			let size = 0;
			const chunks = [];

			res.on('data', chunk => {
				size += chunk.length;

				if (size > DEFAULT_MAX_BODY_BYTES) {
					req.destroy();
					return finish(new Error('response too large'));
				}

				chunks.push(chunk);
			});
			res.on('end', () => finish(null, Buffer.concat(chunks).toString('utf-8')));
			res.on('error', err => finish(err));
		});
	} catch (e) {
		return finish(e);
	}

	req.on('error', err => finish(err));
	req.setTimeout(timeoutMs, () => {
		req.destroy();
		finish(new Error('request timed out'));
	});
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @param {(err: Error|null, body?: string) => void} cb
 */
function defaultFetch(url, timeoutMs, cb) {
	fetchOnce(url, timeoutMs, cb, DEFAULT_MAX_REDIRECTS);
}

/**
 * Fetch+cache+lookup for the remote fp2/IP ban lists, plus a rate-limited local IP auto-ban
 * mutation. Network access and local files are both injectable so this can be fully unit-tested
 * without touching the real network or the real data directory (pass `autoStart: false`).
 */
class BanLists {
	/**
	 * @param {object} [opts]
	 */
	constructor(opts = {}) {
		this.fp2Url = opts.fp2Url || DEFAULT_FP2_URL;
		this.ipUrl = opts.ipUrl || DEFAULT_IP_URL;

		const dataDir = opts.dataDir || DEFAULT_DATA_DIR;
		this.fp2CachePath = opts.fp2CachePath || path.join(dataDir, 'fp2BanList.cache.txt');
		this.ipCachePath = opts.ipCachePath || path.join(dataDir, 'ipBanList.cache.txt');
		this.ipLocalPath = opts.ipLocalPath || path.join(dataDir, 'ipBanList.local.txt');
		this.auditLogPath = opts.auditLogPath || path.join(dataDir, 'autoban-audit.log');

		this.refreshIntervalMs = opts.refreshIntervalMs || DEFAULT_REFRESH_MS;
		this.jitterMs = opts.jitterMs != null ? opts.jitterMs : DEFAULT_JITTER_MS;
		this.fetchTimeoutMs = opts.fetchTimeoutMs || DEFAULT_FETCH_TIMEOUT_MS;
		this.autobanWindowMs = opts.autobanWindowMs || DEFAULT_AUTOBAN_WINDOW_MS;
		this.autobanMaxInWindow = opts.autobanMaxInWindow || DEFAULT_AUTOBAN_MAX_IN_WINDOW;

		this.fetchFn = opts.fetchFn || defaultFetch;
		this.logger = opts.logger || console;

		/** @type {Set<string>} */
		this.fp2Set = new Set();
		/** @type {Set<string>} */
		this.ipSet = new Set();

		this._autobanTimestamps = [];
		this._timer = null;

		this._ensureDir(dataDir);
		this._loadCacheFileSync(this.fp2CachePath, this.fp2Set);
		this._loadCacheFileSync(this.ipCachePath, this.ipSet);
		this._loadCacheFileSync(this.ipLocalPath, this.ipSet);

		if (opts.autoStart !== false) this.start();
	}

	/** @param {string} dir */
	_ensureDir(dir) {
		try {
			fs.mkdirSync(dir, { recursive: true });
		} catch (e) {
			// directory may already exist, or the filesystem is read-only in some sandboxed
			// test environment — either way, non-fatal, fall through to the file-load attempts
		}
	}

	/**
	 * @param {'warn'|'inform'|'debug'} level
	 * @param {string} message
	 */
	_log(level, message) {
		if (this.logger[level]) this.logger[level](message);
		else if (this.logger.log) this.logger.log(message);
	}

	/**
	 * @param {string} filePath
	 * @param {Set<string>} set
	 */
	_loadCacheFileSync(filePath, set) {
		try {
			if (!fs.existsSync(filePath)) {
				atomicWriteFileSync(filePath, '');
				return;
			}

			parseList(fs.readFileSync(filePath, 'utf-8')).forEach(e => set.add(e));
		} catch (e) {
			this._log('warn', `BanLists: failed to load cache file ${filePath}: ${e.message}`);
		}
	}

	/** @param {string} filePath @returns {string} */
	_readFileSafe(filePath) {
		try {
			return fs.readFileSync(filePath, 'utf-8');
		} catch (e) {
			return '';
		}
	}

	start() {
		if (this._timer) return; // already running, avoid stacking a second refresh loop
		this.refresh();
		this._scheduleNext();
	}

	stop() {
		if (this._timer) {
			clearTimeout(this._timer);
			this._timer = null;
		}
	}

	_scheduleNext() {
		const jitter = this.jitterMs > 0 ? (Math.random() * 2 - 1) * this.jitterMs : 0;
		const delay = Math.max(1000, this.refreshIntervalMs + jitter);

		this._timer = setTimeout(() => {
			this.refresh();
			this._scheduleNext();
		}, delay);

		if (this._timer.unref) this._timer.unref();
	}

	refresh() {
		this._refreshOne(this.fp2Url, this.fp2CachePath, this.fp2Set, 'fp2BanList');
		this._refreshOne(this.ipUrl, this.ipCachePath, this.ipSet, 'ipBanList', this.ipLocalPath);
	}

	/**
	 * @param {string} url
	 * @param {string} cachePath
	 * @param {Set<string>} set
	 * @param {string} label
	 * @param {string} [localPath] locally-added entries (this server's own auto-bans) to keep
	 *   unioned into the set on every refresh, so a remote fetch can never silently erase them.
	 */
	_refreshOne(url, cachePath, set, label, localPath) {
		this.fetchFn(url, this.fetchTimeoutMs, (err, text) => {
			if (err) {
				this._log('warn', `BanLists: fetch failed for ${label} (${url}): ${err.message}, keeping cached copy`);
				return;
			}

			const entries = parseList(text);
			const previousSize = set.size;

			if (entries.length === 0 && previousSize > 0) {
				this._log('warn', `BanLists: ${label} fetch returned an empty list but the previous one had ${previousSize} entries — treating as a bad response, keeping cache`);
				return;
			}

			if (previousSize > 10 && entries.length < previousSize * 0.5) {
				this._log('warn', `BanLists: ${label} fetch shrank from ${previousSize} to ${entries.length} entries — treating as a truncated/bad response, keeping cache`);
				return;
			}

			const newSet = new Set(entries);

			if (localPath) {
				parseList(this._readFileSafe(localPath)).forEach(e => newSet.add(e));
			}

			set.clear();
			newSet.forEach(e => set.add(e));

			try {
				atomicWriteFileSync(cachePath, entries.join(','));
			} catch (e) {
				this._log('warn', `BanLists: failed to persist cache for ${label}: ${e.message}`);
			}
		});
	}

	/** @param {string} fp2 @returns {boolean} */
	isFp2Banned(fp2) {
		return !!fp2 && this.fp2Set.has(fp2);
	}

	/** @param {string} ip @returns {boolean} */
	isIpBanned(ip) {
		return !!ip && this.ipSet.has(ip);
	}

	/**
	 * Rate-limited/circuit-broken IP auto-ban. Every match is logged to the audit trail regardless
	 * of outcome; the ban is only actually applied (added to ipSet + persisted) if the rolling
	 * window hasn't exceeded the configured cap, so a bad remote list or a bug can't mass-ban the
	 * playerbase — it can only get logged for an operator to investigate.
	 * @param {string} ip
	 * @param {{fp2?: string, channel?: string}} [evidence]
	 * @returns {boolean} true if the ban actually took effect
	 */
	autoBanIp(ip, evidence = {}) {
		if (!ip) return false;
		if (this.ipSet.has(ip)) return false;

		const now = Date.now();
		this._autobanTimestamps = this._autobanTimestamps.filter(t => now - t < this.autobanWindowMs);

		const wouldExceed = this._autobanTimestamps.length >= this.autobanMaxInWindow;

		this._appendAudit({ time: now, ip, fp2: evidence.fp2 || '', channel: evidence.channel || '', applied: !wouldExceed });

		if (wouldExceed) {
			this._log('warn', `BanLists: auto-ban circuit breaker tripped (${this.autobanMaxInWindow} bans / ${this.autobanWindowMs}ms), refusing to ban '${ip}' (logged only)`);
			return false;
		}

		this._autobanTimestamps.push(now);
		this.ipSet.add(ip);

		try {
			const prefix = this._readFileSafe(this.ipLocalPath).trim().length > 0 ? ',' : '';
			fs.appendFileSync(this.ipLocalPath, prefix + ip, 'utf-8');
		} catch (e) {
			this._log('warn', `BanLists: failed to persist local auto-ban for '${ip}': ${e.message}`);
		}

		this._log('inform', `BanLists: auto-banned IP '${ip}' (fp2='${evidence.fp2 || ''}', channel='${evidence.channel || ''}')`);

		return true;
	}

	/**
	 * @param {string} ip
	 * @returns {boolean} true if it was banned and is now removed
	 */
	unbanIp(ip) {
		if (!ip || !this.ipSet.has(ip)) return false;

		this.ipSet.delete(ip);

		try {
			const remaining = parseList(this._readFileSafe(this.ipLocalPath)).filter(e => e !== ip);
			atomicWriteFileSync(this.ipLocalPath, remaining.join(','));
		} catch (e) {
			this._log('warn', `BanLists: failed to update local ban file while unbanning '${ip}': ${e.message}`);
		}

		return true;
	}

	/** @param {{time: number, ip: string, fp2: string, channel: string, applied: boolean}} entry */
	_appendAudit(entry) {
		try {
			const line = `${new Date(entry.time).toISOString()}\tip=${entry.ip}\tfp2=${entry.fp2}\tchannel=${entry.channel}\tapplied=${entry.applied}\n`;
			fs.appendFileSync(this.auditLogPath, line, 'utf-8');
		} catch (e) {
			this._log('warn', `BanLists: failed to write autoban audit log: ${e.message}`);
		}
	}
}

let singleton = null;

/**
 * Lazy singleton for production use. Deliberately constructed with autoStart:false — the cache
 * files are still loaded synchronously so isFp2Banned/isIpBanned work immediately even before
 * ServerHandle.start() runs, but the network refresh timer only begins once something explicitly
 * calls .start() (ServerHandle's start()/stop() lifecycle), so repeated getInstance() calls (from
 * Listener.js, Router.js, etc.) can never spin up more than one refresh loop.
 * @returns {BanLists}
 */
function getInstance() {
	if (!singleton) singleton = new BanLists({ autoStart: false });
	return singleton;
}

module.exports = { BanLists, getInstance, parseList };
