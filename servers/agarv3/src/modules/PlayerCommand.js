"use strict";
const Log = require("./Logger");
const Entity = require("../entity");
const GameMode = require("../gamemodes");
const QuadNode = require("./QuadNode.js");
const ini = require("./ini.js");
const fs = require("fs");

class PlayerCommand {
	constructor(gameServer, playerTracker) {
		this.gameServer = gameServer;
		this.playerTracker = playerTracker;
	}
	saveIpBanList() {
		try {
			let banlist = fs.createWriteStream("../src/txt/ipbanlist.txt");
			for (let v of this.gameServer.ipBanList.sort()) banlist.write(v + "\n");
			banlist.end();
			this.writeLine("Saved " + this.gameServer.ipBanList.length + " banned IP records to banlist.");
		} catch (e) {
			this.writeLine("[ERROR] Failed to save banlist");
		}
	}
	trimName(name) {
		return name.trim() || "An unnamed cell";
	}
	fillChar(data, char, fieldLength, rTL) {
		let result = data.toString();
		if (rTL === 1)
			for (let i = result.length; i < fieldLength; i++) result = char.concat(result);
		else for (let i = result.length; i < fieldLength; i++) result = result.concat(char);
		return result;
	}
	clientByID(id) {
		if (!id) return null;
		for (let i = 0; i < this.gameServer.clients.length; i++) {
			let client = this.gameServer.clients[i].playerTracker;
			if (client.pID === id) return client;
		}
		return null;
	}
	serverKill(split) {
		let id = parseInt(split[1]), client = this.clientByID(id);

		if (isNaN(id)) return this.writeLine("[ERROR] Please specify a valid player ID.");

		if (client == null) return this.writeLine("[ERROR] Player ID (" + id + ") was not found.");

		let count = 0;

		if (!client.cells.length) return this.writeLine("[ERROR] The specified player is not spawned in the game.");

		for (;client.cells.length;) {
			this.gameServer.removeNode(client.cells[0]);
			count++;
		}

		this.writeLine("Killed " + this.trimName(client._name) + " and removed " + count + " cells.");
	}
	serverBan(split, ip) {
		let ipBin = ip.split('.');

		if (ipBin.length !== 4) {
			this.writeLine("[ERROR] Invalid IP format: " + ip);
			return;
		}

		this.gameServer.ipBanList.push(ip);

		if (ipBin[2] === "*" || ipBin[3] === "*") {
			this.writeLine("The IP sub-net " + ip + " has been banned");
		} else {
			this.writeLine("The IP " + ip + " has been banned");
		}

		this.gameServer.clients.forEach(socket => {
			if (!socket || !socket.isConnected || !this.gameServer.checkIpBan(ip) || socket.remoteAddress != ip)
				return;

			this.serverKill(split);

			socket.close(null, "Banned from server");

			let name = this.trimName(socket.playerTracker._name);
			this.writeLine("Banned: \"" + name + "\" with Player ID " + socket.playerTracker.pID);
			this.gameServer.sendChatMessage(null, null, "Banned \"" + name + "\"");
		}, this.gameServer);

		this.saveIpBanList();
	}
	writeLine(text) {
		this.gameServer.sendChatMessage(null, this.playerTracker, text);
	}
	executeCommandLine(str) {
		if (!str) return;
		let split = str.split(" ");
		if (this["command_" + split[0].toLowerCase()]) this["command_" + split[0].toLowerCase()](split);
		else this.writeLine("[ERROR] Unknown command. Type /help for a list of commands.");
	}
	userLogin(ip, password) {
		if (!password) return null;
		password = password.trim();
		for (let i = 0; i < this.gameServer.userList.length; i++) {
			let user = this.gameServer.userList[i];
			if (user.password !== password) continue;
			if (user.ip && user.ip !== ip && user.ip !== "*") continue;
			return user;
		}
		return null;
	}
	getName() {
		return (!this.playerTracker.cells.length ? "A dead cell" : !this.playerTracker._name.length ? "An unnamed cell" : this.playerTracker._name).trim();
	}
	command_help() {
		if (this.playerTracker.OP.enabled) {
			this.writeLine("~~~~~~~~~~~~~~~~~BAN COMMANDS~~~~~~~~~~~~~~");
			this.writeLine("/playerlist: Get a list of players and bots with IDs.");
			this.writeLine("/ban [playerID or IP]: Ban a player.");
			this.writeLine("/unban [IP]: Unban an IP.");
			this.writeLine("/banlist: Show a list of banned IPs.");
			this.writeLine("~~~~~~~~~~~~~~~OP COMMANDS~~~~~~~~~~~~~~~~~");
			this.writeLine("/operator: Give yourself OP mode.");
			this.writeLine("/ophelp: Show OP available keys.");
			this.writeLine("/shortcuts: List command aliases.");
			this.writeLine("/gamemode [gamemodeID] : Change the game mode. 0 - FFA, 1 - Teams, 2 - Experimental, 3 - Rainbow, 4 - Tournament, 5 - Hunger Games");
			this.writeLine("/addbot: Add bots to the server.");
			this.writeLine("/minion: Remove or give you minions.");
			this.writeLine("/mass: Set your mass to a specified value.");
			this.writeLine("/spawnmass: Set the mass that you spawn at.");
			this.writeLine("/speed: Set your cell movement speed.");
			this.writeLine("/board: Edit text on the leaderboard.");
			this.writeLine("/border: Change the map size.");
			this.writeLine("/change: Change a config value.");
			this.writeLine("/chat: Broadcast a message to all players.");
			this.writeLine("/debug: Show all total nodes in the game.");
			this.writeLine("/freeze: Freeze your cell.");
			this.writeLine("/explode: Explode yourself into ejected mass.");
			this.writeLine("/split: Split your cell a specified amount.");
			this.writeLine("/merge: Merge all your cells.");
			this.writeLine("/teleport: Teleport to a specified location");
			this.writeLine("/virus: Spawn a virus under you.");
			this.writeLine("/foodcolor: Set the color of food spawned by the F key.");
			this.writeLine("/replace: Replace your cell with an entity.");
			this.writeLine("/kickbot: Kick all, or some bots.");
			this.writeLine("/killall: Kill all players.");
			this.writeLine("/kickmi: Kick all, or some minions.");
			this.writeLine("/lms: Enable Last Man Standing mode.");
			this.writeLine("/rec: Toggle supersplitter mode.");
			this.writeLine("/reset: Clear all, or specified nodes.");
			// this.writeLine("/pause: Pauses/unpauses the game."); // TODO: it softlocks the game without a console
			this.writeLine("/reload: Reset all config values to default.");
			this.writeLine("/restart: Restart the server.");
			this.writeLine("/exit: Shut down the server.");
		}

		this.writeLine("~~~~~~~~~~~~~~~PLAYER~COMMANDS~~~~~~~~~~~~~");
		this.writeLine("/help: The list of supported commands.");
		this.writeLine("/shortcuts: List command aliases.");
		this.writeLine("/name: Change your name.");
		this.writeLine("/getcolor: Get your cell color in RGB.");
		this.writeLine("/setcolor: Change your RGB color.");
		this.writeLine("/kill: Commit Suicide.");
		this.writeLine("/kick: Kick yourself from the server.");
		this.writeLine("/status: Show the server's current status.");
		this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
	}
	command_shortcuts() {
		this.writeLine("~~~~~~~~~~~~~~~~~~SHORTCUTS~~~~~~~~~~~~~~~~~~");

		if (this.playerTracker.OP.enabled) {
			this.writeLine("/rp: Shortcut for replace.");
			this.writeLine("/m: Shortcut for mass.");
			this.writeLine("/sm: Shortcut for spawnmass.");
			this.writeLine("/e: Shortcut for explode.");
			this.writeLine("/ka: Shortcut for killall.");
			this.writeLine("/s: Shortcut for speed.");
			this.writeLine("/f: Shortcut for freeze.");
			this.writeLine("/c: Shortcut for change.");
			this.writeLine("/rp: Shortcut for replace.");
			this.writeLine("/ab: Shortcut for addbot.");
			this.writeLine("/kb: Shortcut for kickbot.");
			this.writeLine("/op: Alias for operator.");
		}

		this.writeLine("/k: Shortcut for kill.");
		this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
	}
	command_ophelp(split) {
		this.writeLine("~~~~~~~~~~OP MODE KEYS~~~~~~~~~~");
		this.writeLine(" E : Minions split.");
		this.writeLine(" R : Minions eject.");
		this.writeLine(" T : Minions freeze.");
		this.writeLine(" P : Minions collect food.");
		this.writeLine(" Q : Minions follow cell.");
		this.writeLine(" O : Freeze yourself.");
		this.writeLine(" M : Force merge.");
		this.writeLine(" I : Supersplitter mode.");
		this.writeLine(" K : Suicide.");
		this.writeLine(" Y : Gain mass.");
		this.writeLine(" U : Lose mass.");
		this.writeLine(" L : Clear all entities.");
		this.writeLine(" H : Explode into ejected mass.");
		this.writeLine(" Z : Change own color.");
		this.writeLine(" S : Spawn virus at mouse.");
		this.writeLine(" J : Spawn food at mouse.");
		this.writeLine(" B : Edit J key food color.");
		this.writeLine(" C : Edit J key food size.");
		this.writeLine(" G : Teleport to mouse.");
		this.writeLine(" V : Ejects mass at the mouse.");
		this.writeLine(" X : Rainbow mode.");
		this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
	}
	command_addbot(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let add = parseInt(split[1]);
		if (isNaN(add)) return this.writeLine("[ERROR] Invalid amount of bots to add.");
		for (let i = 0; i < add; i++) this.gameServer.bots.addBot();
		this.writeLine("Added " + add + " Bots.");
	}
	command_playerlist() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		if (this.gameServer.clients.length <= 0) return this.writeLine("No bots or players are currently connected to the server.");

		this.writeLine("Total players connected: " + this.gameServer.clients.length + ".");
		this.writeLine(" ID     | IP              |  P  | CELLS | SCORE  |   POSITION   | " + this.fillChar("NICK", " ", this.gameServer.config.playerMaxNick) + " ");
		this.writeLine(this.fillChar("", "─", " ID     | IP              | CELLS | SCORE  |   POSITION   |   |  ".length + this.gameServer.config.playerMaxNick));

		let sockets = this.gameServer.clients.slice(0).sort((a, b) => a.playerTracker.pID - b.playerTracker.pID);

		for (let i = 0; i < sockets.length; i++) {
			let socket = sockets[i], client = socket.playerTracker, id = this.fillChar(client.pID, " ", 6, 1), ip = client.isMi ? "[MINION]" : client.isBot ? "[BOT]" : socket.isConnected ? socket.remoteAddress : "[UNKNOWN]";

			ip = this.fillChar(ip, " ", 15);

			let protocol = this.gameServer.clients[i].packetHandler.protocol;

			if (!protocol) protocol = "N/A";
			else protocol = " " + protocol + " ";

			let nick = "", cells = "", score = "", position = "", data = "", target = null;

			if (socket.closeReason != null) {
				let reason = "[DISCONNECTED] ";
				if (socket.closeReason.code) reason += "[" + socket.closeReason.code + "] ";
				if (socket.closeReason.message) reason += socket.closeReason.message;
				this.writeLine(" " + id + " | " + ip + " | " + protocol + " | " + reason);
			} else if (!socket.packetHandler.protocol && socket.isConnected && !client.isMi) this.writeLine(" " + id + " | " + ip + " | " + protocol + " | " + "[CONNECTING]");
			else if (client.isSpectating) {
				nick = "in free-roam";
				if (!client.freeRoam) {
					target = client.getSpecTarget();
					if (target) nick = this.trimName(target._name);
				}
				data = this.fillChar(this.trimName(client._name) + " is spectating " + nick, "-", " | CELLS | SCORE  | POSITION    ".length + this.gameServer.config.playerMaxNick, 1);
				this.writeLine(" " + id + " | " + ip + " | " + protocol + " | " + data);
			} else if (client.cells.length) {
				target = client.getSpecTarget();
				nick = this.fillChar(this.trimName(client._name), " ", this.gameServer.config.playerMaxNick);
				cells = this.fillChar(client.cells.length, " ", 5, 1);
				score = this.fillChar(client._score / 100 >> 0, " ", 6, 1);
				position = this.fillChar(client.centerPos.x >> 0, " ", 5, 1) + ", " + this.fillChar(client.centerPos.y >> 0, " ", 5, 1);
				this.writeLine(" " + id + " | " + ip + " | " + protocol + " | " + cells + " | " + score + " | " + position + " | " + nick);
			} else {
				data = this.fillChar("DEAD OR NOT PLAYING", "-", " | CELLS | SCORE  | POSITION    ".length + this.gameServer.config.playerMaxNick, 1);
				this.writeLine(" " + id + " | " + ip + " | " + protocol + " | " + data);
			}
		}
	}
	command_banlist() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		if (!this.gameServer.ipBanList.length) return this.writeLine("There are no banned IPs to list.");

		this.writeLine("Showing " + this.gameServer.ipBanList.length + " banned IPs: ");
		this.writeLine(" IP              | IP ");
		this.writeLine("───────────────────────────────────");

		for (let i = 0; i < this.gameServer.ipBanList.length; i += 2)
			this.writeLine(" " + this.fillChar(this.gameServer.ipBanList[i], " ", 15) + " | " + (this.gameServer.ipBanList.length === i + 1 ? "" : this.gameServer.ipBanList[i + 1]));
	}
	command_ban(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");

		if (split[1] != null) {
			if (split[1].indexOf(".") >= 0) {
				let ip = split[1],
					ipSplit = ip.split(".");

				for (let i in ipSplit)
					if (!(i > 1 && "*" === ipSplit[i]) && (isNaN(ipSplit[i]) || ipSplit[i] < 0 || ipSplit[i] >= 256)) return this.writeLine("[ERROR] Please specify a valid player ID or IP address.");

				return ipSplit.length !== 4 ? this.writeLine("[ERROR] Please specify a valid player ID or IP address.") : this.serverBan(split, ip);
			}

			let id = parseInt(split[1]);

			if (isNaN(id)) return this.writeLine("[ERROR] Please specify a valid player ID or IP address.");
			else {
				let ip = null;
				for (let i = 0; i < this.gameServer.clients.length; i++) {
					let client = this.gameServer.clients[i];
					if (client != null && client.isConnected && client.playerTracker.pID === id) {
						ip = client._socket.remoteAddress;
						break;
					}
				}
				if (ip) this.serverBan(split, ip);
				else this.writeLine("[ERROR] Player ID " + id + " not found.");
			}
		} else this.writeLine("[ERROR] Please specify a valid player ID or IP address.");
	}
	command_unban(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");

		if (split.length < 2 || !split[1] || split[1].trim().length < 1) return this.writeLine("[ERROR] Please specify a valid IP.");
		let ip = split[1].trim(), index = this.gameServer.ipBanList.indexOf(ip);
		if (index < 0) return this.writeLine("[ERROR] The specified IP " + ip + " is not in the ban list.");
		this.gameServer.ipBanList.splice(index, 1);
		this.saveIpBanList();
		this.writeLine("Unbanned IP: " + ip + ".");
	}
	command_board(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let newLB = [], input = split[1];
		if (split.length > this.gameServer.config.serverMaxLB + 1) return this.writeLine("[ERROR] The limit for lines of text on the leaderboard is " + this.gameServer.config.serverMaxLB + ".");
		for (let i = 1; i < split.length; i++) {
			if (split[i]) newLB[i - 1] = split[i];
			else newLB[i - 1] = " ";
		}
		this.gameServer.gameMode.packetLB = 48;
		this.gameServer.gameMode.updateLB = gameServer => {
			gameServer.leaderboard = newLB;
			gameServer.leaderboardType = 48;
		};
		if (input !== "reset") {
			this.writeLine("Successfully changed leaderboard values.");
			this.writeLine("Enter 'board reset' to reset leaderboard.");
		} else {
			let gameMode = GameMode.get(this.gameServer.gameMode.ID);
			this.gameServer.gameMode.packetLB = gameMode.packetLB;
			this.gameServer.gameMode.updateLB = gameMode.updateLB;
			this.writeLine("Successfully reset leaderboard.");
		}
	}
	command_border(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let width = parseInt(split[1]), height = parseInt(split[2]);
		if (isNaN(width) || isNaN(height)) return this.writeLine("[ERROR] Please specify a valid border width/height.");
		for (;this.gameServer.nodesEject.length;) this.gameServer.removeNode(this.gameServer.nodesEject[0]);
		for (;this.gameServer.nodesFood.length;) this.gameServer.removeNode(this.gameServer.nodesFood[0]);
		for (;this.gameServer.nodesVirus.length;) this.gameServer.removeNode(this.gameServer.nodesVirus[0]);
		if (this.gameServer.config.serverGamemode === 2)
			for (;this.gameServer.gameMode.mothercells.length;) this.gameServer.removeNode(this.gameServer.gameMode.mothercells[0]);
		this.gameServer.setBorder(width, height);
		this.gameServer.quadTree = new QuadNode(this.gameServer.border, 64, 32);
		this.writeLine("The map size is now (" + width + ", " + height + ").");
	}
	command_change(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		if (split.length < 3) return this.writeLine("[ERROR] Please specify a valid value for this config.");
		let key = split[1], value = split[2];
		if (value.indexOf(".") !== -1) value = parseFloat(value);
		else value = parseInt(value);
		if (value == null || isNaN(value)) return this.writeLine("[ERROR] Invalid value: " + value + ".");
		if (!this.gameServer.config.hasOwnProperty(key)) return this.writeLine("[ERROR] Unknown config value: " + key + ".");
		this.gameServer.config[key] = value;
		this.gameServer.config.playerMinSize = Math.max(32, this.gameServer.config.playerMinSize);
		this.writeLine("Set '" + key + "' to " + this.gameServer.config[key] + ".");
		Log.info(this.getName() + " changed the config value '" + key + "' to " + this.gameServer.config[key] + ".");
	}
	command_chat(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.gameServer.broadcastMSG(String(split.slice(1, split.length).join(" ")));
		this.writeLine("Succesfully sent your message to all players.");
	}
	command_debug() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.writeLine("~~~~~~~~~~~~~~~~~NODES~~~~~~~~~~~~~~~~~~"),
			this.writeLine("Total nodes: " + this.gameServer.nodesAll.length),
			this.writeLine("Player nodes: " + this.gameServer.nodesPlayer.length),
			this.writeLine("Virus nodes: " + this.gameServer.nodesVirus.length),
			this.writeLine("Ejected nodes: " + this.gameServer.nodesEject.length),
			this.writeLine("Food nodes: " + this.gameServer.nodesFood.length);
		if (this.gameServer.gameMode.ID !== 2) this.writeLine("MotherCell nodes: 0");
		else this.writeLine("Mothercell nodes: " + this.gameServer.gameMode.mothercells.length);
		this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
	}
	command_explode() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		for (let i = 0; i < this.playerTracker.cells.length; i++) {
			let cell = this.playerTracker.cells[i];
			while (cell._size > 31.623) {
				let angle = 6.28 * Math.random(), loss = this.gameServer.config.ejectMinSize;
				if (this.gameServer.config.ejectMaxSize > loss) loss = Math.random() * (this.gameServer.config.ejectMaxSize - loss) + loss;
				let size = cell.radius - (loss + 5) * (loss + 5);
				cell.setSize(Math.sqrt(size));
				let pos = { x: cell.position.x + angle, y: cell.position.y + angle }, eject = new Entity.EjectedMass(this.gameServer, null, pos, loss);
				if (this.gameServer.config.ejectRandomColor === 1) eject.color = this.gameServer.randomColor();
				else eject.color = this.playerTracker.color;
				eject.setBoost(this.gameServer.config.ejectSpeed * Math.random(), angle);
				this.gameServer.addNode(eject);
			}
			cell.setSize(31.623);
		}
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		this.writeLine("Successfully exploded yourself.");
	}
	command_freeze() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.playerTracker.frozen = !this.playerTracker.frozen;
		this.writeLine("You are " + (this.playerTracker.frozen ? "now" : "no longer") + " frozen.");
	}
	command_setcolor(split) {
		//if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let color = { r: 0, g: 0, b: 0 };
		color.r = Math.max(Math.min(parseInt(split[1]), 255), 0);
		color.g = Math.max(Math.min(parseInt(split[2]), 255), 0);
		color.b = Math.max(Math.min(parseInt(split[3]), 255), 0);
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		if (isNaN(color.r) || isNaN(color.g) || isNaN(color.b)) return this.writeLine("[ERROR] Please specify a valid RGB color.");
		this.playerTracker.color = color;
		for (let i = 0; i < this.playerTracker.cells.length; i++) this.playerTracker.cells[i].color = color;
		this.writeLine("Changed your color to (" + color.r + ", " + color.g + ", " + color.b + ").");
	}
	command_getcolor() {
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		this.writeLine("Your RGB color is (" + this.playerTracker.color.r + ", " + this.playerTracker.color.g + ", " + this.playerTracker.color.b + ").");
	}
	command_kick() {
		// if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.playerTracker.socket.close(1000, "You kicked yourself from the server, idiot.");
		this.writeLine("You kicked yourself...");
	}
	command_kickbot(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let toRemove = parseInt(split[1]);
		if (isNaN(toRemove)) toRemove = this.gameServer.clients.length;
		let removed = 0;
		for (let i = 0; i < this.gameServer.clients.length; i++) {
			let client = this.gameServer.clients[i];
			if (client.isConnected != null) continue;
			if (client.playerTracker.isMi) continue;
			client.close();
			removed++;
			if (removed >= toRemove) break;
		}
		if (!removed) this.writeLine("[ERROR] No bots are connected to the server.");
		else this.writeLine("You kicked " + removed + " bots.");
	}
	command_kickmi(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let toRemove = parseInt(split[1]);
		if (isNaN(toRemove)) toRemove = this.gameServer.clients.length;
		let removed = 0;
		for (let i = 0; i < this.gameServer.clients.length; i++) {
			let client = this.gameServer.clients[i];
			if (!client.playerTracker.isMi) continue;
			client.close();
			removed++;
			if (removed >= toRemove) break;
		}
		if (!removed) this.writeLine("[ERROR] No minions are connected to the server.");
		else this.writeLine("You kicked " + removed + " minions.");
	}
	command_kill() {
		// if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You're not spawned in the game.");

		for (;this.playerTracker.cells.length;) {
			let cell = this.playerTracker.cells[0], food = new Entity.Food(this.gameServer, null, cell.position, cell._size);
			food.color = cell.color;
			this.gameServer.addNode(food);
			this.gameServer.removeNode(cell);
		}

		this.writeLine("You killed yourself.");
	}
	command_killall() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let count = 0;
		for (let i = 0; i < this.gameServer.clients.length; i++) {
			let playerTracker = this.gameServer.clients[i].playerTracker;
			for (;playerTracker.cells.length;) {
				this.gameServer.removeNode(playerTracker.cells[0]);
				count++;
			}
		}
		this.writeLine("You killed everyone (" + count + (" cells)."));
	}
	command_lms() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.gameServer.disableSpawn = !this.gameServer.disableSpawn;
		this.writeLine("Last Man Standing has been " + (this.gameServer.disableSpawn ? "enabled." : "disabled."));
	}
	command_mass(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let mass = parseInt(split[1]),
			size = Math.sqrt(mass * 100);
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		if (isNaN(mass)) return this.writeLine("[ERROR] Invalid mass argument.");
		for (let i = 0; i < this.playerTracker.cells.length; i++) this.playerTracker.cells[i].setSize(size);
		this.writeLine("Set your mass to " + mass + ".");
	}
	command_merge() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		if (this.playerTracker.cells.length === 1) return this.writeLine("[ERROR] There are no cells to merge.");
		this.playerTracker.mergeOverride = !this.playerTracker.mergeOverride;
		this.writeLine("You are " + (this.playerTracker.mergeOverride ? "now" : "no longer") + " merging.");
	}
	command_minion(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let add = split[1], name = split.slice(2, split.length).join(" ");
		if (isNaN(add) && add !== "remove") return this.writeLine("[ERROR] Invalid number of minions to add.");
		if (this.playerTracker.minion.control && (add === "remove" || !add)) {
			this.playerTracker.minion = { control: false, split: false, eject: false, frozen: false, collect: false, follow: false };
			this.playerTracker.minions = [];
			this.writeLine("Succesfully removed your minions.");
		} else {
			this.playerTracker.minion.control = true;
			for (let i = 0; i < add; i++) this.gameServer.bots.addMinion(this.playerTracker, name);
			this.writeLine("You gave yourself " + add + " minions.");
		}
	}
	command_name(split) {
		// if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let name = split.slice(1, split.length).join(" ");
		if (typeof name === "undefined") return this.writeLine("[ERROR] Please type a valid name.");
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		this.writeLine("Changing your name to " + (name.trim() || "An unnamed cell") + ".");
		this.playerTracker.setName(name);
		return;
	}
	pause() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.gameServer.running = !this.gameServer.running;
		this.writeLine("You " + (!this.gameServer.running ? "paused" : "unpaused") + " the game.");
	}
	command_rec() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.playerTracker.recMode = !this.playerTracker.recMode;
		this.writeLine("You " + (this.playerTracker.recMode ? "now" : "no longer") + " have rec mode.");
	}
	command_reload() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.gameServer.loadConfig();
		this.gameServer.loadBanList();
		this.writeLine("Reloaded the configuration files succesully.");
		Log.info(this.getName() + " reloaded the configuration files.");
	}
	command_restart() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		for (let i = 0; i < this.gameServer.clients.length; i++) this.gameServer.clients[i].close();
		this.gameServer.httpServer = this.gameServer.quadTree = null;
		this.gameServer.running = true;
		this.gameServer.lastNodeID = this.gameServer.lastPlayerID = 1;
		this.gameServer.tickCount = 0;
		this.gameServer.startTime = Date.now();
		this.gameServer.setBorder(this.gameServer.config.borderWidth, this.gameServer.config.borderHeight);
		this.gameServer.quadTree = new QuadNode(this.gameServer.border, 64, 32);
		for (;this.gameServer.nodesAll.length;) this.gameServer.removeNode(this.gameServer.nodesAll[0]);
		for (;this.gameServer.nodesEject.length;) this.gameServer.removeNode(this.gameServer.nodesEject[0]);
		for (;this.gameServer.nodesFood.length;) this.gameServer.removeNode(this.gameServer.nodesFood[0]);
		for (;this.gameServer.nodesVirus.length;) this.gameServer.removeNode(this.gameServer.nodesVirus[0]);
		this.gameServer.loadConfig();
		this.gameServer.loadBanList();
		this.writeLine("Restarting server...");
	}
	command_replace(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let ent = split[1];
		if ((ent !== "virus" && ent !== "food" && ent !== "mothercell") || !ent) return this.writeLine("[ERROR] Please specify either 'food', 'virus', or 'mothercell'.");
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		for (;this.playerTracker.cells.length;) {
			let cell = this.playerTracker.cells[0];
			if (ent === "virus") {
				let virus = new Entity.Virus(this.gameServer, null, cell.position, cell._size);
				this.gameServer.addNode(virus);
			} else if (ent === "food") {
				let food = new Entity.Food(this.gameServer, null, cell.position, cell._size);
				food.color = this.gameServer.randomColor();
				this.gameServer.addNode(food);
			} else if (ent === "mothercell") {
				let mother = new Entity.MotherCell(this.gameServer, null, cell.position, cell._size);
				this.gameServer.addNode(mother);
			}
			this.gameServer.removeNode(cell);
		}
		this.writeLine("Replaced your cells with " + (ent === "food" ? "food cells" : ent === "virus" ? "viruses" : ent === "mothercell" ? "mothercells" : "invalid entity") + ".");
	}
	command_reset(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let ent = split[1];
		if (ent !== "all" && ent !== "ejected" && ent !== "food" && ent !== "virus" && ent !== "mothercell") return this.writeLine("[ERROR] Please specify either 'food', 'virus', 'ejected', 'all', or 'mothercell'.");
		if (ent === "all") {
			this.writeLine("Removed " + this.gameServer.nodesAll.length + " entities.");
			for (;this.gameServer.nodesAll.length;) this.gameServer.removeNode(this.gameServer.nodesAll[0]);
			for (;this.gameServer.nodesEject.length;) this.gameServer.removeNode(this.gameServer.nodesEject[0]);
			for (;this.gameServer.nodesFood.length;) this.gameServer.removeNode(this.gameServer.nodesFood[0]);
			for (;this.gameServer.nodesVirus.length;) this.gameServer.removeNode(this.gameServer.nodesVirus[0]);
			if (this.gameServer.gameMode.ID === 2)
				for (;this.gameServer.gameMode.mothercells.length;) this.gameServer.removeNode(this.gameServer.gameMode.mothercells[0]);
			for (let i = 0; i < this.gameServer.clients.length; i++) {
				let playerTracker = this.gameServer.clients[i].playerTracker;
				for (;playerTracker.cells.length;) this.gameServer.removeNode(playerTracker.cells[0]);
			}
		}
		if (ent === "ejected") {
			this.writeLine("Removed " + this.gameServer.nodesEject.length + " ejected cells.");
			for (;this.gameServer.nodesEject.length;) this.gameServer.removeNode(this.gameServer.nodesEject[0]);
		}
		if (ent === "food") {
			this.writeLine("Removed " + this.gameServer.nodesFood.length + " food cells.");
			for (;this.gameServer.nodesFood.length;) this.gameServer.removeNode(this.gameServer.nodesFood[0]);
		}
		if (ent === "virus") {
			this.writeLine("Removed " + this.gameServer.nodesVirus.length + " viruses.");
			for (;this.gameServer.nodesVirus.length;) this.gameServer.removeNode(this.gameServer.nodesVirus[0]);
		}
		if (ent === "mothercell") {
			if (this.gameServer.gameMode.ID !== 2) return this.writeLine("[ERROR] Mothercells can only be cleared in experimental mode.");
			this.writeLine("Removed " + this.gameServer.gameMode.mothercells.length + " mothercells.");
			for (;this.gameServer.gameMode.mothercells.length;) this.gameServer.removeNode(this.gameServer.gameMode.mothercells[0]);
		}
	}
	command_spawnmass(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let mass = parseInt(split[1]),
			size = Math.sqrt(mass * 100);
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		if (isNaN(mass)) return this.writeLine("[ERROR] Invalid mass argument.");
		this.playerTracker.spawnMass = size;
		this.writeLine("Set your spawn mass to " + (size * size / 100).toFixed(0) + ".");
	}
	command_speed(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let speed = parseInt(split[1]);
		if (isNaN(speed)) return this.writeLine("[ERROR] Please specify a valid speed.");
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		this.playerTracker.customSpeed = speed;
		this.writeLine("Set your base speed to " + (!speed ? this.gameServer.config.playerSpeed : speed) + ".");
	}
	command_split(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let amount = parseInt(split[1]);
		if (isNaN(amount)) return this.writeLine("[ERROR] Please specify a valid split count.");
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		if (this.playerTracker.cells.length >= this.gameServer.config.playerMaxCells) return this.writeLine("[ERROR] You have reached the splitting limit of " + this.gameServer.config.playerMaxCells + ".");
		for (let i = 0; i < amount; i++) this.gameServer.splitCells(this.playerTracker);
		this.writeLine("You forced yourself to split " + amount + " times.");
	}
	command_status() {
		let humans = 0, bots = 0, mem = process.memoryUsage();
		for (let i = 0; i < this.gameServer.clients.length; i++) {
			if ("_socket" in this.gameServer.clients[i]) humans++;
			else bots++;
		}
		let scores = [];
		for (let i = 0; i < this.gameServer.clients.length; i++) {
			let totalMass = 0, client = this.gameServer.clients[i].playerTracker;
			for (let j = 0; j < client.cells.length; j++) totalMass += this.gameServer.sizeToMass(client.cells[j]._size);
			scores.push(totalMass);
		}
		if (!this.gameServer.clients.length) scores = [0];
		this.writeLine("~~~~~~~~~~~~~~~~~STATUS~~~~~~~~~~~~~~~~~"),
		this.writeLine("Connected Players: " + this.gameServer.clients.length + "/" + this.gameServer.config.serverMaxConnect + ".");
		this.writeLine("Total Players: " + humans + ".");
		this.writeLine("Total Bots: " + bots + ".");
		this.writeLine("Average Score: " + (scores.reduce((x, y) => x + y) / scores.length).toFixed(2) + ".");
		this.writeLine("Server Uptime: " + Math.floor(process.uptime() / 60) + " minutes.");
		this.writeLine("Current Memory Usage: " + Math.round(mem.heapUsed / 1048576 * 10) / 10 + "/" + Math.round(mem.heapTotal / 1048576 * 10) / 10 + " MB.");
		this.writeLine("Current Game Mode: " + this.gameServer.gameMode.name + ".");
		this.writeLine("Current Update Time: " + this.gameServer.updateTimeAvg.toFixed(3) + " ms (" + ini.getLagMessage(this.gameServer.updateTimeAvg) + ").");
		this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
	}
	command_teleport(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let pos = {
			x: parseInt(split[1]),
			y: parseInt(split[2])
		};
		if (isNaN(pos.x) || isNaN(pos.y)) return this.writeLine("[ERROR] Invalid coordinates.");
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		for (let i = 0; i < this.playerTracker.cells.length; i++) {
			let cell = this.playerTracker.cells[i];
			cell.position.x = pos.x;
			cell.position.y = pos.y;
			this.gameServer.updateNodeQuad(cell);
		}
		this.writeLine("You have been teleported to (" + pos.x + " , " + pos.y + ").");
	}
	command_virus() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let virus = new Entity.Virus(this.gameServer, null, this.playerTracker.centerPos, this.gameServer.config.virusMinSize);
		if (!this.playerTracker.cells.length) return this.writeLine("[ERROR] You are either dead or not playing.");
		this.gameServer.addNode(virus);
		this.writeLine("Spawned a virus under yourself.");
	}
	command_operator(split) {
		let password = parseInt(split[1]);

		if (isNaN(password)) password = split[1];

		if (password !== this.gameServer.config.serverChatPassword) {
			Log.warn(this.getName() + " tried to use OP mode, but typed the incorrect password.");
			return this.writeLine("That password is incorrect.");
		}

		this.playerTracker.OP.enabled = !this.playerTracker.OP.enabled;
		this.writeLine("You " + (this.playerTracker.OP.enabled ? "now" : "no longer") + " have OP mode.");
		this.playerTracker.OP.enabled ? Log.info(this.getName() + " gave themself OP mode.") : Log.info(this.getName() + " removed OP mode from themself.");
	}
	command_gamemode(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		try {
			let id = parseInt(split[1]), gameMode = GameMode.get(id);
			this.gameServer.gameMode.onChange(this.gameServer);
			this.gameServer.gameMode = gameMode;
			this.gameServer.gameMode.onServerInit(this.gameServer);
			this.writeLine("Changed the game mode to " + this.gameServer.gameMode.name);
		} catch (e) {
			this.writeLine("Invalid game mode selected.");
		}
	}
	command_exit() {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		this.writeLine("Closing server...");
		this.gameServer.broadcastMSG("The server is closing.");
		Log.warn("Shutdown request has been sent by " + this.getName() + ".");
		process.exit(0);
	}
	command_foodcolor(split) {
		if (!this.playerTracker.OP.enabled) return this.writeLine("[ERROR] You must have OP mode to use this command.");
		let r = parseInt(split[1]),
			g = parseInt(split[2]),
			b = parseInt(split[3]);
		if (isNaN(r) || isNaN(g) || isNaN(b)) return this.writeLine("[ERROR] Please specify a valid RGB color.");
		this.playerTracker.OP.foodColor.r = r;
		this.playerTracker.OP.foodColor.g = g;
		this.playerTracker.OP.foodColor.b = b;
		this.writeLine("Food spawned by the J key will now have a color of (" + r + ", " + g + ", " + b + ").");
	}
	command_m(split) {
		this.command_mass(split);
	}
	command_sm(split) {
		this.command_spawnmass(split);
	}
	command_e() {
		this.command_explode();
	}
	command_ka() {
		this.command_killall();
	}
	command_k() {
		this.command_kill();
	}
	command_s(split) {
		this.command_speed(split);
	}
	command_f() {
		this.command_freeze();
	}
	command_ab(split) {
		this.command_addbot(split);
	}
	command_kb(split) {
		this.command_kickbot(split);
	}
	command_c(split) {
		this.command_change(split);
	}
	command_tp(split) {
		this.command_teleport(split);
	}
	command_rp(split) {
		this.command_replace(split);
	}
	command_op(split) {
		this.command_operator(split);
	}
}

module.exports = PlayerCommand;