/**
 * @abstract
 */
const { containsChatFilterMatch, normalizeChatFilterText, stripInvisible } = require('../sockets/ChatFilterNormalization');

class Protocol {
	/**
	 * @param {Connection} connection
	 */
	constructor(connection) {
		this.connection = connection;
	}

	/**
	 * @abstract
	 * @returns {string}
	 */
	static get type() {
		throw new Error("Must be implemented");
	}

	get type() {
		return this.constructor.type;
	}

	/**
	 * @abstract
	 * @returns {string}
	 */
	get subtype() {
		throw new Error("Must be implemented");
	}

	get listener() {
		return this.connection.listener;
	}

	get handle() {
		return this.connection.listener.handle;
	}

	get logger() {
		return this.connection.listener.handle.logger;
	}

	get settings() {
		return this.connection.listener.handle.settings;
	}

	/**
	 * @abstract
	 * @param {Reader} reader
	 * @returns {boolean}
	 */
	distinguishes(reader) {
		throw new Error("Must be implemented");
	}

	/**
	 * @abstract
	 * @param {Reader} reader
	 */
	onSocketMessage(reader) {
		throw new Error("Must be implemented");
	}

	/**
	 * @abstract
	 * @param {ChatSource} source
	 * @param {string} message
	 */
	onChatMessage(source, message) {
		throw new Error("Must be implemented");
	}

	/**
	 * @abstract
	 * @param {PlayerCell} cell
	 */
	onNewOwnedCell(cell) {
		throw new Error("Must be implemented");
	}

	/**
	 * @param {World} world
	 * @param {boolean} includeServerInfo
	 */
	onNewWorldBounds(world, includeServerInfo) {
		throw new Error("Must be implemented");
	}

	/**
	 * @abstract
	 */
	onWorldReset() {
		throw new Error("Must be implemented");
	}

	/**
	 * @abstract
	 * @param {LeaderboardType} type
	 * @param {LeaderboardDataType[type][]} data
	 * @param {LeaderboardDataType[type]=} selfData
	 */
	onLeaderboardUpdate(type, data, selfData) {
		throw new Error("Must be implemented");
	}

	/**
	 * @abstract
	 * @param {ViewArea} viewArea
	 */
	onSpectatePosition(viewArea) {
		throw new Error("Must be implemented");
	}

	/**
	 * @abstract
	 * @param {Cell[]} add
	 * @param {Cell[]} upd
	 * @param {Cell[]} eat
	 * @param {Cell[]} del
	 */
	onVisibleCellUpdate(add, upd, eat, del) {
		throw new Error("Must be implemented");
	}

	/**
	 * @param {Buffer} data
	 */
	send(data) {
		this.connection.send(data);
	}

	/**
	 * Filter player name against forbidden names and chat filter
	 * @param {string} name
	 * @returns {string}
	 */
	filterName(name) {
		let newname = name || ''

		// Strip control/invisible bytes (binary-name injection) via the chat filter shared,
		// data-driven strip (ranges live in data/normalize.json). Skin punctuation is preserved.
		newname = stripInvisible(newname)

		for (let i = 0, l = this.settings.chatForbiddenNames.length; i < l; i++) {
			if (containsChatFilterMatch(newname, this.settings.chatForbiddenNames[i], true)) {
				return 'An unnamed cell'
			}
		}

		if (this.settings.worldPlayerBotNames && this.settings.worldPlayerBotNames.length > 0) {
			const normalizedName = normalizeChatFilterText(newname)
			for (let i = 0, l = this.settings.worldPlayerBotNames.length; i < l; i++) {
				if (normalizedName === normalizeChatFilterText(this.settings.worldPlayerBotNames[i])) {
					return 'An unnamed cell';
				}
			}
		}

		for (let i = 0, l = this.settings.chatFilteredPhrases.length; i < l; i++) {
			if (containsChatFilterMatch(newname, this.settings.chatFilteredPhrases[i], true)) {
				return 'An unnamed cell'
			}
		}
		return newname
	}

	/**
	 * @param {number=} code
	 * @param {string=} reason
	 */
	fail(code, reason) {
		this.connection.closeSocket(code || 1003, reason || "Unspecified protocol fail");
	}
}

module.exports = Protocol;