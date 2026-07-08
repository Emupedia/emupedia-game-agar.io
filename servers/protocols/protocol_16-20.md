# Client -> Server

# Server -> Client

## Added in protocol 18 (Battle Royale)

string = utf8 null-terminated string

### Game starting
| Offset | Type   | Info
|--------|--------|-----
| 0      | uint8  | Packet ID (176)
| 1      | uint32 | Time to start

### Start Game
| Offset | Type  | Info
|--------|-------|-----
| 0      | uint8 | Packet ID (177)

### Update Game
| Offset | Type   | Info
|--------|--------|-----
| 0      | uint8  | Packet ID (178)
| 1      | uint16 | Players alive
| 3      | uint16 | Game status

#### Read game status (Type 0: waiting for players)

#### Read game status (Type 1: survive!)
| Offset | Type   | Info
|--------|--------|-----
| 5      | uint8  | Phase (0)
| 6      | int32  | Red zone X
| 10     | int32  | Red zone Y
| 14	   | uint32 | Red zone radius
| 18	   | uint32 | Shrink time (0)

#### Read game status (Type 2)
| Offset | Type   | Info
|--------|--------|-----
| 5      | uint8  | Phase (1: safe area shrinking in x, 2: go to safe area)
| 6      | int32  | Red zone X
| 10     | int32  | Red zone Y
| 14	   | uint32 | Red zone radius
| 18	   | uint32 | Shrink time
| 22     | int32  | Target zone X
| 26     | int32  | Target zone Y
| 30	   | uint32 | Target zone radius

### Player death
| Offset | Type  | Info
|--------|-------|-----
| 0      | uint8 | Packet ID (179)
| 1      | uint8 | Death type

##### Death types:
| Type | Description
|------|------------
| 0    | player ate player
| 1    | player eaten by virus
| 2    | player could not get away
| 3    | player died

All types but `0` have 1 field with a string of the killed nickname (type 0 has 1 more, killer nickname)

### Battle result
| Offset | Type   | Info
|--------|--------|-----
| 0      | uint8  | Packet ID (180)
| 1      | uint32 | Final position
| 5      | uint32 | Total kills
| 7      | uint16 | Player count (read below while (playerCount--))
| ?      | string | Player nickname
| ?      | uint32 | Player position

## Added in protocol 19 (Minimap)
Since 2018/20/12, a new protocol 19 is rolled out. The difference is just in cipher key.
Also added a new message 0x45 - Minimap

sv_protocol 19
sv_secret 0x0000765D
sv_versionClient "3.3.1"
sv_versionProto "12.0.1"

45 = MINIMAP UPDATE

| Offset | Size | Description |
| --- | --- | --- |
| 0 | byte | =0x45 |
| 1 | uint16 | record count |
| 3 | minimaprec | record 1 |
| x | minimaprec | record 2 |
| ... | ... | ... |

Minimap record structure is the following:

| Offset | Size | Description |
| --- | --- | --- |
| 0 | int32 | player X coordinate |
| 4 | int32 | player Y coordinate |
| 8 | uint32 | player total mass |
| 11 | byte | player flags |
| ... | ... | ... |

player flags:

| Bit | Mask | Description |
| --- | --- | --- |
| 0 | 01 | highlight player on the minimap with red color |
| 1 | 02 |  |
| 2 | 04 |  |
| 3 | 08 |  |
| ... | ... | ... |



All player cells displayed with one minimap record, which has total mass owned by the player.
Minimap records contains top 20 players, sorted by owned mass.

This is how minimap data looks like (look for minimap debug data on the screen, because graphical minimap on the bottom right corner is not related to this feature, this is just my old minimap):

![Minimap Screenshot](https://i.imgur.com/AVTsLgK.png)

There is need more investigation about minimap record fields. If you have any info, you're welcome.



## Changed in protocol 20
Set Border no longer has server version, it has been moved to Cipher Key (241)
