const value = Object.seal({
	// Admin Authentication System
	adminAuthEnabled: true,                  // Enable admin authentication for chat commands
	adminPassword: "admin123",               // Password for admin access (change this!)
	adminSessionTimeout: 300000,             // Admin session timeout in milliseconds (5 minutes)

	/** @type {IPAddress[]} */
	listenerForbiddenIPs: [],
	/** @type {string[]} */
	listenerAcceptedOrigins: [],
	listenerMaxConnections: 100,
	listenerMaxClientDormancy: 1000 * 60,
	listenerMaxConnectionsPerIP: -1,
	listenerUseReCaptcha: false,
	listeningPort: 443,

	serverFrequency: 25,
	serverName: "An unnamed server",
	serverGamemode: "FFA",

	chatEnabled: true,
	chatSpectatorEnabled: true,
	/** @type {string[]} */
	chatForbiddenNames: [],
	/** @type {string[]} */
	chatFilteredPhrases: [],
	chatCooldown: 1000,

	worldMapX: 0,
	worldMapY: 0,
	worldMapW: 7071,
	worldMapH: 7071,
	worldFinderMaxLevel: 16,
	worldFinderMaxItems: 16,
	worldSafeSpawnTries: 64,
	worldSafeSpawnFromEjectedChance: 0.8,
	worldPlayerDisposeDelay: 25 * 60,

	worldEatMult: 1.140175425099138,
	worldEatOverlapDiv: 3,

	worldPlayerBotsPerWorld: 0,
	/** @type {string[]} */
	worldPlayerBotNames: [],
	/** @type {string[]} */
	worldPlayerBotSkins: [],
	worldMinionsPerPlayer: 0,
	worldMaxPlayers: 50,
	worldEnforceMinCount: true,
	worldMinCount: 0,
	worldMaxCount: 2,

	matchmakerNeedsQueuing: false,
	matchmakerBulkSize: 1,

	minionName: "Minion",
	minionSpawnSize: 32,
	minionEnableERTPControls: false,
	minionEnableQBasedControl: true,

	pelletMinSize: 10,
	pelletMaxSize: 20,
	pelletGrowTicks: 25 * 60,
	pelletCount: 1000,

	virusMinCount: 30,
	virusMaxCount: 90,
	virusSize: 100,
	virusFeedTimes: 7,
	virusGrowSplitting: true,
	virusPushing: false,
	virusSplitBoost: 780,
	virusPushBoost: 120,
	virusMonotonePops: false,

	ejectedSize: 38,
	ejectingLoss: 43,
	ejectDispersion: 0.3,
	ejectedCellBoost: 780,

	mothercellSize: 149,
	mothercellCount: 0,
	mothercellPassiveSpawnChance: 0.05,
	mothercellActiveSpawnSpeed: 1,
	mothercellPelletBoost: 90,
	mothercellMaxPellets: 96,
	mothercellMaxSize: 65535,

	playerRoamSpeed: 32,
	playerRoamViewScale: 0.4,
	playerViewScaleMult: 1,
	playerMinViewScale: 0.01,
	playerMaxNameLength: 16,
	playerAllowSkinInName: true,

	playerSpawnSize: 32,
	playerMinSize: 32,
	playerMaxSize: 1500,
	playerMaxTotalMass: 500000,
	playerMinSplitSize: 60,
	playerMinEjectSize: 60,
	playerSplitCap: 255,
	playerEjectDelay: 2,
	playerMaxCells: 16,

	playerMoveMult: 1,
	playerSplitSizeDiv: 1.414213562373095,
	playerSplitDistance: 40,
	playerSplitBoost: 780,
	playerNoCollideDelay: 13,
	playerNoMergeDelay: 15,
	/** @type {"old" | "new"} */
	playerMergeVersion: "old",
	playerMergeTime: 30,
	playerMergeTimeIncrease: 0.02,
	playerDecayMult: 0.001,
	playerDecayMultOversize: 10,

	// Anti-teaming system settings
	antiTeamingEnabled: true,
	antiTeamingStealthyPunishment: true,     // Enable stealthy mass absorption reduction
	antiTeamingStealthyMessage: false,       // Send message to player when stealthy punishment is applied (disabled for maximum stealth)
	antiTeamingShowWarnings: false,          // Show warning messages to players (can be disabled for stealth mode)
	antiTeamingShowDetectionMessages: false, // Show immediate detection messages (proximity, feeding, avoidance)
	antiTeamingMassLossPunishment: false,    // Enable direct mass loss punishment (can be disabled for stealth-only mode)
	antiTeamingBanEnabled: false,            // Enable temporary bans (disabled by default)
	antiTeamingProximityMultiplier: 3.0,     // Distance multiplier for proximity detection
	antiTeamingProximityThreshold: 10,       // Ticks players can be close before suspicion
	antiTeamingProximitySuspicion: 2,        // Suspicion points added for proximity teaming
	antiTeamingMassTransferWindow: 75,       // Ticks window to detect mass transfers (3 seconds)
	antiTeamingMassTransferThreshold: 50,    // Mass threshold for suspicious transfers
	antiTeamingMassTransferSuspicion: 5,     // Suspicion points for mass transfer teaming
	antiTeamingAvoidanceThreshold: 20,       // Avoidance instances before suspicion
	antiTeamingAvoidanceSuspicion: 1,        // Suspicion points for avoidance teaming
	antiTeamingSuspicionDecay: 0.99,         // Decay rate for suspicion levels per tick
	antiTeamingWarningThreshold: 15,         // Suspicion level for warnings
	antiTeamingPunishmentThreshold: 30,      // Suspicion level for punishment
	antiTeamingMassLossPercent: 25,          // Percentage of mass lost as punishment
	antiTeamingMaxWarnings: 3,               // Maximum warnings before ban
	antiTeamingBanDuration: 300,             // Temporary ban duration in seconds (5 minutes)
	antiTeamingMassAbsorptionPenalty: 0.5,   // Multiplier for mass gained when suspected of teaming (0.5 = 50% reduction)
});

module.exports = value;