"use strict";
const BinaryWriter = require("./BinaryWriter");

class SetBorder {
    constructor(playerTracker, border, gameType, serverName) {
        this.playerTracker = playerTracker;
        this.border = border;
        this.gameType = gameType;
        this.serverName = serverName;
    }
    build(protocol) {
        let scrambleX = this.playerTracker.scrambleX,
            scrambleY = this.playerTracker.scrambleY,
            b = this.border;
        if (this.gameType == null) {
            let buffer = Buffer.alloc(33);
            buffer.writeUInt8(0x40, 0, 1);
            buffer.writeDoubleLE(b.minX + scrambleX, 1, 1);
            buffer.writeDoubleLE(b.minY + scrambleY, 9, 1);
            buffer.writeDoubleLE(b.maxX + scrambleX, 17, 1);
            buffer.writeDoubleLE(b.maxY + scrambleY, 25, 1);
            return buffer;
        }
        let writer = new BinaryWriter();
        writer.writeUInt8(0x40);
        writer.writeDouble(b.minX + scrambleX);
        writer.writeDouble(b.minY + scrambleY);
        writer.writeDouble(b.maxX + scrambleX);
        writer.writeDouble(b.maxY + scrambleY);
        writer.writeUInt32(this.gameType >> 0);
        let name = this.serverName;
        if (name == null) name = "";
        if (protocol < 6) writer.writeStringZeroUnicode(name);
        else writer.writeStringZeroUtf8(name);
        return writer.toBuffer();
    }
}

module.exports = SetBorder;
