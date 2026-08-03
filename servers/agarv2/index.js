require('dotenv').config()

const DefaultSettings = require("./src/Settings");
const { getSettingsFilePath, readSettingsFile, writeSettingsFile, reloadSettings, ensureSettingsFile } = require("./src/SettingsIO");
const ServerHandle = require("./src/ServerHandle");
const { genCommand } = require("./src/commands/CommandList");
const readline = require("readline");

const DefaultCommands = require("./src/commands/DefaultCommands");

const DefaultProtocols = [
	require("./src/protocols/LegacyProtocol"),
	require("./src/protocols/ModernProtocol"),
];

const DefaultGamemodes = [
	require("./src/gamemodes/FFA"),
	require("./src/gamemodes/PVP"),
	require("./src/gamemodes/Teams"),
	require("./src/gamemodes/LastManStanding")
];

ensureSettingsFile(DefaultSettings);

let settings = readSettingsFile();

const currentHandle = new ServerHandle(settings);
// writeSettingsFile(currentHandle.settings);
require("./log-handler")(currentHandle);
const logger = currentHandle.logger;

let commandStreamClosing = false;

const commandStream = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: true,
	prompt: "",
	historySize: 64,
	removeHistoryDuplicates: true
});

let shutdownStarted = false;

function shutdown(signal) {
	if (shutdownStarted) return;
	shutdownStarted = true;
	logger.inform(`received ${signal}, shutting down`);
	commandStreamClosing = true;
	commandStream.close();
	currentHandle.stop();
	process.exitCode = 0;

	const forceExitTimer = setTimeout(() => {
		logger.inform("graceful shutdown timed out");
		process.exit(1);
	}, 5000);
	forceExitTimer.unref();
}

commandStream.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

DefaultCommands(currentHandle.commands, currentHandle.chatCommands);
currentHandle.protocols.register(...DefaultProtocols);
currentHandle.gamemodes.register(...DefaultGamemodes);
currentHandle.commands.register(
	genCommand({
		name: "start",
		args: "",
		desc: "start the handle",
		/**
		 * @param {ServerHandle} context
		 */
		exec: (handle, context, args) => {
			if (!handle.start()) {
				handle.logger.print("handle already running");
			}
		}
	}),
	genCommand({
		name: "stop",
		args: "",
		desc: "stop the handle",
		/**
		 * @param {ServerHandle} context
		 */
		exec: (handle, context, args) => {
			if (!handle.stop()) {
				handle.logger.print("handle not started");
			}
		}
	}),
	genCommand({
		name: "exit",
		args: "",
		desc: "stop the handle and close the command stream",
		/**
		 * @param {ServerHandle} context
		 */
		exec: (handle, context, args) => {
			handle.stop();
			commandStream.close();
			commandStreamClosing = true;
		}
	}),
	genCommand({
		name: "reload",
		args: "",
		desc: "reload the settings from local settings.json",
		/**
		 * @param {ServerHandle} context
		 */
		exec: (handle, context, args) => {
			try {
				const settingsPath = reloadSettings(handle);
				logger.print(`settings reloaded from ${settingsPath}`);
			} catch (e) {
				logger.print(e.message);
			}
		}
	}),
	genCommand({
		name: "save",
		args: "",
		desc: "save the current settings to settings.json",
		/**
		 * @param {ServerHandle} context
		 */
		exec: (handle, context, args) => {
			writeSettingsFile(handle.settings);
			logger.print(`settings saved to ${getSettingsFilePath()}`);
		}
	}),
);

process.on("SIGHUP", () => {
	try {
		const settingsPath = reloadSettings(currentHandle);
		logger.inform(`settings reloaded from ${settingsPath} (SIGHUP)`);
	} catch (e) {
		logger.inform(`failed to reload settings (SIGHUP): ${e.message}`);
	}
});

function ask() {
	if (commandStreamClosing) {
		return;
	}
	commandStream.question("@ ", (input) => {
		setTimeout(ask, 0);
		if (!(input = input.trim())) {
			return;
		}
		logger.printFile(`@ ${input}`);
		if (!currentHandle.commands.execute(null, input)) {
			logger.print(`unknown command`);
		}
	});
}

setTimeout(() => {
	logger.debug("command stream open");
	ask();
}, 1000);

currentHandle.start();