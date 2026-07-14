const { containsChatFilterMatch } = require('./ChatFilterNormalization')

const serverSource = {
	isServer: true,
	name: 'Server',
	color: 0x3F3FC0,
	state: -1
}

/** @param {Connection} connection */
function getSourceFromConnection(connection) {
	return {
		isServer: false,
		name: connection.player.chatName,
		color: connection.player.chatColor,
		state: connection.player.state
	}
}

class ChatChannel {
	/**
	 * @param {Listener} listener
	 */
	constructor(listener) {
		this.listener = listener
		/** @type {Connection[]} */
		this.connections = []
	}

	get settings() { return this.listener.handle.settings }

	/**
	 * @param {Connection} connection
	 */
	add(connection) {
		const isPresent = this.connections.some(item => item.hash === connection.remoteAddress + '-' + (connection.player && typeof connection.player.id !== 'undefined' ? connection.player.id : 0))

		if (!isPresent) {
			this.connections.push({
				hash: connection.remoteAddress + '-' + (connection.player && typeof connection.player.id !== 'undefined' ? connection.player.id : 0),
				socket: connection
			})
		} else {
			this.remove(connection)

			this.connections.push({
				hash: connection.remoteAddress + '-' + (connection.player && typeof connection.player.id !== 'undefined' ? connection.player.id : 0),
				socket: connection
			})
		}
	}
	/**
	 * @param {Connection} connection
	 */
	remove(connection) {
		for (let i = 0; i < this.connections.length; i++) {
			if (this.connections[i].hash === (connection.remoteAddress + '-' + (connection.player && typeof connection.player.id !== 'undefined' ? connection.player.id : 0))) {
				this.connections.splice(i, 1)
				break
			}
		}
	}

	/**
	 * @param {string} message
	 */
	shouldFilter(message) {
		for (let i = 0, l = this.settings.chatFilteredPhrases.length; i < l; i++) {
			if (containsChatFilterMatch(message, this.settings.chatFilteredPhrases[i], true)) {
				this.listener.logger.inform(`MESSAGE REJECTED '${message}' contains '${this.settings.chatFilteredPhrases[i]}'`)
				return true
			}
		}

		return false
	}
	/**
	 * @param {Connection} source
	 */
	rejectFilteredMessage(source) {
		return source.protocol.onChatMessage(serverSource, 'Last message was not sent, because it contains banned words.')
	}
	/**
	 * @param {Connection} source
	 * @param {string} message
	 */
	broadcast(source, message) {
		if (this.shouldFilter(message)) {
			return this.rejectFilteredMessage(source)
		}

		const sourceInfo = source == null ? serverSource : getSourceFromConnection(source)

		if (!this.settings.chatSpectatorEnabled && (sourceInfo.state === -1 || sourceInfo.state === 1)) {
			return source.protocol.onChatMessage(serverSource, 'Spectator chat is disabled, you must play in order to chat.')
		}

		for (let i = 0, l = this.connections.length; i < l; i++) {
			const conn = this.connections[i]

			if (conn && conn.socket && conn.socket !== source && conn.socket.protocol) {
				conn.socket.protocol.onChatMessage(sourceInfo, message)
			}
		}
	}
	/**
	 * @param {Connection} source
	 * @param {Connection} recipient
	 * @param {string} message
	 */
	directMessage(source, recipient, message) {
		if (this.shouldFilter(message) && recipient.protocol) {
			return this.rejectFilteredMessage(recipient)
		}

		const sourceInfo = source == null ? serverSource : getSourceFromConnection(source)
		if (recipient.protocol) recipient.protocol.onChatMessage(sourceInfo, message)
	}
}

module.exports = ChatChannel