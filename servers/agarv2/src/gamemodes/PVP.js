const FFA = require('./FFA');
const Misc = require('../primitives/Misc')

class PVP extends FFA {
	static get name() {
		return 'PVP';
	}

	static get type() {
		return 0;
	}

	/**
	 * @param {Player} player
	 * @param {World} world
	 */
	onPlayerJoinWorld(player, world) {
		super.onPlayerJoinWorld(player, world);
		return void this.handle.listener.globalChat.directMessage(null, player.router, "Maximum number of players for this world is " + (world.id <= 20 ? 2 : 4));
	}


	/**
	 * @param {Player} player
	 * @param {string} name
	 */
	onPlayerSpawnRequest(player, name, skin) {
		if (player.state === 0 || !player.hasWorld) {
			return;
		}

		player.world.compileStatistics()

		if (player.world.id <= 20 && player.world.stats.playing > 1) {
			for (let i = 0, l = player.ownedCells.length; i < l; i++) {
				player.world.removeCell(player.ownedCells[0]);
			}

			player.updateState(1);

			return void this.handle.listener.globalChat.directMessage(null, player.router, 'You cannot spawn in this world you can only spectate because there are already 2 players doing PVP');
		}

		if (player.world.id > 20 && player.world.stats.playing > 3) {
			for (let i = 0, l = player.ownedCells.length; i < l; i++) {
				player.world.removeCell(player.ownedCells[0]);
			}

			player.updateState(1);

			return void this.handle.listener.globalChat.directMessage(null, player.router, 'You cannot spawn in this world you can only spectate because there are already 4 players doing PVP');
		}

		const size = player.router.type === 'minion' ? this.handle.settings.minionSpawnSize : this.handle.settings.playerSpawnSize;
		const spawnInfo = player.world.getPlayerSpawn(size);
		const color = spawnInfo.color || Misc.randomColor();
		player.cellName = player.chatName = player.leaderboardName = name;
		player.cellSkin = skin;
		player.chatColor = player.cellColor = color;
		player.world.spawnPlayer(player, spawnInfo.pos, size, name, null);
	}
}

module.exports = PVP;