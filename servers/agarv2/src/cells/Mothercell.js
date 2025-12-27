const Cell = require("./Cell");
const Pellet = require("./Pellet");

/**
 * @implements {Spawner}
 */
class Mothercell extends Cell {
	/**
	 * @param {World} world
	 */
	constructor(world, x, y) {
		// Validate input coordinates before passing to parent
		if (isNaN(x) || !isFinite(x) || isNaN(y) || !isFinite(y)) {
			world.handle.logger.onFatal("Attempting to create Mothercell with invalid coordinates: x=%s, y=%s", x, y);
			// Use fallback coordinates (center of map)
			x = world.border.x || 0;
			y = world.border.y || 0;
		}

		const size = world.settings.mothercellSize;
		super(world, x, y, size, 0xCE6363);

		this.pelletCount = 0;
		this.activePelletFormQueue = 0;
		this.passivePelletFormQueue = 0;
	}

	get type() {
		return 4;
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

	set size(value) {
		if (!Number.isFinite(value) || value < 0) {
			value = 149;
		}
		// Enforce maximum size limit for mothercells
		const maxSize = (this.world && this.world.settings && this.world.settings.mothercellMaxSize) || 1500;
		super.size = Math.min(value, maxSize);
	}

	set squareSize(value) {
		this.size = Math.sqrt(Math.max(0, value));
	}

	set mass(value) {
		this.size = Math.sqrt(100 * Math.max(0, value));
	}

	/**
	 * @param {Cell} other
	 * @returns {CellEatResult}
	 */
	getEatResult(other) {
		return 0;
	}

	onTick() {
		const settings = this.world.settings;
		const mothercellSize = settings.mothercellSize;
		const pelletSize = settings.pelletMinSize;
		const minSpawnSqSize = mothercellSize * mothercellSize + pelletSize * pelletSize;

		this.activePelletFormQueue += settings.mothercellActiveSpawnSpeed * this.world.handle.stepMult;
		this.passivePelletFormQueue += Math.random() * settings.mothercellPassiveSpawnChance * this.world.handle.stepMult;

		while (this.activePelletFormQueue > 0) {
			if (this.squareSize > minSpawnSqSize) {
				this.spawnPellet();
				this.squareSize -= pelletSize * pelletSize;
			} else if (this.size > mothercellSize) {
				this.size = mothercellSize;
			}

			this.activePelletFormQueue--;
		}

		while (this.passivePelletFormQueue > 0) {
			if (this.pelletCount < settings.mothercellMaxPellets) {
				this.spawnPellet();
			}

			this.passivePelletFormQueue--;
		}
	}

	spawnPellet() {
		// Validate mothercell state before spawning
		if (isNaN(this.x) || !isFinite(this.x) || isNaN(this.y) || !isFinite(this.y) || isNaN(this.size) || !isFinite(this.size)) {
			this.world.handle.logger.onFatal("Mothercell has invalid state: x=%s, y=%s, size=%s, id=%s", 
				this.x, this.y, this.size, this.id);
			// Remove this invalid mothercell to prevent further issues
			if (this.exists) {
				this.world.removeCell(this);
			}
			return;
		}

		const angle = Math.random() * 2 * Math.PI;
		const x = this.x + this.size * Math.sin(angle);
		const y = this.y + this.size * Math.cos(angle);
		
		// Additional validation after calculation
		if (isNaN(x) || !isFinite(x) || isNaN(y) || !isFinite(y)) {
			this.world.handle.logger.onFatal("Calculated NaN pellet coordinates: x=%s, y=%s, mothercell: x=%s, y=%s, size=%s, angle=%s", 
				x, y, this.x, this.y, this.size, angle);
			// Remove this invalid mothercell
			if (this.exists) {
				this.world.removeCell(this);
			}
			return;
		}

		const pellet = new Pellet(this.world, this, x, y);
		pellet.boost.dx = Math.sin(angle);
		pellet.boost.dy = Math.cos(angle);
		const d = this.world.settings.mothercellPelletBoost;
		pellet.boost.d = d / 2 + Math.random() * d / 2;
		this.world.addCell(pellet);
		this.world.setCellAsBoosting(pellet);
	}

	onSpawned() {
		this.world.mothercellCount++;
	}

	whenAte(cell) {
		super.whenAte(cell);
		this.size = Math.min(this.size, this.world.settings.mothercellMaxSize);
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
		this.world.mothercellCount--;
	}
}

module.exports = Mothercell;