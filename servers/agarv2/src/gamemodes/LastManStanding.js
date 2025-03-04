const FFA = require("./FFA");

class LastManStanding extends FFA {
	static get name() {
		return "Last Man Standing";
	}

	static get type() {
		return 0;
	}

	/**
	 * @param {World} world
	 */
	onNewWorld(world) {
		world.hadPlayers = false;
	}

	/**
	 * @param {World} world
	 */
	canJoinWorld(world) {
		return world.hadPlayers;
	}

	/**
	 * @param {Player} player
	 * @param {World} world
	 */
	onPlayerJoinWorld(player, world) {
		super.onPlayerJoinWorld(player, world);

		world.hadPlayers = true;

		if (player.router.isExternal) {
			player.life = 0;
		}
	}

	/**
	 * @param {Player} player
	 * @param {string} name
	 */
	onPlayerSpawnRequest(player, name) {
		if (player.router.isExternal && player.life++ > 0) {
			return void this.handle.listener.globalChat.directMessage(null, player.router, "You cannot spawn anymore.");
		}

		super.onPlayerSpawnRequest(player, name);
	}
}

module.exports = LastManStanding;