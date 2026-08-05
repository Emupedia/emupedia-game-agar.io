const Cell = require("./Cell");

class Virus extends Cell {
	/**
	 * @param {World} world
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(world, x, y) {
		const size = world.settings.virusSize;
		super(world, x, y, size, 0x33FF33);

		this.fedTimes = 0;
		this.splitAngle = NaN;
		/** @type {{ id: number, name: string }} */
		this.lastFedBy = null;
	}

	get type() {
		return 2;
	}

	get isSpiked() {
		return true;
	}

	get isAgitated() {
		return false;
	}

	get avoidWhenSpawning() {
		return true;
	}

	/**
	 * @param {Cell} other
	 * @returns {CellEatResult}
	 */
	getEatResult(other) {
		if (other.type === 3) {
			return this.getEjectedEatResult(true);
		}

		if (other.type === 4) {
			return 3;
		}

		return 0;
	}

	/**
	 * @param {boolean} isSelf
	 * @returns {CellEatResult}
	 */
	getEjectedEatResult(isSelf) {
		return this.world.virusCount >= this.world.settings.virusMaxCount ? 0 : isSelf ? 2 : 3;
	}

	onSpawned() {
		this.world.virusCount++;
	}

	/**
	 * @param {Cell} cell
	 */
	whenAte(cell) {
		const settings = this.world.settings;

		// Remember who last pushed this virus, so a mothercell that swallows it
		// can attribute the feed. Snapshotted instead of holding the player:
		// they can disconnect long before the virus is consumed.
		if (cell.owner) {
			this.lastFedBy = {
				id: cell.owner.id,
				name: cell.owner.leaderboardName || cell.owner.cellName || "unnamed"
			};
		}

		if (settings.virusPushing) {
			const newD = this.boost.d + settings.virusPushBoost;
			this.boost.dx = (this.boost.dx * this.boost.d + cell.boost.dx * settings.virusPushBoost) / newD;
			this.boost.dy = (this.boost.dy * this.boost.d + cell.boost.dy * settings.virusPushBoost) / newD;
			this.boost.d = newD;
			this.world.setCellAsBoosting(this);
		}

		if (settings.virusGrowSplitting) {
			this.splitAngle = Math.atan2(cell.boost.dx, cell.boost.dy);

			if (++this.fedTimes >= settings.virusFeedTimes) {
				this.fedTimes = 0;
				this.size = settings.virusSize;
				this.world.splitVirus(this);
			} else {
				super.whenAte(cell);
			}
		}
	}

	/**
	 * @param {Cell} cell
	 */
	whenEatenBy(cell) {
		super.whenEatenBy(cell);

		if (cell.type === 0) {
			this.world.popPlayerCell(cell);
		}
	}

	onRemoved() {
		this.world.virusCount--;
	}
}

module.exports = Virus;