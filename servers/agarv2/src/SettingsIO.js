const fs = require("fs");
const path = require("path");
const DefaultSettings = require("./Settings");

/**
 * @returns {string}
 */
function getSettingsFilePath() {
	if (process.env.DEV === "true") {
		return path.resolve("./settings.dev.json");
	}

	return path.resolve("./settings.json");
}

/**
 * @param {{ fatal?: boolean }} [options]
 * @returns {import("./Settings")}
 */
function readSettingsFile(options = {}) {
	const fatal = options.fatal !== false;
	const settingsPath = getSettingsFilePath();

	try {
		return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
	} catch (e) {
		const message = `failed to read ${settingsPath}: ${e.message}`;

		if (fatal) {
			console.log(message);
			process.exit(1);
		}

		throw new Error(message);
	}
}

/**
 * @param {import("./Settings")} settings
 */
function writeSettingsFile(settings) {
	fs.writeFileSync(getSettingsFilePath(), JSON.stringify(settings, null, 4), "utf-8");
}

/**
 * @param {import("./ServerHandle")} handle
 * @returns {string}
 */
function reloadSettings(handle) {
	const settings = readSettingsFile({ fatal: false });
	handle.setSettings(settings);
	return getSettingsFilePath();
}

/**
 * @param {import("./Settings")} settings
 */
function ensureSettingsFile(settings = DefaultSettings) {
	if (!fs.existsSync(getSettingsFilePath())) {
		writeSettingsFile(settings);
	}
}

module.exports = {
	getSettingsFilePath,
	readSettingsFile,
	writeSettingsFile,
	reloadSettings,
	ensureSettingsFile
};
