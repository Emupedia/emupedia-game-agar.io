require('dotenv').config();

const crypto = require('crypto');
const WebSocket = require('uws');
const WebSocketServer = WebSocket.Server;
// const uws = require('uWebSockets.js');
// const app = uws.App();
const url = require('url');
const request = require('request');
const Connection = require('./Connection');
const ChatChannel = require('./ChatChannel');
const { filterIPAddress } = require('../primitives/Misc');
const BanLists = require('../BanLists');

class Listener {
	/**
	 * @param {ServerHandle} handle
	 */
	constructor(handle) {
		/** @type {WebSocketServer} */
		this.listenerSocket = null;
		this.handle = handle;
		this.globalChat = new ChatChannel(this);
		/** @type {Router[]} */
		this.routers = [];
		/** @type {Connection[]} */
		this.connections = [];
		/** @type {Counter<IPAddress>} */
		this.connectionsByIP = { };
		this.CS = 'tFoL46WDlZuRja7W6qCl';
		this.usedNonces = new Map();

	}
	get settings() { return this.handle.settings; }
	get logger() { return this.handle.logger; }
	open() {
		if (this.listenerSocket !== null) return false;

		this.logger.debug(`listener opening at ${this.settings.listeningPort}`);

		this.listenerSocket = new WebSocketServer({
			port: this.settings.listeningPort,
			verifyClient: this.verifyClient.bind(this),
			handleProtocols: function (protocols) {
				this.logger.inform(`received protocols ${protocols}`);
				return protocols[0];
			}
		}, this.onOpen.bind(this));

		this.listenerSocket.on("connection", this.onConnection.bind(this));

		return true;
	}
	close() {
		if (this.listenerSocket === null) return false;

		this.logger.debug("listener closing");
		this.listenerSocket.close();
		this.listenerSocket = null;

		return true;
	}
	/**
	 * @param {{req: any, origin: string}} info
	 * @param {*} response
	 */
	verifyClient(info, response) {
		const ip = typeof info.req.headers['x-real-ip'] !== 'undefined' ? info.req.headers['x-real-ip'] : info.req.socket.remoteAddress;
		const address = filterIPAddress(ip);
		const protocol = info.req.headers['sec-websocket-protocol'];
		const userAgent = typeof info.req.headers['user-agent'] !== 'undefined' ? info.req.headers['user-agent'] : 'Unknown User Agent';
		this.logger.onAccess(`REQUEST FROM ${address}, ${info.secure ? "" : "not "}secure, Origin: ${info.origin}`);
		this.logger.onAccess(`IP: '${address}' Browser UA: '${userAgent}'`);

		if (this.connections.length > this.settings.listenerMaxConnections) {
			this.logger.inform("verifyClient: listenerMaxConnections reached, dropping new connections");

			return void response(false, 503, "Service Unavailable");
		}

		const acceptedOrigins = this.settings.listenerAcceptedOrigins;

		if (acceptedOrigins.length > 0 && acceptedOrigins.indexOf(info.origin) === -1) {
			this.logger.inform(`verifyClient: listenerAcceptedOrigins doesn't contain ${info.origin}`);

			return void response(false, 403, "Forbidden");
		}

                if (!protocol) {
			this.logger.inform(`verifyClient: missing websocket protocol for '${address}'`);

			return void response(false, 403, "Forbidden");
		}

		if (userAgent.length > 0 && userAgent.toLowerCase().indexOf('headless') !== -1 || userAgent.toLowerCase().indexOf('phantomjs') !== -1 || userAgent.toLowerCase().indexOf('electron') !== -1) {
			this.logger.inform(`verifyClient: UserAgent seems to be Headless UA: '${userAgent}'`);

			return void response(false, 403, "Forbidden");
		}

		if (this.settings.listenerForbiddenIPs.indexOf(address) !== -1) {
			this.logger.inform(`verifyClient: listenerForbiddenIPs contains ${address}, dropping connection`);

			return void response(false, 403, "Forbidden");
		}

		if (BanLists.getInstance().isIpBanned(address)) {
			this.logger.inform(`verifyClient: BanLists ipBanList contains ${address}, dropping connection`);

			return void response(false, 403, "Forbidden");
		}

		if (this.settings.listenerMaxConnectionsPerIP > 0) {
			const count = this.connectionsByIP[address];

			if (count && count >= this.settings.listenerMaxConnectionsPerIP) {
				this.logger.inform(`verifyClient: listenerMaxConnectionsPerIP reached for '${address}', dropping its new connections`);

				return void response(false, 403, "Forbidden");
			}
		}

		function sha256Hex(input) {
			return crypto.createHash('sha256').update(input).digest('hex');
		}

		// Derives the same per-connection XOR key the client derives (from ts/nonce/CS, distinct
		// from the main proof digest so the two purposes don't share key material) to decode the
		// obfuscated fp2 segment. Returns a 32-byte Buffer.
		function deriveFp2Key(ts, nonce, CS) {
			return crypto.createHash('sha256').update([ts, nonce, CS, 'fp2key'].join('.')).digest();
		}

		// XOR is self-inverse, so this is the same operation the client used to encode fp2.
		// Returns the decoded 64-char hex fp2 string, or null if encodedHex isn't a well-formed
		// 64-char hex string to begin with.
		function decodeFp2(ts, nonce, CS, encodedHex) {
			if (!/^[a-f0-9]{64}$/.test(encodedHex)) {
				return null;
			}

			const keyBytes = deriveFp2Key(ts, nonce, CS);
			const encBytes = Buffer.from(encodedHex, 'hex');
			const outBytes = Buffer.alloc(encBytes.length);

			for (let i = 0; i < encBytes.length; i++) {
				outBytes[i] = encBytes[i] ^ keyBytes[i];
			}

			return outBytes.toString('hex');
		}

		function cleanupUsedNonces(usedNonces) {
			const now = Date.now();

			usedNonces.forEach(function (expiresAt, nonce) {
				if (expiresAt <= now) {
					usedNonces.delete(nonce);
				}
			});
		}

		function validateProof(CS, logger, usedNonces) {
			const parts = protocol.split(".");

			// <timestamp>.<nonce>.<digest>.<encoded fp2> — fp2 is mandatory: a connection without
			// it is rejected exactly like any other malformed proof.
			if (parts.length !== 4) {
		    		return false;
			}

			const ts = parts[0];
			const nonce = parts[1];
			const digest = parts[2];

			if (!/^\d{13}$/.test(ts)) {
				return false;
			}

			if (!/^[a-f0-9]{32}$/.test(nonce)) {
				return false;
			}

			if (!/^[a-f0-9]{64}$/.test(digest)) {
				return false;
			}

			const decodedFp2 = decodeFp2(ts, nonce, CS, parts[3]);

			if (decodedFp2 === null) {
				return false;
			}

			const now = Date.now();
			const timestamp = Number(ts);

			// 30-second validity window
			if (Math.abs(now - timestamp) > (20 * 60 * 1000)) {
				logger.inform(`verifyClient: timestamp expired for '${address}', server=${now}, client=${timestamp}, diff=${Math.abs(now - timestamp)}ms`);
				return false;
			}

			cleanupUsedNonces(usedNonces);

			if (usedNonces.has(nonce)) {
				logger.inform(`verifyClient: nonce '${nonce}'  reused for '${address}'`);
				return false;
			}

			const origin = info.req.headers.origin || "";
			const raw = [ts, nonce, origin, CS].join(".");
			const expectedDigest = sha256Hex(raw);
			const valid = crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(expectedDigest, "utf8") );

			if (!valid) {
				logger.inform(`verifyClient: digest differ '${digest}' expected '${expectedDigest}'`);
				return false;
			}

			// Prevent replay within the timestamp window
			usedNonces.set(nonce, now + 30000);

			requestFp2 = decodedFp2;
			return true;
		}

		let requestFp2 = '';

		if (!validateProof(this.CS, this.logger, this.usedNonces)) {
			this.logger.inform(`verifyClient: protocol validation failed for '${address}'`);
			return void response(false, 403, "Forbidden");
		}

		if (BanLists.getInstance().isFp2Banned(requestFp2)) {
			this.logger.inform(`verifyClient: BanLists fp2BanList matched for '${address}', fp2='${requestFp2}'`);
			return void response(false, 403, "Forbidden");
		}

		// Stash the decoded fp2 on the upgrade request so Connection (constructed from this same
		// req in onConnection) can pick it up — otherwise it's only ever checked here, once, and is
		// unavailable later for per-spawn re-checks or logging.
		info.req.fp2 = requestFp2;

		this.logger.debug(`verifyClient: IP '${address}' Client Verification Passed`);
		response(true);
	}
	onOpen() {
		this.logger.inform(`listener open at ${this.settings.listeningPort}`);
	}
	/**
	 * @param {Router} router
	 */
	addRouter(router) {
		this.routers.push(router);
	}
	/**
	 * @param {Router} router
	 */
	removeRouter(router) {
		this.routers.splice(this.routers.indexOf(router), 1);
	}
	/**
	 * @param {WebSocket} webSocket
	 */
	onConnection(webSocket, req) {
		const newConnection = new Connection(this, webSocket, req);
		this.logger.onAccess(`CONNECTION FROM ${newConnection.remoteAddress}`);
		this.connectionsByIP[newConnection.remoteAddress] = this.connectionsByIP[newConnection.remoteAddress] + 1 || 1;
		this.connections.push(newConnection);

		if (this.settings.listenerUseReCaptcha) {
			const url_parts = url.parse(req.url, true);
			const query = url_parts.query;
			const secret_key = process.env.RECAPTCHA_SECRET_KEY || '';
			const verify_url = 'https://www.google.com/recaptcha/api/siteverify?secret=' + secret_key + '&response=' + query.token;

			request(verify_url, { json: true }, (error, response, body) => {
				if (!error && response.statusCode === 200) {
					if (body.success === false) {
						const errorCodes = Array.isArray(body['error-codes']) ? body['error-codes'].join(',') : 'unknown';
						this.logger.onAccess(`IP '${newConnection.remoteAddress}' Token '${query.token}' Error '${errorCodes}' failed recaptcha`);
						newConnection.closeSocket(1003, "Failed recaptcha verification clientside");
					} else {
						newConnection.verifyScore = body.score
					}
				} else {
					this.logger.onAccess(`IP '${newConnection.remoteAddress}' Token '${query.token}' Error '${error}' failed recaptcha`);
					newConnection.closeSocket(1003, "Failed reacaptha verification serverside");
				}
			});
		}
	}

	/**
	 * @param {Connection} connection
	 * @param {number} code
	 * @param {string} reason
	 */
	onDisconnection(connection, code, reason) {
		this.logger.onAccess(`DISCONNECTION FROM ${connection.remoteAddress} (${code} '${reason}')`);

		if (--this.connectionsByIP[connection.remoteAddress] <= 0)
			delete this.connectionsByIP[connection.remoteAddress];

		this.globalChat.remove(connection);
		this.connections.splice(this.connections.indexOf(connection), 1);
	}
	update() {
		let i, l;

		for (i = 0, l = this.routers.length; i < l; i++) {
			const router = this.routers[i];

			if (!router.shouldClose) continue;

			router.close(); i--; l--;
		}

		for (i = 0; i < l; i++) this.routers[i].update();

		for (i = 0, l = this.connections.length; i < l; i++) {
			const connection = this.connections[i];

			if (this.settings.listenerForbiddenIPs.indexOf(connection.remoteAddress) !== -1)
				connection.closeSocket(1003, "Remote address is forbidden");
			else if (Date.now() - connection.lastActivityTime >= this.settings.listenerMaxClientDormancy)
				connection.closeSocket(1003, "Maximum dormancy time exceeded");
		}
	}
}

module.exports = Listener;