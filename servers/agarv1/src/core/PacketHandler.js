var Packet = require('./../packet/index');
var commands = require('../modules/CommandList').chat;
/*
Proverbs 20:18:
   Bread obtained by falsehood is sweet to a man, But afterward his mouth will be filled with gravel.

We worked really hard for this project. Although we dont care if you enhance it and publish, we would care
if you copy it and claim our work as your own. Although it might feel good, to take the credit, you would ultimatly
regret it. But please feel free to change the files and publish putting your name up as well as ours.
We will also not get into legalities. but please dont take advantage that we dont use
legalities. Instead, treat us with respect like we treat you.

Sincerely
The AJS Dev Team.

*/
function PacketHandler(gameServer, socket) {
  this.gameServer = gameServer;
  this.socket = socket;
  // todo Detect protocol version - we can do something about it later
  this.protocol = 0;

  this.pressQ = false;
  this.pressW = false;
  this.pressSpace = false;
  this.pressE = false;
  this.pressR = false;
  this.pressT = false;

  // Rate limiting for key presses to prevent packet flooding from scripts
  this.lastWPressTime = 0;
  this.lastSpacePressTime = 0;

  // Packet statistics tracking
  this.packetStats = {
    0: 0,   // Set Nickname
    1: 0,   // Spectate
    16: 0,  // Set Target (mouse)
    17: 0,  // Space (split)
    18: 0,  // Q key
    19: 0,  // Q key released
    21: 0,  // W key (feed)
    22: 0,  // E key
    23: 0,  // R key
    24: 0,  // T key
    90: 0,  // Chat (cigar)
    99: 0,  // Chat (cigar)
    255: 0  // Connection Start
  };
}

module.exports = PacketHandler;

PacketHandler.prototype.handleMessage = function(message) {
  try {
    function stobuf(buf) {
      var length = buf.length;
      var arrayBuf = new ArrayBuffer(length);
      var view = new Uint8Array(arrayBuf);

      for (var i = 0; i < length; i++) {
        view[i] = buf[i];
      }

      return view.buffer;
    }

    // Discard empty messages
    if (message.length == 0) {
      return;
    }

    var buffer = stobuf(message);
    var view = new DataView(buffer);
    var packetId = view.getUint8(0, true);

    // Track packet statistics
    if (this.packetStats[packetId] !== undefined) {
      this.packetStats[packetId]++;
    } else {
      // Track unknown packet types
      if (!this.packetStats.unknown) {
        this.packetStats.unknown = {};
      }
      if (!this.packetStats.unknown[packetId]) {
        this.packetStats.unknown[packetId] = 0;
      }
      this.packetStats.unknown[packetId]++;
    }

    switch (packetId) {
      case 0:
        // Check for invalid packets
        if ((view.byteLength + 1) % 2 == 1) {
          break;
        }

        // Set Nickname
        var nick = "";
        var maxLen = this.gameServer.config.playerMaxNickLength * 2; // 2 bytes per char
        for (var i = 1; i < view.byteLength && i <= maxLen; i += 2) {
          var charCode = view.getUint16(i, true);
          if (charCode == 0) {
            break;
          }

          nick += String.fromCharCode(charCode);
        }

        this.setNickname(nick);
        break;
      case 1:
        // Spectate mode
        if (this.socket.playerTracker.cells.length <= 0) {
          // Make sure client has no cells
          this.gameServer.switchSpectator(this.socket.playerTracker);
          if (!this.socket.playerTracker.spectate) {
            if (this.gameServer.config.kickspectate > 0 && this.gameServer.whlist.indexOf(this.socket.remoteAddress) == -1) {
              this.socket.playerTracker.spect = setTimeout(function() {
                if (this.socket.playerTracker.spectate && this.gameServer.whlist.indexOf(this.socket.remoteAddress) == -1) {
                  this.socket.close();
                }
              }.bind(this), this.gameServer.config.kickspectate * 1000);
            }
          }

          this.socket.playerTracker.spectate = true;
        }
        break;
      case 16:
        // Set Target
        if (view.byteLength == 21) {
          var client = this.socket.playerTracker; // Scramble
          client.mouse.x = view.getFloat64(1, true) - client.scrambleX; // Scramble
          client.mouse.y = view.getFloat64(9, true) - client.scrambleY;
        } else if (view.byteLength == 13) {
          var client = this.socket.playerTracker; // Scramble
          client.mouse.x = view.getInt32(1, true) - client.scrambleX; // Scramble
          client.mouse.y = view.getInt32(5, true) - client.scrambleY;

        }

        break;
      case 17:
        // Space Press - Split cell
        // Rate limit split packets using splitCooldown config to prevent rapid splitting from scripts
        var now = Date.now();
        var splitMinInterval = this.gameServer.config.splitCooldown || 100; // Reuse splitCooldown config
        if (!this.lastSpacePressTime || (now - this.lastSpacePressTime >= splitMinInterval)) {
          this.pressSpace = true;
          this.lastSpacePressTime = now;
        }
        // Silently ignore packets that arrive too quickly (prevents server lag)
        break;
      case 18:
        // Q Key Pressed
        this.pressQ = true;
        break;
      case 19:
        // Q Key Released
        break;
      case 21:
        // W Press - Eject mass
        // Rate limit W key presses at packet level using ejectMassCooldown config to prevent packet flooding
        var now = Date.now();
        var minInterval = this.gameServer.config.ejectMassCooldown || 50; // Reuse ejectMassCooldown config (same as game logic)
        if (!this.lastWPressTime || (now - this.lastWPressTime >= minInterval)) {
          this.pressW = true;
          this.lastWPressTime = now;
        }
        // Silently ignore packets that arrive too quickly (prevents server lag)
        break;
      case 22:
        this.pressE = true;
        break;
      case 23:
        this.pressR = true;
        break;
      case 24:
        this.pressT = true;
        break;
      case 255:
        // Connection Start
        if (view.byteLength == 5) {
          this.protocol = view.getUint32(1, true);
          // Send SetBorder packet first
          var c = this.gameServer.config;
          this.socket.sendPacket(new Packet.SetBorder(
            c.borderLeft + this.socket.playerTracker.scrambleX, // Scramble
            c.borderRight + this.socket.playerTracker.scrambleX,
            c.borderTop + this.socket.playerTracker.scrambleY,
            c.borderBottom + this.socket.playerTracker.scrambleY
          ));
          if (this.gameServer.isMaster) this.socket.sendPacket(new Packet.DataPacket(this.gameServer));
          this.socket.sendPacket(new Packet.ClientPacket(this.gameServer));
        }
        break;
      case 90: // from cigar
        var message = "";
        var maxLen = this.gameServer.config.chatMaxMessageLength * 2; // 2 bytes per char
        var offset = 2;
        var flags = view.getUint8(1); // for future use (e.g. broadcast vs local message)
        if (flags & 2) {
          offset += 4;
        }
        if (flags & 4) {
          offset += 8;
        }
        if (flags & 8) {
          offset += 16;
        }
        for (var i = offset; i < view.byteLength && i <= maxLen; i += 2) {
          var charCode = view.getUint16(i, true);
          if (charCode == 0) {
            break;
          }
          message += String.fromCharCode(charCode);
        }

        console.log('[' + (new Date().toISOString().replace('T', ' ')) + '][90][' + this.socket.remoteAddress + '][' + (typeof this.socket.verifyScore !== 'undefined' ? this.socket.verifyScore : '??') +'][' + this.socket.playerTracker.pID + '][' + this.socket.playerTracker.premium.split('|').slice(-1) + '][' + this.socket.playerTracker.premium.split('|')[0] + '] <' + this.socket.playerTracker.name + '>: \'' + message + '\'');

        var packet = new Packet.Chat(this.socket.playerTracker, message);
        // Send to all clients (broadcast)
        for (var i = 0; i < this.gameServer.clients.length; i++) {
          this.gameServer.clients[i].sendPacket(packet);
        }
        break;
      case 99: // from cigar
        for (var i in this.gameServer.plugins) {
          if (this.gameServer.plugins[i].beforechat) {
            if (!this.gameServer.plugins[i].beforechat(this.socket.playerTracker)) return;
          }
        }
        if (this.gameServer.config.allowChat == 1) {
          if (!this.socket.playerTracker.chatAllowed) {
            this.gameServer.pm(this.socket.playerTracker.pID, "You are not allowed to chat!");
            return;
          }
          if (this.gameServer.config.specChatAllowed != 1) {
            if (this.socket.playerTracker.cells.length < 1) {
              this.gameServer.pm(this.socket.playerTracker.pID, "Spectator chat is disabled, you must play in order to chat.");
              return;
            }

          }
          var message = "",
            maxLen = this.gameServer.config.chatMaxMessageLength * 2,
            offset = 2,
            flags = view.getUint8(1);

          if (flags & 2) {
            offset += 4;
          }
          if (flags & 4) {
            offset += 8;
          }
          if (flags & 8) {
            offset += 16;
          }

          for (var i = offset; i < view.byteLength && i <= maxLen; i += 2) {
            var charCode = view.getUint16(i, true);
            if (charCode == 0) {
              break;
            }
            message += String.fromCharCode(charCode);
          }

          var zname = wname = this.socket.playerTracker.name;
          if (wname == "") wname = "Spectator";

          console.log('[' + (new Date().toISOString().replace('T', ' ')) + '][99][' + this.socket.remoteAddress + '][' + (typeof this.socket.verifyScore !== 'undefined' ? this.socket.verifyScore : '??') +'][' + this.socket.playerTracker.pID + '][' + this.socket.playerTracker.premium.split('|').slice(-1) + '][' + this.socket.playerTracker.premium.split('|')[0] + '] <' + this.socket.playerTracker.name + '>: \'' + message + '\'');

          for (var i in this.gameServer.plugins) {
            if (this.gameServer.plugins[i].beforecmsg) {
              if (!this.gameServer.plugins[i].beforecmsg(this.socket.playerTracker, message)) break;
            }
          }
          if (this.gameServer.config.serverAdminPass != '') {
            var passkey = "/rcon " + this.gameServer.config.serverAdminPass + " ";
            if (message.substr(0, passkey.length) == passkey) {
              this.socket.playerTracker.isAdmin = true;
              var cmd = message.substr(passkey.length, message.length);
              var split = cmd.split(" "),
                first = split[0].toLowerCase();
              console.log("[Console] " + wname + " has issued a remote command " + cmd + " and is logged in!");

              this.gameServer.consoleService.execCommand(first, split);
              this.gameServer.pm(this.socket.playerTracker.pID, "Command Sent and Logged in!")
              break;
            } else if (this.socket.playerTracker.isAdmin && message.substr(0, 6) == "/rcon ") {
              var l = "/rcon ";
              var cmd = message.substr(l.length, message.length);
              var split = cmd.split(" "),
                first = split[0].toLowerCase();
              console.log("[Console] " + wname + " has issued a remote command " + cmd);
              this.gameServer.pm(this.socket.playerTracker.pID, "Command Sent!")
              this.gameServer.consoleService.execCommand(first, split);

              break;
            } else if (message.substr(0, 6) == "/rcon ") {
              console.log("[Console] " + wname + " has issued a remote command but used the wrong password!");
              this.gameServer.pm(this.socket.playerTracker.pID, "Wrong Password!")
              break;
            }
          }

          if (message.charAt(0) == "/") {
            var str = message.substr(1);
            var split = str.split(" ");
            var exec = commands[split[0]];
            if (exec) {
              try {
                exec(this.gameServer, this.socket.playerTracker, split);
              } catch (e) {
                this.gameServer.pm(this.socket.playerTracker.pID, "There was an error with the command, " + e);
                console.log("[Console] Caught error " + e);
              }
              break;
            }
            this.gameServer.pm(this.socket.playerTracker.pID, "That is not a valid command! Do /help for a list of commands!");
            break;
          }

          message = message.replace(/  +/g, ' ');
          message = message.trim();

          if (!message) return;

          if (message === '') {
            this.gameServer.pm(this.socket.playerTracker.pID, '[AntiSpam] Last message was not sent, cannot send empty message.');
            console.log('MESSAGE REJECTED \'' + message + '\' is empty');
            return;
          }

          var lastChatTime = this.lastChatTime;
          var lastMessage = this.lastMessage;

          if (!lastChatTime || (Date.now() - lastChatTime >= this.gameServer.config.chatIntervalTime)) {
            if (lastMessage) {
              if ((lastMessage === message || ~lastMessage.indexOf(message) || ~message.indexOf(lastMessage)) && message.length >= 10) {
                this.gameServer.pm(this.socket.playerTracker.pID, '[AntiSpam] Last message was not sent, please don\'t repeat yourself, write something different.');
                console.log('MESSAGE REJECTED \'' + message + '\' contains repeated last message \'' + lastMessage + '\'');

                return;
              }
            }

            var check_message = message.toLowerCase();
            check_message = check_message.replace(/  +/g, ' ');
            check_message = check_message.replace(/(.)\1{3,}/gi, '$1');

            if (!this.chatBlockedWords) {
              this.chatBlockedWords = JSON.parse(this.gameServer.config.chatBlockedWords.replace(/'/g, '"'));
            }

            if (Array.isArray(this.chatBlockedWords) && this.chatBlockedWords.length) {
              for (var i = 0, l = this.chatBlockedWords.length; i < l; i++) {
                if (message.indexOf(this.chatBlockedWords[i]) !== -1) {
                  this.gameServer.pm(this.socket.playerTracker.pID, 'Last message was not sent, because it contains banned words.');
                  console.log('MESSAGE REJECTED \'' + message + '\' contains \'' + this.chatBlockedWords[i]);
                  return;
                }
              }
            }

            var packet = new Packet.Chat(this.socket.playerTracker, message);
            // Send to all clients (broadcast)
            for (var i = 0; i < this.gameServer.clients.length; i++) {
              if (!this.gameServer.clients[i].playerTracker.chat) continue;
              this.gameServer.clients[i].sendPacket(packet);
            }

            this.lastChatTime = Date.now();
            this.lastMessage = message;
          } else {
            this.gameServer.pm(this.socket.playerTracker.pID, '[AntiSpam] Last message was not sent, please don\'t write too fast, wait at least ' + (this.gameServer.config.chatIntervalTime / 1000)  + ' seconds.');
            console.log('MESSAGE REJECTED \'' + message + '\' tryied to write too fast');
          }

          /*var date = new Date(),
            hour = date.getHours();

          if ((date - this.socket.playerTracker.cTime) < this.gameServer.config.chatIntervalTime) {
            var time = 1 + Math.floor(((this.gameServer.config.chatIntervalTime - (date - this.socket.playerTracker.cTime)) / 1000) % 60);
            // Happens when user tries to spam
            this.gameServer.pm(this.socket.playerTracker.pID, "Please dont spam.");
            break;
          }

          blockedWords = this.gameServer.config.chatBlockedWords.split(";");

          // Removes filtered words.
          var chatFilter = 0;

          function checkChat() {
            if (chatFilter !== blockedWords.length) {
              message = message.replace(blockedWords[chatFilter], "****");
              chatFilter++;
              checkChat();
            }
          }

          checkChat();

          this.socket.playerTracker.cTime = date;
          var LastMsg;
          if (message == LastMsg) {
            ++SpamBlock;
            if (SpamBlock > 5) {
              this.socket.playerTracker.chatAllowed = false;
              this.gameServer.pm(this.socket.playerTracker.pID, "Your chat is banned because you are spamming!");
            }
            this.gameServer.pm(this.socket.playerTracker.pID, "Please dont spam.");
            break;
          }
          LastMsg = message;
          SpamBlock = 0;
          hour = (hour < 10 ? "0" : "") + hour;
          var min = date.getMinutes();
          min = (min < 10 ? "0" : "") + min;
          hour += ":" + min;*/
        } else {
          this.gameServer.pm(this.socket.playerTracker.pID, "Chat is not allowed!");
        }
        break;
      default:
        break;
    }
  } catch (e) {
    console.log("[WARN] Stopped crash at packethandler. Probably because of wrong packet/client . Usually normal.");
  }
};

PacketHandler.prototype.setNickname = function(newNick) {
  var client = this.socket.playerTracker;
  if (client.cells.length < 1) {
    // Set name first
    client.setName(newNick);

    // If client has no cells... then spawn a player

    if (!client.nospawn) this.gameServer.gameMode.onPlayerSpawn(this.gameServer, client);

    // Turn off spectate mode
    client.spectate = false;
  }
};

// Get and reset packet statistics
PacketHandler.prototype.getPacketStats = function() {
  var stats = {};
  for (var key in this.packetStats) {
    if (this.packetStats.hasOwnProperty(key)) {
      stats[key] = this.packetStats[key];
    }
  }
  return stats;
};

PacketHandler.prototype.resetPacketStats = function() {
  for (var key in this.packetStats) {
    if (this.packetStats.hasOwnProperty(key)) {
      if (typeof this.packetStats[key] === 'object') {
        // Reset unknown packet types
        for (var subKey in this.packetStats[key]) {
          this.packetStats[key][subKey] = 0;
        }
      } else {
        this.packetStats[key] = 0;
      }
    }
  }
};
