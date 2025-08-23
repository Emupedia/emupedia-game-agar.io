const { throwIfBadNumber } = require("../primitives/Misc");

/**
 * Anti-teaming detection and punishment system for FFA gamemode
 */
class AntiTeaming {
	/**
	 * @param {World} world
	 */
	constructor(world) {
		this.world = world;
		this.handle = world.handle;
		
		/** @type {Map<number, PlayerTeamingData>} */
		this.playerData = new Map();
		
		/** @type {Set<string>} */
		this.teamingPairs = new Set();
		
		/** @type {Map<number, number>} */
		this.playerWarnings = new Map();
		
		/** @type {Map<string, number>} */
		this.lastMessageTimes = new Map(); // Track last message time for each player-message type
		this.messageCooldown = 125; // 5 seconds cooldown between similar messages (125 ticks)
		
		this.lastCheckTick = 0;
		this.checkInterval = 25; // Check every second (assuming 25 TPS)
	}

	get settings() {
		return this.handle.settings;
	}

	get logger() {
		return this.handle.logger;
	}

	/**
	 * Initialize player data for anti-teaming tracking
	 * @param {Player} player
	 */
	initializePlayer(player) {
		if (!this.playerData.has(player.id)) {
			this.playerData.set(player.id, {
				id: player.id,
				lastPositions: [],
				proximityTimes: new Map(),
				massTransfers: new Map(),
				avoidanceCount: 0,
				lastMassLossTime: 0,
				suspicionLevel: 0,
				isBeingTracked: false
			});
		}
	}

	/**
	 * Remove player data when player leaves
	 * @param {Player} player
	 */
	removePlayer(player) {
		this.playerData.delete(player.id);
		this.playerWarnings.delete(player.id);
		
		// Remove message cooldown data for this player
		const messagesToRemove = [];
		for (const messageKey of this.lastMessageTimes.keys()) {
			if (messageKey.startsWith(`${player.id}_`)) {
				messagesToRemove.push(messageKey);
			}
		}
		messagesToRemove.forEach(key => this.lastMessageTimes.delete(key));
		
		// Remove any teaming pairs involving this player
		const toRemove = [];
		for (const pair of this.teamingPairs) {
			if (pair.includes(`_${player.id}_`) || pair.startsWith(`${player.id}_`) || pair.endsWith(`_${player.id}`)) {
				toRemove.push(pair);
			}
		}
		toRemove.forEach(pair => this.teamingPairs.delete(pair));
	}

	/**
	 * Main anti-teaming update function
	 */
	update() {
		if (this.handle.tick - this.lastCheckTick < this.checkInterval) {
			return;
		}

		if (!this.settings.antiTeamingEnabled) {
			return;
		}

		this.lastCheckTick = this.handle.tick;
		this.updatePlayerPositions();
		this.checkProximityTeaming();
		this.checkMassTransferTeaming();
		this.checkAvoidanceTeaming();
		this.updateSuspicionLevels();
		this.applyPunishments();
	}

	/**
	 * Update player position history
	 */
	updatePlayerPositions() {
		for (const player of this.world.players) {
			if (player.state !== 0 || player.ownedCells.length === 0) continue;

			this.initializePlayer(player);
			const data = this.playerData.get(player.id);

			// Calculate center of mass for player
			let totalX = 0, totalY = 0, totalMass = 0;
			for (const cell of player.ownedCells) {
				const mass = cell.mass;
				totalX += cell.x * mass;
				totalY += cell.y * mass;
				totalMass += mass;
			}

			const centerX = totalX / totalMass;
			const centerY = totalY / totalMass;

			data.lastPositions.push({
				x: centerX,
				y: centerY,
				mass: totalMass,
				cellCount: player.ownedCells.length,
				tick: this.handle.tick
			});

			// Keep only last 10 positions (10 seconds of data)
			if (data.lastPositions.length > 10) {
				data.lastPositions.shift();
			}
		}
	}

	/**
	 * Check for proximity-based teaming
	 */
	checkProximityTeaming() {
		const players = this.world.players.filter(p => p.state === 0 && p.ownedCells.length > 0);

		for (let i = 0; i < players.length; i++) {
			for (let j = i + 1; j < players.length; j++) {
				const player1 = players[i];
				const player2 = players[j];
				
				this.checkProximityBetweenPlayers(player1, player2);
			}
		}
	}

	/**
	 * Check proximity between two specific players
	 * @param {Player} player1
	 * @param {Player} player2
	 */
	checkProximityBetweenPlayers(player1, player2) {
		const data1 = this.playerData.get(player1.id);
		const data2 = this.playerData.get(player2.id);

		if (!data1 || !data2 || data1.lastPositions.length === 0 || data2.lastPositions.length === 0) {
			return;
		}

		const pos1 = data1.lastPositions[data1.lastPositions.length - 1];
		const pos2 = data2.lastPositions[data2.lastPositions.length - 1];

		const distance = Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
		const avgSize = (Math.sqrt(pos1.mass * 100) + Math.sqrt(pos2.mass * 100)) / 2;
		const suspiciousDistance = avgSize * this.settings.antiTeamingProximityMultiplier;

		const pairKey = this.getPairKey(player1.id, player2.id);

		if (distance < suspiciousDistance) {
			// Players are close - increment proximity time
			const currentTime = data1.proximityTimes.get(player2.id) || 0;
			data1.proximityTimes.set(player2.id, currentTime + 1);
			data2.proximityTimes.set(player1.id, currentTime + 1);

			// Check if they've been close for too long
			if (currentTime > this.settings.antiTeamingProximityThreshold) {
				data1.suspicionLevel += this.settings.antiTeamingProximitySuspicion;
				data2.suspicionLevel += this.settings.antiTeamingProximitySuspicion;
				
				// Send messages to both players about proximity detection (if enabled)
				if (this.settings.antiTeamingShowDetectionMessages) {
					this.sendMessageToPlayer(player1, "⚠️ Anti-teaming: You've been too close to another player for too long. Keep distance in FFA!", "proximity");
					this.sendMessageToPlayer(player2, "⚠️ Anti-teaming: You've been too close to another player for too long. Keep distance in FFA!", "proximity");
				}
				
				if (!this.teamingPairs.has(pairKey)) {
					this.teamingPairs.add(pairKey);
					this.logger.warn(`Suspected teaming detected between players ${player1.id} and ${player2.id} (proximity)`);
				}
			}
		} else {
			// Players are not close - reset proximity time
			data1.proximityTimes.set(player2.id, 0);
			data2.proximityTimes.set(player1.id, 0);
		}
	}

	/**
	 * Check for mass transfer teaming (players feeding each other)
	 */
	checkMassTransferTeaming() {
		// This will be triggered when cells are eaten
		// We'll track rapid mass changes between specific players
	}

	/**
	 * Called when a cell is eaten to check for suspicious mass transfers
	 * @param {Cell} eatenCell
	 * @param {Cell} eaterCell
	 */
	onCellEaten(eatenCell, eaterCell) {
		if (!this.settings.antiTeamingEnabled) return;
		
		if (eatenCell.type === 0 && eaterCell.type === 0) {
			// Player cell eaten by another player cell
			const victim = eatenCell.owner;
			const eater = eaterCell.owner;

			if (victim.id === eater.id) return; // Same player, not teaming

			const victimData = this.playerData.get(victim.id);
			const eaterData = this.playerData.get(eater.id);

			if (!victimData || !eaterData) return;

			// Check if this looks like intentional feeding
			const massTransferred = eatenCell.mass;
			const timeSinceLastTransfer = this.handle.tick - (victimData.lastMassLossTime || 0);

			if (timeSinceLastTransfer < this.settings.antiTeamingMassTransferWindow) {
				// Recent mass transfer - increase suspicion
				const transferKey = this.getPairKey(victim.id, eater.id);
				const currentTransfers = eaterData.massTransfers.get(victim.id) || 0;
				eaterData.massTransfers.set(victim.id, currentTransfers + massTransferred);

				if (currentTransfers > this.settings.antiTeamingMassTransferThreshold) {
					victimData.suspicionLevel += this.settings.antiTeamingMassTransferSuspicion;
					eaterData.suspicionLevel += this.settings.antiTeamingMassTransferSuspicion;
					
					// Send messages to both players about mass transfer detection (if enabled)
					if (this.settings.antiTeamingShowDetectionMessages) {
						this.sendMessageToPlayer(victim, "⚠️ Anti-teaming: Suspicious feeding pattern detected. Don't intentionally feed other players!", "feeding");
						this.sendMessageToPlayer(eater, "⚠️ Anti-teaming: Suspicious feeding pattern detected. Don't accept intentional feeding!", "feeding");
					}
					
					this.teamingPairs.add(transferKey);
					this.logger.warn(`Suspected teaming detected between players ${victim.id} and ${eater.id} (mass transfer)`);
				}
			}

			victimData.lastMassLossTime = this.handle.tick;
		}
	}

	/**
	 * Check for avoidance-based teaming (players avoiding each other when they could eat)
	 */
	checkAvoidanceTeaming() {
		const players = this.world.players.filter(p => p.state === 0 && p.ownedCells.length > 0);

		for (let i = 0; i < players.length; i++) {
			for (let j = i + 1; j < players.length; j++) {
				const player1 = players[i];
				const player2 = players[j];
				
				this.checkAvoidanceBetweenPlayers(player1, player2);
			}
		}
	}

	/**
	 * Check avoidance patterns between two players
	 * @param {Player} player1
	 * @param {Player} player2
	 */
	checkAvoidanceBetweenPlayers(player1, player2) {
		// Check if players could eat each other but consistently avoid doing so
		for (const cell1 of player1.ownedCells) {
			for (const cell2 of player2.ownedCells) {
				const distance = Math.sqrt((cell1.x - cell2.x) ** 2 + (cell1.y - cell2.y) ** 2);
				const eatDistance = Math.max(cell1.size, cell2.size) * 2;

				if (distance < eatDistance) {
					const canEat1 = cell1.size > cell2.size * this.settings.worldEatMult;
					const canEat2 = cell2.size > cell1.size * this.settings.worldEatMult;

					if (canEat1 || canEat2) {
						// They're close enough and one could eat the other
						const data1 = this.playerData.get(player1.id);
						const data2 = this.playerData.get(player2.id);
						
						if (data1 && data2) {
							data1.avoidanceCount++;
							data2.avoidanceCount++;

							if (data1.avoidanceCount > this.settings.antiTeamingAvoidanceThreshold) {
								data1.suspicionLevel += this.settings.antiTeamingAvoidanceSuspicion;
								data2.suspicionLevel += this.settings.antiTeamingAvoidanceSuspicion;
								
								// Send messages to both players about avoidance detection (if enabled)
								if (this.settings.antiTeamingShowDetectionMessages) {
									this.sendMessageToPlayer(player1, "⚠️ Anti-teaming: You're avoiding eating players you could consume. This looks like teaming!", "avoidance");
									this.sendMessageToPlayer(player2, "⚠️ Anti-teaming: You're avoiding eating players you could consume. This looks like teaming!", "avoidance");
								}
							}
						}
					}
				}
			}
		}
	}

	/**
	 * Update suspicion levels and decay them over time
	 */
	updateSuspicionLevels() {
		for (const [playerId, data] of this.playerData) {
			// Decay suspicion over time
			data.suspicionLevel *= this.settings.antiTeamingSuspicionDecay;
			
			// Reset counters periodically
			if (this.handle.tick % (25 * 30) === 0) { // Every 30 seconds
				data.avoidanceCount = Math.floor(data.avoidanceCount * 0.5);
				data.massTransfers.clear();
			}
		}
	}

	/**
	 * Apply punishments based on suspicion levels
	 */
	applyPunishments() {
		for (const [playerId, data] of this.playerData) {
			const player = this.world.players.find(p => p.id === playerId);
			if (!player || player.state !== 0) continue;

			if (data.suspicionLevel >= this.settings.antiTeamingPunishmentThreshold) {
				this.punishPlayer(player, data);
			} else if (data.suspicionLevel >= this.settings.antiTeamingWarningThreshold) {
				this.warnPlayer(player);
			}
		}
	}

	/**
	 * Warn a player about suspected teaming
	 * @param {Player} player
	 */
	warnPlayer(player) {
		const warnings = this.playerWarnings.get(player.id) || 0;
		
		if (warnings === 0) {
			// Only send warning message if warnings are enabled
			if (this.settings.antiTeamingShowWarnings) {
				this.sendMessageToPlayer(player, "⚠️ WARNING: Suspected teaming behavior detected. FFA means everyone fights alone!", "warning");
			}
			this.playerWarnings.set(player.id, 1);
			this.logger.warn(`Warning issued to player ${player.id} for suspected teaming${this.settings.antiTeamingShowWarnings ? "" : " (silent)"}`);
		}
	}

	/**
	 * Punish a player for confirmed teaming
	 * @param {Player} player
	 * @param {PlayerTeamingData} data
	 */
	punishPlayer(player, data) {
		const warnings = this.playerWarnings.get(player.id) || 0;
		
		if (warnings < this.settings.antiTeamingMaxWarnings) {
			// Issue warning and potentially reduce mass
			let punishmentApplied = false;
			
			if (this.settings.antiTeamingMassLossPunishment) {
				this.reduceMass(player, this.settings.antiTeamingMassLossPercent / 100);
				punishmentApplied = true;
				
				if (this.settings.antiTeamingShowWarnings) {
					this.sendMessageToPlayer(player, `🚫 PUNISHMENT: Teaming detected! Mass reduced by ${this.settings.antiTeamingMassLossPercent}%`, "punishment");
				}
			} else if (this.settings.antiTeamingShowWarnings) {
				this.sendMessageToPlayer(player, `⚠️ WARNING: Teaming behavior detected! Stop teaming or face consequences.`, "punishment");
			}
			
			this.playerWarnings.set(player.id, warnings + 1);
			data.suspicionLevel *= 0.5; // Reduce suspicion after punishment
			
			const logMessage = punishmentApplied ? 
				`Player ${player.id} punished for teaming with mass loss (warning ${warnings + 1}/${this.settings.antiTeamingMaxWarnings})` :
				`Player ${player.id} warned for teaming without mass loss (warning ${warnings + 1}/${this.settings.antiTeamingMaxWarnings})`;
			this.logger.warn(`${logMessage}${this.settings.antiTeamingShowWarnings ? "" : " (silent)"}`);
		} else if (this.settings.antiTeamingBanEnabled) {
			// Temporary ban (only if enabled)
			if (this.settings.antiTeamingShowWarnings) {
				this.sendMessageToPlayer(player, "🔨 BANNED: Repeated teaming violations. You have been temporarily banned.", "ban");
			}
			this.temporarilyBanPlayer(player);
			
			this.logger.warn(`Player ${player.id} temporarily banned for repeated teaming violations${this.settings.antiTeamingShowWarnings ? "" : " (silent)"}`);
		} else {
			// Maximum warnings reached but bans are disabled
			let punishmentApplied = false;
			
			if (this.settings.antiTeamingMassLossPunishment) {
				this.reduceMass(player, this.settings.antiTeamingMassLossPercent / 100);
				punishmentApplied = true;
				
				if (this.settings.antiTeamingShowWarnings) {
					this.sendMessageToPlayer(player, `🚫 FINAL WARNING: Continued teaming detected! Mass reduced by ${this.settings.antiTeamingMassLossPercent}%`, "final_warning");
				}
			} else if (this.settings.antiTeamingShowWarnings) {
				this.sendMessageToPlayer(player, `🚫 FINAL WARNING: Continued teaming detected! No further warnings will be given.`, "final_warning");
			}
			
			data.suspicionLevel *= 0.3; // Reduce suspicion more after final warning
			
			const logMessage = punishmentApplied ?
				`Player ${player.id} received final warning for continued teaming with mass loss (bans disabled)` :
				`Player ${player.id} received final warning for continued teaming without mass loss (bans disabled)`;
			this.logger.warn(`${logMessage}${this.settings.antiTeamingShowWarnings ? "" : " (silent)"}`);
		}
	}

	/**
	 * Reduce a player's mass as punishment
	 * @param {Player} player
	 * @param {number} percentage
	 */
	reduceMass(player, percentage) {
		for (const cell of player.ownedCells) {
			cell.mass *= (1 - percentage);
			cell.mass = Math.max(cell.mass, this.settings.playerMinSize * this.settings.playerMinSize / 100);
		}
	}

	/**
	 * Temporarily ban a player
	 * @param {Player} player
	 */
	temporarilyBanPlayer(player) {
		if (player.router.isExternal) {
			// Add to temporary ban list
			const banDuration = this.settings.antiTeamingBanDuration * 1000; // Convert to milliseconds
			const banEnd = Date.now() + banDuration;
			
			// Store ban info (you might want to persist this)
			this.handle.tempBans = this.handle.tempBans || new Map();
			this.handle.tempBans.set(player.router.remoteAddress, banEnd);
			
			// Disconnect the player
			player.router.closeSocket(1008, "Temporary ban for teaming violations");
		}
	}

	/**
	 * Send a message to a specific player with cooldown to prevent spam
	 * @param {Player} player
	 * @param {string} message
	 * @param {string} messageType - Type of message for cooldown tracking
	 */
	sendMessageToPlayer(player, message, messageType = "default") {
		if (!player.router.isExternal) return;
		
		const cooldownKey = `${player.id}_${messageType}`;
		const lastMessageTime = this.lastMessageTimes.get(cooldownKey) || 0;
		const currentTime = this.handle.tick;
		
		// Check if enough time has passed since last message of this type
		if (currentTime - lastMessageTime >= this.messageCooldown) {
			this.handle.listener.globalChat.directMessage(null, player.router, message);
			this.lastMessageTimes.set(cooldownKey, currentTime);
		}
	}

	/**
	 * Get a unique key for a player pair
	 * @param {number} id1
	 * @param {number} id2
	 * @returns {string}
	 */
	getPairKey(id1, id2) {
		return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
	}

	/**
	 * Check if a player is currently suspected of teaming
	 * @param {number} playerId
	 * @returns {boolean}
	 */
	isPlayerSuspected(playerId) {
		const data = this.playerData.get(playerId);
		return data && data.suspicionLevel >= this.settings.antiTeamingWarningThreshold;
	}

	/**
	 * Get the mass absorption multiplier for a suspected player
	 * @param {number} playerId
	 * @param {Cell} eatenCell - The cell being consumed (for logging/messaging)
	 * @returns {number} Multiplier between 0 and 1
	 */
	getMassAbsorptionMultiplier(playerId, eatenCell = null) {
		if (!this.settings.antiTeamingStealthyPunishment || !this.settings.antiTeamingEnabled) {
			return 1.0;
		}

		const data = this.playerData.get(playerId);
		if (!data) return 1.0;

		// Apply penalty if player has any suspicion above warning threshold
		if (data.suspicionLevel >= this.settings.antiTeamingWarningThreshold) {
			const player = this.world.players.find(p => p.id === playerId);
			if (player) {
				this.logger.debug(`Stealthy punishment applied to player ${playerId}: mass absorption reduced to ${this.settings.antiTeamingMassAbsorptionPenalty * 100}%`);
				
				// Optional message to player (disabled by default for stealth)
				if (this.settings.antiTeamingStealthyMessage && eatenCell && eatenCell.type === 0) {
					this.sendMessageToPlayer(player, "⚠️ Anti-teaming: Your mass absorption is reduced due to suspected teaming behavior.", "stealthy");
				}
			}
			
			return this.settings.antiTeamingMassAbsorptionPenalty;
		}

		return 1.0;
	}

	/**
	 * Get teaming statistics for admin purposes
	 * @returns {Object}
	 */
	getTeamingStats() {
		const suspectedPlayers = Array.from(this.playerData.values())
			.filter(data => data.suspicionLevel >= this.settings.antiTeamingWarningThreshold)
			.length;
			
		const stealthyPunishedPlayers = this.settings.antiTeamingStealthyPunishment ? suspectedPlayers : 0;
		
		return {
			totalPlayers: this.playerData.size,
			suspectedPlayers,
			activePairs: this.teamingPairs.size,
			totalWarnings: Array.from(this.playerWarnings.values()).reduce((sum, w) => sum + w, 0),
			stealthyPunishedPlayers,
			stealthyPunishmentEnabled: this.settings.antiTeamingStealthyPunishment,
			massAbsorptionPenalty: this.settings.antiTeamingMassAbsorptionPenalty
		};
	}
}

/**
 * @typedef {Object} PlayerTeamingData
 * @property {number} id
 * @property {Array<{x: number, y: number, mass: number, cellCount: number, tick: number}>} lastPositions
 * @property {Map<number, number>} proximityTimes
 * @property {Map<number, number>} massTransfers
 * @property {number} avoidanceCount
 * @property {number} lastMassLossTime
 * @property {number} suspicionLevel
 * @property {boolean} isBeingTracked
 */

module.exports = AntiTeaming;
