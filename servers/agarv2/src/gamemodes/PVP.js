const FFA = require("./FFA");

class PVP extends FFA {
	static get name() {
		return "PVP";
	}

	static get type() {
		return 0;
	}

	/**
	 * @param {World} world
	 */
	onNewWorld(world) {}

	/**
	 * @param {World} world
	 */
	canJoinWorld(world) {
		return world.players.length <= world.settings.worldMaxPlayers;
	}

	/**
	 * @param {Player} player
	 * @param {World} world
	 */
	onPlayerJoinWorld(player, world) {
		super.onPlayerJoinWorld(player, world);

		if (player.router.isExternal) {
			player.life = 0;
			player.updateState(1);
		}
	}

	/** @param {Player} player @param {World} world @virtual */
	onPlayerLeaveWorld(player, world) {
		player.life = 0;
	}

	/**
	 * @param {Player} player
	 * @param {string} name
	 */
	onPlayerSpawnRequest(player, name) {
		if (player.router.isExternal && player.life++ > 0) {
			player.updateState(1);

			return void this.handle.listener.globalChat.directMessage(null, player.router, "You cannot spawn anymore in this world, try joining a new world.");
		}

		super.onPlayerSpawnRequest(player, name);
	}
}

module.exports = PVP;