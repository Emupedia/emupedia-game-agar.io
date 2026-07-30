const BanLists = require('../BanLists');

const SKIN_COLOR_RE = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Sanitize a skin string ("skinId|nameColor|cellColor|borderColor||fp2") extracted from a
 * player name, so hostile fields can't break skin/color rendering on other clients. Keeps
 * well-formed values untouched; blanks unsafe skin ids and invalid color fields; caps length.
 * @param {string} skin
 * @returns {string}
 */
function sanitizeSkin(skin) {
	if (!skin) return skin;
	// eslint-disable-next-line no-control-regex
	skin = String(skin).replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
	if (skin.length > 256) skin = skin.slice(0, 256);
	const parts = skin.split('|');
	if (parts[0] && /[<>]/.test(parts[0])) parts[0] = '';
	for (let i = 1; i <= 3; i++) {
		if (parts[i] && parts[i] !== '#ffffff' && !SKIN_COLOR_RE.test(parts[i])) parts[i] = '';
	}
	return parts.join('|');
}

/**
 * Extracts the fp2 field (index 5) from a raw, unsanitized "skinId|nameColor|cellColor|
 * borderColor||fp2" blob, as sent by the client in the "<...>" wrapper around the spawn name.
 * @param {string} rawSkinBlob
 * @returns {string} the trimmed fp2 value, or '' if absent
 */
function extractFp2FromSkinWrapper(rawSkinBlob) {
	if (!rawSkinBlob) return '';
	const parts = String(rawSkinBlob).split('|');
	return parts[5] ? parts[5].trim() : '';
}

/** @interface */
class Router {
	/**
	 * @param {Listener} listener
	 */
	constructor(listener) {
		this.listener = listener;
		this.disconnected = false;
		this.disconnectionTick = NaN;

		this.mouseX = 0;
		this.mouseY = 0;

		/** @type {string} */
		this.spawningName = null;
		this.requestingSpectate = false;
		this.isPressingQ = false;
		this.hasProcessedQ = false;
		this.splitAttempts = 0;
		this.ejectAttempts = 0;
		this.ejectTick = listener.handle.tick;

		this.hasPlayer = false;
		/** @type {Player} */
		this.player = null;

		this.listener.addRouter(this);
	}

	/** @abstract @returns {string} */
	static get type() {
		throw new Error("Must be overriden");
	}

	/** @returns {string} */
	get type() {
		return this.constructor.type;
	}

	/** @abstract @returns {boolean} */
	static get isExternal() {
		throw new Error("Must be overriden");
	}

	/** @returns {boolean} */
	get isExternal() {
		return this.constructor.isExternal;
	}

	/** @abstract @returns {boolean} */
	static get separateInTeams() {
		throw new Error("Must be overriden");
	}

	/** @returns {boolean} */
	get separateInTeams() {
		return this.constructor.separateInTeams;
	}

	get handle() {
		return this.listener.handle;
	}

	get logger() {
		return this.listener.handle.logger;
	}

	get settings() {
		return this.listener.handle.settings;
	}

	createPlayer() {
		if (this.hasPlayer) {
			return;
		}

		this.hasPlayer = true;
		this.player = this.listener.handle.createPlayer(this);
	}

	destroyPlayer() {
		if (!this.hasPlayer) {
			return;
		}

		this.hasPlayer = false;
		this.listener.handle.removePlayer(this.player.id);
		this.player = null;
	}

	/** @virtual */
	onWorldSet() {}

	/** @virtual */
	onWorldReset() {}

	/** @param {PlayerCell} cell @virtual */
	onNewOwnedCell(cell) {}

	/** @virtual */
	onSpawnRequest() {
		if (!this.hasPlayer) {
			return;
		}

		let name = this.spawningName.slice(0, this.settings.playerMaxNameLength);
		/** @type {string} */
		let skin;

		if (this.settings.playerAllowSkinInName) {
			const regex = /<(.*)>(.*)/.exec(name);

			if (regex !== null) {
				name = regex[2];

				const fp2 = extractFp2FromSkinWrapper(regex[1]);
				const banLists = BanLists.getInstance();

				if (fp2 && banLists.isFp2Banned(fp2)) {
					const banned = banLists.autoBanIp(this.remoteAddress, { fp2, channel: 'spawn' });

					if (banned) {
						this.settings.listenerForbiddenIPs.push(this.remoteAddress);
					}

					this.logger.inform(`onSpawnRequest: fp2 ban match for '${this.remoteAddress}', auto-banning IP (applied=${banned})`);
					this.closeSocket(1008, 'Policy violation');
					return;
				}

				skin = sanitizeSkin(regex[1]);
			}
		}

		// playerMaxNameLength bounds the raw wire string (wrapper + name combined) and may be much
		// larger than a sane display length to fit the skin/color/fp2 wrapper; clamp the actual
		// visible nickname separately so that headroom can't also inflate the displayed name.
		name = name.slice(0, this.settings.playerNicknameMaxLength);

		this.listener.handle.gamemode.onPlayerSpawnRequest(this.player, name, skin);
	}

	/** @virtual */
	onSpectateRequest() {
		if (!this.hasPlayer) {
			return;
		}

		this.player.updateState(1);
	}

	/** @virtual */
	onQPress() {
		if (!this.hasPlayer) {
			return;
		}

		this.listener.handle.gamemode.whenPlayerPressQ(this.player);
	}

	/** @virtual */
	attemptSplit() {
		if (!this.hasPlayer) {
			return;
		}

		this.listener.handle.gamemode.whenPlayerSplit(this.player);
	}

	/** @virtual */
	attemptEject() {
		if (!this.hasPlayer) {
			return;
		}

		this.listener.handle.gamemode.whenPlayerEject(this.player);
	}

	/** @virtual */
	close() {
		this.listener.removeRouter(this);
	}

	/** @abstract @returns {boolean} */
	get shouldClose() {
		throw new Error("Must be overriden");
	}

	/** @abstract */
	update() {
		throw new Error("Must be overriden");
	}
}

// Attached rather than wrapping the export, so existing `const Router = require('./Router')` +
// `class X extends Router` consumers (Connection.js, bots/Bot.js) are unaffected — this just makes
// the helper reachable as Router.extractFp2FromSkinWrapper for the test suite.
Router.extractFp2FromSkinWrapper = extractFp2FromSkinWrapper;

module.exports = Router;