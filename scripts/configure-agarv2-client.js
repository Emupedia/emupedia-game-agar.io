#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) {
	console.error(message);
	process.exit(1);
}

function replaceDeclaration(source, name, value) {
	const pattern = new RegExp(`const\\s+${name}\\s*=\\s*[^;]+;`);
	if (!pattern.test(source)) throw new Error(`Could not find ${name} declaration`);
	return source.replace(pattern, `const ${name} = ${JSON.stringify(value)};`);
}

function updateClient(root, config) {
	const mainPath = path.join(root, 'assets/js/main.js');
	if (!fs.existsSync(mainPath)) throw new Error(`Missing ${mainPath}`);

	let source = fs.readFileSync(mainPath, 'utf8');
	if (typeof config.skinBaseUrl === 'string') {
		source = replaceDeclaration(source, 'SKIN_URL', config.skinBaseUrl);
	}
	if (Array.isArray(config.servers) && config.servers.length) {
		source = replaceDeclaration(source, 'SERVERS', config.servers);
	}
	if (config.geo && typeof config.geo === 'object' && !Array.isArray(config.geo)) {
		source = replaceDeclaration(source, 'GEO', config.geo);
	}

	const temporaryPath = `${mainPath}.tmp`;
	fs.writeFileSync(temporaryPath, source);
	fs.renameSync(temporaryPath, mainPath);
	console.log(`Configured ${mainPath}`);
}

const configPath = process.argv[2];
if (!configPath) fail('Usage: configure-agarv2-client.js <config.json> [client directories...]');

let config;
try {
	config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
	fail(`Could not read deployment config: ${error.message}`);
}

const roots = process.argv.slice(3);
if (!roots.length) roots.push('clients/agarv2', 'docs/agarv2');

try {
	for (const root of roots) updateClient(path.resolve(root), config);
} catch (error) {
	fail(error.message);
}
