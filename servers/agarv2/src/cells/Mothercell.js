const Cell = require("./Cell");
const Pellet = require("./Pellet");

// Minimum ticks between two oversize reports for the same mothercell. A cell
// that is being fed clamps on every absorption, so reporting each one would
// bury the log at the server tick rate.
const OVERSIZE_LOG_INTERVAL = 100;

// Indexed by Cell#type, for readable oversize reports.
const CELL_TYPE_NAMES = ["player cell", "pellet", "virus", "ejected mass", "mothercell"];

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

		this.oversizeClamps = 0;
		this.oversizePeak = 0;
		this.lastOversizeLogTick = 0;
		/** @type {string} */
		this.lastFed = null;
		this.lastFedTick = 0;
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

	// A subclass that defines only a setter shadows the inherited accessor in
	// JavaScript. Keep the Cell getters visible so mother cells are sent with
	// their real size instead of `undefined` (which the protocol encodes as 0).
	get size() {
		return super.size;
	}

	set size(value) {
		if (!Number.isFinite(value) || value < 0) {
			value = 149;
		}
		// Enforce maximum size limit for mothercells
		const maxSize = (this.world && this.world.settings && this.world.settings.mothercellMaxSize) || 1500;

		if (value > maxSize) {
			this.reportOversize(value, maxSize);
		}

		super.size = Math.min(value, maxSize);
	}

	get squareSize() {
		return super.squareSize;
	}

	set squareSize(value) {
		this.size = Math.sqrt(Math.max(0, value));
	}

	get mass() {
		return super.mass;
	}

	set mass(value) {
		this.size = Math.sqrt(100 * Math.max(0, value));
	}

	/**
	 * Snapshots what was just absorbed, as a plain string. Deliberately keeps no
	 * reference to the cell: resolveEatCheck removes it immediately after
	 * whenAte returns, and holding it would keep dead cells alive.
	 * @param {Cell} cell
	 * @returns {string}
	 */
	describeFedCell(cell) {
		if (!cell) {
			return "unknown";
		}

		const type = CELL_TYPE_NAMES[cell.type] || `type ${cell.type}`;
		const size = Number.isFinite(cell.size) ? Math.round(cell.size) : cell.size;
		const owner = cell.owner;

		if (owner) {
			return `${type} (size ${size}) from player ${owner.id} "${owner.leaderboardName || owner.cellName || "unnamed"}"`;
		}

		// Viruses are world-spawned and have no owner, but Virus#whenAte records
		// whoever pushed them last - which is the attribution that matters when
		// players steer viruses into a mothercell to inflate it.
		const pusher = cell.lastFedBy;

		if (pusher) {
			return `${type} (size ${size}) last pushed by player ${pusher.id} "${pusher.name}"`;
		}

		return `${type} (size ${size}, unattributed)`;
	}

	/**
	 * Reports writes that had to be clamped to mothercellMaxSize. The cell can
	 * never actually exceed the cap, so what this measures is feeding pressure:
	 * a steady stream of clamps means players are pushing viruses or ejected
	 * mass into this mothercell and holding it pinned at its ceiling.
	 * @param {number} value size that was requested, before clamping
	 * @param {number} maxSize the cap it was clamped to
	 */
	reportOversize(value, maxSize) {
		this.oversizeClamps = (this.oversizeClamps || 0) + 1;
		this.oversizePeak = Math.max(this.oversizePeak || 0, value);

		if (!this.world || !this.world.handle) {
			return;
		}

		const tick = this.world.handle.tick;

		if (this.lastOversizeLogTick !== 0 && tick - this.lastOversizeLogTick < OVERSIZE_LOG_INTERVAL) {
			return;
		}

		this.world.handle.logger.inform(
			"Mothercell %s hit its size cap %s time(s) since tick %s: peak requested size %s, capped at %s (x=%s, y=%s); last fed %s at tick %s",
			this.id, this.oversizeClamps, this.lastOversizeLogTick, this.oversizePeak.toFixed(1), maxSize,
			Math.round(this.x), Math.round(this.y),
			this.lastFed || "nothing yet", this.lastFedTick
		);

		this.lastOversizeLogTick = tick;
		this.oversizeClamps = 0;
		this.oversizePeak = 0;
	}

	/**
	 * @param {Cell} other
	 * @returns {CellEatResult}
	 */
	getEatResult(other) {
		return 0;
	}

	onTick() {
		// Self-repair: corrupt size state
		if (isNaN(this.size) || !isFinite(this.size)) {
			this.world.handle.logger.onFatal("Mothercell %s has corrupt size: %s. Resetting to 149.", this.id, this.size);
			this.size = 149;
		}

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
			this.world.handle.logger.onFatal("Mothercell has invalid state: x=%s, y=%s, size=%s, id=%s", this.x, this.y, this.size, this.id);
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
			this.world.handle.logger.onFatal("Calculated NaN pellet coordinates: x=%s, y=%s, mothercell: x=%s, y=%s, size=%s, angle=%s", x, y, this.x, this.y, this.size, angle);
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
		// Recorded before the growth: super.whenAte() is what triggers the
		// clamped write, and reportOversize() reads this off the instance.
		this.lastFed = this.describeFedCell(cell);
		this.lastFedTick = this.world.handle.tick;

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