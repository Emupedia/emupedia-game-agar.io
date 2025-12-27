const Bot = require("./Bot.js");

class AdvancedPlayerBot extends Bot {
	/**
	 * @param {World} world
	 */
	constructor(world) {
		super(world);

		this.splitCooldownTicks = 0;
		/** @type {Cell} */
		this.target = null;
		this.ejectCooldownTicks = 0;
		this.splitAttempts = 0;
		this.ejectAttempts = 0;
		this.nextUpdateTick = 0;

		// Memory system
		this.memory = {
			threats: new Map(),      // cellId -> {x, y, size, threatLevel, lastSeen, vx, vy}
			opportunities: new Map(), // cellId -> {x, y, size, value, lastSeen, vx, vy}
			playerPatterns: new Map() // playerId -> {behaviorType, lastSeen, positions[]}
		};
		this.memoryDecayTicks = 60;

		// Strategic state
		this.strategy = {
			mode: "balanced", // "aggressive", "balanced", "defensive", "deceptive"
			riskTolerance: 0.5,
			baitTarget: null,
			herdingRisk: 0
		};

		// Multi-cell coordination
		this.coordination = {
			selfFeedCooldown: 0
		};

		// Psychological state
		this.psychology = {
			fakeWeaknessActive: false,
			lastJitterTick: 0
		};

		// Social / Chat
		this.social = {
			lastChatTick: 0,
			chatCooldown: 0,
			killStreak: 0
		};

		this.virusShots = new Map(); // virusId -> count
		this.lastMergeTicks = 0;

		this.bragMessages = [
			"Yummy {target}!",
			"Thanks for the mass, {target}!",
			"Too slow, {target}!",
			"Ez {target}",
			"Nom nom {target}",
			"You looked tasty, {target}!",
			"Oops, did I eat {target}?",
			"More mass from {target}!",
			"Delicious {target}!",
			"Snack time, {target}!",
			"Omg sorry {target}!",
			"Was that you {target}?",
			"Need more mass, thanks {target}!",
			"Tasty snack {target}!",
			"Gulp! Bye {target}!",
			"You made a good meal {target}!",
			"Diet starts tomorrow, {target}!",
			"Feed me more {target}!",
			"Can't catch me {target}!",
			"Nice try {target}!",
			"Burp! Excuse me {target}!"
		];
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
		return aSize > bSize * eatMult;
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
		return (this.listener && this.listener.settings) ? this.listener.settings : {};
	}

	/**
	 * Helper: Get largest cell for a player
	 */
	_getLargestCell(player) {
		let largest = null;
		for (const cell of player.ownedCells) {
			if (!largest || cell.size > largest.size) largest = cell;
		}
		return largest;
	}

	updatePlayerPattern(ownerId, cell, player, tick) {
		if (!player.viewArea || isNaN(player.viewArea.x) || isNaN(player.viewArea.y)) return;
		let pat = this.memory.playerPatterns.get(ownerId);
		if (!pat) {
			pat = { positions: [], behaviorType: "unknown", lastSeen: tick, aggressionLevel: 0.5 };
			this.memory.playerPatterns.set(ownerId, pat);
		}
		pat.positions.push({ x: cell.x, y: cell.y, tick: tick });
		if (pat.positions.length > 20) pat.positions.shift();
		pat.lastSeen = tick;

		// Calculate aggression based on movement towards player
		if (pat.positions.length >= 2) {
			const prev = pat.positions[pat.positions.length - 2];
			const dxP = prev.x - player.viewArea.x, dyP = prev.y - player.viewArea.y;
			const distPrev = Math.sqrt(dxP * dxP + dyP * dyP);
			const dxC = cell.x - player.viewArea.x, dyC = cell.y - player.viewArea.y;
			const distCurr = Math.sqrt(dxC * dxC + dyC * dyC);
			if (distCurr < distPrev) pat.aggressionLevel = Math.min(1.0, pat.aggressionLevel + 0.05);
			else pat.aggressionLevel = Math.max(0, pat.aggressionLevel - 0.02);
		}
	}

	/**
	 * Helper: Calculate border distance from cell
	 */
	_getBorderDistance(cell, border) {
		return Math.min(
			Math.abs(cell.x - (border.x - border.w)),
			Math.abs(cell.x - (border.x + border.w)),
			Math.abs(cell.y - (border.y - border.h)),
			Math.abs(cell.y - (border.y + border.h))
		);
	}

	_setMousePosition(x, y) {
		this.mouseX = x;
		this.mouseY = y;
	}

	_clampToBorder(value, borderMin, borderMax) {
		return Math.max(borderMin, Math.min(borderMax, value));
	}

	_getOwnerId(cell) {
		return cell && cell.owner && cell.owner.id ? cell.owner.id : null;
	}

	update() {
		const handle = this.listener && this.listener.handle;
		if (!handle) return;
		const currentTick = handle.tick;
		const settings = this._getSettings(); // Ensure cached

		// 0. Update Cooldowns and Memory Decay
		if (this.splitCooldownTicks > 0) this.splitCooldownTicks--;
		else this.target = null;

		if (this.ejectCooldownTicks > 0) this.ejectCooldownTicks--;
		this.updateMemoryDecay(currentTick);

		if (this.social.chatCooldown > 0) this.social.chatCooldown--;

		// 0.1 Simulate Human Reaction Latency (1-3 ticks)
		if (currentTick < this.nextUpdateTick) return;
		this.nextUpdateTick = currentTick + (Math.random() < 0.1 ? 2 : 1);

		// 1. Prepare Tick Context (Optimization: single pass over data)
		const player = this.player;
		player.updateVisibleCells();
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
		if (this.coordination.selfFeedCooldown <= 0 && this.shouldSelfFeed(player, ctx)) {
			this.performSelfFeed(player, largest);
			this.coordination.selfFeedCooldown = 10;
		}
		if (this.coordination.selfFeedCooldown > 0) this.coordination.selfFeedCooldown--;

		// 6. Tactical Phases (Priority Engine)
		const action = this._evaluateTacticalAction(largest, player, ctx);
		if (action) {
			this._setMousePosition(action.x, action.y);
			if (action.type === "eject" && this.ejectCooldownTicks <= 0) {
				this.ejectAttempts++;
				this.ejectCooldownTicks = settings.playerEjectDelay;
			}
			return;
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

		this.onSpawnRequest();
		this.spawningName = null;
	}

	_prepareTickContext(player, largest, currentTick, settings, handle) {
		const viewArea = player.viewArea || {};
		const stepMult = handle.stepMult || 1;
		const ctx = {
			currentTick, settings, largest,
			totalMass: 0, cellCount: player.ownedCells.length, allCanMerge: true,
			viewDims: { w: viewArea.w || 1000, h: viewArea.h || 1000 },
			visible: { enemies: [], pellets: [], viruses: [], ejected: [], motherCells: [] },
			threatsNearby: 0, opportunitiesNearby: 0, closestThreat: null, bestOpportunity: null, bestPellet: null, bestMotherCell: null,
			incomingSplit: null,
			nearTactical: { threats: [], viruses: [] },
			enemyPops: [],
			invLargestSize: largest.size > 0 ? 1 / largest.size : 0,
			eatMult: settings.worldEatMult || 1.14017
		};

		// Pre-calculate tactical range squares to avoid Math.sqrt in simple checks later
		const tacticalRange = largest.size * 10;
		const tacticalRangeSq = tacticalRange * tacticalRange;

		for (const c of player.ownedCells) {
			ctx.totalMass += (c.mass || 0);
			const mergeInfo = this.canCellMerge(c, settings, currentTick, stepMult);
			if (ctx.allCanMerge && !mergeInfo.canMerge) ctx.allCanMerge = false;
			if (mergeInfo.ticksToMerge > 0 && mergeInfo.ticksToMerge < 50) this.lastMergeTicks = mergeInfo.ticksToMerge;
		}

		const threatsMemory = this.memory.threats, oppMemory = this.memory.opportunities;
		const lastVisible = player.lastVisibleCells || {}, eatMult = ctx.eatMult;


		const visibleCells = player.visibleCells || {};
		for (let id in visibleCells) {
			const cell = visibleCells[id];
			if (!cell || cell.x === undefined) continue;

			const dx = cell.x - largest.x, dy = cell.y - largest.y;
			const distSq = dx * dx + dy * dy;
			const dist = Math.sqrt(distSq);
			const cellData = { cell, id, distSq, dist, dx, dy };

			if (cell.type === 0 && cell.owner && cell.owner.id && cell.owner.id !== player.id && (!player.team || player.team !== cell.owner.team)) {
				ctx.visible.enemies.push(cellData);
				const ownerId = cell.owner.id;
				this.updatePlayerPattern(ownerId, cell, player, currentTick);

				const isThreat = this.canEat(cell.size, largest.size, eatMult);
				if (isThreat) {
					ctx.threatsNearby++;
					if (!ctx.closestThreat || dist < ctx.closestThreat.dist) ctx.closestThreat = cellData;
					if (distSq < tacticalRangeSq) ctx.nearTactical.threats.push(cellData);
				} else if (this.canEat(largest.size, cell.size, eatMult)) {
					ctx.opportunitiesNearby++;
					if (!ctx.bestOpportunity || cell.size / distSq > ctx.bestOpportunity.cell.size / ctx.bestOpportunity.distSq) ctx.bestOpportunity = cellData;
				}

				const lastData = threatsMemory.get(id);
				let vx = 0, vy = 0;
				if (lastData && lastVisible[id]) {
					const invTickDiff = 1 / Math.max(1, currentTick - lastData.lastSeen);
					vx = (cell.x - lastData.x) * invTickDiff; vy = (cell.y - lastData.y) * invTickDiff;
				}

				const memoryEntry = { x: cell.x, y: cell.y, size: cell.size, lastSeen: currentTick, vx, vy, ownerId };
				if (isThreat) {
					memoryEntry.threatLevel = cell.size / largest.size;
					threatsMemory.set(id, memoryEntry);

					// Elite: Integrated Incoming Split Check
					if (memoryEntry.threatLevel > 1.0) {
						const invDiv = (settings.playerSplitSizeDiv || 1.414);
						const sDist = (settings.playerSplitDistance || 40) + (settings.playerSplitBoost || 780) / 9;
						const dot = (vx * -dx + vy * -dy) / Math.max(1, dist); // Move towards largest
						if (dot > 0.5) {
							const border = this._getValidBorder(player);
							let herding = 0;
							const fX = largest.x + (-dx / dist) * largest.size * 5, fY = largest.y + (-dy / dist) * largest.size * 5;
							if (border && this._getBorderDistance({ x: fX, y: fY }, border) < largest.size * 2) herding += 0.8;
							if (dist < (sDist + cell.size / invDiv) * (1.8 + herding * 0.5)) {
								if (!ctx.incomingSplit || dist < ctx.incomingSplit.d) ctx.incomingSplit = { ...memoryEntry, dx: -dx, dy: -dy, d: dist };
							}
						}
					}
				} else if (this.canEat(largest.size, cell.size, eatMult)) {
					memoryEntry.value = cell.size;
					oppMemory.set(id, memoryEntry);
				}
			} else if (cell.type === 1) {
				ctx.visible.pellets.push(cellData);
				if (!ctx.bestPellet || cell.size / distSq > ctx.bestPellet.cell.size / ctx.bestPellet.distSq) ctx.bestPellet = cellData;
			} else if (cell.type === 2) {
				ctx.visible.viruses.push(cellData);
				if (distSq < tacticalRangeSq) ctx.nearTactical.viruses.push(cellData);
			} else if (cell.type === 3) {
				ctx.visible.ejected.push(cellData);
			} else if (cell.type === 4) {
				ctx.visible.motherCells.push(cellData);
				if (this.canEat(largest.size, cell.size, eatMult) && (!ctx.bestMotherCell || dist < ctx.bestMotherCell.dist)) ctx.bestMotherCell = cellData;
			}

			// Ultra-Elite: Auto-Split Farming Detection
			if (cell.type === 0 && cell.size > (settings.playerMaxSize || 1500) * 0.95) {
				ctx.enemyPops.push(cellData);
			}
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
				this.splitAttempts++;
				this.splitCooldownTicks = 15;
			}
			return true;
		}
		return false;
	}

	_handlePopSplitPrep(player, ctx) {
		if (player.ownedCells.length > 1 && ctx.allCanMerge) {
			this.strategy.mode = "aggressive";
			this.strategy.riskTolerance = 0.9;
		}

		// Elite: Pop-Split Surprise Detection
		if (player.ownedCells.length === 1) {
			const cell = player.ownedCells[0];
			const eatMult = ctx.eatMult;
			const overlappingEnemy = ctx.visible.enemies.find(e => {
				return e.dist < cell.size && this.canEat(e.cell.size, cell.size * 0.5, eatMult); // They can eat half our mass
			});

			if (overlappingEnemy) {
				const virusSafeRangeSq = (cell.size * 1.5) ** 2;
				const nearVirus = ctx.visible.viruses.find(v => {
					const vdx = cell.x - v.cell.x, vdy = cell.y - v.cell.y;
					return (vdx * vdx + vdy * vdy) < virusSafeRangeSq;
				});
				if (nearVirus) {
					// We are being hunted near a virus. Humans expect us to run.
					// Instead, we could intentionally pop to spread mass and potentially merge-kill.
					this.strategy.mode = "aggressive";
					this.strategy.riskTolerance = 1.0;
				}
			}
		}
	}

	/**
	 * Optimized: Consolidated Targeting & Movement logic
	 */
	_handleTargetingAndMovement(largest, player, ctx) {
		const settings = ctx.settings;
		// 1. Existing Target validation
		if (this.target != null) {
			if (!this.target.exists || !this.target.size || largest.size <= this.target.size * ctx.eatMult) {
				this.target = null;
			} else {
				const path = this.calculatePath(largest, this.target, player, ctx);
				this._setMousePosition(path.x, path.y);
				return;
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
				this.splitAttempts++;
				this.splitCooldownTicks = 25;
				// Elite: Mark target for aggressive pursuit
				this.target = bestTarget;
			} else {
				const path = this.calculatePath(largest, bestTarget, player, ctx);
				this._setMousePosition(path.x, path.y);
			}
			return;
		}

		// 4. Default: Influence-based movement
		const influence = this.calculateAdvancedInfluence(largest, player, ctx);
		const d = Math.sqrt(influence.x * influence.x + influence.y * influence.y);
		const invD = 1 / Math.max(1, d);

		let speedMult = 1.0;
		// Elite: Apply "Fake Weakness" deceleration
		if (this.psychology.fakeWeaknessActive) {
			speedMult = 0.4 + Math.random() * 0.2; // Move at 40-60% speed
		}

		// Elite: The Shield Maneuver (Defensive/Offensive Barrier)
		if (player.ownedCells.length > 1 && ctx.closestThreat) {
			const threat = ctx.closestThreat.cell, dx = threat.x - largest.x, dy = threat.y - largest.y, invD = 1 / Math.max(1, ctx.closestThreat.dist);
			const shieldDist = this.strategy.mode === "defensive" ? -largest.size : largest.size * 0.8;
			this._setMousePosition(largest.x + (dx * invD) * shieldDist, largest.y + (dy * invD) * shieldDist);
			return;
		}

		// Elite: Pop-Split Execution
		if (this.strategy.mode === "aggressive" && ctx.cellCount === 1) {
			const nearVirus = ctx.nearTactical.viruses.find(v => v.dist < largest.size * 1.2);
			if (nearVirus) {
				const virus = nearVirus.cell;
				// Intentionally hit virus if an enemy is overlapping us
				const overlapEnemy = ctx.visible.enemies.find(e => e.dist < largest.size && this.canEat(e.cell.size, largest.size * 0.5, ctx.eatMult));
				if (overlapEnemy) {
					this._setMousePosition(virus.x, virus.y);
					return;
				}
			}
		}

		this._setMousePosition(
			largest.x + (influence.x * invD * ctx.viewDims.w) * speedMult,
			largest.y + (influence.y * invD * ctx.viewDims.h) * speedMult
		);
	}

	/**
	 * Optimized: Determine if bot should self-feed
	 */
	shouldSelfFeed(player, ctx) {
		if (ctx.cellCount < 2) return false;
		// Optimization: Use playerMaxSize from settings instead of hardcoded 2000
		const threshold = ctx.settings.playerMaxSize ? ctx.settings.playerMaxSize * 1.33 : 2000;
		return ctx.threatsNearby > 0 || ctx.totalMass > threshold;
	}

	/**
	 * Optimized: Consolidate mass into largest cell
	 */
	performSelfFeed(player, largest) {
		this._setMousePosition(largest.x, largest.y);
		let smallCellMass = 0;
		for (const c of player.ownedCells) {
			if (c !== largest) smallCellMass += (c.mass || 0);
		}
		if (smallCellMass > 50 && this.ejectCooldownTicks <= 0) {
			this.ejectAttempts++;
			this.ejectCooldownTicks = this._getSettings().playerEjectDelay;
		}
	}

	/**
	 * Optimized: Update bot strategy
	 */
	updateStrategy(cell, player, ctx) {
		const threatCount = ctx.threatsNearby;
		const opportunityCount = ctx.opportunitiesNearby;
		const totalMass = ctx.totalMass;

		// Reset deceptive state
		this.psychology.fakeWeaknessActive = false;

		if (threatCount === 0 && opportunityCount > 2 && totalMass > (ctx.settings.playerMaxSize || 1500) * 3) {
			this.strategy.mode = "aggressive";
			this.strategy.riskTolerance = 0.7;
		} else if (ctx.closestThreat) {
			// Elite: "Fake Weakness" logic
			// If a single large threat is at a "tempting" distance, pretend to be slow/vulnerable
			if (threatCount === 1) {
				const threat = ctx.closestThreat;
				if (threat.dist > cell.size * 3 && threat.dist < cell.size * 6) {
					this.psychology.fakeWeaknessActive = true;
					this.strategy.mode = "deceptive";
					this.strategy.riskTolerance = 0.8; // High risk for high reward bait
					return;
				}
			}
			if (this.lastMergeTicks > 0 && this.lastMergeTicks < 25) {
				const nearbyTarget = ctx.visible.enemies.find(e => e.dist < cell.size * 2 && this.canEat(cell.size * 1.5, e.cell.size, ctx.eatMult));
				if (nearbyTarget) {
					this.strategy.mode = "deceptive";
					this.strategy.riskTolerance = 1.0; // Bait for surprise merge
				}
			}

			// Herding Detection: If trapped between multiple threats or walls
			if (threatCount > 1) {
				let herdVecX = 0, herdVecY = 0;
				for (const t of ctx.visible.enemies) {
					if (this.canEat(t.cell.size, cell.size, ctx.eatMult)) {
						const dx = t.cell.x - cell.x, dy = t.cell.y - cell.y, dist = Math.sqrt(dx * dx + dy * dy);
						herdVecX += dx / dist; herdVecY += dy / dist;
					}
				}
				this.strategy.herdingRisk = Math.sqrt(herdVecX * herdVecX + herdVecY * herdVecY) / threatCount;
				if (this.strategy.herdingRisk < 0.3) {
					// Low risk means threats are on opposite sides (pinching us)
					this.strategy.mode = "defensive";
					this.strategy.riskTolerance = 0.5; // Prepare for desperate split
				}
			} else if (this.strategy.mode === "deceptive" && ctx.closestThreat && ctx.closestThreat.dist < cell.size * 2.5) {
				// Safety: If deceptive baiting but threat gets too close, swap to defensive
				this.strategy.mode = "defensive";
				this.strategy.riskTolerance = 0.2;
			}
		} else {
			this.strategy.mode = "balanced";
			this.strategy.riskTolerance = 0.5;
			this.strategy.herdingRisk = 0;
		}
	}

	/**
	 * Optimized: Cornered detection
	 */
	isCornered(cell, player, ctx) {
		const border = this._getValidBorder(player);
		if (!border || this._getBorderDistance(cell, border) >= cell.size * 2) return false;
		return ctx.threatsNearby > 0;
	}

	/**
	 * Optimized: Cornered escape
	 */
	handleEscape(cell, player, ctx) {
		const escapeRoute = this.calculateEscapeRoute(cell, player, ctx);
		if (escapeRoute.splitAway && this.splitCooldownTicks <= 0 && ctx.cellCount < ctx.settings.playerMaxCells) {
			this._setMousePosition(escapeRoute.x, escapeRoute.y);
			this.splitAttempts++;
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

		let threatX = 0, threatY = 0, count = 0;
		const threatRadius = cell.size * 5;

		for (const data of ctx.visible.enemies) {
			if (!this.canEat(data.cell.size, cell.size, ctx.eatMult)) continue;
			if (data.dist < threatRadius) {
				const invDist = 1 / Math.max(1, data.dist);
				threatX += (data.cell.x - cell.x) * invDist;
				threatY += (data.cell.y - cell.y) * invDist;
				count++;
			}
		}

		let escapeX = border.x, escapeY = border.y;
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
			x: this._clampToBorder(escapeX, border.x - border.w, border.x + border.w),
			y: this._clampToBorder(escapeY, border.y - border.h, border.y + border.h),
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

		const nearT = ctx.nearTactical.threats, nearV = ctx.nearTactical.viruses;
		// Optimization: Pre-calculate constants for isBlocked to avoid closure allocation
		const cellR = cell.size;
		const checkRadiusT = cellR * 1.8 + cellR;
		const checkRadiusV = cellR * 1.05 + cellR * 2.1; // Approx virus size
		const checkRadTSq = checkRadiusT * checkRadiusT;
		const checkRadVSq = checkRadiusV * checkRadiusV;

		// Optimization: Flattened check loop to avoid function call overhead in hot path
		const checkBlocked = (tx, ty) => {
			for (const e of nearT) {
				const dx = e.cell.x - tx;
				const dy = e.cell.y - ty;
				if (dx * dx + dy * dy < checkRadTSq) return true;
			}
			for (const v of nearV) {
				const dx = v.cell.x - tx;
				const dy = v.cell.y - ty;
				if (dx * dx + dy * dy < checkRadVSq) return true;
			}
			return false;
		};

		let blocked = false;
		for (let i = 1; i <= 5; i++) {
			if (checkBlocked(cell.x + bx * cell.size * i, cell.y + by * cell.size * i)) {
				blocked = true;
				break;
			}
		}
		if (blocked) {
			// Adaptive Raycasting: Start with coarse angles, then refine if needed
			// Angles: Primary [30, 90, 150] (both sides)
			const primaryAngles = [30, 90, 150];
			let found = false;

			for (const ang of primaryAngles) {
				for (let s = -1; s <= 1; s += 2) {
					const r = (ang * s) * 0.01745;
					const cos = Math.cos(r), sin = Math.sin(r);
					const nx = bx * cos - by * sin, ny = bx * sin + by * cos;
					let ab = false;
					for (let i = 1; i <= 4; i++) { // Reduce steps to 4 for rays
						if (checkBlocked(cell.x + nx * cell.size * i, cell.y + ny * cell.size * i)) { ab = true; break; }
					}
					if (!ab) { bx = nx; by = ny; blocked = false; found = true; break; }
				}
				if (found) break;
			}

			// If primary failed, try intermediate [60, 120]
			if (!found) {
				const secondaryAngles = [60, 120];
				for (const ang of secondaryAngles) {
					for (let s = -1; s <= 1; s += 2) {
						const r = (ang * s) * 0.01745;
						const cos = Math.cos(r), sin = Math.sin(r);
						const nx = bx * cos - by * sin, ny = bx * sin + by * cos;
						let ab = false;
						for (let i = 1; i <= 3; i++) { // Reduce checks further for desperation rays
							if (checkBlocked(cell.x + nx * cell.size * i, cell.y + ny * cell.size * i)) { ab = true; break; }
						}
						if (!ab) { bx = nx; by = ny; blocked = false; break; }
					}
					if (!blocked) break;
				}
			}
		}
		let fX = cell.x + bx * ctx.viewDims.w * 0.4, fY = cell.y + by * ctx.viewDims.h * 0.4;
		if (ctx.threatsNearby > 0 && ctx.currentTick - this.psychology.lastJitterTick > 4) {
			const j = cell.size * 0.1;
			fX += (Math.random() - 0.5) * j; fY += (Math.random() - 0.5) * j;
			this.psychology.lastJitterTick = ctx.currentTick;
		}
		return { x: fX, y: fY };
	}

	calculateAdvancedInfluence(cell, player, ctx) {
		const settings = ctx.settings, cellSize = cell.size, eatMult = ctx.eatMult;
		const truncatedInf = cellSize > 0 ? Math.log10(cellSize * cellSize) : 0;
		let mx = 0, my = 0, tix = 0, tiy = 0, oix = 0, oiy = 0;

		const border = this._getValidBorder(player);
		if (border) {
			const dx = border.x - cell.x, dy = border.y - cell.y;
			const dSq = dx * dx + dy * dy;
			const invD = 1 / Math.max(1, Math.sqrt(dSq));
			
			// Center-Heatmap Logic: Pull towards center (0,0 typically, or border center)
			const heatmapWeight = (cellSize / 1000) * 0.1; // Larger bots want center more
			mx += (border.x - cell.x) * heatmapWeight;
			my += (border.y - cell.y) * heatmapWeight;

			mx += (dx * invD) * 0.05;
			my += (dy * invD) * 0.05;
		}

		// Optimization: Limit enemies checked for influence to prevent lag on crowded servers
		let enemyCount = 0;
		const maxEnemiesToCheck = 50;

		for (const d of ctx.visible.enemies) {
			if (enemyCount >= maxEnemiesToCheck) break;
			const eSize = d.cell.size;
			const dx = d.dx, dy = d.dy;
			const invDist = 1 / Math.max(1, d.dist - cellSize - eSize);
			const s = invDist * invDist;

			if (this.canEat(cellSize, eSize, eatMult)) {
				const c = truncatedInf * s;
				mx += dx * c; my += dy * c; oix += dx * c; oiy += dy * c;
			} else if (this.canEat(eSize, cellSize, eatMult)) {
				const c = (truncatedInf * ctx.cellCount) * s;
				tix -= dx * c; tiy -= dy * c;
			}
			enemyCount++;
		}

		const pMaxSq = settings.pelletMaxSize;
		// Optimization: Don't iterate all pellets. Limit to closest or substantial ones
		// We use a simplified loop that breaks early or skips far ones if list is sorted, 
		// but since it's not sorted, we just limit the count.
		let pelletCount = 0;
		const maxPelletsToCheck = 20;

		for (const d of ctx.visible.pellets) {
			if (pelletCount >= maxPelletsToCheck) break;
			// Simple distance check before expensive math (dist is already calced but this is just for safety/logic flow)
			if (d.dist > cellSize * 5) continue; // Ignore far pellets for influence

			const invDist = 1 / Math.max(1, d.dist - cellSize - d.cell.size);
			const contribution = (1 + d.cell.size / pMaxSq) * invDist * invDist;
			mx += (d.cell.x - cell.x) * contribution;
			my += (d.cell.y - cell.y) * contribution;
			pelletCount++;
		}

		for (const d of ctx.visible.viruses) {
			const invDist = 1 / Math.max(1, d.dist - cellSize - d.cell.size);
			const inf = ctx.cellCount >= settings.playerMaxCells ? truncatedInf * 2 : (ctx.threatsNearby > 0 ? truncatedInf : -ctx.cellCount);
			const contribution = inf * invDist * invDist;
			mx += (d.cell.x - cell.x) * contribution;
			my += (d.cell.y - cell.y) * contribution;
		}

		const tw = Math.max(0.1, 1 + (1 - Math.max(1, cellSize / 200)) * 2);
		return { x: mx + tix * tw + oix, y: my + tiy * tw + oiy };
	}

	/**
	 * Prediction logic
	 */
	predictPlayerPosition(cell, ticksAhead, ctx) {
		const id = this._getOwnerId(cell);
		const pat = id && this.memory.playerPatterns.get(id);
		let x = cell.x, y = cell.y;
		
		if (pat && pat.positions.length >= 2) {
			const last = pat.positions[pat.positions.length - 1], prev = pat.positions[pat.positions.length - 2];
			const idiff = 1 / Math.max(1, last.tick - prev.tick);
			x += (last.x - prev.x) * idiff * ticksAhead;
			y += (last.y - prev.y) * idiff * ticksAhead;
		}

		// Destination Bias: If small, they likely move towards pellets. If large and chasing us, they move towards us.
		if (ctx && ctx.bestPellet && cell.size < 100) {
			const p = ctx.bestPellet.cell;
			x = x * 0.8 + p.x * 0.2;
			y = y * 0.8 + p.y * 0.2;
		}

		const border = this._getValidBorder(this.player);
		if (border) return { x: this._clampToBorder(x, border.x - border.w, border.x + border.w), y: this._clampToBorder(y, border.y - border.h, border.y + border.h) };
		return { x, y };
	}

	/**
	 * Memory & Decay Helpers
	 */
	updateMemoryDecay(tick) {
		const decay = (m) => { for (let [i, d] of m.entries()) if (!d || tick - d.lastSeen > this.memoryDecayTicks || tick - d.lastSeen < 0) m.delete(i); };
		decay(this.memory.threats); decay(this.memory.opportunities); decay(this.memory.playerPatterns);
		
		// Decay virus shots
		for (const [id, count] of this.virusShots) {
			if (!this.player.visibleCells[id]) this.virusShots.delete(id);
		}

		// Fix: Memory leak prevention for long-running servers
		if (this.memory.playerPatterns.size > 50) {
			let oldestKey = null, oldestTime = Infinity;
			for (const [k, v] of this.memory.playerPatterns) {
				if (v.lastSeen < oldestTime) { oldestTime = v.lastSeen; oldestKey = k; }
			}
			if (oldestKey) this.memory.playerPatterns.delete(oldestKey);
		}
	}


	canCellMerge(c, s, currentTick, stepMult) {
		if (!c || c.birthTick === undefined) return { canMerge: false, ticksToMerge: Infinity };
		const age = (currentTick - c.birthTick) * stepMult, size = Math.max(1, c.size);
		let d = s.playerNoMergeDelay || 15;
		if (s.playerMergeTime > 0) {
			const initial = Math.round(25 * s.playerMergeTime);
			const increase = Math.round(25 * size * (s.playerMergeTimeIncrease || 0.02));
			d = Math.max(d, s.playerMergeVersion === "new" ? Math.max(initial, increase) : initial + increase);
		}
		return { canMerge: age >= d, ticksToMerge: Math.max(0, d - age) };
	}

	/**
	 * Logic: Check for baiting opportunities
	 */
	checkBaitingOpportunity(cell, player, ctx) {
		const baitRadius = cell.size * 4, eatMult = ctx.eatMult, virusRadius = cell.size * 6;
		for (const data of ctx.visible.enemies) {
			const check = data.cell;
			if (this.canEat(cell.size, check.size, eatMult) && this.canEat(check.size * 1.5, cell.size, eatMult) && data.dist < baitRadius) {
				let baitPos = null;
				for (const vData of ctx.nearTactical.viruses) {
					if (vData.dist < virusRadius) {
						baitPos = { x: (check.x + vData.cell.x) * 0.5, y: (check.y + vData.cell.y) * 0.5 };
						break;
					}
				}
				if (!baitPos) {
					const border = this._getValidBorder(player);
					if (border) {
						const corners = [{ x: border.x - border.w, y: border.y - border.h }, { x: border.x + border.w, y: border.y - border.h }, { x: border.x - border.w, y: border.y + border.h }, { x: border.x + border.w, y: border.y + border.h }];
						const limit8Sq = (cell.size * 8) ** 2;
						for (let c of corners) if ((c.x - cell.x) ** 2 + (c.y - cell.y) ** 2 < limit8Sq) { baitPos = c; break; }
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
		if (cell.mass < 250 || this.ejectCooldownTicks > 0 || ctx.nearTactical.viruses.length === 0) return { action: null };
		const settings = ctx.settings, virusRadius = cell.size * 5, eatMult = ctx.eatMult;
		for (const vData of ctx.nearTactical.viruses) {
			const virus = vData.cell;
			if (vData.dist > virusRadius) continue;
			
			// Ultra-Elite: Virus Sniper Logic (7-shot split)
			const dxV = virus.x - cell.x, dyV = virus.y - cell.y, distV = Math.sqrt(dxV * dxV + dyV * dyV);
			const invDistV = 1 / distV, dirX = dxV * invDistV, dirY = dyV * invDistV;
			
			for (const eData of ctx.visible.enemies) {
				const enemy = eData.cell, dxE = enemy.x - virus.x, dyE = enemy.y - virus.y;
				const distETask = dxE * dirX + dyE * dirY;
				const crossDist = Math.abs(dxE * -dirY + dyE * dirX);
				
				// If enemy is along the split path (trajectory projection)
				const boost = settings.virusSplitBoost || 780;
				if (distETask > 0 && distETask < boost && crossDist < enemy.size) {
					// We have a target. How many shots?
					const shots = this.virusShots.get(virus.id) || 0;
					this.virusShots.set(virus.id, shots + 1);
					return { action: "feed", x: virus.x, y: virus.y, virus, target: enemy };
				}
			}

			if (this.strategy.mode === "defensive" && ctx.closestThreat) {
				const threat = ctx.closestThreat.cell, dx = threat.x - cell.x, dy = threat.y - cell.y, vx = virus.x - cell.x, vy = virus.y - cell.y;
				if ((dx * vx + dy * vy) > 0 && vData.dist < cell.size * 3) return { action: "feed", x: virus.x, y: virus.y, virus };
			}
			let enemiesNearby = 0;
			if (settings.virusGrowSplitting || vData.dist < virus.size * 3) {
				for (const eData of ctx.visible.enemies) {
					const enemy = eData.cell, dx = enemy.x - virus.x, dy = enemy.y - virus.y, d2 = dx * dx + dy * dy;
					if (settings.virusGrowSplitting && this.canEat(enemy.size, cell.size * 0.5, ctx.eatMult)) {
						const snipeRange = (settings.virusSplitBoost || 780) + enemy.size;
						if (d2 < snipeRange * snipeRange && (dx * (cell.x - virus.x) + dy * (cell.y - virus.y)) < 0) return { action: "feed", x: virus.x, y: virus.y, virus, target: enemy };
					}
					if (d2 < (virus.size * 3) ** 2) enemiesNearby++;
				}
			}
			if (enemiesNearby > 0 && virus.world && virus.world.virusCount < virus.world.settings.virusMaxCount) {
				// Virus Farming: If at max cells, grow viruses to eat them
				if (ctx.cellCount >= settings.playerMaxCells) return { action: "feed", x: virus.x, y: virus.y, virus };
				return { action: "feed", x: virus.x, y: virus.y, virus };
			}
		}
		return { action: null };
	}

	/**
	 * Logic: Create a virus wall in front of a threat
	 */
	checkVirusWallOpportunity(cell, player, ctx) {
		if (cell.mass < 1000 || this.ejectCooldownTicks > 0) return { shouldShoot: false };
		const threat = ctx.closestThreat;
		if (!threat || threat.dist > cell.size * 5) return { shouldShoot: false };

		// Find a virus between us and the threat
		const dx = threat.cell.x - cell.x, dy = threat.cell.y - cell.y;
		const dist = threat.dist, invD = 1 / dist;
		const dirX = dx * invD, dirY = dy * invD;

		for (const vData of ctx.nearTactical.viruses) {
			const v = vData.cell;
			const vdx = v.x - cell.x, vdy = v.y - cell.y;
			const vDot = (vdx * dirX + vdy * dirY);
			// If virus is in the general direction of the threat and close enough to shoot
			if (vDot > cell.size && vDot < dist * 0.8) {
				const crossDist = Math.abs(vdx * -dirY + vdy * dirX);
				if (crossDist < v.size) return { shouldShoot: true, x: v.x, y: v.y };
			}
		}
		return { shouldShoot: false };
	}

	/**
	 * Logic: Position near large enemies about to auto-split
	 */
	checkAutoSplitFarming(cell, player, ctx) {
		if (ctx.enemyPops.length === 0) return { shouldFarm: false };
		const target = ctx.enemyPops[0];
		// Position slightly offset to catch pieces but not get merged into
		const dx = target.cell.x - cell.x, dy = target.cell.y - cell.y, dist = target.dist;
		const offsetDist = target.cell.size + cell.size * 1.5;
		return { shouldFarm: true, x: target.cell.x - (dx / dist) * offsetDist, y: target.cell.y - (dy / dist) * offsetDist };
	}

	/**
	 * Logic: Identify candidates for split-scooping (multiple small cells)
	 */
	identifyAutoSplitCandidates(player, ctx) {
		const largest = ctx.largest, settings = ctx.settings, eatMult = ctx.eatMult;
		const splitLimit = largest.size / (settings.playerSplitSizeDiv || 1.414);
		return ctx.visible.enemies.filter(e => this.canEat(splitLimit, e.cell.size, eatMult) && e.dist < splitLimit * 2).map(e => e.cell);
	}

	/**
	 * Logic: Select the best single target for chasing/splitting
	 */
	scoreTarget(cell, target, player, ctx, scanRadiusSq) {
		const invSize = ctx.invLargestSize, dx = target.x - cell.x, dy = target.y - cell.y, dist = Math.sqrt(dx * dx + dy * dy);
		const pred = this.predictPlayerPosition(target, Math.round(ctx.settings.serverFrequency * 0.6), ctx);
		const predDist = Math.sqrt((pred.x - cell.x) ** 2 + (pred.y - cell.y) ** 2), eatMult = ctx.eatMult;
		const border = this._getValidBorder(player);
		
		let score = (target.size * 2.5) + (invSize / (invSize + dist) * 30);
		
		// Align score with predictive position
		score += (invSize / (invSize + predDist) * 60);

		// Multi-threat risk assessment with distance decay
		let risk = 0;
		for (const data of ctx.nearTactical.threats) {
			const decay = 1 / (1 + data.distSq * (invSize * invSize));
			risk += (data.cell.size * invSize) * decay * 50;
			
			// Penalty for proximity between threat and target (avoid being pinched)
			const d2Target = (data.cell.x - target.x) ** 2 + (data.cell.y - target.y) ** 2;
			if (d2Target < (cell.size * 3) ** 2) score -= 20;
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
		const canSplitKill = this.canEat(sSize, target.size, eatMult) && dist - sDist <= cell.size - target.size / (ctx.settings.worldEatOverlapDiv || 3);
		
		if (canSplitKill) score += 150;

		return score - risk;
	}

	selectBestTarget(cell, player, ctx) {
		if (ctx.bestOpportunity) return ctx.bestOpportunity.cell;
		if (ctx.bestMotherCell) return ctx.bestMotherCell.cell;
		if (ctx.bestPellet) return ctx.bestPellet.cell;
		return null;
	}

	/**
	 * Logic: Validate split-kill attempt
	 */
	shouldAttemptSplitKill(cell, player, target, ctx, scanRadiusSq) {
		if (this.splitCooldownTicks > 0 || ctx.cellCount >= ctx.settings.playerMaxCells) return false;
		for (const vData of ctx.nearTactical.viruses) if (vData.dist < cell.size * 2) return false;
		return this.scoreTarget(cell, target, player, ctx, scanRadiusSq) > 50 && this.strategy.riskTolerance > 0.3;
	}

	checkLuringOpportunity(cell, player, ctx) {
		if (cell.mass < 500 || this.ejectCooldownTicks > 0) return { shouldLure: false };
		const innerLimitSq = (cell.size * 3) ** 2, outerLimitSq = (cell.size * 6) ** 2, eatMult = ctx.eatMult;
		for (const eData of ctx.visible.enemies) {
			const enemy = eData.cell;
			if (this.canEat(cell.size, enemy.size * 2, eatMult) && eData.distSq > innerLimitSq && eData.distSq < outerLimitSq) {
				// Deceptive Gifting: Throw some mass to lure them in
				if (this.strategy.mode === "deceptive" && Math.random() < 0.3) return { shouldLure: true, x: enemy.x, y: enemy.y, action: "gift" };
				return { shouldLure: true, x: enemy.x, y: enemy.y };
			}
		}
		return { shouldLure: false };
	}

	onNewOwnedCell(cell) {
		// Prevent double-hooking (recursion/stack overflow protection)
		if (cell._botHooked) return;

		const original = (typeof cell.whenAte === 'function') ? cell.whenAte.bind(cell) : null;

		cell.whenAte = (other) => {
			if (original) original(other);
			// Safety: Ensure valid objects and bot still exists before kill check
			if (this.hasPlayer && other && other.type === 0 && other.owner && other.owner.id !== this.player.id) this.onKill(other);
		};
		cell._botHooked = true;
	}

	onKill(victim) {
		if (!this.hasPlayer) return;
		this.social.killStreak++;
		if (this.social.chatCooldown > 0) return;
		let name = "An unnamed cell";
		if (victim && victim.owner) {
			const n = victim.owner.leaderboardName;
			if (typeof n === 'string' && n.length > 0 && n !== "An unnamed cell") name = n;
		}
		let msg = "";
		if (this.social.killStreak % 5 === 0) msg = `${this.social.killStreak} KILLSTREAK! UNSTOPPABLE!`;
		else msg = this.bragMessages[~~(Math.random() * this.bragMessages.length)].replace("{target}", name);
		this.sendChat(msg);
		this.social.chatCooldown = 125;
	}
	/**
	 * Priority Engine: Evaluate tactical actions
	 */
	_evaluateTacticalAction(cell, player, ctx) {
		// 1. Virus Sniper (Sniper has highest priority if mass is sufficient)
		const vSnipe = this.checkVirusManipulation(cell, player, ctx);
		if (vSnipe.action === "feed") return { x: vSnipe.x, y: vSnipe.y, type: "eject" };

		// 2. Virus Walls (Defensive shooting)
		const vWall = this.checkVirusWallOpportunity(cell, player, ctx);
		if (vWall.shouldShoot) return { x: vWall.x, y: vWall.y, type: "eject" };

		// 3. Auto-Split Farming
		const farming = this.checkAutoSplitFarming(cell, player, ctx);
		if (farming.shouldFarm) return { x: farming.x, y: farming.y, type: "move" };

		// 4. Baiting 
		const bait = this.checkBaitingOpportunity(cell, player, ctx);
		if (bait.shouldBait) return { x: bait.x, y: bait.y, type: "move" };

		// 5. Luring 
		const lure = this.checkLuringOpportunity(cell, player, ctx);
		if (lure.shouldLure) return { x: lure.x, y: lure.y, type: lure.action === "gift" ? "eject" : "move" };

		return null;
	}
}

module.exports = AdvancedPlayerBot;
