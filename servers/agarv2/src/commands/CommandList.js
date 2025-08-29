/**
 * @template T
 */
class Command {
	/**
	 * @param {string} name
	 * @param {string} description
	 * @param {string} args
	 * @param {(handle: ServerHandle, context: T, args: string[]) => void} executor
	 */
	constructor(name, description, args, executor) {
		this.name = name.toLowerCase();
		this.description = description;
		this.args = args;
		this.executor = executor;
	}

	toString() {
		return `${this.name}${!this.args ? "" : " " + this.args} - ${this.description}`;
	}
}

/**
 * @template T
 */
class CommandList {
	constructor(handle) {
		this.handle = handle;
		/** @type {{[commandName: string]: Command}} */
		this.list = {};
	}

	/**
	 * @param {Command[]} commands
	 */
	register(...commands) {
		for (let i = 0, l = commands.length; i < l; i++) {
			const command = commands[i];

			if (this.list.hasOwnProperty(command)) {
				throw new Error("command conflicts with another already registered one");
			}

			this.list[command.name] = command;
		}
	}

	/**
	 * @param {T} context
	 * @param {string} input
	 */
	execute(context, input) {
		const split = input.split(" ");

		if (split.length === 0) {
			return false;
		}

		if (!this.list.hasOwnProperty(split[0].toLowerCase())) {
			return false;
		}

		const command = this.list[split[0].toLowerCase()];
		
		// Log admin command executions for audit purposes
		this._logAdminCommand(context, command.name, split.slice(1));

		command.executor(this.handle, context, split.slice(1));

		return true;
	}

	/**
	 * Log admin command execution for audit trail
	 * @param {T} context
	 * @param {string} commandName
	 * @param {string[]} args
	 * @private
	 */
	_logAdminCommand(context, commandName, args) {
		// Define admin-only commands that should be logged
		const adminCommands = [
			'antiteamstats', 'antiteamclear', 'antiteamtoggle', 'setting',
			'login', 'logout', 'adminstatus'
		];
		
		// Define console admin commands (from server console)
		const consoleAdminCommands = [
			'help', 'routers', 'players', 'stats', 'setting', 'eval', 'test',
			'crash', 'restart', 'pause', 'mass', 'merge', 'kill', 'explode',
			'addminion', 'rmminion', 'killall', 'addbot', 'rmbot', 'ban', 'unban',
			'antiteam', 'antiteamclear', 'antiteamtoggle'
		];

		// Commands with sensitive data that should not have their arguments logged
		const sensitiveCommands = ['login', 'eval'];

		// Check if this is an admin command that should be logged
		const isAdminCommand = adminCommands.includes(commandName.toLowerCase());
		const isConsoleAdminCommand = consoleAdminCommands.includes(commandName.toLowerCase());
		const isSensitive = sensitiveCommands.includes(commandName.toLowerCase());
		
		// For chat commands, only log if it's an admin command and user is authenticated
		if (context && context.remoteAddress) {
			// This is a chat command from a connection
			if (isAdminCommand) {
				const isAuthenticated = context.isAdminSessionValid ? context.isAdminSessionValid() : false;
				
				if (isAuthenticated || commandName.toLowerCase() === 'login') {
					const playerInfo = context.hasPlayer ? context.player.id : 'spectator';
					
					// Handle sensitive commands - don't log arguments for security
					let argsStr = '';
					if (isSensitive) {
						argsStr = args.length > 0 ? ' [REDACTED]' : '';
					} else {
						argsStr = args.length > 0 ? ` ${args.join(' ')}` : '';
					}
					
					this.handle.logger.inform(`[ADMIN AUDIT] Command executed: /${commandName}${argsStr} | IP: ${context.remoteAddress} | Player ID: ${playerInfo}`);
				}
			}
		} else if (context === null) {
			// This is a console command
			if (isConsoleAdminCommand) {
				// Handle sensitive commands - don't log arguments for security
				let argsStr = '';
				if (isSensitive) {
					argsStr = args.length > 0 ? ' [REDACTED]' : '';
				} else {
					argsStr = args.length > 0 ? ` ${args.join(' ')}` : '';
				}
				
				this.handle.logger.inform(`[ADMIN AUDIT] Console command executed: ${commandName}${argsStr} | Source: server console`);
			}
		}
	}
}

module.exports = {
	Command: Command,
	CommandList: CommandList,
	/**
	 * @template T
	 * @param {{ args: string, desc: string, name: string, exec: (handle: ServerHandle, context: T, args: string[]) => void }} info
	 */
	genCommand(info) {
		return new Command(info.name, info.desc, info.args, info.exec);
	}
};