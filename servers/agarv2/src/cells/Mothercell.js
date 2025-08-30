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
				// Safely reduce squareSize, ensuring it doesn't go negative
				const newSquareSize = Math.max(0, this.squareSize - pelletSize * pelletSize);
				this.squareSize = newSquareSize;
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
		// Ensure size is valid before spawning
		if (!Number.isFinite(this.size) || this.size <= 0) {
			const defaultSize = 149; // fallback if settings are corrupted
			this.size = this.world.settings?.mothercellSize || defaultSize;
		}
		
		const angle = Math.random() * 2 * Math.PI;
		const x = this.x + this.size * Math.sin(angle);
		const y = this.y + this.size * Math.cos(angle);
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

	// Override size setter to enforce maximum size limit
	set size(value) {
		// Ensure value is a valid number and not NaN
		const defaultSize = 149; // fallback if settings are corrupted
		const defaultMaxSize = 1500; // fallback if settings are corrupted
		const safeValue = Number.isFinite(value) ? value : (this.world.settings?.mothercellSize || defaultSize);
		const maxSize = this.world.settings?.mothercellMaxSize || defaultMaxSize;
		const limitedValue = Math.min(safeValue, maxSize);
		super.size = limitedValue;
	}

	// Override squareSize setter to enforce maximum size limit
	set squareSize(value) {
		// Ensure value is not negative to prevent NaN from Math.sqrt
		const safeValue = Math.max(0, value);
		const defaultMaxSize = 1500; // fallback if settings are corrupted
		const maxSize = this.world.settings?.mothercellMaxSize || defaultMaxSize;
		const limitedSize = Math.min(Math.sqrt(safeValue), maxSize);
		this.size = limitedSize;
	}

	// Override mass setter to enforce maximum size limit
	set mass(value) {
		// Ensure value is not negative to prevent NaN from Math.sqrt
		const safeValue = Math.max(0, value);
		const defaultMaxSize = 1500; // fallback if settings are corrupted
		const maxSize = this.world.settings?.mothercellMaxSize || defaultMaxSize;
		const limitedSize = Math.min(Math.sqrt(100 * safeValue), maxSize);
		this.size = limitedSize;
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