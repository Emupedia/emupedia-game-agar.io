const { throwIfBadNumber, throwIfBadOrNegativeNumber } = require("../primitives/Misc");

/** @abstract */
class Cell {
	/**
	 * @param {World} world
	 * @param {number} x
	 * @param {number} y
	 * @param {number} size
	 * @param {number} color
	 */
	constructor(world, x, y, size, color) {
		this.world = world;

		this.id = world.nextCellId;
		this.birthTick = world.handle.tick;
		this.exists = false;
		/** @type {Cell} */
		this.eatenBy = null;
		/** @type {Rect} */
		this.range = null;
		this.isBoosting = false;
		/** @type {Boost} */
		this.boost = { dx: 0, dy: 0, d: 0 };

		/** @type {Player} */
		this.owner = null;

		this.x = x;
		this.y = y;
		this.size = size;
		this.color = color;
		this.name = null;
		this.skin = null;

		this.posChanged = this.sizeChanged = this.colorChanged = this.nameChanged = this.skinChanged = false;
	}

	/**
	 * @abstract
	 * @returns {number}
	 */
	get type() {
		throw new Error("Must be overriden");
	}

	/**
	 * @abstract
	 * @returns {boolean}
	 */
	get isSpiked() {
		throw new Error("Must be overriden");
	}

	/**
	 * @abstract
	 * @returns {boolean}
	 */
	get isAgitated() {
		throw new Error("Must be overriden");
	}

	/**
	 * @abstract
	 * @returns {boolean}
	 */
	get avoidWhenSpawning() {
		throw new Error("Must be overriden");
	}

	/**
	 * @virtual
	 */
	get shouldUpdate() {
		return this.posChanged || this.sizeChanged || this.colorChanged || this.nameChanged || this.skinChanged;
	}

	get age() {
		return (this.world.handle.tick - this.birthTick) * this.world.handle.stepMult;
	}

	/** @type {number} */
	get x() {
		return this._x;
	}

	/** @type {number} */
	get y() {
		return this._y;
	}

	set x(value) {
		throwIfBadNumber(value);
		this._x = value;
		this.posChanged = true;
	}

	set y(value) {
		throwIfBadNumber(value);
		this._y = value;
		this.posChanged = true;
	}

	/** @type {number} */
	get size() {
		return this._size;
	}

	set size(value) {
		// Special handling for mothercells to prevent NaN and enforce size limits
		if (this.type === 4) { // Mothercell type
			// Ensure value is a valid number and not NaN
			if (!Number.isFinite(value) || value < 0) {
				value = 149; // Default mothercell size
			}
			// Enforce maximum size limit for mothercells
			const maxSize = (this.world && this.world.settings && parseInt(this.world.settings.mothercellMaxSize)) || 1500;
			value = Math.min(value, maxSize);
		}
		
		throwIfBadOrNegativeNumber(value);
		this._size = value;
		this.sizeChanged = true;
	}

	/** @type {number} */
	get squareSize() {
		return this.size * this.size;
	}

	set squareSize(value) {
		// Special handling for mothercells to prevent NaN from negative squareSize
		if (this.type === 4) { // Mothercell type
			// Ensure value is not negative to prevent NaN from Math.sqrt
			const safeValue = Math.max(0, value);
			this.size = Math.sqrt(safeValue);
		} else {
			this.size = Math.sqrt(value);
		}
	}

	/** @type {number} */
	get mass() {
		return this.size * this.size / 100;
	}

	set mass(value) {
		// Special handling for mothercells to prevent NaN from negative mass
		if (this.type === 4) { // Mothercell type
			// Ensure value is not negative to prevent NaN from Math.sqrt
			const safeValue = Math.max(0, value);
			this.size = Math.sqrt(100 * safeValue);
		} else {
			this.size = Math.sqrt(100 * value);
		}
	}

	/** @type {number} */
	get color() {
		return this._color;
	}

	set color(value) {
		this._color = value;
		this.colorChanged = true;
	}

	/** @type {string} */
	get name() {
		return this._name;
	}

	set name(value) {
		this._name = value;
		this.nameChanged = true;
	}

	/** @type {string} */
	get skin() {
		return this._skin;
	}

	set skin(value) {
		this._skin = value;
		this.skinChanged = true;
	}

	/**
	 * @param {Cell} other
	 * @returns {CellEatResult}
	 */
	getEatResult(other) {
		throw new Error("Must be overriden");
	}

	/**
	 * @virtual
	 */
	onSpawned() {}

	/**
	 * @virtual
	 */
	onTick() {
		this.posChanged = this.sizeChanged = this.colorChanged = this.nameChanged = this.skinChanged = false;
	}

	/**
	 * @param {Cell} other
	 * @virtual
	 */
	whenAte(other) {
		this.squareSize += other.squareSize;
	}

	/**
	 * @param {Cell} other
	 * @virtual
	 */
	whenEatenBy(other) {
		this.eatenBy = other;
	}

	/**
	 * @virtual
	 */
	onRemoved() {}
}

module.exports = Cell;