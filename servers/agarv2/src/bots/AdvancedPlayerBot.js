const Bot = require("./Bot.js");

class AdvancedPlayerBot extends Bot {

	/**
	 * @param {World} world
	 */
	constructor(world) {
		super(world);
		this.world = world;
		this.splitCooldownTicks = 0;
		this.splitAttempts = 0;
		this.target = null;
		this.ejectCooldownTicks = 0;

		// Memory system
		this.memory = {
			threats: new Map(),
			opportunities: new Map(),
			playerPatterns: new Map()
		};
		this.hookedCells = new WeakSet();
		this.lastVisibleCells = {};

		// Flat state
		this.strategyMode = "balanced";
		this.strategyRiskTolerance = 0.5;

		this.selfFeedCooldown = 0;
		this.fakeWeaknessActive = false;
		this.lastJitterTick = 0;

		this.chatCooldown = 0;
		this.killStreak = 0;

		this.virusShots = new Map();
		this.lastMergeTicks = 0;

		// GC Pressure Reduction: Permanent context pool
		this._ctx = {
			currentTick: 0, settings: null, largest: null, border: null, eatMult: 1.14017,
			invLargestSize: 0, truncatedInf: 0, totalMass: 0, cellCount: 0, allCanMerge: true,
			viewDims: { w: 1000, h: 1000 },
			visibleEnemies: [],
			tCount: 0, oCount: 0, closestThreat: null,
			bestOpportunityCell: null, bestOpportunityDistSq: Infinity,
			bestPelletCell: null, bestPelletDistSq: Infinity,
			bestMotherCellCell: null, bestMotherCellDistSq: Infinity,
			incomingSplit: null,
			nearThreats: [], nearViruses: [], nearTeammates: [],
			enemyPops: [],
			infX: 0, infY: 0,
			enemyDataPool: [], enemyDataIdx: 0,
			virusDataPool: [], virusDataIdx: 0,
			bestEjectedCell: null, bestEjectedDistSq: Infinity,
			bestVirusCell: null, bestVirusDistSq: Infinity
		};

		// Mock protocol for ChatChannel compatibility
		this.protocol = {
			onChatMessage: (source, msg) => { /* Bot ignores chat feedback */ }
		};
	}

	static get type() {
		return "playerbot";
	}

	static get separateInTeams() {
		return true;
	}

	get shouldClose() {
		return !this.hasPlayer || !this.player.exists || !this.player.hasWorld;
	}

	/**
	 * Send a chat message to the server
	 * @param {string} message
	 */
	sendChat(message) {
		if (this.listener && this.listener.globalChat) {
			this.listener.globalChat.broadcast(this, message);
		}
	}

	canEat(aSize, bSize, eatMult) {
		return aSize >= bSize * eatMult;
	}

	_getValidBorder(player) {
		if (!player.world || !player.world.border) return null;
		const border = player.world.border;
		if (isNaN(border.x) || isNaN(border.y) || isNaN(border.w) || isNaN(border.h)) return null;
		return border;
	}

	/**
	 * Helper: Return current settings
	 */
	_getSettings() {
		return this.listener && this.listener.handle ? this.listener.handle.settings : {};
	}

	/**
	 * Helper: Get largest cell for a player
	 */
	_getLargestCell(player) {
		let largest = null, cells = player.ownedCells;
		for (let i = 0, len = cells.length; i < len; i++) {
			const cell = cells[i]; if (!largest || cell.size > largest.size) largest = cell;
		}
		return largest;
	}

	updatePlayerPattern(ownerId, cell, player, tick) {
		const view = player.viewArea; if (!view || isNaN(view.x)) return;
		let pat = this.memory.playerPatterns.get(ownerId);
		if (!pat) {
			pat = { positions: [], lastSeen: tick, aggressionLevel: 0.5 };
			this.memory.playerPatterns.set(ownerId, pat);
		}
		pat.positions.push({ x: cell.x, y: cell.y, tick: tick });
		if (pat.positions.length > 20) pat.positions.shift();
		pat.lastSeen = tick;

		if (pat.positions.length >= 2) {
			const prev = pat.positions[pat.positions.length - 2];
			const viewArea = player.viewArea;
			if (viewArea && !isNaN(viewArea.x) && !isNaN(viewArea.y)) {
				const dxP = prev.x - viewArea.x, dyP = prev.y - viewArea.y, dSqP = dxP * dxP + dyP * dyP;
				const dxC = cell.x - viewArea.x, dyC = cell.y - viewArea.y, dSqC = dxC * dxC + dyC * dyC;
				if (!isNaN(dSqC) && !isNaN(dSqP)) {
					if (dSqC < dSqP) pat.aggressionLevel = Math.min(1.0, pat.aggressionLevel + 0.05);
					else pat.aggressionLevel = Math.max(0, pat.aggressionLevel - 0.02);
				}
			}
		}
	}

	/**
	 * Helper: Calculate border distance from cell
	 */
	_getBorderDistance(cell, border) {
		const r = cell.size / 2; // Pass 3 Fix: Account for server Half-Radius rigid bounce
		return Math.min(
			Math.abs(cell.x - (border.x - border.w)) - r,
			Math.abs(cell.x - (border.x + border.w)) - r,
			Math.abs(cell.y - (border.y - border.h)) - r,
			Math.abs(cell.y - (border.y + border.h)) - r
		);
	}

	_setMousePosition(x, y) {
		this.mouseX = x;
		this.mouseY = y;
	}

	_clampToBorder(value, borderMin, borderMax, r = 0) {
		// Elite: Account for size/2 wall clipping found in World.js:600
		return Math.max(borderMin + r / 2, Math.min(borderMax - r / 2, value));
	}

	_getOwnerId(cell) {
		return cell && cell.owner && cell.owner.id ? cell.owner.id : null;
	}

	_leaderboardName(cell) {
		if (!cell || !cell.owner) return "An unnamed cell";
		const n = cell.owner.leaderboardName;
		return (typeof n === 'string' && n.length > 0 && n !== "An unnamed cell") ? n : "An unnamed cell";
	}

	update() {
		const handle = this.listener && this.listener.handle;
		if (!handle) return;
		const currentTick = handle.tick;
		const settings = this._getSettings(); // Ensure cached

		// 0. Update Cooldowns and Memory Decay
		if (this.splitCooldownTicks > 0) this.splitCooldownTicks--;
		// Fix Phase 16: Persistent Tactical Targets
		// Coordinate-based targets lack 'exists'/'size', so we use a flag to preserve them.
		if (this.target && !this.targetIsTactical && (!this.target.exists || !this.target.size)) {
			this.target = null;
		}

		if (this.ejectCooldownTicks > 0) this.ejectCooldownTicks--;
		this.updateMemoryDecay(currentTick);

		if (this.chatCooldown > 0) this.chatCooldown--;

		// 0.5 Pass 3 Fix: Clearing Target Visibility (Escape Tunnel Vision)
		if (this.target && this.player.visibleCells && !this.player.visibleCells[this.target.id]) {
			this.target = null;
		}


		// 1. Spawning and Persistence
		const player = this.player;
		if (player.state === -1) {
			this._handleSpawning();
			return;
		}

		const largest = this._getLargestCell(player);
		if (!largest) return;

		const ctx = this._prepareTickContext(player, largest, currentTick, settings, handle);

		// 2. Emergency Dodge
		if (this._handleEmergencyDodge(largest, player, ctx)) return;

		// 3. Logic: Pop-split preparation
		this._handlePopSplitPrep(player, ctx);

		// 4. Critical: Cornered Escape
		if (this.isCornered(largest, player, ctx)) {
			this.handleEscape(largest, player, ctx);
			return;
		}

		// 5. Multi-cell coordination: Self-feeding
		if (this.selfFeedCooldown <= 0 && this.shouldSelfFeed(player, ctx)) {
			this.performSelfFeed(player, largest);
			this.selfFeedCooldown = 10;
		}
		if (this.selfFeedCooldown > 0) this.selfFeedCooldown--;

		// 6. Tactical Phases (Priority Engine)
		const action = this._evaluateTacticalAction(largest, player, ctx);
		ctx.tacticalAction = action; // Phase 17: Cache for performance
		this.targetIsTactical = false; 
		this.strategyFixed = false;   

		if (action) {
			if (action.type === "eject" && this.ejectCooldownTicks <= 0) {
				this._setMousePosition(action.x, action.y);
				this.ejectCooldownTicks = Math.max(1, settings.playerEjectDelay || 2);
				this.attemptEject();
			}
			this.target = action; 
			this.targetIsTactical = true; 
			this.strategyFixed = true;    
		}

		// 6.5 Speed Splitting (Mobility)
		if (ctx.cellCount < settings.playerMaxCells && !ctx.closestThreat && this.splitCooldownTicks <= 0 && this.target) {
			const distSq = (this.target.x - largest.x) ** 2 + (this.target.y - largest.y) ** 2;
			let nearV = false, vs = ctx.nearViruses, limit = (largest.size * 3) ** 2;
			for (let i = 0, len = vs.length; i < len; i++) { if (vs[i].distSq < limit) { nearV = true; break; } }
			if (distSq > (largest.size * 8) ** 2 && !nearV && largest.mass > 600) {
				this.splitAttempts++; this.splitCooldownTicks = 10;
				this.attemptSplit();
			}
		}

		// 7. Final Targeting & Movement
		this._handleTargetingAndMovement(largest, player, ctx);
	}

	/**
	 * Optimized: Handle spawning logic
	 */
	_handleSpawning() {
		const settings = this._getSettings();
		const names = settings.worldPlayerBotNames;
		const skins = settings.worldPlayerBotSkins;
		/** @type {string} */
		this.spawningName = (names && names.length > 0) ? names[~~(Math.random() * names.length)] : "Player bot";

		if (this.spawningName.indexOf("<*>") !== -1 && skins && skins.length > 0) {
			const skin = skins[~~(Math.random() * skins.length)];
			this.spawningName = this.spawningName.replace(/<\*>/g, `<${skin}>`);
		} else if (skins && skins.length > 0 && this.spawningName.indexOf("<") !== 0) {
			// Fix: Force apply a skin if one is valid and name doesn't already have one (e.g. static "EmuBot")
			const skin = skins[~~(Math.random() * skins.length)];
			this.spawningName = `<${skin}>${this.spawningName}`;
		}

		// Reset state for new life
		this.killStreak = 0;
		this.chatCooldown = 0;
		this.lastMergeTicks = 0;
		this.virusShots.clear();
		this.target = null;

		this.onSpawnRequest();
		this.spawningName = null;
	}

	_prepareTickContext(player, largest, currentTick, settings, handle) {
		const ctx = this._ctx, viewArea = player.viewArea || {}, stepMult = handle.stepMult || 1;
		const border = this._getValidBorder(player), cellSize = largest.size;
		const invSize = cellSize > 0 ? 1 / cellSize : 0, tacticalRangeSq = (cellSize * 10) ** 2;
		const eatMult = settings.worldEatMult || 1.140175425;

		// 1. Reset Context Pooled State
		ctx.currentTick = currentTick; ctx.settings = settings; ctx.largest = largest; ctx.border = border;
		ctx.eatMult = eatMult; ctx.invLargestSize = invSize; ctx.totalMass = 0;
		ctx.cellCount = player.ownedCells.length; ctx.allCanMerge = true;
		ctx.viewDims.w = viewArea.w || 1000; ctx.viewDims.h = viewArea.h || 1000;
		ctx.truncatedInf = cellSize > 0 ? Math.max(0.1, Math.log10(cellSize * cellSize)) : 0;
		ctx.tCount = 0; ctx.oCount = 0; ctx.closestThreat = null; ctx.incomingSplit = null;
		ctx.bestOpportunityCell = null; ctx.bestOpportunityDistSq = Infinity;
		ctx.bestPelletCell = null; ctx.bestPelletDistSq = Infinity;
		ctx.bestMotherCellCell = null; ctx.bestMotherCellDistSq = Infinity;
		ctx.bestEjectedCell = null; ctx.bestEjectedDistSq = Infinity;
		ctx.bestVirusCell = null; ctx.bestVirusDistSq = Infinity;
		ctx.infX = 0; ctx.infY = 0;
		ctx.stepMult = handle.stepMult || 1;
		ctx.moveMult = settings.playerMoveMult || 1;
		ctx.isSuspected = player.world && player.world.antiTeaming && player.world.antiTeaming.isPlayerSuspected(player.id);

		// Clear pooled arrays (reuse capacity)
		ctx.visibleEnemies.length = 0;
		ctx.nearThreats.length = 0; ctx.nearViruses.length = 0; ctx.nearTeammates.length = 0; ctx.enemyPops.length = 0;
		ctx.enemyDataIdx = 0; ctx.virusDataIdx = 0;

		// Elite: Lite visibleCells swap (Optimization: single pass over data)
		// Fix: Store previous cells in this.lastVisibleCells for correct velocity tracking
		this.lastVisibleCells = { ...player.visibleCells };
		if (player.visibleCells) {
			for (const id in player.visibleCells) delete player.visibleCells[id];
		} else {
			player.visibleCells = {};
		}
		const visibleCells = player.visibleCells;

		this.lastMergeTicks = 999;
		const owned = player.ownedCells;
		for (let i = 0, len = owned.length; i < len; i++) {
			const c = owned[i]; ctx.totalMass += (c.mass || 0);
			visibleCells[c.id] = c;
			const mergeInfo = this.canCellMerge(c, settings, currentTick, stepMult);
			if (ctx.allCanMerge && !mergeInfo.canMerge) ctx.allCanMerge = false;
			if (mergeInfo.canMerge) this.lastMergeTicks = 0;
			else if (mergeInfo.ticksToMerge > 0 && mergeInfo.ticksToMerge < this.lastMergeTicks) this.lastMergeTicks = mergeInfo.ticksToMerge;
		}

		const threatsMemory = this.memory.threats, oppMemory = this.memory.opportunities;
		const lastVisible = this.lastVisibleCells || {};
		const pMaxSq = settings.pelletMaxSize || 40, pMaxSqInv = 1 / pMaxSq;
		let enemyCount = 0, pelletCount = 0;
		let mx = 0, my = 0, tix = 0, tiy = 0, oix = 0, oiy = 0;

		this.world.finder.search(player.viewArea, (cell) => {
			if (!cell || cell.id === undefined) return;
			const dx = cell.x - largest.x, dy = cell.y - largest.y, distSq = dx * dx + dy * dy;
			const id = cell.id;

			if (cell.type === 0) {
				const isTeammate = player.team !== null && cell.owner && player.team === cell.owner.team;
				if (cell.owner && cell.owner.id && cell.owner.id !== player.id && !isTeammate) {
					let cellData = ctx.enemyDataPool[ctx.enemyDataIdx++];
					if (!cellData) { cellData = { cell: null, id: null, distSq: 0, dx: 0, dy: 0, _dist: -1 }; ctx.enemyDataPool.push(cellData); }
					cellData.cell = cell; cellData.id = id; cellData.distSq = distSq; cellData.dx = dx; cellData.dy = dy; cellData._dist = -1;

					ctx.visibleEnemies.push(cellData);
					this.updatePlayerPattern(cell.owner.id, cell, player, currentTick);

					const isThreat = this.canEat(cell.size, cellSize, eatMult);
					if (isThreat) {
						ctx.tCount++;
						const d = Math.sqrt(distSq); cellData._dist = d;
						if (!ctx.closestThreat || d < ctx.closestThreat._dist) ctx.closestThreat = cellData;
						if (distSq < tacticalRangeSq) ctx.nearThreats.push(cellData);
					} else if (this.canEat(cellSize, cell.size, eatMult)) {
						ctx.oCount++;
					}

					if (enemyCount < 50) {
						const dActual = cellData._dist > 0 ? cellData._dist : Math.sqrt(distSq);
						const invGap = 1 / Math.max(1, dActual - cellSize - cell.size);
						const s = invGap * invGap;
						if (isThreat) {
							const coeff = (ctx.truncatedInf * ctx.cellCount) * s;
							tix -= dx * coeff; tiy -= dy * coeff;
						} else if (this.canEat(cellSize, cell.size, eatMult)) {
							const coeff = ctx.truncatedInf * s;
							mx += dx * coeff; my += dy * coeff; oix += dx * coeff; oiy += dy * coeff;
						}
						enemyCount++;
					}

					visibleCells[id] = cell; // Populate visibleCells during the single search pass

					let memoryEntry = threatsMemory.get(id);
					if (!memoryEntry) {
						memoryEntry = { x: cell.x, y: cell.y, size: cell.size, lastSeen: currentTick, vx: 0, vy: 0, ownerId: cell.owner.id, threatLevel: 0 }; threatsMemory.set(id, memoryEntry);
					} else {
						const dt = Math.max(1, currentTick - memoryEntry.lastSeen), iDt = 1 / dt;
						// Elite Optimization: Sync with server boost physics for perfect velocity truth
						if (cell.isBoosting && cell.boost.d >= 1) {
							const bMag = cell.boost.d / 9 * ctx.stepMult;
							memoryEntry.vx = cell.boost.dx * bMag; memoryEntry.vy = cell.boost.dy * bMag;
						} else if (lastVisible[id]) {
							memoryEntry.vx = (cell.x - memoryEntry.x) * iDt; memoryEntry.vy = (cell.y - memoryEntry.y) * iDt;
						}
						memoryEntry.x = cell.x; memoryEntry.y = cell.y; memoryEntry.size = cell.size; memoryEntry.lastSeen = currentTick;
					}

					if (isThreat) {
						memoryEntry.threatLevel = cell.size * invSize;
						if (memoryEntry.threatLevel > 1.0) {
							const d = cellData._dist > 0 ? cellData._dist : Math.sqrt(distSq);
							if (memoryEntry.vx * -dx + memoryEntry.vy * -dy > 0.5 * d) {
								const sDist = (settings.playerSplitDistance || 40) + (settings.playerSplitBoost || 780) / 9;
								let herding = (border && this._getBorderDistance({ x: largest.x + (-dx / d) * cellSize * 5, y: largest.y + (-dy / d) * cellSize * 5 }, border) < cellSize * 2) ? 0.8 : 0;
								if (d < (sDist + cell.size / (settings.playerSplitSizeDiv || 1.414)) * (1.8 + herding * 0.5)) {
									if (!ctx.incomingSplit || d < ctx.incomingSplit.d) ctx.incomingSplit = { ...memoryEntry, dx: -dx, dy: -dy, d };
								}
							}
						}
					} else if (this.canEat(cellSize, cell.size, eatMult)) {
						memoryEntry.value = cell.size;
						if (!oppMemory.has(id)) oppMemory.set(id, memoryEntry);
					}
				} else if (isTeammate && cell.owner && cell.owner.id !== player.id) {
					let cellData = ctx.enemyDataPool[ctx.enemyDataIdx++];
					if (!cellData) { cellData = { cell: null, id: null, distSq: 0, dx: 0, dy: 0, _dist: -1 }; ctx.enemyDataPool.push(cellData); }
					cellData.cell = cell; cellData.id = id; cellData.distSq = distSq; cellData.dx = dx; cellData.dy = dy; cellData._dist = -1;
					if (distSq < tacticalRangeSq) ctx.nearTeammates.push(cellData);
				}
				if (cell.size > (settings.playerMaxSize || 1500) * 0.95) ctx.enemyPops.push({ cell, distSq, dx, dy });
			}
			else if (cell.type === 1) {
				visibleCells[id] = cell;
				const valSq = (cell.size * cell.size) / Math.max(1, distSq);
				const bestValSq = ctx.bestPelletCell ? (ctx.bestPelletCell.size * ctx.bestPelletCell.size) / Math.max(1, ctx.bestPelletDistSq) : -1;
				if (valSq > bestValSq) { ctx.bestPelletCell = cell; ctx.bestPelletDistSq = distSq; }
				if (pelletCount < 20 && distSq < (cellSize * 5) ** 2) {
					// Fix Phase 13/15: Pellet Suppression & Recycling Priority
					// Once large enough (>300 mass), ignore pellets if a virus is visible
					// BUT always prioritize Ejected Mass (Type 3) for recycling.
					let pWeight = 1;
					if (ctx.totalMass > 300 && ctx.bestVirusCell) pWeight = 0.1;

					const invGap = 1 / Math.max(1, Math.sqrt(distSq) - cellSize - cell.size);
					const contribution = (1 + cell.size * pMaxSqInv) * invGap * invGap * pWeight;
					mx += dx * contribution; my += dy * contribution; pelletCount++;
				}
			} else if (cell.type === 2) {
				visibleCells[id] = cell;
				let vData = ctx.virusDataPool[ctx.virusDataIdx++];
				if (!vData) { vData = { cell: null, distSq: 0, dx: 0, dy: 0 }; ctx.virusDataPool.push(vData); }
				vData.cell = cell; vData.distSq = distSq; vData.dx = dx; vData.dy = dy;

				if (distSq < tacticalRangeSq) ctx.nearViruses.push(vData);
				
				const canEatV = this.canEat(cellSize, cell.size, eatMult);

				// Track best virus for targeting (strictly edible now to prevent circling)
				if (canEatV && distSq < ctx.bestVirusDistSq) { ctx.bestVirusCell = cell; ctx.bestVirusDistSq = distSq; }

				const invGap = 1 / Math.max(1, Math.sqrt(distSq) - cellSize - cell.size);
				// Elite: Attraction to viruses when strictly edible.
				// If not edible, we MUST repel to prevent the bot from sitting on it or circling it.
				let inf = 0;
				if (canEatV) {
					inf = ctx.cellCount >= settings.playerMaxCells ? ctx.truncatedInf * 15 : (ctx.tCount > 0 ? ctx.truncatedInf : ctx.truncatedInf * 5);
				} else {
					// Nudge away from non-edible viruses to avoid unintentional collision
					inf = -1; 
				}
				const contribution = inf * invGap * invGap;
				mx += dx * contribution; my += dy * contribution;
			} else if (cell.type === 3) {
				visibleCells[id] = cell;
				// Phase 4: Track Ejected Mass for Cleanup
				const valSq = (cell.size * cell.size) / Math.max(1, distSq);
				const bestValSq = ctx.bestEjectedCell ? (ctx.bestEjectedCell.size * ctx.bestEjectedCell.size) / Math.max(1, ctx.bestEjectedDistSq) : -1;
				if (valSq > bestValSq) { ctx.bestEjectedCell = cell; ctx.bestEjectedDistSq = distSq; }
				
				// Strong attraction to ejected mass (recover bait)
				// Higher weight than pellets (size * 10)
				const invGap = 1 / Math.max(1, Math.sqrt(distSq) - cellSize - cell.size);
				const contribution = (10 + cell.size * pMaxSqInv * 5) * invGap * invGap;
				mx += dx * contribution; my += dy * contribution;
			} else if (cell.type === 4) {
				visibleCells[id] = cell;
				if (this.canEat(cellSize, cell.size, eatMult) && (!ctx.bestMotherCellCell || distSq < ctx.bestMotherCellDistSq)) {
					ctx.bestMotherCellCell = cell; ctx.bestMotherCellDistSq = distSq;
				}
			}
		});

		const tw = Math.max(0.1, 1 + (1 - Math.max(1, cellSize * 0.005)) * 2);
		ctx.infX = mx + tix * tw + oix; ctx.infY = my + tiy * tw + oiy;

		// Phase 9: Border Repulsion & Idle Drift
		if (border) {
			const bXmin = border.x - border.w, bXmax = border.x + border.w;
			const bYmin = border.y - border.h, bYmax = border.y + border.h;
			const margin = cellSize * 3;
			
			// Strong repulsion when near wall
			if (largest.x - bXmin < margin) ctx.infX += (1 - (largest.x - bXmin) / margin) * 10;
			if (bXmax - largest.x < margin) ctx.infX -= (1 - (bXmax - largest.x) / margin) * 10;
			if (largest.y - bYmin < margin) ctx.infY += (1 - (largest.y - bYmin) / margin) * 10;
			if (bYmax - largest.y < margin) ctx.infY -= (1 - (bYmax - largest.y) / margin) * 10;
		}

		// Idle Drift: If total influence is negligible, drift towards center to avoid freezing
		if (Math.abs(ctx.infX) < 0.01 && Math.abs(ctx.infY) < 0.01) {
			ctx.infX = (border ? border.x : 0) - largest.x;
			ctx.infY = (border ? border.y : 0) - largest.y;
		}

		this.updateStrategy(largest, player, ctx);
		return ctx;
	}

	/**
	 * Optimized: Handle emergency dodging
	 */
	_handleEmergencyDodge(largest, player, ctx) {
		const threat = ctx.incomingSplit;
		if (!threat) return false;

		const { dx, dy, d } = threat;
		if (d > 0) {
			const invD = 1 / d;
			let targetX = largest.x + (dx * invD) * ctx.viewDims.w;
			let targetY = largest.y + (dy * invD) * ctx.viewDims.h;

			const border = this._getValidBorder(player);
			if (border) {
				const bDist = Math.min(Math.abs(largest.x - (border.x - border.w)), Math.abs(largest.x - (border.x + border.w)), Math.abs(largest.y - (border.y - border.h)), Math.abs(largest.y - (border.y + border.h)));
				if (bDist < largest.size * 1.5 && largest.isBoosting) {
					targetX = dx > 0 ? border.x + border.w : border.x - border.w;
					targetY = dy > 0 ? border.y + border.h : border.y - border.h;
				}
			}

			this._setMousePosition(targetX, targetY);
			if (d < largest.size * 2 && this.splitCooldownTicks <= 0 && ctx.cellCount < ctx.settings.playerMaxCells) {
				this.splitCooldownTicks = 15;
				this.attemptSplit();
			}
			return true;
		}

		return false;
	}

	_handlePopSplitPrep(player, ctx) {
		// Optimization: With fast merge (playerMergeTime: 1), aggressive mode is safe even with 1.5x mass
		if (player.ownedCells.length > 1 && ctx.allCanMerge && this.strategyMode !== "merge") {
			this.strategyMode = "aggressive";
			this.strategyRiskTolerance = 1.0; // Max risk with fast merge
		}

		// Elite: Pop-Split Surprise Detection
		if (player.ownedCells.length === 1) {
			const cell = player.ownedCells[0], eatMult = ctx.eatMult;
			const enemies = ctx.visibleEnemies;
			for (let i = 0, len = enemies.length; i < len; i++) {
				const e = enemies[i];
				if (e.distSq < cell.size * cell.size && this.canEat(e.cell.size, cell.size * 0.5, eatMult)) {
					const virusSafeRangeSq = (cell.size * 1.5) ** 2;
					const viruses = ctx.nearViruses;
					for (let j = 0, vLen = viruses.length; j < vLen; j++) {
						const v = viruses[j];
						const vdx = cell.x - v.cell.x, vdy = cell.y - v.cell.y;
						if ((vdx * vdx + vdy * vdy) < virusSafeRangeSq) {
							this.strategyMode = "aggressive";
							this.strategyRiskTolerance = 1.0;
							return;
						}
					}
				}
			}
		}
	}

	/**
	 * Optimized: Consolidated Targeting & Movement logic
	 */
	_handleTargetingAndMovement(largest, player, ctx) {
		// Fix Phase 17: Mouse Conflict Resolution
		// If we are specifically self-feeding (consolidating mass), do NOT overwrite the mouse
		// with a tactical target unless the target is of critical value.
		if (this.selfFeedCooldown > 8) return; 

		// Phase 3: Defensive Merge Protocol Priority
		if (this.strategyMode === "merge") {
			this.target = null; // Drop any previous targets
			
			// Elite: Active Regrouping during Merge (Phase 2 Refinement)
			// Move towards the geometric center of all cells to force stacking
			let comX = 0, comY = 0, totalM = 0;
			const owned = player.ownedCells;
			for (let i = 0; i < owned.length; i++) {
				const c = owned[i]; comX += c.x * c.mass; comY += c.y * c.mass; totalM += c.mass;
			}
			if (totalM > 0) {
				this._setMousePosition(comX / totalM, comY / totalM);
			} else {
				this._setMousePosition(largest.x, largest.y);
			}
			return;
		}

		const settings = ctx.settings;
		// 1. Existing Target validation & Re-evaluation
		if (this.target != null) {
			const eatMult = ctx.eatMult;
			if (!this.target.exists || !this.target.size || largest.size <= this.target.size * eatMult) {
				this.target = null;
			} else {
				// Dynamic Target Re-evaluation
				const currentScore = this.scoreTarget(largest, this.target, player, ctx, (largest.size * 6) ** 2);
				
				// If target is no longer desirable (e.g. protector moved nearby), drop it
				if (currentScore <= 0) {
					this.target = null;
				} else {
					const bestAvailable = this.selectBestTarget(largest, player, ctx);
					// Only switch if bestAvailable is a PLAYER cell (scoreable) and significantly better
					if (bestAvailable && bestAvailable.type === 0 && bestAvailable !== this.target) {
						const bestScore = this.scoreTarget(largest, bestAvailable, player, ctx, (largest.size * 6) ** 2);
						if (bestScore > currentScore * 1.5) this.target = bestAvailable;
					}

					const path = this.calculatePath(largest, this.target, player, ctx);
					this._setMousePosition(path.x, path.y);
					return;
				}
			}
		}

		// 2. Auto-split Scoop
		const splitCandidates = this.identifyAutoSplitCandidates(player, ctx);
		if (splitCandidates.length > 0) {
			this._setMousePosition(splitCandidates[0].x, splitCandidates[0].y);
			return;
		}

		// 3. Best Target Selection
		const bestTarget = this.selectBestTarget(largest, player, ctx);
		if (bestTarget !== null) {
			const scanRadiusSq = (largest.size * 6) ** 2;
			if (this.shouldAttemptSplitKill(largest, player, bestTarget, ctx, scanRadiusSq)) {
				this.target = bestTarget;
				this._setMousePosition(bestTarget.x, bestTarget.y);
				this.splitCooldownTicks = 25;
				this.attemptSplit();
			} else {
				const path = this.calculatePath(largest, bestTarget, player, ctx);
				this._setMousePosition(path.x, path.y);
			}
			return;
		}

		// 4. Default: Influence-based movement
		const invD = 1 / Math.max(1, Math.sqrt(ctx.infX * ctx.infX + ctx.infY * ctx.infY));

		let speedMult = 1.0;
		// Elite: Apply "Fake Weakness" deceleration
		if (this.fakeWeaknessActive) {
			speedMult = 0.4 + Math.random() * 0.2; // Move at 40-60% speed
		}

		// Elite: The Shield Maneuver (Defensive/Offensive Barrier)
		// Fix Phase 12: Only trigger if threat is close enough to warrant defensive shielding
		if (player.ownedCells.length > 1 && ctx.closestThreat && ctx.closestThreat._dist < largest.size * 3) {
			const threat = ctx.closestThreat.cell, dx = threat.x - largest.x, dy = threat.y - largest.y;
			const invD = 1 / Math.max(1, ctx.closestThreat._dist || Math.sqrt(ctx.closestThreat.distSq));
			const shieldDist = this.strategyMode === "defensive" ? -largest.size : largest.size * 0.8;
			this._setMousePosition(largest.x + (dx * invD) * shieldDist, largest.y + (dy * invD) * shieldDist);
			return;
		}

		// Elite: Pop-Split Execution
		if (this.strategyMode === "aggressive" && ctx.cellCount === 1) {
			const vRangeSq = (largest.size * 1.2) ** 2, viruses = ctx.nearViruses, eatMult = ctx.eatMult, enemies = ctx.visibleEnemies;
			for (let i = 0, len = viruses.length; i < len; i++) {
				const vData = viruses[i];
				if (vData.distSq < vRangeSq) {
					const virus = vData.cell;
					for (let j = 0, eLen = enemies.length; j < eLen; j++) {
						const e = enemies[j];
						if (e.distSq < largest.size * largest.size && this.canEat(e.cell.size, largest.size * 0.5, eatMult)) {
							this._setMousePosition(virus.x, virus.y);
							return;
						}
					}
				}
			}
		}

		// Elite: Active Regrouping (Phase 2)
		// If we are split into many pieces and safe, gently drift towards our geometric center to encourage merging
		if (ctx.cellCount > 4 && this.strategyMode !== "aggressive" && !ctx.closestThreat) {
			let comX = 0, comY = 0, totalM = 0;
			const owned = player.ownedCells;
			for (let i = 0; i < owned.length; i++) {
				const c = owned[i];
				comX += c.x * c.mass;
				comY += c.y * c.mass;
				totalM += c.mass;
			}
			if (totalM > 0) {
				comX /= totalM; comY /= totalM;
				const rDx = comX - largest.x, rDy = comY - largest.y;
				const rDist = Math.sqrt(rDx * rDx + rDy * rDy);
				if (rDist > largest.size) {
					// Add 20% bias towards center
					ctx.infX += (rDx / rDist) * 0.2;
					ctx.infY += (rDy / rDist) * 0.2;
					// Re-normalize influence if needed, but simple addition works as a bias
				}
			}
		}

		this._setMousePosition(
			largest.x + (ctx.infX * invD * ctx.viewDims.w) * speedMult,
			largest.y + (ctx.infY * invD * ctx.viewDims.h) * speedMult
		);
	}

	/**
	 * Optimized: Determine if bot should self-feed
	 */
	shouldSelfFeed(player, ctx) {
		if (ctx.cellCount < 2) return false;
		if (this.strategyMode === "merge") return true; // Force feed to merge
		
		// Fix Phase 14: Only self-feed if no immediate threat is ready to split-kill us
		if (ctx.closestThreat && ctx.closestThreat._dist < ctx.largest.size * 4) return false;
		
		const threshold = ctx.settings.playerMaxSize ? ctx.settings.playerMaxSize * 1.33 : 2000;
		return ctx.totalMass > threshold || (ctx.tCount > 0 && ctx.totalMass > 500);
	}

	/**
	 * Optimized: Consolidate mass into largest cell
	 */
	performSelfFeed(player, largest) {
		this._setMousePosition(largest.x, largest.y);
		const settings = this._getSettings();
		let smallCellMass = 0;
		for (const c of player.ownedCells) {
			if (c !== largest) smallCellMass += (c.mass || 0);
		}
		// Optimization: If ejectingLoss == ejectedSize (Zero-Loss), feed aggressively
		const loss = settings.ejectingLoss || 43, size = settings.ejectedSize || 38;
		const minFeed = (loss === size) ? 10 : 50;
		if (smallCellMass > minFeed && this.ejectCooldownTicks <= 0) {
			this.ejectCooldownTicks = settings.playerEjectDelay || 2;
			this.attemptEject();
		}
	}

	/**
	 * Optimized: Update bot strategy
	 */
	updateStrategy(cell, player, ctx) {
		const threatCount = ctx.tCount, opportunityCount = ctx.oCount, totalMass = ctx.totalMass;

		// Fix Phase 16: Respect Strategy Fixed flag from tactical modules
		if (this.strategyFixed) return;

		// Reset deceptive state and strategy mode
		this.fakeWeaknessActive = false;
		this.strategyMode = "balanced";

		// Note: Anti-Teaming and Teaming are disabled in this environment.
		// Previous "isSuspected" block removed for specialized FFA performance.

		if (threatCount === 0 && opportunityCount > 2 && totalMass > (ctx.settings.playerMaxSize || 1500) * 2) {
			this.strategyMode = "aggressive";
			this.strategyRiskTolerance = 0.8; // Higher baseline aggression
		} else if (ctx.tCount === 0 && ctx.bestVirusCell && ctx.totalMass < 5000) {
			// Phase 5: Virus Greed
			// If safe and small/medium, be aggressive about finding food (viruses)
			this.strategyRiskTolerance = 1.0; 
		} else if (ctx.closestThreat) {
			const threat = ctx.closestThreat, d = threat._dist;
			// Elite: "Fake Weakness" logic
			if (threatCount === 1 && d > cell.size * 3 && d < cell.size * 6) {
				this.fakeWeaknessActive = true;
				this.strategyMode = "deceptive";
				this.strategyRiskTolerance = 0.8;
				return;
			}
			if (totalMass > (ctx.settings.playerMaxSize || 1500)) {
				this.strategyMode = "aggressive";
				this.strategyRiskTolerance = 1.0;
				return;
			}

			// Phase 3/15: Consolidated Merge Protocol
			// If threat is bigger than our biggest cell, BUT our total mass allows us to win if merged...
			// OR if we are specifically in a merge-to-farm state
			if (ctx.cellCount > 1 && ((threat.cell.size > cell.size && totalMass > threat.cell.mass * 1.25) || this.strategyMode === "merge")) {
				const dist = threat._dist;
				// Only if we have some space to breathe (not instant death)
				if (dist > cell.size * 2) {
					this.strategyMode = "merge";
					this.strategyRiskTolerance = 0.1; // Extreme caution while merging
					return;
				}
			}

			if (this.lastMergeTicks < 25) {
				let nearT = false, es = ctx.visibleEnemies, eatMult = ctx.eatMult, limit = (cell.size * 2) ** 2;
				for (let i = 0, len = es.length; i < len; i++) {
					const e = es[i]; if (e.distSq < limit && this.canEat(cell.size * 1.5, e.cell.size, eatMult)) { nearT = true; break; }
				}
				if (nearT) { this.strategyMode = "deceptive"; this.strategyRiskTolerance = 1.0; }
			}

			// Herding Detection
			if (threatCount > 1) {
				let herdVecX = 0, herdVecY = 0, enemies = ctx.visibleEnemies, eatMult = ctx.eatMult;
				for (let i = 0, len = enemies.length; i < len; i++) {
					const t = enemies[i];
					if (this.canEat(t.cell.size, cell.size, eatMult)) {
						const d = t._dist >= 0 ? t._dist : Math.sqrt(t.distSq);
						herdVecX += t.dx / d; herdVecY += t.dy / d;
					}
				}
				this.strategyHerdingRisk = Math.sqrt(herdVecX * herdVecX + herdVecY * herdVecY) / threatCount;
				if (this.strategyHerdingRisk < 0.3) {
					this.strategyMode = "defensive";
					this.strategyRiskTolerance = 0.5;
				}
			} else if (this.strategyMode === "deceptive" && ctx.closestThreat && ctx.closestThreat._dist < cell.size * 2.5) {
				this.strategyMode = "defensive";
				this.strategyRiskTolerance = 0.2;
			}
		} else {
			this.strategyRiskTolerance = 0.5;
			this.strategyHerdingRisk = 0;
		}

		// Elite: Self-Split Vulnerability Adjustment
		// If we are split, we are vulnerable. Play safer.
		if (ctx.cellCount > 2 && this.strategyMode !== "defensive") {
			// Reduce aggression if we are fragmented to prioritize regrouping
			this.strategyRiskTolerance = Math.min(this.strategyRiskTolerance, 0.4);
		}
	}

	isCornered(cell, player, ctx) {
		const border = this._getValidBorder(player);
		if (!border) return false;
		const d = this._getBorderDistance(cell, border);
		return d < cell.size * 2 && ctx.tCount > 0;
	}

	_getBorderDistance(cell, border) {
		return Math.min(
			Math.abs(cell.x - (border.x - border.w)),
			Math.abs(cell.x - (border.x + border.w)),
			Math.abs(cell.y - (border.y - border.h)),
			Math.abs(cell.y - (border.y + border.h))
		);
	}

	/**
	 * Optimized: Cornered escape
	 */
	handleEscape(cell, player, ctx) {
		const escapeRoute = this.calculateEscapeRoute(cell, player, ctx);
		if (escapeRoute.splitAway && this.splitCooldownTicks <= 0 && ctx.cellCount < ctx.settings.playerMaxCells) {
			this._setMousePosition(escapeRoute.x, escapeRoute.y);
			this.splitCooldownTicks = 25;
			return;
		}
		this._setMousePosition(escapeRoute.x, escapeRoute.y);
	}

	/**
	 * Optimized: Escape route calculation
	 */
	calculateEscapeRoute(cell, player, ctx) {
		const border = this._getValidBorder(player);
		if (!border) return { x: cell.x, y: cell.y, splitAway: false };

		let threatX = 0, threatY = 0, count = 0, enemies = ctx.visibleEnemies;
		const threatRadius = cell.size * 5;

		for (let i = 0, len = enemies.length; i < len; i++) {
			const data = enemies[i];
			if (!this.canEat(data.cell.size, cell.size, ctx.eatMult)) continue;
			if (data.distSq < threatRadius * threatRadius) {
				const invDist = 1 / Math.max(1, data._dist || Math.sqrt(data.distSq));
				threatX += (data.cell.x - cell.x) * invDist;
				threatY += (data.cell.y - cell.y) * invDist;
				count++;
			}
		}

		let escapeX = cell.x, escapeY = cell.y;
		if (count > 0) {
			// Safety: Protect against divide-by-zero (though count>0 handles it, robustness is key)
			const invCount = 1 / Math.max(1, count);
			escapeX = cell.x - threatX * invCount * (cell.size * 3);
			escapeY = cell.y - threatY * invCount * (cell.size * 3);

			// Elite: Wall Sliding (Pro Escape)
			// If near a wall, adjust escape vector to slide along it
			const borderDist = this._getBorderDistance(cell, border);
			if (borderDist < cell.size * 2) {
				const nearMinX = Math.abs(cell.x - (border.x - border.w)) < cell.size * 2;
				const nearMaxX = Math.abs(cell.x - (border.x + border.w)) < cell.size * 2;
				const nearMinY = Math.abs(cell.y - (border.y - border.h)) < cell.size * 2;
				const nearMaxY = Math.abs(cell.y - (border.y + border.h)) < cell.size * 2;

				if (nearMinX || nearMaxX) escapeX = cell.x; // Stop trying to push through the wall
				if (nearMinY || nearMaxY) escapeY = cell.y; // Stop trying to push through the wall

				// Aim tangentially
				if (nearMinX || nearMaxX) escapeY += (escapeY > cell.y ? cell.size : -cell.size);
				if (nearMinY || nearMaxY) escapeX += (escapeX > cell.x ? cell.size : -cell.size);
			}
		}

		return {
			x: this._clampToBorder(escapeX, border.x - border.w, border.x + border.w, cell.size),
			y: this._clampToBorder(escapeY, border.y - border.h, border.y + border.h, cell.size),
			splitAway: count > 1 && ctx.cellCount < ctx.settings.playerMaxCells / 2
		};
	}

	calculatePath(cell, target, player, ctx) {
		const dx = target.x - cell.x, dy = target.y - cell.y;
		const distSq = dx * dx + dy * dy;
		if (distSq === 0) return target;
		const invDist = 1 / Math.sqrt(distSq);
		let bx = dx * invDist, by = dy * invDist;

		// Rigid Physics Maneuver: Wall Bounce Awareness
		const border = this._getValidBorder(player);
		if (border) {
			const bDist = this._getBorderDistance(cell, border);
			if (bDist < cell.size * 1.5) {
				// We are near a wall. Check if bouncing would be faster.
				const isMinX = Math.abs(cell.x - (border.x - border.w)) < cell.size;
				const isMaxX = Math.abs(cell.x - (border.x + border.w)) < cell.size;
				const isMinY = Math.abs(cell.y - (border.y - border.h)) < cell.size;
				const isMaxY = Math.abs(cell.y - (border.y + border.h)) < cell.size;

				if (isMinX || isMaxX) bx = -bx; // Reverse X to "push" into the wall for bounce
				if (isMinY || isMaxY) by = -by; // Reverse Y to "push" into the wall for bounce
			}
		}

		const nearT = ctx.nearThreats, nearV = ctx.nearViruses, nearTM = ctx.nearTeammates;
		// In-line checks for performance
		const checkRadTSq = (cell.size * 1.8 + cell.size) ** 2;
		const checkRadVSq = (cell.size * 3.15) ** 2;
		const checkRadTMSq = (cell.size * 1.5 + cell.size) ** 2;

		let blocked = false;
		for (let i = 1; i <= 5; i++) {
			const tx = cell.x + bx * cell.size * i, ty = cell.y + by * cell.size * i;
			for (let j = 0, lenT = nearT.length; j < lenT; j++) {
				const e = nearT[j];
				if (e.cell === target) continue; // Fix Phase 14: Don't block our own target
				const edx = e.cell.x - tx, edy = e.cell.y - ty;
				if (edx * edx + edy * edy < checkRadTSq) { blocked = true; break; }
			}
			if (blocked) break;
			for (let j = 0, lenV = nearV.length; j < lenV; j++) {
				const v = nearV[j];
				if (v.cell === target) continue; // Fix Phase 14: Don't block our own target
				const vdx = v.cell.x - tx, vdy = v.cell.y - ty;
				if (vdx * vdx + vdy * vdy < checkRadVSq) { blocked = true; break; }
			}
			if (blocked) break;
			for (let j = 0, lenTM = nearTM.length; j < lenTM; j++) {
				const t = nearTM[j];
				if (t.cell === target) continue; // Fix Phase 14: Don't block our own target
				const tdx = t.cell.x - tx, tdy = t.cell.y - ty;
				if (tdx * tdx + tdy * tdy < checkRadTMSq) { blocked = true; break; }
			}
			if (blocked) break;
		}
		if (blocked) {
			let found = false;
			const pVecs = AdvancedPlayerBot.RAY_VECTORS_PRIMARY;
			for (let a = 0, lenA = pVecs.length; a < lenA; a++) {
				const v = pVecs[a];
				// Test both sides: (bx*vx - by*vy, bx*vy + by*vx) and (bx*vx + by*vy, -bx*vy + by*vx)
				for (let s = -1; s <= 1; s += 2) {
					const nx = bx * v.cos - by * (v.sin * s), ny = bx * (v.sin * s) + by * v.cos;
					let ab = false;
					for (let i = 1; i <= 4; i++) {
						const tx = cell.x + nx * cell.size * i, ty = cell.y + ny * cell.size * i;
						for (let j = 0, lenT = nearT.length; j < lenT; j++) {
							const e = nearT[j]; if ((e.cell.x - tx) ** 2 + (e.cell.y - ty) ** 2 < checkRadTSq) { ab = true; break; }
						}
						if (ab) break;
						for (let j = 0, lenV = nearV.length; j < lenV; j++) {
							const vir = nearV[j]; if ((vir.cell.x - tx) ** 2 + (vir.cell.y - ty) ** 2 < checkRadVSq) { ab = true; break; }
						}
						if (ab) break;
						for (let j = 0, lenTM = nearTM.length; j < lenTM; j++) {
							const t = nearTM[j]; if ((t.cell.x - tx) ** 2 + (t.cell.y - ty) ** 2 < checkRadTMSq) { ab = true; break; }
						}
						if (ab) break;
					}
					if (!ab) { bx = nx; by = ny; blocked = false; found = true; break; }
				}
				if (found) break;
			}

			if (!found) {
				const sVecs = AdvancedPlayerBot.RAY_VECTORS_SECONDARY;
				for (let a = 0, lenA = sVecs.length; a < lenA; a++) {
					const v = sVecs[a];
					for (let s = -1; s <= 1; s += 2) {
						const nx = bx * v.cos - by * (v.sin * s), ny = bx * (v.sin * s) + by * v.cos;
						let ab = false;
						for (let i = 1; i <= 3; i++) {
							const tx = cell.x + nx * cell.size * i, ty = cell.y + ny * cell.size * i;
							for (let j = 0, lenT = nearT.length; j < lenT; j++) {
								const e = nearT[j]; if ((e.cell.x - tx) ** 2 + (e.cell.y - ty) ** 2 < checkRadTSq) { ab = true; break; }
							}
							if (ab) break;
							for (let j = 0, lenV = nearV.length; j < lenV; j++) {
								const vir = nearV[j]; if ((vir.cell.x - tx) ** 2 + (vir.cell.y - ty) ** 2 < checkRadVSq) { ab = true; break; }
							}
							if (ab) break;
							for (let j = 0, lenTM = nearTM.length; j < lenTM; j++) {
								const t = nearTM[j]; if ((t.cell.x - tx) ** 2 + (t.cell.y - ty) ** 2 < checkRadTMSq) { ab = true; break; }
							}
							if (ab) break;
						}
						if (!ab) { bx = nx; by = ny; blocked = false; break; }
					}
					if (!blocked) break;
				}
			}
		}

		// Elite: Rigid Physics Gliding (Aligning with World.js:resolveRigidCheck)
		// If we are touching a cell we can't eat, adjust vector to glide around its circumference
		const rigidRad = cell.size + 10;
		for (let i = 0, lenT = nearT.length; i < lenT; i++) {
			const e = nearT[i]; if (e.distSq < rigidRad * rigidRad) {
				const d = e._dist > 0 ? e._dist : Math.sqrt(e.distSq);
				if (d > 0) {
					const tx = (e.dx / d), ty = (e.dy / d);
					bx -= tx * 0.5; by -= ty * 0.5;
				}
			}
		}
		for (let i = 0, lenTM = nearTM.length; i < lenTM; i++) {
			const t = nearTM[i]; if (t.distSq < rigidRad * rigidRad) {
				const d = t._dist > 0 ? t._dist : Math.sqrt(t.distSq);
				if (d > 0) {
					const tx = (t.dx / d), ty = (t.dy / d);
					bx -= tx * 0.5; by -= ty * 0.5;
				}
			}
		}



		let fX = cell.x + bx * ctx.viewDims.w * 0.4, fY = cell.y + by * ctx.viewDims.h * 0.4;
		
		// Fix Phase 12: Integrate Influence Bias into Pathfinding
		// This prevents "tunnel vision" where chasing a target leads the bot into threats
		const infX = ctx.infX, infY = ctx.infY;
		const infD = Math.sqrt(infX * infX + infY * infY);
		if (infD > 0.1) {
			fX = fX * 0.9 + (cell.x + (infX / infD) * ctx.viewDims.w * 0.4) * 0.1;
			fY = fY * 0.9 + (cell.y + (infY / infD) * ctx.viewDims.h * 0.4) * 0.1;
		}

		// Fix Phase 12/17: Smart Jitter Inhibition
		// Disable jitter during tactical moves (sniping/baiting) for precision
		const isTactical = ctx.tacticalAction;
		if (ctx.tCount > 0 && ctx.currentTick - this.lastJitterTick > 4 && !isTactical) {
			const j = cell.size * 0.1;
			fX += (Math.random() - 0.5) * j; fY += (Math.random() - 0.5) * j;
			this.lastJitterTick = ctx.currentTick;
		}
		return { x: fX, y: fY };
	}

// calculateAdvancedInfluence removed: Fused into _prepareTickContext for performance

	/**
	 * Prediction logic
	 */
	predictPlayerPosition(cell, ticksAhead, ctx) {
		const id = this._getOwnerId(cell);
		const pat = id && this.memory.playerPatterns.get(id);
		let x = cell.x, y = cell.y;

		if (pat && pat.positions.length >= 2) {
			const last = pat.positions[pat.positions.length - 1], prev = pat.positions[pat.positions.length - 2];
			const dt = Math.max(1, last.tick - prev.tick);
			x += (last.x - prev.x) * (ticksAhead / dt);
			y += (last.y - prev.y) * (ticksAhead / dt);

			// Elite: Geometric Boost Decay prediction (Sync with World.js:580)
			if (cell.isBoosting && cell.boost.d >= 1) {
				const sm = (ctx && ctx.stepMult) || 1;
				let currentD = cell.boost.d;
				for (let i = 0; i < ticksAhead; i++) {
					const step = currentD / 9 * sm;
					x += cell.boost.dx * step; y += cell.boost.dy * step;
					currentD -= step; if (currentD < 1) break;
				}
			}
		} else if (cell.type === 0) {
			// Pass 3 Fix: Use synced server property cell.moveSpeed instead of hardcoded formula
			const speed = cell.moveSpeed || 88 * Math.pow(cell.size, -0.4396754);
			const maxD = speed * ticksAhead * ((ctx && ctx.stepMult) || 1);
			if (pat && pat.positions.length > 0) {
				const p = pat.positions[pat.positions.length - 1];
				const dx = p.x - cell.x, dy = p.y - cell.y, d = Math.sqrt(dx * dx + dy * dy);
				if (d > 0) { const f = Math.min(1, maxD / d); x += dx * f; y += dy * f; }
			}
		}

		// Destination Bias
		if (ctx && ctx.bestPelletCell && cell.size < 100) {
			const p = ctx.bestPelletCell;
			x = x * 0.8 + p.x * 0.2; y = y * 0.8 + p.y * 0.2;
		}

		const border = ctx ? ctx.border : this._getValidBorder(this.player);
		if (border) return { x: this._clampToBorder(x, border.x - border.w, border.x + border.w, cell.size), y: this._clampToBorder(y, border.y - border.h, border.y + border.h, cell.size) };
		return { x, y };
	}

	canCellMerge(c, s, currentTick, stepMult) {
		if (!c || c.birthTick === undefined) return { canMerge: false, ticksToMerge: Infinity };
		const age = (currentTick - c.birthTick) * stepMult, size = Math.max(1, c.size);
		let d = s.playerNoMergeDelay || 15;
		if (s.playerMergeTime > 0) {
			const initial = Math.round(25 * s.playerMergeTime);
			const increase = Math.round(25 * size * (s.playerMergeTimeIncrease || 0.02));
			// Match server-side branch exactly from PlayerCell.js:129
			d = Math.max(d, s.playerMergeVersion === "new" ? Math.max(initial, increase) : initial + increase);
		}
		return { canMerge: age >= d, ticksToMerge: Math.max(0, d - age) };
	}

	/**
	 * Logic: Check for baiting opportunities
	 */
	checkBaitingOpportunity(cell, player, ctx) {
		const baitRad = cell.size * 4, vRad = cell.size * 6, eatMult = ctx.eatMult, enemies = ctx.visibleEnemies, viruses = ctx.nearViruses;
		for (let i = 0, lenE = enemies.length; i < lenE; i++) {
			const data = enemies[i], check = data.cell;
			if (this.canEat(cell.size, check.size, eatMult) && this.canEat(check.size * 1.5, cell.size, eatMult) && data.distSq < baitRad * baitRad) {
				// Elite: Total Mass Safety Check
				// Only bait if we are overwhelmingly larger (2.5x) to absorb ejection costs
				let oppTotal = check.mass;
				if (check.owner && check.owner.ownedCells) {
					oppTotal = 0;
					for (let k = 0; k < check.owner.ownedCells.length; k++) oppTotal += check.owner.ownedCells[k].mass;
				}
				if (ctx.totalMass < oppTotal * 2.5) continue;

				let baitPos = null;
				for (let j = 0, lenV = viruses.length; j < lenV; j++) {
					const vData = viruses[j];
					if (vData.distSq < vRad * vRad) {
						baitPos = { x: (check.x + vData.cell.x) * 0.5, y: (check.y + vData.cell.y) * 0.5 };
						break;
					}
				}
				if (!baitPos) {
					const border = this._getValidBorder(player);
					if (border) {
						const limitSq = (cell.size * 8) ** 2;
						const bx = border.x, bw = border.w, by = border.y, bh = border.h;
						const corners = [{ x: bx - bw, y: by - bh }, { x: bx + bw, y: by - bh }, { x: bx - bw, y: by + bh }, { x: bx + bw, y: by + bh }];
						for (let k = 0; k < 4; k++) {
							const c = corners[k]; if ((c.x - cell.x) ** 2 + (c.y - cell.y) ** 2 < limitSq) { baitPos = c; break; }
						}
					}
				}
				if (baitPos) return { shouldBait: true, ...baitPos, target: check };
			}
		}
		return { shouldBait: false };
	}

	/**
	 * Logic: Check for virus manipulation (shooting)
	 */
	checkVirusManipulation(cell, player, ctx) {
		const viruses = ctx.nearViruses, enemies = ctx.visibleEnemies, settings = ctx.settings;
		if (cell.mass < 250 || this.ejectCooldownTicks > 0 || viruses.length === 0) return { action: null };
		const vRadiusSq = (cell.size * 5) ** 2, eatMult = ctx.eatMult;
		for (let i = 0, lenV = viruses.length; i < lenV; i++) {
			const vData = viruses[i], virus = vData.cell;
			if (vData.distSq > vRadiusSq) continue;
			const invD = 1 / Math.max(1, Math.sqrt(vData.distSq)), dirX = vData.dx * invD, dirY = vData.dy * invD;
			for (let j = 0, lenE = enemies.length; j < lenE; j++) {
				const eData = enemies[j], enemy = eData.cell, dxE = enemy.x - virus.x, dyE = enemy.y - virus.y;
				const dETask = dxE * dirX + dyE * dirY, crossD = Math.abs(dxE * -dirY + dyE * dirX);
				if (dETask > 0 && dETask < (settings.virusSplitBoost || 780) + enemy.size && crossD < enemy.size) {
					const shots = this.virusShots.get(virus.id) || 0;
					if (shots < 7) { this.virusShots.set(virus.id, shots + 1); return { action: "feed", x: virus.x, y: virus.y, virus, target: enemy }; }
					return { action: null };
				}
			}
			if (this.strategyMode === "defensive" && ctx.closestThreat) {
				const t = ctx.closestThreat.cell; if ((t.x - cell.x) * vData.dx + (t.y - cell.y) * vData.dy > 0 && vData.distSq < (cell.size * 3) ** 2) return { action: "feed", x: virus.x, y: virus.y, virus };
			}
			let nNear = 0;
			if (settings.virusGrowSplitting || vData.distSq < (virus.size * 3) ** 2) {
				for (let j = 0, lenE = enemies.length; j < lenE; j++) {
					const e = enemies[j].cell, dx = e.x - virus.x, dy = e.y - virus.y, d2 = dx * dx + dy * dy;
					if (settings.virusGrowSplitting && this.canEat(e.size, cell.size * 0.5, eatMult)) {
						const range = (settings.virusSplitBoost || 780) + e.size;
						if (d2 < range * range && (dx * (cell.x - virus.x) + dy * (cell.y - virus.y)) < 0) return { action: "feed", x: virus.x, y: virus.y, virus, target: e };
					}
					if (d2 < (virus.size * 3) ** 2) nNear++;
				}
			}
			if (nNear > 0 && virus.world && virus.world.virusCount < virus.world.settings.virusMaxCount) return { action: "feed", x: virus.x, y: virus.y, virus };
		}
		return { action: null };
	}

	/**
	 * Logic: Create a virus wall in front of a threat
	 */
	checkVirusWallOpportunity(cell, player, ctx) {
		if (cell.mass < 1000 || this.ejectCooldownTicks > 0) return { shouldShoot: false };
		const threat = ctx.closestThreat;
		if (!threat || threat._dist > cell.size * 5) return { shouldShoot: false };

		const dx = threat.cell.x - cell.x, dy = threat.cell.y - cell.y;
		const invD = 1 / (threat._dist || Math.sqrt(threat.distSq)), dirX = dx * invD, dirY = dy * invD;
		const viruses = ctx.nearViruses;
		for (let i = 0, lenV = viruses.length; i < lenV; i++) {
			const vData = viruses[i], v = vData.cell, vdx = vData.dx, vdy = vData.dy;
			const vDot = (vdx * dirX + vdy * dirY);
			if (vDot > cell.size && vDot < (threat._dist || Math.sqrt(threat.distSq)) * 0.8 && Math.abs(vdx * -dirY + vdy * dirX) < v.size) return { shouldShoot: true, x: v.x, y: v.y };
		}
		return { shouldShoot: false };
	}

	/**
	 * Logic: Position near large enemies about to auto-split
	 */
	checkFragmentFarmingOpportunity(cell, player, ctx) {
		if (ctx.enemyPops.length === 0) return { shouldFarm: false };
		const target = ctx.enemyPops[0];
		// Position slightly offset to catch pieces but not get merged into
		const dx = target.dx, dy = target.dy, distSq = target.distSq;
		const invD = 1 / Math.max(1, Math.sqrt(distSq));
		const offsetDist = target.cell.size + cell.size * 1.5;
		return { shouldFarm: true, x: target.cell.x - dx * invD * offsetDist, y: target.cell.y - dy * invD * offsetDist };
	}

	/**
	 * Logic: Identify candidates for split-scooping (multiple small cells)
	 */
	identifyAutoSplitCandidates(player, ctx) {
		const res = [], enemies = ctx.visibleEnemies, largestCell = ctx.largest;
		const sLimit = largestCell.size / (ctx.settings.playerSplitSizeDiv || 1.414), eatMult = ctx.eatMult;
		const playerMaxSize = ctx.settings.playerMaxSize || 1500;
		for (let i = 0, len = enemies.length; i < len; i++) {
			const e = enemies[i], check = e.cell;
			// Pass 2 Fix: Allow targeting enemies near pop limit even if small fragments can't eat the WHOLE unpopped enemy
			const isNearPop = check.mass > playerMaxSize * 0.9;
			if (e.distSq < (sLimit * 3) ** 2 && (isNearPop || this.canEat(sLimit, check.size, eatMult))) {
				// Perfect Prediction: Simulation: distributeCellMass (Full logic from World.js:824)
				const eMass = check.mass, eCells = (check.owner ? check.owner.ownedCells.length : 1);
				let cLeft = (ctx.settings.playerMaxCells || 16) - eCells;
				if (cLeft > 0) {
					let pieces = [], pMass = eMass;
					const sMinMass = AdvancedPlayerBot.SPLIT_MIN_MASS;
					if (ctx.settings.virusMonotonePops) {
						let n = Math.min(Math.floor(pMass / sMinMass), cLeft); pieces = new Array(n).fill(pMass / (n + 1));
					} else if (pMass / cLeft < sMinMass) {
						let n = 2; while (pMass / (n + 1) >= sMinMass && n * 2 <= cLeft) n *= 2; pieces = new Array(n).fill(pMass / (n + 1));
					} else {
						let nM = pMass / 2, mL = pMass / 2, s = [], cL = cLeft;
						while (cL > 0) {
							if (nM / cL < sMinMass) break;
							while (nM >= mL && cL > 1) nM /= 2;
							s.push(nM); mL -= nM; cL--;
						}
						pieces = s.concat(new Array(cL).fill(mL / cL));
					}
					// Check IF the largest fragment is edible
					if (pieces.length > 0 && this.canEat(sLimit, Math.sqrt(pieces[0] * 100), eatMult)) res.push(check);
				}
			}
		}
		return res;
	}

	static get SPLIT_MIN_MASS() { return 35; }

	/**
	 * Logic: Select the best single target for chasing/splitting
	 */
	scoreTarget(cell, target, player, ctx, scanRadiusSq) {
		const invSize = ctx.invLargestSize, dx = target.x - cell.x, dy = target.y - cell.y, distSq = dx * dx + dy * dy;
		const d = Math.sqrt(distSq);
		const pred = this.predictPlayerPosition(target, Math.round(ctx.settings.serverFrequency * 0.6), ctx);
		const predDistSq = (pred.x - cell.x) ** 2 + (pred.y - cell.y) ** 2;
		const predD = Math.sqrt(predDistSq);
		const eatMult = ctx.eatMult, border = ctx.border;

		// 1. Base Score (Mass based)
		let score = (target.size * 2.5) + (30 / (1 + d * invSize));

		// 2. Oversize Pressure Compensation
		// Only increase greed if the server actually punishes oversized cells extra (standard=10x)
		const decayNorm = ctx.settings.playerDecayMult || 0.001;
		const decayOver = ctx.settings.playerDecayMultOversize || 0.01;
		if (cell.mass > (ctx.settings.playerMaxSize || 1500) && decayOver > decayNorm) {
			score *= 1.5;
		}

		// 3. Predictive Alignment
		score += (60 / (1 + predD * invSize));

		// Multi-threat risk assessment with distance decay
		let risk = 0, threats = ctx.nearThreats;
		for (let i = 0, len = threats.length; i < len; i++) {
			const t = threats[i], decay = 1 / (1 + t.distSq * (invSize * invSize));
			risk += (t.cell.size * invSize) * decay * 50;
			risk += (t.cell.size * invSize) * decay * 50;
			if ((t.cell.x - target.x) ** 2 + (t.cell.y - target.y) ** 2 < (cell.size * 3) ** 2) score -= 20;
		}

		// 4. Suicide Prevention: Massive Penalty for targets that are too big to fight (and likely to eat us)
		// Check total mass of the opponent player, not just the single cell (Account for split players)
		if (target.owner) {
			let oppTotal = 0;
			const oppCells = target.owner.ownedCells;
			// Fast summation if accessible, otherwise fallback to known visible cells
			if (oppCells) {
				for (let i = 0; i < oppCells.length; i++) oppTotal += oppCells[i].mass;
				
				// Elite: Split-State Vulnerability Analysis
				// If opponent is split (>4 cells) and CANNOT merge, they are weak despite high mass.
				// If they CAN merge, they are deadly.
				if (oppCells.length > 4 && oppTotal > ctx.totalMass * 1.5) {
					let canMergeCount = 0;
					for (let i = 0; i < oppCells.length; i++) {
						if (oppCells[i].mass > cell.mass * 0.5 && this.canCellMerge(oppCells[i], ctx.settings, ctx.currentTick, ctx.stepMult).canMerge) {
							canMergeCount++;
						}
					}
					// If they have big cells ready to merge, RUN.
					if (canMergeCount > 0) score -= 5000;
					else {
						// Elite: Straggler Detection (Phase 2)
						// Check if this specific target cell is isolated from the main herd
						let cx = 0, cy = 0, mTotal = 0;
						for (let i = 0; i < oppCells.length; i++) { cx += oppCells[i].x * oppCells[i].mass; cy += oppCells[i].y * oppCells[i].mass; mTotal += oppCells[i].mass; }
						if (mTotal > 0) { cx /= mTotal; cy /= mTotal; }
						
						const distFromHerd = Math.sqrt((target.x - cx) ** 2 + (target.y - cy) ** 2);
						
						// If straggler is > 2500 units from center, it's vulnerable. Reduce penalty significantly.
						if (distFromHerd > 2500) score -= 500; 
						else score -= 2000; // Still part of the herd, dangerous
					}
				} else if (oppTotal > ctx.totalMass * 1.5) {
					score -= 10000; // Phase 7: Massive penalty for players that can eat us
				}
			} else {
				oppTotal = target.mass; // Fallback
				if (oppTotal > ctx.totalMass * 1.5) score -= 10000;
			}
		}

		// Phase 6: Threat Zones (Guarded Cells)
		// Check if this target is "protected" by a bigger cell (same owner) nearby
		if (target.owner && target.owner.ownedCells && target.owner.ownedCells.length > 1) {
			const protectors = target.owner.ownedCells;
			const guardRangeSq = (cell.size * 5) ** 2; // Approximate split range of protector
			for (let i = 0; i < protectors.length; i++) {
				const p = protectors[i];
				if (p !== target && p.size > cell.size * 1.25) { // Protector is bigger than us
					if ((p.x - target.x) ** 2 + (p.y - target.y) ** 2 < guardRangeSq) {
						score -= 3000; // IT'S A TRAP!
						break;
					}
				}
			}
		}

		// If target cell itself is > our edible size, it's suicidal to target them
		const canEatUs = target.size > cell.size * (1/eatMult);
		if (canEatUs) {
			score -= 10000;
		} else if (target.size > cell.size * 2.5) {
			score -= 5000;
		} else if (target.size > cell.size * 1.5) {
			score -= 2000;
		}

		// Border proximity penalties
		if (border) {
			const bDist = this._getBorderDistance(target, border);
			if (bDist < target.size * 2) score += 20; // Cornering bonus!
			const myBDist = this._getBorderDistance(cell, border);
			if (myBDist < cell.size) risk += 10; // I am trapped penalty
		}

		// Split-kill opportunity bonuses
		const sSize = cell.size / (ctx.settings.playerSplitSizeDiv || 1.414);
		const sDist = (ctx.settings.playerSplitDistance || 40) + (ctx.settings.playerSplitBoost || 780) / 9;
		const canSplitKill = this.canEat(sSize, target.size, eatMult) && d - sDist <= cell.size - target.size / (ctx.settings.worldEatOverlapDiv || 3);

		if (canSplitKill) score += 150;

		// Elite: Consolidation Bias
		// If we are split, avoid risky targets and prefer easy meals
		if (ctx.cellCount > 2) {
			score *= 0.8; // Reduce interest in fighting players when split to focus on regrouping
		} else if (ctx.cellCount === 1) {
			// If we are one big cell, we WANT to split-kill.
			if (canSplitKill) score *= 1.2;
			
			// Phase 6: Cluster Targeting (Efficiency)
			// If we are big and singular, prefer hitting a GROUP of small cells
			let clusterBonus = 0;
			const enemies = ctx.visibleEnemies;
			const clusterRangeSq = (target.size * 4) ** 2;
			for (let i = 0; i < enemies.length; i++) {
				const e = enemies[i].cell;
				if (e !== target && this.canEat(sSize, e.size, eatMult)) {
					if ((e.x - target.x) ** 2 + (e.y - target.y) ** 2 < clusterRangeSq) {
						clusterBonus += 25; // Bonus for each extra kill
					}
				}
			}
			score += Math.min(200, clusterBonus);
		}

		return score - risk;
	}

	selectBestTarget(cell, player, ctx) {
		const enemies = ctx.visibleEnemies;
		let bestT = null, maxScore = -99999;
		const scanRadiusSq = (cell.size * 6) ** 2;

		for (let i = 0; i < enemies.length; i++) {
			const e = enemies[i].cell;
			if (this.canEat(cell.size, e.size, ctx.eatMult)) {
				const score = this.scoreTarget(cell, e, player, ctx, scanRadiusSq);
				if (score > maxScore) {
					maxScore = score;
					bestT = e;
				}
			}
		}

		if (bestT && maxScore > 0) return bestT;

		// Fix Phase 16: Priority Harmony
		// If we already have a high-priority TACTICAL target (Virus/Eject),
		// do NOT overwrite it with a low-priority pellet or distant mothercell.
		if (this.targetIsTactical) return null;

		if (ctx.bestMotherCellCell) return ctx.bestMotherCellCell;
		
		// Elite: Prioritize Viruses for growth if safe AND strictly edible
		if (ctx.bestVirusCell && ctx.nearThreats.length === 0 && ctx.totalMass < 10000) {
			if (this.canEat(cell.size, ctx.bestVirusCell.size, ctx.eatMult)) {
				return ctx.bestVirusCell;
			}
		}
		
		// Phase 4: Prioritize Ejected Mass over Pellets
		if (ctx.bestEjectedCell) return ctx.bestEjectedCell;
		if (ctx.bestPelletCell) return ctx.bestPelletCell;
		return null;
	}

	/**
	 * Logic: Validate split-kill attempt
	 */
	shouldAttemptSplitKill(cell, player, target, ctx, scanRadiusSq) {
		// Fix Phase 14: Never split-kill a virus
		if (target.type === 2) return false;
		if (this.splitCooldownTicks > 0 || ctx.cellCount >= ctx.settings.playerMaxCells) return false;
		const viruses = ctx.nearViruses;
		for (let i = 0, len = viruses.length; i < len; i++) { if (viruses[i].distSq < (cell.size * 2) ** 2) return false; }
		return this.scoreTarget(cell, target, player, ctx, scanRadiusSq) > 50 && this.strategyRiskTolerance > 0.3;
	}

	checkLuringOpportunity(cell, player, ctx) {
		// Elite: Mass Sustainability Check
		// Only lure if we have significant mass to spare (> 600 in this cell)
		if (cell.mass < 600 || this.ejectCooldownTicks > 0) return { shouldLure: false };
		const iLSq = (cell.size * 3) ** 2, oLSq = (cell.size * 6) ** 2, eatMult = ctx.eatMult, enemies = ctx.visibleEnemies;
		for (let i = 0, len = enemies.length; i < len; i++) {
			const eData = enemies[i], e = eData.cell, dSq = eData.distSq;
			if (this.canEat(cell.size, e.size * 2, eatMult) && dSq > iLSq && dSq < oLSq) {
				// Elite: Total Mass Safety Check
				// Only lure if we are overwhelmingly larger (2.5x) than the whole player
				let oppTotal = e.mass;
				if (e.owner && e.owner.ownedCells) {
					oppTotal = 0;
					for (let k = 0; k < e.owner.ownedCells.length; k++) oppTotal += e.owner.ownedCells[k].mass;
				}
				if (ctx.totalMass < oppTotal * 2.5) continue;

				// Limit ejection frequency to prevent excessive mass dumping
				// Only "gift" if we are a single cell (not vulnerable to split-kills)
				if (ctx.cellCount === 1 && this.strategyMode === "deceptive" && Math.random() < 0.1) return { shouldLure: true, x: e.x, y: e.y, action: "gift" };
				return { shouldLure: true, x: e.x, y: e.y };
			}
		}
		return { shouldLure: false };
	}

	onNewOwnedCell(cell) {
		if (this.hookedCells.has(cell)) return;
		const originalAte = (typeof cell.whenAte === 'function') ? cell.whenAte.bind(cell) : null;
		cell.whenAte = (other) => {
			if (this.shouldClose || !this.hasPlayer) return; // Fix: Zombie safety
			if (originalAte) originalAte(other);
			this._handleCellAte(cell, other);
		};
		const originalEaten = (typeof cell.whenEatenBy === 'function') ? cell.whenEatenBy.bind(cell) : null;
		cell.whenEatenBy = (other) => {
			if (this.shouldClose || !this.hasPlayer) return; // Fix: Zombie safety
			if (originalEaten) originalEaten(other);
			this._handleCellEaten(cell, other);
		};
		this.hookedCells.add(cell);
	}

	_handleCellAte(cell, other) {
		if (this.hasPlayer && this.player.exists && other && other.type === 0 && other.owner && other.owner.id) {
			const isTeammate = this.player.team !== null && other.owner.team === this.player.team;
			const eatMult = this._getSettings().worldEatMult || 1.14017;
			if (other.owner.id !== this.player.id && !isTeammate && this.canEat(cell.size, other.size, eatMult)) {
				this.onKill(other);
			}
		}
	}

	_handleCellEaten(cell, other) {
		if (this.hasPlayer && this.player.exists && other && other.type === 0 && other.owner && other.owner.id && other.owner.id !== this.player.id) {
			const largest = this._getLargestCell(this.player);
			if ((largest && cell.size > largest.size * 0.5) || cell.mass > 500) {
				this.onDeath(other);
			} else {
				this.killStreak = 0;
			}
		}
	}

	onKill(victim) { this._triggerSocialEvent("kill", victim); }
	onDeath(killer) { this._triggerSocialEvent("death", killer); }

	_triggerSocialEvent(type, other) {
		if (!this.hasPlayer || !other || !other.owner || other.owner === this.player || other.owner.id == this.player.id || this.chatCooldown > 0) return;

		let name = this._leaderboardName(other);
		// Sanitization: Strip control characters and trim to prevent spoofing/bloat
		name = name.replace(/[\x00-\x1F\x7F-\x9F]/g, "").substring(0, 16);

		let msg = "";
		if (type === "kill") {
			this.killStreak++;
			if (this.killStreak % 5 === 0) msg = `${this.killStreak} KILLSTREAK! UNSTOPPABLE!`;
			else {
				const msgs = AdvancedPlayerBot.BRAG_MESSAGES;
				msg = msgs[~~(Math.random() * msgs.length)].replace("{target}", name);
			}
			this.chatCooldown = 125;
		} else {
			this.killStreak = 0;
			const msgs = AdvancedPlayerBot.REVENGE_MESSAGES;
			msg = msgs[~~(Math.random() * msgs.length)].replace("{killer}", name);
			this.chatCooldown = 150;
		}
		this.sendChat(msg);
	}
	updateMemoryDecay(tick) {
		const decay = AdvancedPlayerBot.MEMORY_DECAY;
		if (tick % 5 === 0) {
			for (const [id, entry] of this.memory.threats) {
				if (Math.abs(tick - entry.lastSeen) > decay) this.memory.threats.delete(id);
			}
			// Pass 2 Fix: Robust pruning with while loop
			while (this.memory.threats.size > 200) {
				let oldestKey = null, oldestTime = Infinity;
				for (const [k, v] of this.memory.threats) { if (v.lastSeen < oldestTime) { oldestTime = v.lastSeen; oldestKey = k; } }
				if (oldestKey) this.memory.threats.delete(oldestKey);
				else break;
			}
		}
		if (tick % 7 === 0) {
			for (const [id, entry] of this.memory.opportunities) {
				if (Math.abs(tick - entry.lastSeen) > decay) this.memory.opportunities.delete(id);
			}
			while (this.memory.opportunities.size > 200) {
				let oldestKey = null, oldestTime = Infinity;
				for (const [k, v] of this.memory.opportunities) { if (v.lastSeen < oldestTime) { oldestTime = v.lastSeen; oldestKey = k; } }
				if (oldestKey) this.memory.opportunities.delete(oldestKey);
				else break;
			}
		}
		if (tick % 60 === 0) {
			for (const [id, pat] of this.memory.playerPatterns) {
				if (Math.abs(tick - pat.lastSeen) > decay * 10) this.memory.playerPatterns.delete(id);
			}
			while (this.memory.playerPatterns.size > 100) {
				let oldestKey = null, oldestTime = Infinity;
				for (const [k, v] of this.memory.playerPatterns) {
					if (v.lastSeen < oldestTime) { oldestTime = v.lastSeen; oldestKey = k; }
				}
				if (oldestKey) this.memory.playerPatterns.delete(oldestKey);
				else break;
			}
		}
		// Pass 2 Fix: Intelligent virus shot decay
		if (tick % 100 === 0 && this.virusShots.size > 0) {
			for (const [id, shots] of this.virusShots) {
				// Only clear shots for viruses that aren't visible anymore
				if (this.player.visibleCells && !this.player.visibleCells[id]) {
					this.virusShots.delete(id);
				}
			}
		}
	}

	/**
	 * Priority Engine: Evaluate tactical actions
	 */
	_evaluateTacticalAction(cell, player, ctx) {
		// Fix Phase 15/17: Survival & Consolidation Overrides
		// Immediately drop tactical aggression if we are cornered, under critical threat, or consolidating
		if (this.isCornered(cell, player, ctx)) return null;
		if (ctx.closestThreat && ctx.closestThreat._dist < cell.size * 2.5) return null;
		if (this.strategyMode === "merge" && this.selfFeedCooldown > 0) return null;

		// Elite: Defensive Merge Priority (Phase 3)
		// Only block tactics if we are merging DEFENSIVELY (due to a threat)
		if (this.strategyMode === "merge" && ctx.nearThreats.length > 0) return null;

		// 0. Priority: Explosive Growth (Virus Popping)
		// If we are small/medium and safe, farming viruses is the fastest way to grow.
		const popping = this.checkVirusPoppingOpportunity(cell, player, ctx);
		if (popping && popping.shouldFarm) {
			if (popping.action === "merge_to_farm") {
				this.strategyMode = "merge";
				return null; // Fall through to _handleTargetingAndMovement to execute merge
			}
			return { x: popping.x, y: popping.y, type: "move" };
		}

		// 0.5 Hyper-Aggressive Pellet Farming (Fixed Reference & Moved from dead code)
		if (ctx.cellCount < ctx.settings.playerMaxCells && ctx.tCount === 0 && ctx.totalMass > 250 && this.splitCooldownTicks <= 0) {
			const bestP = ctx.bestPelletCell;
			if (bestP && (bestP.x - cell.x) ** 2 + (bestP.y - cell.y) ** 2 > (cell.size * 2) ** 2) {
				this.splitCooldownTicks = 5; // Low cooldown for rapid farming
				this.attemptSplit();
				return { x: bestP.x, y: bestP.y, type: "move" };
			}
		}

		// 1. Virus Sniper (Sniper has highest priority if mass is sufficient)
		// Safety: Don't snipe if a huge player is right on top of us
		if (!ctx.closestThreat || ctx.closestThreat._dist > cell.size * 4) {
			const vSnipe = this.checkVirusManipulation(cell, player, ctx);
			if (vSnipe.action === "feed") return { x: vSnipe.x, y: vSnipe.y, type: "eject" };
		}

		// 2. Virus Walls (Defensive shooting)
		const vWall = this.checkVirusWallOpportunity(cell, player, ctx);
		if (vWall.shouldShoot) return { x: vWall.x, y: vWall.y, type: "eject" };

		// 3. Virus Harvesting (Eat viruses for mass when at max cells)
		const harvest = this.checkVirusHarvestOpportunity(cell, player, ctx);
		if (harvest.shouldHarvest) return { x: harvest.x, y: harvest.y, type: "move" };

		// 4. Fragment Farming (Was previously overwritten checkAutoSplitFarming)
		const fragmentFarming = this.checkFragmentFarmingOpportunity(cell, player, ctx);
		if (fragmentFarming && fragmentFarming.shouldFarm) return { x: fragmentFarming.x, y: fragmentFarming.y, type: "move" };

		// 5. Baiting
		const bait = this.checkBaitingOpportunity(cell, player, ctx);
		if (bait.shouldBait) return { x: bait.x, y: bait.y, type: "move" };

		// 6. Luring
		const lure = this.checkLuringOpportunity(cell, player, ctx);
		if (lure.shouldLure) return { x: lure.x, y: lure.y, type: lure.action === "gift" ? "eject" : "move" };

		return null;
	}

	/**
	 * Logic: Check for virus harvesting opportunities (at max cells)
	 */
	checkVirusHarvestOpportunity(cell, player, ctx) {
		const viruses = ctx.nearViruses, enemies = ctx.visibleEnemies;
		if (ctx.cellCount < ctx.settings.playerMaxCells || viruses.length === 0) return { shouldHarvest: false };
		const eatMult = ctx.eatMult, sRSq = (cell.size * 5) ** 2;
		for (let i = 0, lenV = viruses.length; i < lenV; i++) {
			const v = viruses[i].cell;
			if (this.canEat(cell.size, v.size, eatMult)) {
				let tNear = false;
				for (let j = 0, lenE = enemies.length; j < lenE; j++) {
					const t = enemies[j].cell;
					if (this.canEat(t.size, cell.size * 0.5, eatMult)) {
						if ((t.x - v.x) ** 2 + (t.y - v.y) ** 2 < sRSq) { tNear = true; break; }
					}
				}
				if (!tNear) return { shouldHarvest: true, x: v.x, y: v.y };
			}
		}
		return { shouldHarvest: false };
	}

	/**
	 * Logic: Intentionally pop on viruses to farm mass (if at low cell count)
	 */
	checkVirusPoppingOpportunity(largestCell, player, ctx) {
		const viruses = ctx.nearViruses, enemies = ctx.visibleEnemies, settings = ctx.settings;
		// Relaxed: Farm until we are almost full (leave 1 splits' worth of room)
		// Elite: Allow farming even if full, if we can merge (Greed factor)
		if (ctx.cellCount >= settings.playerMaxCells) {
			if (!ctx.allCanMerge) return { shouldFarm: false };
		}
		
		const eatMult = ctx.eatMult;
		const owned = player.ownedCells;

		// 1. Direct Farm: Do we have a cell ready to pop?
		for (let k = 0; k < owned.length; k++) {
			const cell = owned[k];
			if (cell.mass < 120) continue; // Too small to eat virus

			const vRadSq = (cell.size * 10) ** 2, tRadSq = (cell.size * 6) ** 2; // Expanded search radius
			for (let i = 0, lenV = viruses.length; i < lenV; i++) {
				const v = viruses[i].cell;
				if (this.canEat(cell.size, v.size, eatMult) && (v.x - cell.x) ** 2 + (v.y - cell.y) ** 2 < vRadSq) {
					let highRisk = false;
					// Only fear enemies that can punish our split pieces (size/2)
					// If we are already split, we are more willing to pop on a virus to grow
					const splitSize = Math.sqrt(cell.mass / 2 * 100);
					
					for (let j = 0, lenE = enemies.length; j < lenE; j++) {
						const e = enemies[j].cell;
						// If enemy is dangerous to our future pieces
						if (this.canEat(e.size, splitSize, eatMult) && (e.x - v.x) ** 2 + (e.y - v.y) ** 2 < tRadSq) { highRisk = true; break; }
					}
					if (!highRisk) return { shouldFarm: true, x: v.x, y: v.y };
				}
			}
		}

		// Phase 5: Merge-to-Farm Logic
		// If no single cell can eat a virus, but our TOTAL mass can...
		// Only trigger if we are ready to merge soon (within 150 ticks / ~6 seconds)
		if (ctx.totalMass > 150 && ctx.cellCount > 1 && ctx.cellCount < settings.playerMaxCells && 
			ctx.nearThreats.length === 0 && this.lastMergeTicks < 150) {
			// Find nearest virus
			let bestV = null, bestDist = Infinity;
			for (let i = 0; i < viruses.length; i++) {
				const v = viruses[i];
				if (v.distSq < bestDist) { bestDist = v.distSq; bestV = v; }
			}
			
			// If we found a virus and our total mass is enough to eat it (+safety margin)
			if (bestV && this.canEat(Math.sqrt(ctx.totalMass * 100), bestV.cell.size * 1.1, eatMult)) {
				// FORCE MERGE
				// Only fear enemies that can actually eat our total mass
				let safe = true;
				for (let j = 0; j < enemies.length; j++) {
					const e = enemies[j];
					if (this.canEat(e.cell.size, Math.sqrt(ctx.totalMass * 100), eatMult) && e.distSq < (Math.sqrt(ctx.totalMass * 100) * 8) ** 2) { 
						safe = false; break; 
					}
				}
				if (safe) return { shouldFarm: true, x: bestV.cell.x, y: bestV.cell.y, action: "merge_to_farm" };
			}
		}

		return { shouldFarm: false };
	}
}

// Node.js 10 Compatibility: Assign static properties outside the class body
AdvancedPlayerBot.RAY_ANGLES_PRIMARY = [0.5236, 1.5708, 2.6180];
AdvancedPlayerBot.RAY_ANGLES_SECONDARY = [1.0472, 2.0944];
AdvancedPlayerBot.RAY_VECTORS_PRIMARY = AdvancedPlayerBot.RAY_ANGLES_PRIMARY.map(r => ({ cos: Math.cos(r), sin: Math.sin(r) }));
AdvancedPlayerBot.RAY_VECTORS_SECONDARY = AdvancedPlayerBot.RAY_ANGLES_SECONDARY.map(r => ({ cos: Math.cos(r), sin: Math.sin(r) }));
AdvancedPlayerBot.MEMORY_DECAY = 60;
AdvancedPlayerBot.BRAG_MESSAGES = [
	"Yummy {target}!", "Thanks for the mass, {target}!", "Too slow, {target}!", "Ez {target}",
	"Nom nom {target}", "You looked tasty, {target}!", "Oops, did I eat {target}?",
	"More mass from {target}!", "Delicious {target}!", "Snack time, {target}!", "Omg sorry {target}!",
	"Was that you {target}?", "Need more mass, thanks {target}!", "Tasty snack {target}!",
	"Gulp! Bye {target}!", "You made a good meal {target}!", "Diet starts tomorrow, {target}!",
	"Feed me more {target}!", "Can't catch me {target}!", "Nice try {target}!", "Burp! Excuse me {target}!",
	"Get rekt {target}!", "Nothing personal {target}!", "GG {target}, you tried!",
	"Mmm protein {target}!", "Dinner is served, {target}!", "Outplayed {target}!",
	"You're mine {target}!", "Better luck next time {target}!", "Absolutely demolished {target}!",
	"You hate to see it {target}!", "Sit down {target}!", "Who's next after {target}?",
	"Easy pickings {target}!", "Git gud {target}!", "Skill issue {target}!", "No escape {target}!",
	"Fastest meal ever {target}!", "Thanks for feeding me {target}!", "You thought {target}!",
	"That was MY spot {target}!", "Prediction 100 {target}!", "Gotcha {target}!",
	"You've been consumed {target}!", "Tastes like victory {target}!", "Checkmate {target}!",
	"Absorbed {target}!", "Into the void {target}!", "Rekt and wrecked {target}!",
	"You're now part of me {target}!", "That's how it's done {target}!",
	"Breakfast lunch and dinner {target}!", "Too predictable {target}!", "Saw that coming {target}!", "Destroyed {target}!",
	"Nom nom nom {target}!", "You're in my belly now {target}!",
	"That's what you get {target}!", "360 no scope {target}!", "Welcome to the food chain {target}!", "Munched {target}!", "Chomped {target}!",
	"You're history {target}!", "Sent to the shadow realm {target}!"
];
AdvancedPlayerBot.REVENGE_MESSAGES = [
	"I'll be back, {killer}!", "Lucky shot, {killer}...", "You'll pay for that, {killer}!",
	"Enjoy it while it lasts, {killer}!", "Hey! That was my favorite cell, {killer}!",
	"Nice move {killer}, but I'm not done!", "Lag! I swear it was lag, {killer}!",
	"I'm coming for you now, {killer}!", "Well played {killer}, see you in a minute.",
	"You're on my list now, {killer}!", "This isn't over {killer}!",
	"Rematch time {killer}!", "You got me {killer}, GG!", "Wow {killer}, teach me!",
	"That was personal {killer}!", "Revenge mode activated {killer}!",
	"You had to tryhard {killer}?", "Caught me slipping {killer}!",
	"Respawn and revenge {killer}!", "Round 2 incoming {killer}!",
	"I wasn't ready {killer}!", "Okay you win this round {killer}...",
	"My keyboard wasn't working {killer}!", "I had connection issues {killer}!",
	"You're the main target now {killer}!",
	"Can't believe you got me {killer}!", "Not bad {killer}, not bad!",
	"I demand a rematch {killer}!", "That was cheap {killer}!",
	"Respectable kill {killer}!", "You woke up the beast {killer}!",
	"Alright {killer}, you win THIS time!", "How did you even... {killer}?!",
	"You... you monster {killer}!", "Impressive {killer}, very impressive!",
	"My revenge will be swift {killer}!", "Watch your back {killer}!",
	"I underestimated you {killer}!", "You're good {killer}, I'll admit it!",
	"Bruh {killer}...", "Seriously {killer}?!", "Are you hacking {killer}?!",
	"That hurt {killer}!", "I'll remember that {killer}!", "You just made an enemy {killer}!",
	"Fastest respawn ever {killer}!", "Time for payback {killer}!",
	"I'm upgrading my strats {killer}!", "You activated my trap card {killer}!", "You shouldn't have done that {killer}...",
	"That's it, now it's personal {killer}!"
];

module.exports = AdvancedPlayerBot;