"use strict";

class ClearOwned {
    build() {
        let buffer = Buffer.alloc(1);
        buffer.writeUInt8(0x14, 0, 1);
        return buffer;
    }
}

module.exports = ClearOwned;
