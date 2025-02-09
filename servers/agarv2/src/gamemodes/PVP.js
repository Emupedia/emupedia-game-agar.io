const FFA = require("./FFA");
const Misc = require('../primitives/Misc')

class PVP extends FFA {
	static get name() {
		return "PVP";
	}

	static get type() {
		return 0;
	}

	/**
	 * @param {Player} player
	 * @param {string} name
	 */
	onPlayerSpawnRequest(player, name) {
		if (player.state === 0 || !player.hasWorld) {
			return;
		}

		if (player.world.players.filter(player => player.state === 0).length >= 2) {
			return void this.handle.listener.globalChat.directMessage(null, player.router, "You cannot spawn in this world you can only specatate because there are already 2 players doing PVP");
		}

		const size = player.router.type === "minion" ? this.handle.settings.minionSpawnSize : this.handle.settings.playerSpawnSize;
		const spawnInfo = player.world.getPlayerSpawn(size);
		const color = spawnInfo.color || Misc.randomColor();
		player.cellName = player.chatName = player.leaderboardName = name;
		player.cellSkin = skin;
		player.chatColor = player.cellColor = color;
		player.world.spawnPlayer(player, spawnInfo.pos, size, name, null);
	}
}

module.exports = PVP;