// noinspection DuplicatedCode,JSUnresolvedReference,JSIgnoredPromiseFromCall

(function() {
	'use strict';

	if (typeof WebSocket === 'undefined' || typeof DataView === 'undefined' || typeof ArrayBuffer === 'undefined' || typeof Uint8Array === 'undefined') {
		alert('Your browser does not support required features, please update your browser.');
		window.stop();
	}

	class Sound {
		constructor(src, volume, maximum) {
			this.src = src;
			this.volume = typeof volume === 'number' ? volume : 0.5;
			this.maximum = typeof maximum === 'number' ? maximum : Infinity;
			this.elms = [];
		}
		play(vol) {
			if (typeof vol === 'number') this.volume = vol;
			const toPlay = this.elms.find((elm) => elm.paused) ?? this.add();
			toPlay.volume = this.volume;
			// noinspection JSIgnoredPromiseFromCall
			toPlay.play();
		}
		add() {
			if (this.elms.length >= this.maximum) return this.elms[0];
			const elm = new Audio(this.src);
			this.elms.push(elm);
			return elm;
		}
	}

	class Color {
		static fromHex(color) {
			let hex = color;
			if (color.startsWith('#')) hex = color.slice(1);
			if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
			if (hex.length !== 6) throw new Error(`Invalid color ${color}`);
			const v = parseInt(hex, 16);
			return new Color(v >>> 16 & 255, v >>> 8 & 255, v & 255, `#${hex}`);
		}
		constructor(r, g, b, hex) {
			this.r = r;
			this.g = g;
			this.b = b;
			this.hexCache = hex;
		}
		clone() {
			return new Color(this.r, this.g, this.b);
		}
		toHex() {
			if (this.hexCache) return this.hexCache;
			return this.hexCache = `#${(1 << 24 | this.r << 16 | this.g << 8 | this.b).toString(16).slice(1)}`;
		}
		darken(grade = 1) {
			grade /= 10;
			this.r *= 1 - grade;
			this.g *= 1 - grade;
			this.b *= 1 - grade;
			return this;
		}
		darker(grade = 1) {
			return this.clone().darken(grade);
		}
		static randomColor() {
			switch (~~(Math.random() * 6)) {
				case 0: return Color.toColor((~~(Math.random() * 0x100) << 16) | (0xFF << 8) | 0x10);
				case 1: return Color.toColor((~~(Math.random() * 0x100) << 16) | (0x10 << 8) | 0xFF);
				case 2: return Color.toColor((0xFF << 16) | (~~(Math.random() * 0x100) << 8) | 0x10);
				case 3: return Color.toColor((0x10 << 16) | (~~(Math.random() * 0x100) << 8) | 0xFF);
				case 4: return Color.toColor((0x10 << 16) | (0xFF << 8) | ~~(Math.random() * 0x100));
				case 5: return Color.toColor((0xFF << 16) | (0x10 << 8) | ~~(Math.random() * 0x100));
			}
		}
		static toColor(num) {
			return '#' + (num & 0x00FFFFFF).toString(16).padStart(6, '0');
		}
		// noinspection JSUnusedGlobalSymbols
		static toRGBA(num) {
			num >>>= 0;
			let b = num & 0xFF, g = (num & 0xFF00) >>> 8, r = (num & 0xFF0000) >>> 16, a = ( (num & 0xFF000000) >>> 24 ) / 255;
			return 'rgba(' + [r, g, b, a].join(',') + ')';
		}
	}

	class Writer {
		constructor(littleEndian) {
			this.tmpBuf = new DataView(new ArrayBuffer(8));
			this._e = littleEndian;
			this.reset();

			return this;
		}
		reset(littleEndian = this._e) {
			this._e = littleEndian;
			this._b = [];
			this._o = 0;
		}
		setUint8(a) {
			if (a >= 0 && a < 256) this._b.push(a);
			return this;
		}
		setInt8(a) {
			if (a >= -128 && a < 128) this._b.push(a);
			return this;
		}
		setUint16(a) {
			this.tmpBuf.setUint16(0, a, this._e);
			this._move(2);
			return this;
		}
		setInt16(a) {
			this.tmpBuf.setInt16(0, a, this._e);
			this._move(2);
			return this;
		}
		setUint32(a) {
			this.tmpBuf.setUint32(0, a, this._e);
			this._move(4);
			return this;
		}
		setInt32(a) {
			this.tmpBuf.setInt32(0, a, this._e);
			this._move(4);
			return this;
		}
		setFloat32(a) {
			this.tmpBuf.setFloat32(0, a, this._e);
			this._move(4);
			return this;
		}
		setFloat64(a) {
			this.tmpBuf.setFloat64(0, a, this._e);
			this._move(8);
			return this;
		}
		_move(b) {
			for (let i = 0; i < b; i++) this._b.push(this.tmpBuf.getUint8(i));
		}
		setStringUTF8(s) {
			// noinspection JSDeprecatedSymbols
			const bytesStr = unescape(encodeURIComponent(s));
			for (let i = 0, l = bytesStr.length; i < l; i++) this._b.push(bytesStr.charCodeAt(i));
			this._b.push(0);
			return this;
		}
		build() {
			return new Uint8Array(this._b);
		}
	}

	class Reader {
		constructor(view, offset, littleEndian) {
			this.reader = true;
			this._e = littleEndian;
			if (view) this.repurpose(view, offset);
		}
		repurpose(view, offset) {
			this.view = view;
			this._o = offset || 0;
		}
		getUint8() {
			return this.view.getUint8(this._o++, this._e);
		}
		getInt8() {
			return this.view.getInt8(this._o++, this._e);
		}
		getUint16() {
			return this.view.getUint16((this._o += 2) - 2, this._e);
		}
		getInt16() {
			return this.view.getInt16((this._o += 2) - 2, this._e);
		}
		getUint32() {
			return this.view.getUint32((this._o += 4) - 4, this._e);
		}
		getInt32() {
			return this.view.getInt32((this._o += 4) - 4, this._e);
		}
		getFloat32() {
			return this.view.getFloat32((this._o += 4) - 4, this._e);
		}
		getFloat64() {
			return this.view.getFloat64((this._o += 8) - 8, this._e);
		}
		getStringUTF8() {
			let s = '', b;
			while ((b = this.view.getUint8(this._o++)) !== 0) s += String.fromCharCode(b);
			// noinspection JSDeprecatedSymbols
			return decodeURIComponent(escape(s));
		}
	}

	class Logger {
		static get verbosity() {
			return 0;
		}
		static error() {
			if (Logger.verbosity > 0) console.error.apply(null, arguments);
		}
		static warn() {
			if (Logger.verbosity > 1) console.warn.apply(null, arguments);
		}
		static info() {
			if (Logger.verbosity > 2) console.info.apply(null, arguments);
		}
		static debug() {
			if (Logger.verbosity > 3) console.debug.apply(null, arguments);
		}
	}

	/*class Filters {
		constructor() {
			this.blacklist_search_regex = {}
			this.blacklist_search_regex_tr = {}
			this.blacklist_search_regex_pt = {}
			this.blacklist_replace_regex = {}
		}

		run_all_filters(str) {
			str = str.replaceAll('?', ' ?').replaceAll('!', ' !').replaceAll('-', ' ').replaceAll('.', ' ').replaceAll(',', ' ').trim().split(' ')

			if (Array.isArray(str)) {
				for (let word1 in str) {
					for (let r1 in this.autocorrect_slang_regex_list) {
						if (str[word1].match(this.autocorrect_slang_regex_list[r1])) {
							str[word1] = str[word1].replace(this.autocorrect_slang_regex_list[r1], r1)
						}
					}
				}

				for (let word2 in str) {
					for (let r2 in this.autocorrect_abbreviation_regex_list) {
						if (str[word2].match(this.autocorrect_abbreviation_regex_list[r2])) {
							str[word2] = str[word2].replace(this.autocorrect_abbreviation_regex_list[r2], r2)
						}
					}
				}

				for (let word3 in str) {
					for (let r3 in this.autocorrect_misspelling_regex_list) {
						if (str[word3].match(this.autocorrect_misspelling_regex_list[r3])) {
							str[word3] = str[word3].replace(this.autocorrect_misspelling_regex_list[r3], r3)
						}
					}
				}

				for (let word4 in str) {
					for (let r4 in this.autocorrect_contraction_regex_list) {
						if (str[word4].match(this.autocorrect_contraction_regex_list[r4])) {
							str[word4] = str[word4].replace(this.autocorrect_contraction_regex_list[r4], r4)
						}
					}
				}

				for (let word5 in str) {
					for (let r5 in this.autocorrect_replacement_regex_list) {
						if (str[word5].match(this.autocorrect_replacement_regex_list[r5])) {
							str[word5] = str[word5].replace(this.autocorrect_replacement_regex_list[r5], r5)
						}
					}
				}

				return str.join(' ')
			}
		}

		remove_zalgo(str) {
			return str.replace(/[\u0300-\u036F\u0483-\u0486\u064E\u064F]/g, '').replace(/[\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F\u0483-\u0486\u05C7\u0610-\u061A\u0656-\u065F\u0670\u06D6-\u06ED\u0711\u0730-\u073F\u0743-\u074A\u0F18-\u0F19\u0F35\u0F37\u0F72-\u0F73\u0F7A-\u0F81\u0F84\u0e00-\u0eff\uFC5E-\uFC62]{2,}/gi, '')
		}

		remove_spam(str) {
			// noinspection JSUnresolvedVariable
			for (let spam in blacklist) {
				// noinspection JSUnresolvedVariable,JSUnfilteredForInLoop
				str = str.replace(new RegExp(blacklist[spam], 'gi'), '')
			}

			return str.replace(/  +/g, ' ').trim()
		}

		remove_duplicates(str) {
			return str.replace(/([^`])\1{4,}/gi, '$1').replace(/(.)\1{5,}/gi, '$1$1$1$1$1$1')
		}

		str_replace(search, replace, subject, countObj) {
			let i = 0
			let j = 0
			let temp = ''
			let repl = ''
			let sl = 0
			let fl = 0
			let f = [].concat(search)
			let r = [].concat(replace)
			let s = subject
			let ra = Object.prototype.toString.call(r) === '[object Array]'
			let sa = Object.prototype.toString.call(s) === '[object Array]'
			s = [].concat(s)

			if (typeof search === 'object' && typeof replace === 'string') {
				temp = replace
				replace = []

				for (i = 0; i < search.length; i += 1) {
					replace[i] = temp
				}

				temp = ''
				r = [].concat(replace)
				ra = Object.prototype.toString.call(r) === '[object Array]'
			}

			if (typeof countObj !== 'undefined') {
				countObj.value = 0
			}

			for (i = 0, sl = s.length; i < sl; i++) {
				if (s[i] === '') {
					continue
				}

				for (j = 0, fl = f.length; j < fl; j++) {
					temp = s[i] + ''
					repl = ra ? (r[j] !== undefined ? r[j] : '') : r[0]
					s[i] = (temp).split(f[j]).join(repl)

					if (typeof countObj !== 'undefined') {
						countObj.value += ((temp.split(f[j])).length - 1)
					}
				}
			}

			return sa ? s : s[0]
		}
	}*/

	class Cell {
		static parseName(name, limit = true) {
			if (typeof name !== 'undefined' && name !== null && name !== '')
				return name.trim().replace(/[<>|﷽⸺⸻ဪ௵꧁꧂꧅༽╲⎝⧹⎠╱⧸⎨⎬▀▄𒐧𒐧𒐧𒐧𒐧𒅃𒄊𒈜𒌧𒉮𒁎𒄡𒅌𒈓𒈙𒊎𒀰]/g, '').substring(0, 16);
			return name;
		}
		constructor(id, x, y, s, name, nameColor, cellColor, borderColor, skin, flags) {
			this.destroyed = false;
			this.diedBy = 0;
			this.nameSize = 0;
			this.drawNameSize = 0;
			this.updated = null;
			this.dead = null;
			this.id = id;
			this.ox = x;
			this.x = x;
			this.nx = x;
			this.oy = y;
			this.y = y;
			this.ny = y;
			this.os = s;
			this.s = s;
			this.ns = s;
			this.name = Cell.parseName(name);
			this.nameColor = nameColor || Color.fromHex('#ffffff');
			this.cellColor = cellColor || Color.fromHex('#ffffff');
			this.borderColor = borderColor || (cellColor ? cellColor.darker() : Color.fromHex('#ffffff'));
			this.setSkin(skin, name);
			this.fp = skin && skin !== '' ? skin.split('|')[4] : null;
			this.fp2 = skin && skin !== '' ? skin.split('|')[5] : null;
			this.jagged = flags.jagged;
			this.ejected = flags.ejected;
			this.born = syncUpdStamp;
			this.points = [];
			this.pointsVel = [];
		}
		destroy(killerId) {
			cells.byId.delete(this.id);

			if (cells.mine.remove(this.id) && cells.mine.length === 0) {
				if (settings.autoRespawn && !escOverlayShown) {
					allowClick = true;
					byId('play-btn').click();
					allowClick = false;
				} else {
					showESCOverlay();
				}
			}

			this.destroyed = true;
			this.dead = syncUpdStamp;

			if (killerId && !this.diedBy) {
				this.diedBy = killerId;
				this.updated = syncUpdStamp;
			}
		}
		update(relativeTime) {
			// const prevFrameSize = this.s;
			const dt = Math.max(Math.min((relativeTime - this.updated) / 120, 1), 0);
			let diedBy;

			if (this.destroyed && Date.now() > this.dead + 200) {
				cells.list.remove(this);
			} else if (this.diedBy && (diedBy = cells.byId.get(this.diedBy))) {
				this.nx = diedBy.x;
				this.ny = diedBy.y;
			}

			this.x = this.ox + (this.nx - this.ox) * dt;
			this.y = this.oy + (this.ny - this.oy) * dt;
			this.s = this.os + (this.ns - this.os) * dt;
			this.nameSize = ~~(~~(Math.max(~~(0.3 * this.ns), 24)) / 3) * 3;
			this.drawNameSize = ~~(~~(Math.max(~~(0.3 * this.s), 24)) / 3) * 3;

			/*TODO: find out why this causes random background color
			if (settings.jellyPhysics && this.points.length) {
				const ratio = this.s / prevFrameSize;
				if (this.ns != this.os && ratio != 1) {
					for (const point of this.points) point.rl *= ratio;
				}
			}*/
		}
		updateNumPoints() {
			let numPoints = Math.min(Math.max(this.s * camera.scale | 0, CELL_POINTS_MIN), CELL_POINTS_MAX);

			if (this.jagged) numPoints = VIRUS_POINTS;

			while (this.points.length > numPoints) {
				const i = Math.random() * this.points.length | 0;
				this.points.splice(i, 1);
				this.pointsVel.splice(i, 1);
			}

			if (this.points.length === 0 && numPoints !== 0) {
				this.points.push({ x: this.x, y: this.y, rl: this.s, parent: this });
				this.pointsVel.push(Math.random() - 0.5);
			}

			while (this.points.length < numPoints) {
				const i = Math.random() * this.points.length | 0;
				const point = this.points[i];
				const vel = this.pointsVel[i];
				this.points.splice(i, 0, { x: point.x, y: point.y, rl: point.rl, parent: this });
				this.pointsVel.splice(i, 0, vel);
			}
		}
		movePoints() {
			const pointsVel = this.pointsVel.slice();

			for (let i = 0; i < this.points.length; ++i) {
				const prevVel = pointsVel[(i - 1 + this.points.length) % this.points.length];
				const nextVel = pointsVel[(i + 1) % this.points.length];
				const newVel = Math.max(Math.min((this.pointsVel[i] + Math.random() - 0.5) * 0.7, 10), -10);
				this.pointsVel[i] = (prevVel + nextVel + 8 * newVel) / 10;
			}

			for (let i = 0; i < this.points.length; ++i) {
				const curP = this.points[i];
				const prevRl = this.points[(i - 1 + this.points.length) % this.points.length].rl;
				const nextRl = this.points[(i + 1) % this.points.length].rl;
				let curRl = curP.rl;

				let affected = quadtree.some({ x: curP.x - 5, y: curP.y - 5, w: 10, h: 10 }, item => item.parent !== this && sqDist(item, curP) <= 25);

				if (!affected && (curP.x < border.left || curP.y < border.top || curP.x > border.right || curP.y > border.bottom)) {
					affected = true;
				}

				if (affected) {
					this.pointsVel[i] = Math.min(this.pointsVel[i], 0) - 1;
				}

				curRl += this.pointsVel[i];
				curRl = Math.max(curRl, 0);
				curRl = (9 * curRl + this.s) / 10;
				curP.rl = (prevRl + nextRl + 8 * curRl) / 10;

				const angle = 2 * Math.PI * i / this.points.length;
				let rl = curP.rl;

				if (this.jagged && i % 2 === 0) {
					rl += 5;
				}

				curP.x = this.x + Math.cos(angle) * rl;
				curP.y = this.y + Math.sin(angle) * rl;
			}
		}
		setSkin(value, name) {
			let skinpic = value;

			if (typeof skinpic !== 'undefined' && skinpic !== null && skinpic !== '') {
				skinpic = skinpic.trim();

				if (skinpic.indexOf('|') !== -1) {
					skinpic = skinpic.split('|')[0];
				}
			}

			if (typeof skinpic === 'undefined' || skinpic === null || skinpic === '') return;

			this.skin = skinpic[0] === '%' ? skinpic.slice(1) : skinpic;

			if (loadedSkins.has(this.skin) || bannedSkins.has(this.skin)) return;

			const skin = new Image();

			if (this.skin.startsWith('https://iili.io/') && !this.skin.endsWith('.gif')) {
				skin.onerror = () => {
					skin.onerror = null;
					skin.src = './assets/img/transparent.png';
				};
				skin.src = `https://agar2.emupedia.net/skin/${textToNumber(this.skin)}?nick=${name}&fp=${value.split('|')[4]}&fp2=${value.split('|')[5]}`;
			} else {
				skin.onerror = () => {
					skin.onerror = null;
					skin.src = './assets/img/transparent.png';
				};
				skin.src = `${SKIN_URL}${this.skin}.png`;
			}

			loadedSkins.set(this.skin, skin);
		}
		draw(ctx) {
			ctx.save();
			this.drawShape(ctx);
			this.drawText(ctx);
			ctx.restore();
		}
		drawShape(ctx) {
			ctx.fillStyle = settings.showColor ? this.cellColor.toHex() : '#ffffff';
			ctx.strokeStyle = settings.showColor ? this.borderColor.toHex() : '#e5e5e5';
			ctx.lineWidth = Math.max(~~(this.s / 50), 10);

			if (this.s > 20) {
				this.s -= ctx.lineWidth / 2;
			}

			ctx.beginPath();
			if (this.jagged) ctx.lineJoin = 'miter';
			if (settings.jellyPhysics && this.points.length) {
				const point = this.points[0];
				ctx.moveTo(point.x, point.y);
				for (const point of this.points) ctx.lineTo(point.x, point.y);
			} else if (this.jagged) {
				const pointCount = 120;
				const incremental = PI_2 / pointCount;
				ctx.moveTo(this.x, this.y + this.s + 3);
				for (let i = 1; i < pointCount; i++) {
					const angle = i * incremental;
					const dist = this.s - 3 + (i % 2 === 0) * 6;
					ctx.lineTo(this.x + dist * Math.sin(angle), this.y + dist * Math.cos(angle))
				}
				ctx.lineTo(this.x, this.y + this.s + 3);
			} else {
				ctx.arc(this.x, this.y, this.s, 0, PI_2, false);
			}
			ctx.closePath();

			if (settings.showTransparent) {
				ctx.globalAlpha = 1 - parseFloat(transparentAlpha.value) || 1;
			} else if (this.destroyed) {
				ctx.globalAlpha = Math.max(120 - Date.now() + this.dead, 0) / 120;
			} else {
				ctx.globalAlpha = Math.min(Date.now() - this.born, 120) / 120;
			}

			const skinImage = loadedSkins.get(this.skin);
			if (settings.showSkins && this.skin && skinImage && skinImage.complete && skinImage.width && skinImage.height) {
				if (settings.fillSkin) ctx.fill();
				ctx.save();
				ctx.clip();
				ctx.drawImage(skinImage, this.x - this.s, this.y - this.s, this.s * 2, this.s * 2);
				ctx.restore();
			} else {
				ctx.fill();
			}
			if (this.s > 20) {
				ctx.stroke();
				this.s += ctx.lineWidth / 2;
			}
		}
		drawText(ctx) {
			if (this.s < 20 || this.jagged) return;

			const mass = (~~(this.s * this.s / 100)).toString();

			if (settings.showIdenticon && (this.fp2 || this.fp) && mass > 100) {
				let y = this.y;

				y += 2 * Math.max(this.s / 4.5, this.nameSize / 1.5);

				drawText(ctx, 'fp', this.x, y, this.nameSize * 4, this.drawNameSize * 2, this.fp2 || this.fp, settings.showColor ? this.borderColor.toHex() : '#e5e5e5');
			}

			if (this.name && settings.showNames) {
				drawText(ctx, 'name', this.x, this.y, this.nameSize, this.drawNameSize, this.name, this.nameColor ? this.nameColor.toHex().toUpperCase() : '#ffffff');
			}

			if (settings.showMass && (cells.mine.indexOf(this.id) !== -1 || cells.mine.length === 0)) {
				let y = this.y;

				if (this.name && settings.showNames) y += Math.max(this.s / 4.5, this.nameSize / 1.5);

				drawText(ctx, 'mass', this.x, y, this.nameSize / 2, this.drawNameSize / 2, mass);
			}
		}
	}

	function byId(id) {
		return document.getElementById(id);
	}

	function byClass(clss, parent) {
		return (parent || document).getElementsByClassName(clss);
	}

	const LOAD_START = Date.now();

	Array.prototype.remove = function (a) {
		const i = this.indexOf(a);
		return i !== -1 && this.splice(i, 1);
	}

	Element.prototype.hide = function () {
		// noinspection JSUnresolvedReference
		this.style.display = 'none';
		// noinspection JSUnresolvedReference
		if (this.style.opacity === 1) {
			// noinspection JSUnresolvedReference
			this.style.opacity = 0;
		}
	}

	Element.prototype.show = function (seconds) {
		// noinspection JSUnresolvedReference
		this.style.display = '';
		if (!seconds) return;
		// noinspection JSUnresolvedReference
		this.style.transition = `opacity ${seconds}s ease 0s`;
		// noinspection JSUnresolvedReference
		this.style.opacity = 1;
	}

	Element.prototype.toggle = function () {
		// noinspection JSUnresolvedReference
		if (this.style.display === 'none') {
			this.show();
		} else {
			this.hide();
		}
	}

	function cleanupObject(object) {
		for (const i in object) delete object[i];
	}

	const SKIN_URL = './skins/';
	const USE_HTTPS = 'https:' === window.location.protocol || window.location.hostname === 'localhost';
	const EMPTY_NAME = 'An unnamed cell';
	const QUADTREE_MAX_POINTS = 32;
	const CELL_POINTS_MIN = 5;
	const CELL_POINTS_MAX = 120;
	const VIRUS_POINTS = 100;
	const PI_2 = Math.PI * 2;
	const UINT8_CACHE = {
		0x00: new Uint8Array([0x00]),
		0x01: new Uint8Array([0x01]),
		0x11: new Uint8Array([0x11]),
		0x12: new Uint8Array([0x12]),
		0x13: new Uint8Array([0x13]),
		0x15: new Uint8Array([0x15]),
		0x16: new Uint8Array([0x16]),
		0x17: new Uint8Array([0x17]),
		0x18: new Uint8Array([0x18]),
		0x19: new Uint8Array([0x19]),
		0xFE: new Uint8Array([0xFE])
	};
	const FP = FingerprintJS.load();
	const LOCATION = ~window.location.hostname.indexOf('emupedia.net') ? 'emupedia.net' : (~window.location.hostname.indexOf('emupedia.org') ? 'emupedia.org' : (~window.location.hostname.indexOf('emupedia.games') ? 'emupedia.games' : (~window.location.hostname.indexOf('emuos.net') ? 'emuos.net' : (~window.location.hostname.indexOf('emuos.org') ? 'emuos.org' : (~window.location.hostname.indexOf('emuos.games') ? 'emuos.games' : 'emupedia.net')))));
	const SERVERS = ['agar' + '.' + LOCATION + '/ws2/', 'agar2' + '.' + LOCATION + '/ws2/'];
	const GEO = {'eu-ffa': SERVERS[0], 'eu': SERVERS[0], 'us': SERVERS[1], 'eu-pvp': SERVERS[1]};
	const TC = new BroadcastChannel('agar2');
	const MC = document.getElementById('multicheck');

	TC.onmessage = event => {
		if (event.data.type === 'check') {
			TC.postMessage({ type: 'ac' });
		} else if (event.data.type === 'ac') {
			if (!isActive) {
				setInterval(() => {
					wsCleanup();
					hideESCOverlay();
					byId('chat_textbox').hide();
					byId('chat_clear').hide();
					byId('connecting-content').innerHTML = '<h3>Multisession Warning</h3><hr class="top" /><p style="text-align: center">Multiple game instances are not allowed.<br />Close all other game instances and reload.</p>';
					byId('connecting').show(0.5);
				}, 1000);
			}
		}
	};

	const KEY_TO_OPCODE = {
		e: UINT8_CACHE[0x16],
		r: UINT8_CACHE[0x17],
		t: UINT8_CACHE[0x18]
	};

	const IE_KEYS = {
		spacebar: ' ',
		esc: 'escape'
	};

	const CODE_TO_KEY = {
		Space: ' ',
		KeyW: 'w',
		KeyQ: 'q',
		KeyE: 'e',
		KeyR: 'r',
		KeyT: 't',
		KeyZ: 'z',
		KeyX: 'x',
		KeyC: 'c'
	};

	function wsCleanup() {
		if (!ws) return;
		Logger.debug('WebSocket cleanup');
		ws.onopen = null;
		ws.onmessage = null;
		ws.close();
		ws = null;
	}

	function wsInit(url) {
		if (ws) {
			Logger.debug('WebSocket init on existing connection');
			wsCleanup();
			gameReset();
		}
		byId('connecting').show(0.5);

		// noinspection JSUnresolvedReference
		if (typeof grecaptcha !== 'undefined') {
			// noinspection JSUnresolvedReference
			grecaptcha.ready(() => {
				// noinspection JSUnresolvedReference
				grecaptcha.execute('6LdxZMspAAAAAOVZOMGJQ_yJo2hBI9QAbShSr_F3', { action: 'connectV2' }).then(token => {
					ws = new WebSocket(`ws${USE_HTTPS ? 's' : ''}://${url + '?token=' + token}`);
					ws.binaryType = 'arraybuffer';
					ws.onopen = wsOpen;
					ws.onmessage = wsMessage;
					ws.onerror = wsError;
					ws.onclose = wsClose;
				});
			});
		} else {
			ws = new WebSocket(`ws${USE_HTTPS ? 's' : ''}://${url}`);
			ws.binaryType = 'arraybuffer';
			ws.onopen = wsOpen;
			ws.onmessage = wsMessage;
			ws.onerror = wsError;
			ws.onclose = wsClose;
		}
	}

	function wsOpen() {
		reconnectDelay = 1000;

		byId('connecting').hide();

		wsSend(new Uint8Array([0xFE, 6, 0, 0, 0]));

		if (settings.nick !== '') {
			const writer = new Writer(true);
			writer.setUint8(0xFF);
			writer.setUint8(1);
			writer.setUint8(0);
			writer.setUint8(0);
			writer.setUint8(0);
			writer.setStringUTF8(Cell.parseName(settings.nick));
			wsSend(writer);
		} else {
			wsSend(new Uint8Array([0xFF, 1, 0, 0, 0]));
		}
	}

	function wsError(error) {
		Logger.warn(error);
	}

	function wsClose(e) {
		if (e.currentTarget !== ws) return;
		Logger.debug(`WebSocket disconnected ${e.code} (${e.reason})`);
		wsCleanup();
		gameReset();
		setTimeout(() => window.setserver(settings.server), reconnectDelay *= 1.8);
	}

	function wsSend(data) {
		if (!ws) return;
		if (ws.readyState !== 1) return;
		if (data.build) ws.send(data.build());
		else ws.send(data);
	}

	function wsMessage(data) {
		syncUpdStamp = Date.now();
		const reader = new Reader(new DataView(data.data), 0, true);
		const packetId = reader.getUint8();

		switch (packetId) {
			// update nodes
			case 0x10: {
				// consume records
				const addedCount = reader.getUint16();

				for (let i = 0; i < addedCount; i++) {
					const killer = reader.getUint32();
					const killed = reader.getUint32();

					if (!cells.byId.has(killer) || !cells.byId.has(killed))
						continue;

					if (settings.playSounds && cells.mine.includes(killer)) {
						(cells.byId.get(killed).s < 20 ? pelletSound : eatSound).play(parseFloat(soundsVolume.value));
					}

					cells.byId.get(killed).destroy(killer);
				}

				let skinParts = ['', '#ffffff', '#ffffff', '#ffffff'];

				// update records
				while (true) {
					const id = reader.getUint32();

					if (id === 0) break;

					const x = reader.getInt32();
					const y = reader.getInt32();
					const s = reader.getUint16();

					const flagMask = reader.getUint8();

					const flags = {
						updColor: !!(flagMask & 0x02),
						updSkin: !!(flagMask & 0x04),
						updName: !!(flagMask & 0x08),
						jagged: !!(flagMask & 0x01) || !!(flagMask & 0x10),
						ejected: !!(flagMask & 0x20),
					};

					const color = flags.updColor ? new Color(reader.getUint8(), reader.getUint8(), reader.getUint8()) : null;
					const skin = flags.updSkin ? reader.getStringUTF8() : null;
					const name = flags.updName ? reader.getStringUTF8() : null;

					if (cells.byId.has(id)) {
						const cell = cells.byId.get(id);
						cell.update(syncUpdStamp);
						cell.updated = syncUpdStamp;
						cell.ox = cell.x;
						cell.oy = cell.y;
						cell.os = cell.s;
						cell.nx = x;
						cell.ny = y;
						cell.ns = s;

						if (color) cell.cellColor = color;

						if (name) cell.name = Cell.parseName(name);

						if (skin) {
							cell.setSkin(skin, name);

							if (skin && Array.isArray(skin.split('|')) && skin.split('|').length > 1) {
								skinParts = skin.split('|');
								cell.nameColor = skinParts[1] !== '#ffffff' ? Color.fromHex(skinParts[1]) : color;
								cell.cellColor = skinParts[2] !== '#ffffff' ? Color.fromHex(skinParts[2]) : color;
								cell.borderColor = skinParts[3] !== '#ffffff' ? Color.fromHex(skinParts[3]) : color.darker();
							}
						}
					} else {
						const cell = new Cell(id, x, y, s, name, color, color, color?.darker(), skin, flags);

						if (skin && Array.isArray(skin.split('|')) && skin.split('|').length > 1) {
							skinParts = skin.split('|');
							cell.nameColor = skinParts[1] !== '#ffffff' ? Color.fromHex(skinParts[1]) : color;
							cell.cellColor = skinParts[2] !== '#ffffff' ? Color.fromHex(skinParts[2]) : color;
							cell.borderColor = skinParts[3] !== '#ffffff' ? Color.fromHex(skinParts[3]) : color.darker();
						}

						cells.byId.set(id, cell);
						cells.list.push(cell);
					}
				}

				// dissapear records
				const removedCount = reader.getUint16();

				for (let i = 0; i < removedCount; i++) {
					const killed = reader.getUint32();

					if (cells.byId.has(killed) && !cells.byId.get(killed).destroyed) {
						cells.byId.get(killed).destroy(null);
					}
				}
				break;
			}
			// update pos
			case 0x11: {
				camera.target.x = reader.getFloat32();
				camera.target.y = reader.getFloat32();
				camera.target.scale = reader.getFloat32();
				camera.target.scale *= camera.viewportScale;
				camera.target.scale *= camera.userZoom;
				break;
			}
			// clear all
			case 0x12: {
				for (const cell of cells.byId.values()) {
					cell.destroy(null);
				}
				cells.mine = [];
				break;
			}
			// clear my cells
			case 0x14: {
				cells.mine = [];
				break;
			}
			// draw line
			case 0x15: {
				Logger.warn('got packet 0x15 (draw line) which is unsupported');
				break;
			}
			// new cell
			case 0x20: {
				cells.mine.push(reader.getUint32());
				break;
			}
			// text list
			case 0x30: {
				leaderboard.items = [];
				leaderboard.type = 'text';

				const lbCount = reader.getUint32();

				for (let i = 0; i < lbCount; ++i) {
					leaderboard.items.push(reader.getStringUTF8());
				}

				drawLeaderboard();
				break;
			}
			// ffa list
			case 0x31: {
				leaderboard.items = [];
				leaderboard.type = 'ffa';

				const count = reader.getUint32();

				for (let i = 0; i < count; ++i) {
					const isMe = !!reader.getUint32();
					const lbName = reader.getStringUTF8();
					leaderboard.items.push({
						me: isMe,
						name: Cell.parseName(lbName) || EMPTY_NAME
					});
				}

				drawLeaderboard();
				break;
			}
			// pie chart
			case 0x32: {
				leaderboard.items = [];
				leaderboard.type = 'pie';

				const teamsCount = reader.getUint32();

				for (let i = 0; i < teamsCount; ++i) {
					leaderboard.items.push(reader.getFloat32());
				}

				drawLeaderboard();
				break;
			}
			// set border
			case 0x40: {
				border.left = reader.getFloat64();
				border.top = reader.getFloat64();
				border.right = reader.getFloat64();
				border.bottom = reader.getFloat64();
				border.width = border.right - border.left;
				border.height = border.bottom - border.top;
				border.centerX = (border.left + border.right) / 2;
				border.centerY = (border.top + border.bottom) / 2;

				if (data.data.byteLength === 33) break;

				if (!mapCenterSet) {
					mapCenterSet = true;
					camera.x = camera.target.x = border.centerX;
					camera.y = camera.target.y = border.centerY;
					camera.scale = camera.target.scale = 1;
				}

				reader.getUint32(); // game type

				if (!/MultiOgar|OgarII/.test(reader.getStringUTF8()) || stats.pingLoopId) break;

				stats.pingLoopId = setInterval(() => {
					wsSend(UINT8_CACHE[0xFE]);
					stats.pingLoopStamp = Date.now();
				}, 2000);
				break;
			}
			// chat message
			case 0x62: {
				const flagMask = reader.getUint8();

				const flags = {
					server: !!(flagMask & 0x80),
					admin: !!(flagMask & 0x40),
					mod: !!(flagMask & 0x20),
				};

				const color = new Color(reader.getUint8(), reader.getUint8(), reader.getUint8());
				const rawName = reader.getStringUTF8();
				const message = reader.getStringUTF8();

				let name = Cell.parseName(rawName) || EMPTY_NAME;

				if (flags.server && name !== 'SERVER') name = `[SERVER] `;
				if (flags.admin) name = `[ADMIN] ${name}`;
				if (flags.mod) name = `[MOD] ${name}`;

				const wait = Math.max(3000, 1000 + message.length * 150);
				chat.waitUntil = syncUpdStamp - chat.waitUntil > 1000 ? syncUpdStamp + wait : chat.waitUntil + wait;
				chat.messages.push({ color, name, message, time: syncUpdStamp, server: flags.server, admin: flags.admin, mod: flags.mod, me: false });
				if (settings.showChat) drawChat();
				break;
			}
			// server stat
			case 0xFE: {
				stats.info = JSON.parse(reader.getStringUTF8());
				stats.latency = syncUpdStamp - stats.pingLoopStamp;
				drawStats();
				break;
			}
			// invalid packet
			default: {
				wsCleanup();
				break;
			}
		}
	}

	function sendMouseMove(x, y) {
		const writer = new Writer(true);
		writer.setUint8(0x0F);
		writer.setUint32(x);
		writer.setUint32(y);
		writer._b.push(0, 0, 0, 0);
		wsSend(writer);
	}

	function sendPlay(name) {
		const writer = new Writer(true);
		writer.setUint8(0x05);
		writer.setStringUTF8(name);
		wsSend(writer);
	}

	function sendSpectate() {
		wsSend(UINT8_CACHE[0x01]);
		stats.maxScore = 0;
		hideESCOverlay();
	}

	function sendChat(text) {
		syncUpdStamp = Date.now();

		const wait = Math.max(3000, 1000 + text.length * 150);
		chat.waitUntil = syncUpdStamp - chat.waitUntil > 1000 ? syncUpdStamp + wait : chat.waitUntil + wait;

		chat.messages.push({ color: settings.nameColor !== '#ffffff' ? Color.fromHex(settings.nameColor) : Color.fromHex('#33ff33'), name: '[YOU]', message: text, time: Date.now(), server: false, admin: false, mod: false, me: true });
		if (settings.showChat) drawChat();

		const writer = new Writer();
		writer.setUint8(0x62);
		writer.setUint8(0);
		writer.setStringUTF8(text);
		wsSend(writer);
	}

	function gameReset() {
		cleanupObject(cells);
		cleanupObject(border);
		cleanupObject(leaderboard);
		cleanupObject(chat);
		cleanupObject(stats);
		chat.messages = [];
		leaderboard.items = [];
		cells.mine = [];
		cells.byId = new Map();
		cells.list = [];
		camera.x = camera.y = camera.target.x = camera.target.y = 0;
		camera.scale = camera.target.scale = 1;
		mapCenterSet = false;
	}

	const cells = {
		mine: [],
		byId: new Map(),
		list: [],
	};

	const border = {
		left: -2000,
		right: 2000,
		top: -2000,
		bottom: 2000,
		width: 4000,
		height: 4000,
		centerX: -1,
		centerY: -1
	};

	const leaderboard = Object.create({
		type: null,
		items: null,
		canvas: document.createElement('canvas'),
		teams: ['#ff3333', '#33ff33', '#3333ff']
	});

	const chat = Object.create({
		viewportHeight: window.innerHeight,
		scrollbarWidth: 8,
		lineHeightSpacing: 10,
		lineTopSpacing: 20,
		leftTextSpacing: 4,
		isDraggingScroll:false,
		scrollOffset: 0,
		scrollDragOffset: 0,
		iconHeight: 20,
		messages: [],
		waitUntil: 0,
		canvas: document.createElement('canvas'),
		visible: false
	});

	const stats = Object.create({
		fps: 0,
		latency: NaN,
		supports: null,
		info: null,
		pingLoopId: NaN,
		pingLoopStamp: null,
		canvas: document.createElement('canvas'),
		visible: false,
		score: NaN,
		maxScore: 0
	});

	const knownSkins = new Map();
	const loadedSkins = new Map();
	const bannedSkins = new Set();
	const bannedFP = new Set();
	const bannedFP2 = new Set();
	const camera = {
		x: 0,
		y: 0,
		target: {
			x: 0,
			y: 0,
			scale: 1
		},
		viewportScale: 1,
		userZoom: 1,
		sizeScale: 1,
		scale: 1
	};

	let ws = null;
	let reconnectDelay = 1000;

	let syncUpdStamp = Date.now();
	let syncAppStamp = Date.now();

	let ident = '';
	let mainCanvas = null;
	let mainCtx = null;
	let soundsVolume;
	let transparentAlpha;
	let escOverlayShown = false;
	let isTyping = false;
	let chatBox = null;
	let chatClear = null;
	let mapCenterSet = false;
	let minionControlled = false;
	let isActive = false;
	let hasResponded = false;
	let allowClick = false;
	let touched = false;
	let mouseX = NaN;
	let mouseY = NaN;
	let feedMacroIntervalID;
	let splitMacroIntervalID;
	let quadtree;
	let interval;

	const settings = {
		server: 'eu-ffa',
		nick: '',
		nicknames: [],
		skin: '',
		skinnames: [],
		gamemode: '',
		fp: '',
		fp2: '',
		showSkins: true,
		showNames: true,
		darkTheme: false,
		showColor: true,
		showMass: false,
		showIdenticon: false,
		_showChat: true,
		mutedPlayers: [],
		get showChat() {
			return this._showChat;
		},
		set showChat(a) {
			this._showChat = a;
			if (!chatBox) return;
			a ? chatBox.show() : chatBox.hide();
			a ? chatClear.show() : chatClear.hide();
		},
		showMinimap: true,
		showPosition: false,
		showBorder: false,
		showGrid: true,
		playSounds: true,
		soundsVolume: 0.5,
		moreZoom: false,
		showZoom: false,
		fillSkin: true,
		backgroundSectors: false,
		jellyPhysics: false,
		showTransparent: false,
		transparentAlpha: 0.75,
		feedMacro: true,
		splitMacro: true,
		bgColor: '#ffffff',
		nameColor: '#ffffff',
		cellColor: '#ffffff',
		borderColor: '#ffffff',
		leftClick: true,
		middleClick: true,
		rightClick: true,
		disableTouchControls: false,
		flipTouchControls: false,
		useJoystick: true,
		useFilters: true,
		autoRespawn: true
	};

	const pressed = {
		' ': false,
		w: false,
		z: false,
		e: false,
		r: false,
		t: false,
		q: false,
		x: false,
		c: false,
		ctrl: false,
		enter: false,
		escape: false
	};

	const eatSound = new Sound('./assets/sound/eat.mp3', 0.5, 10);
	const pelletSound = new Sound('./assets/sound/pellet.mp3', 0.5, 10);

	function hideESCOverlay() {
		escOverlayShown = false;
		byId('overlays').hide();
	}

	function showESCOverlay() {
		escOverlayShown = true;
		byId('overlays').show(0.5);

		if (!touched) {
			byId('menuBtn').hide();
		}
	}

	function toCamera(ctx) {
		ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
		scaleForth(ctx);
		ctx.translate(-camera.x, -camera.y);
	}

	function scaleForth(ctx) {
		ctx.scale(camera.scale, camera.scale);
	}

	function scaleBack(ctx) {
		ctx.scale(1 / camera.scale, 1 / camera.scale);
	}

	function fromCamera(ctx) {
		ctx.translate(camera.x, camera.y);
		scaleBack(ctx);
		ctx.translate(-mainCanvas.width / 2, -mainCanvas.height / 2);
	}

	function initSetting(id, elm) {
		function simpleAssignListen(id, elm, prop) {
			if (id !== 'fp2' && settings[id] !== '') {
				elm[prop] = settings[id];
			}

			elm.addEventListener('change', () => {
				settings[id] = elm[prop];
				// console.log('initSetting()');
				storeSettings();
			});
		}

		switch (elm.tagName.toLowerCase()) {
			case 'input':
				switch (elm.type.toLowerCase()) {
					case 'range':
					case 'text':
						simpleAssignListen(id, elm, 'value');
						break;
					case 'checkbox':
						simpleAssignListen(id, elm, 'checked');
						break;
				}
				break;
			case 'select':
				simpleAssignListen(id, elm, 'value');
				break;
		}
	}

	function loadSettings() {
		const text = localStorage.getItem('settings');
		const obj = text ? JSON.parse(text) : settings;

		for (const prop in settings) {
			const elm = byId(prop.charAt(0) === '_' ? prop.slice(1) : prop);

			if (elm) {
				if (Object.hasOwnProperty.call(obj, prop)) settings[prop] = obj[prop];
				initSetting(prop, elm);
			} else {
				if (prop === 'mutedPlayers') {
					if (Object.hasOwnProperty.call(obj, prop) && Array.isArray(obj[prop])) {
						settings[prop] = obj[prop];
					} else {
						settings[prop] = [];
					}
				} else {
					Logger.info(`setting ${prop} not loaded because there is no element for it.`);
				}
			}
		}
	}

	function storeSettings() {
		const text = localStorage.getItem('settings');
		const obj = text ? JSON.parse(text) : settings;

		if (typeof obj['fp2'] !== 'undefined' && obj['fp2'] !== '') {
			settings['fp2'] = obj['fp2'];
		}

		localStorage.setItem('settings', JSON.stringify(settings));
	}

	function buildGallery() {
		const sortedSkins = Array.from(knownSkins.keys()).sort();

		let html = '';

		for (const skin of sortedSkins) {
			html += `<li class="skin" onclick="changeSkin(null, '${skin}')">`;
			html += `<img class="circular" alt="" loading="lazy" src="./skins/${skin}.png">`;
			html += `<h4 class="skinName">${skin}</h4>`;
			html += '</li>';
		}

		byId('gallery-body').innerHTML = `<ul id="skinsUL">${html}</ul>`;
	}

	function buildList(target, list) {
		if (typeof list !== 'undefined' && Array.isArray(list)) {
			let html = '<option value=" "></option>';

			for (const item of list) {
				html += `<option value="${item}"></option>`;
			}

			byId(target).innerHTML = html;
		}
	}

	function computeLineHeight(ctx, font = '18px Ubuntu') {
		ctx.font = font;

		const metrics = ctx.measureText('M');

		if (metrics.actualBoundingBoxAscent !== undefined && metrics.actualBoundingBoxDescent !== undefined) {
			return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
		}

		const fontSizeMatch = font.match(/(\d+)px/);

		return fontSizeMatch ? parseInt(fontSizeMatch[1]) : 18;
	}

	function resetChatScroll() {
		chat.scrollOffset = 0;
		drawChat();
	}

	function mutePlayer(username) {
		if (!username || username.trim() === '') return;

		username = username.trim();

		if (settings.mutedPlayers.includes(username)) return;

		settings.mutedPlayers.push(username);
		// console.log('mutePlayer()');
		storeSettings();
		updateMutedPlayersList();
		chat.messages.push({ color: Color.fromHex('#3f3fc0'), name: '[SYSTEM]', message: `Player "${username}" has been muted. You can unmute them in the Settings menu.`, time: Date.now(), server: true, admin: false, mod: false, me: false });
		drawChat();
	}

	function unmutePlayer(username) {
		if (!username || username.trim() === '') return;

		username = username.trim();

		const index = settings.mutedPlayers.indexOf(username);

		if (index !== -1) {
			settings.mutedPlayers.splice(index, 1);
			// console.log('unmutePlayer()');
			storeSettings();
			updateMutedPlayersList();
			chat.messages.push({ color: Color.fromHex('#3f3fc0'), name: '[SYSTEM]', message: `Player "${username}" has been unmuted.`, time: Date.now(), server: true, admin: false, mod: false, me: false });
			drawChat();
		}
	}

	function updateMutedPlayersList() {
		const mutedList = byId('muted-users-list');
		if (!mutedList) return;

		mutedList.innerHTML = '';

		if (settings.mutedPlayers.length === 0) {
			mutedList.innerHTML = '<p class="text-muted">No Muted Players</p>';
			return;
		}

		settings.mutedPlayers.forEach(username => {
			const item = document.createElement('div');
			item.className = 'muted-user-item';
			item.style.display = 'flex';
			item.style.justifyContent = 'space-between';
			item.style.alignItems = 'center';
			item.style.marginBottom = '5px';

			const canvas = document.createElement('canvas');
			canvas.width = 100;  // Adjust width based on expected username length
			canvas.height = 20;
			const ctx = canvas.getContext('2d');
			drawTextOnto(canvas, ctx, username, 16, '#ffffff');

			const unmuteBtn = document.createElement('button');
			unmuteBtn.className = 'btn btn-xs btn-danger';
			unmuteBtn.textContent = 'Unmute';
			unmuteBtn.onclick = () => unmutePlayer(username);

			item.appendChild(canvas);
			item.appendChild(unmuteBtn);
			mutedList.appendChild(item);
		});
	}

	function updateChatScrollFromMouse(mouseY) {
		const canvas = chat.canvas;
		const ctx = canvas.getContext('2d');
		const font = '18px Ubuntu';
		const baseLineHeight = computeLineHeight(ctx, font);
		const lineHeight = baseLineHeight + chat.lineHeightSpacing;
		const effectiveViewportHeight = chat.viewportHeight - (chat.lineTopSpacing * lineHeight);
		const visibleCount = Math.floor(effectiveViewportHeight / lineHeight);
		const trackHeight = visibleCount * lineHeight;
		const trackY = effectiveViewportHeight - trackHeight;
		const thumbHeight = trackHeight * visibleCount / chat.messages.length;

		let newThumbY = mouseY - chat.scrollDragOffset;
		newThumbY = Math.max(trackY, Math.min(newThumbY, trackY + trackHeight - thumbHeight));
		const fraction = (trackY + trackHeight - thumbHeight - newThumbY) / (trackHeight - thumbHeight);
		chat.scrollOffset = Math.round(fraction * (chat.messages.length - visibleCount));
		chat.scrollOffset = Math.max(0, Math.min(chat.scrollOffset, chat.messages.length - visibleCount));
	}

	function getChatScrollThumbInfo() {
		const ctx = chat.canvas.getContext('2d');
		const font = '18px Ubuntu';
		const baseLineHeight = computeLineHeight(ctx, font);
		const lineHeight = baseLineHeight + chat.lineHeightSpacing;
		const effectiveViewportHeight = chat.viewportHeight - (chat.lineTopSpacing * lineHeight);
		const visibleCount = Math.floor(effectiveViewportHeight / lineHeight);
		const trackHeight = visibleCount * lineHeight;
		const trackY = effectiveViewportHeight - trackHeight;
		const thumbHeight = trackHeight * visibleCount / chat.messages.length;

		return {
			trackY: trackY,
			trackHeight: trackHeight,
			thumbHeight: thumbHeight,
			visibleCount: visibleCount,
			lineHeight: lineHeight,
			effectiveViewportHeight: effectiveViewportHeight
		};
	}

	function drawChat() {
		if (chat.messages.length === 0 && settings.showChat)
			return chat.visible = false;

		chat.visible = true;

		const canvas = chat.canvas;
		const ctx = canvas.getContext('2d');
		const font = '18px Ubuntu';
		const baseLineHeight = computeLineHeight(ctx, font);
		const lineHeight = baseLineHeight + chat.lineHeightSpacing;
		const textLeftMargin = chat.scrollbarWidth + chat.leftTextSpacing;
		const effectiveViewportHeight = chat.viewportHeight - (chat.lineTopSpacing * lineHeight);
		const visibleCount = Math.floor(effectiveViewportHeight / lineHeight);

		if (chat.scrollOffset > chat.messages.length - visibleCount) {
			chat.scrollOffset = Math.max(0, chat.messages.length - visibleCount);
		}

		const startIndex = Math.max(0, chat.messages.length - visibleCount - chat.scrollOffset);
		const endIndex = chat.messages.length - chat.scrollOffset;
		const visibleMessages = chat.messages.slice(startIndex, endIndex);

		chat.muteIconAreas = [];

		const lines = [];

		for (let i = 0; i < visibleMessages.length; i++) {
			const message = visibleMessages[i];
			const isMuted = settings.mutedPlayers.includes(message.name);

			if (!isMuted) {
				lines.push([{
					text: message.server || message.admin || message.mod || message.me ? '' : '🔇',
					color: Color.fromHex('#ffffff'),
					username: message.name,
					fontSize: '22px Ubuntu',
					hasMuteIcon: true,
				} , {
					text: message.name,
					color: message.color
				} , {
					text: ` ${message.message}`,
					color: Color.fromHex(settings.darkTheme ? '#ffffff' : '#000000')
				}]);
			}
		}

		window.lines = lines;

		let textWidth = textLeftMargin;

		for (let i = 0; i < lines.length; i++) {
			let lineWidth = textLeftMargin;
			let parts = lines[i];

			for (let j = 0; j < parts.length; j++) {
				ctx.font = parts[j].fontSize || font;
				parts[j].width = ctx.measureText(parts[j].text).width;
				lineWidth += parts[j].width;
			}

			textWidth = Math.max(textWidth, lineWidth);
		}

		canvas.width = textWidth;
		canvas.height = effectiveViewportHeight;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (chat.messages.length > visibleCount) {
			const trackHeight = visibleCount * lineHeight;
			const trackY = effectiveViewportHeight - trackHeight;
			const thumbHeight = trackHeight * visibleCount / chat.messages.length;
			const fraction = chat.scrollOffset / (chat.messages.length - visibleCount);
			const thumbY = trackY + trackHeight - thumbHeight - fraction * (trackHeight - thumbHeight);

			ctx.fillStyle = '#ccc';
			ctx.fillRect(0, trackY, chat.scrollbarWidth, trackHeight);
			ctx.fillStyle = '#888';
			ctx.fillRect(0, thumbY, chat.scrollbarWidth, thumbHeight);
		}

		ctx.textBaseline = 'bottom';

		chat.muteIconAreas = [];

		for (let i = 0; i < lines.length; i++) {
			let x = textLeftMargin;
			const y = effectiveViewportHeight - (i * lineHeight);
			const parts = lines[lines.length - 1 - i];

			for (let j = 0; j < parts.length; j++) {
				ctx.font = parts[j].fontSize || font;
				ctx.fillStyle = settings.showColor ? parts[j].color.toHex() : '#ffffff';
				ctx.fillText(parts[j].text, x, y);

				if (parts[j].hasMuteIcon) {
					chat.muteIconAreas.push({
						x: x,
						y: y - chat.iconHeight,
						width: parts[j].width,
						height: chat.iconHeight,
						username: parts[j].username
					});
				}

				x += parts[j].width;
			}
		}
	}

	function drawStats() {
		if (!stats.info) return stats.visible = false;
		stats.visible = true;

		const canvas = stats.canvas;
		const ctx = canvas.getContext('2d');
		ctx.font = '14px Ubuntu';
		const uptime = prettyPrintTime(stats.info.uptime);
		const rows = [
			`${stats.info.name} (${stats.info.mode}) ${typeof stats.info.world !== 'undefined' ? ` - World ${stats.info.world}` : ' - World 1'}`,
			`${stats.info.playersTotal} / ${stats.info.playersLimit} players`,
			`${stats.info.playersAlive} playing`,
			`${stats.info.playersSpect} spectating`,
			`${(stats.info.update * 2.5).toFixed(1)}% load @ ${uptime}`,
		];
		let width = 0;
		for (const row of rows) {
			width = Math.max(width, 2 + ctx.measureText(row).width + 2);
		}
		canvas.width = width;
		canvas.height = rows.length * (14 + 2);
		ctx.font = '14px Ubuntu';
		ctx.fillStyle = settings.darkTheme ? '#aaaaaa' : '#555555';
		ctx.textBaseline = 'top';
		for (let i = 0; i < rows.length; i++) {
			ctx.fillText(rows[i], 2, -1 + i * (14 + 2));
		}
	}

	function drawPosition() {
		if(border.centerX !== 0 || border.centerY !== 0 || !settings.showPosition) return;
		const width = 200 * (border.width / border.height);
		const height = 40 * (border.height / border.width);

		let beginX = mainCanvas.width / camera.viewportScale - width;
		let beginY = mainCanvas.height / camera.viewportScale - height;

		if (settings.showMinimap) {
			mainCtx.font = '15px Ubuntu';
			beginX += width / 2 - 1;
			beginY = beginY - 194 * border.height / border.width;
			mainCtx.textAlign = 'right';
			mainCtx.fillStyle = settings.darkTheme ? '#aaaaaa' : '#555555';
			mainCtx.fillText(`X: ${~~camera.x}, Y: ${~~camera.y}`, beginX + width / 2, beginY + height / 2);
		} else {
			mainCtx.fillStyle = '#000000';
			mainCtx.globalAlpha = 0.4;
			mainCtx.fillRect(beginX, beginY, width, height);
			mainCtx.globalAlpha = 1;
			drawRaw(mainCtx, beginX + width / 2, beginY + height / 2, `X: ${~~camera.x}, Y: ${~~camera.y}`, 15);
		}
	}

	function prettyPrintTime(seconds) {
		const minutes = ~~(seconds / 60);
		if (minutes < 1) return '<1 min';
		const hours = ~~(minutes / 60);
		if (hours < 1) return `${minutes}min`;
		const days = ~~(hours / 24);
		if (days < 1) return `${hours}h`;
		return `${days}d`;
	}

	function drawLeaderboard() {
		if (leaderboard.type === null) return leaderboard.visible = false;

		if (!settings.showNames || leaderboard.items.length === 0) {
			return leaderboard.visible = false;
		}

		leaderboard.visible = true;
		const canvas = leaderboard.canvas;
		const ctx = canvas.getContext('2d');

		canvas.width = 200;
		canvas.height = leaderboard.type !== 'pie' ? 60 + 24 * leaderboard.items.length : 240;

		ctx.globalAlpha = .4;
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, 200, canvas.height);

		ctx.globalAlpha = 1;
		ctx.fillStyle = '#ffffff';
		ctx.font = '30px Ubuntu';
		ctx.fillText('Leaderboard', 100 - ctx.measureText('Leaderboard').width / 2, 40);

		if (leaderboard.type === 'pie') {
			let last = 0;

			for (let i = 0; i < leaderboard.items.length; i++) {
				ctx.fillStyle = leaderboard.teams[i];
				ctx.beginPath();
				ctx.moveTo(100, 140);
				ctx.arc(100, 140, 80, last, (last += leaderboard.items[i] * PI_2), false);
				ctx.closePath();
				ctx.fill();
			}
		} else {
			ctx.font = '20px Ubuntu';

			for (let i = 0; i < leaderboard.items.length; i++) {
				let isMe = false;
				let text;

				if (leaderboard.type === "text") {
					text = leaderboard.items[i];
				} else {
					text = leaderboard.items[i].name;
					isMe = leaderboard.items[i].me;
				}

				if (leaderboard.type === 'ffa') text = `${i + 1}. ${text}`;

				ctx.fillStyle = isMe ? '#ffaaaa' : '#ffffff';
				const width = ctx.measureText(text).width;
				const start = width > 200 ? 2 : 100 - width * 0.5;
				ctx.fillText(text, start, 70 + 24 * i);
			}
		}
	}

	function drawGrid() {
		mainCtx.save();
		mainCtx.lineWidth = 1;
		mainCtx.strokeStyle = settings.darkTheme ? '#aaaaaa' : '#000000';
		mainCtx.globalAlpha = 0.2;
		const step = 50;
		const cW = mainCanvas.width / camera.scale;
		const cH = mainCanvas.height / camera.scale;
		const startLeft = (-camera.x + cW / 2) % step;
		const startTop = (-camera.y + cH / 2) % step;

		scaleForth(mainCtx);
		mainCtx.beginPath();
		for (let i = startLeft; i < cW; i += step) {
			mainCtx.moveTo(i, 0);
			mainCtx.lineTo(i, cH);
		}
		for (let i = startTop; i < cH; i += step) {
			mainCtx.moveTo(0, i);
			mainCtx.lineTo(cW, i);
		}
		mainCtx.stroke();
		mainCtx.restore();
	}

	function drawBackgroundSectors() {
		if (border === undefined || border.width === undefined) return;
		mainCtx.save();

		const sectorCount = 5;
		const sectorNames = ['ABCDE', '12345'];
		const w = border.width / sectorCount;
		const h = border.height / sectorCount;

		toCamera(mainCtx);
		mainCtx.fillStyle = settings.darkTheme ? '#666666' : '#dddddd';
		mainCtx.textBaseline = 'middle';
		mainCtx.textAlign = 'center';
		mainCtx.font = `${w / 3 | 0}px Ubuntu`;

		for (let y = 0; y < sectorCount; ++y) {
			for (let x = 0; x < sectorCount; ++x) {
				const str = sectorNames[0][x] + sectorNames[1][y];
				const dx = (x + 0.5) * w + border.left;
				const dy = (y + 0.5) * h + border.top;
				mainCtx.fillText(str, dx, dy);
			}
		}
		mainCtx.restore();
	}

	function drawMinimap() {
		if (border.centerX !== 0 || border.centerY !== 0 || !settings.showMinimap) return;
		mainCtx.save();
		mainCtx.resetTransform();
		const targetSize = 200;
		const borderAR = border.width / border.height;
		const width = targetSize * borderAR * camera.viewportScale;
		const height = targetSize / borderAR * camera.viewportScale;
		const beginX = mainCanvas.width - width;
		const beginY = mainCanvas.height - height;

		mainCtx.fillStyle = '#000000';
		mainCtx.globalAlpha = 0.4;
		mainCtx.fillRect(beginX, beginY, width, height);
		mainCtx.globalAlpha = 1;

		const sectorCount = 5;
		const sectorNames = ['ABCDE', '12345'];
		const sectorWidth = width / sectorCount;
		const sectorHeight = height / sectorCount;
		const sectorNameSize = Math.min(sectorWidth, sectorHeight) / 3;

		mainCtx.fillStyle = settings.darkTheme ? '#666666' : '#dddddd';
		mainCtx.textBaseline = 'middle';
		mainCtx.textAlign = 'center';
		mainCtx.font = `${sectorNameSize}px Ubuntu`;

		for (let i = 0; i < sectorCount; i++) {
			const x = (i + 0.5) * sectorWidth;
			for (let j = 0; j < sectorCount; j++) {
				const y = (j + 0.5) * sectorHeight;
				mainCtx.fillText(sectorNames[0][i] + sectorNames[1][j], beginX + x, beginY + y);
			}
		}

		const xScale = width / border.width;
		const yScale = height / border.height;
		const halfWidth = border.width / 2;
		const halfHeight = border.height / 2;
		const myPosX = beginX + (camera.x + halfWidth) * xScale;
		const myPosY = beginY + (camera.y + halfHeight) * yScale;

		const xIndex = (myPosX - beginX) / sectorWidth | 0;
		const yIndex = (myPosY - beginY) / sectorHeight | 0;
		const lightX = beginX + xIndex * sectorWidth;
		const lightY = beginY + yIndex * sectorHeight;
		mainCtx.fillStyle = 'yellow';
		mainCtx.globalAlpha = 0.3;
		mainCtx.fillRect(lightX, lightY, sectorWidth, sectorHeight);
		mainCtx.globalAlpha = 1;

		mainCtx.beginPath();
		if (cells.mine.length) {
			for (const id of cells.mine) {
				const cell = cells.byId.get(id);
				if (!cell) continue;
				mainCtx.fillStyle = cell.cellColor.toHex();
				const x = beginX + (cell.x + halfWidth) * xScale;
				const y = beginY + (cell.y + halfHeight) * yScale;
				const r = Math.max(cell.s, 200) * (xScale + yScale) / 2;
				mainCtx.moveTo(x + r, y);
				mainCtx.arc(x, y, r, 0, PI_2);
			}
		} else {
			mainCtx.fillStyle = '#ffaaaa';
			mainCtx.arc(myPosX, myPosY, 5, 0, PI_2);
		}
		mainCtx.fill();

		const cell = cells.byId.get(cells.mine.find(id => cells.byId.has(id)));

		if (cell) {
			mainCtx.fillStyle = settings.showColor && typeof cell['nameColor'] !== 'undefined' && cell.nameColor !== '' && cell.nameColor !== null ? cell.nameColor.toHex() : (settings.darkTheme ? '#dddddd' : '#222222');
			mainCtx.font = `${sectorNameSize}px Ubuntu`;
			mainCtx.fillText(cell.name || EMPTY_NAME, myPosX, myPosY - 7 - sectorNameSize / 2);
		}

		mainCtx.restore();
	}

	function drawBorders() {
		if (!settings.showBorder) return;
		mainCtx.strokeStyle = '#0000ff';
		mainCtx.lineWidth = 20;
		mainCtx.lineCap = 'round';
		mainCtx.lineJoin = 'round';
		mainCtx.beginPath();
		mainCtx.moveTo(border.left, border.top);
		mainCtx.lineTo(border.right, border.top);
		mainCtx.lineTo(border.right, border.bottom);
		mainCtx.lineTo(border.left, border.bottom);
		mainCtx.closePath();
		mainCtx.stroke();
	}

	function drawGame() {
		stats.fps += (1000 / Math.max(Date.now() - syncAppStamp, 1) - stats.fps) / 10;
		syncAppStamp = Date.now();

		const drawList = cells.list.slice(0).sort(cellSort);

		for (const cell of drawList) cell.update(syncAppStamp);

		cameraUpdate();

		if (settings.jellyPhysics) {
			updateQuadtree();

			for (const cell of drawList) {
				cell.updateNumPoints();
				cell.movePoints();
			}
		}

		mainCtx.save();
		mainCtx.resetTransform();

		mainCtx.fillStyle = settings.bgColor !== '#ffffff' ? settings.bgColor : (settings.darkTheme ? '#111111' : '#f2fbff');
		mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

		if (settings.showGrid) drawGrid();
		if (settings.backgroundSectors) drawBackgroundSectors();

		toCamera(mainCtx);
		drawBorders();

		for (const cell of drawList) {
			cell.draw(mainCtx);
		}

		fromCamera(mainCtx);
		quadtree = null;
		mainCtx.scale(camera.viewportScale, camera.viewportScale);

		let height = 2;
		mainCtx.fillStyle = settings.darkTheme ? '#ffffff' : '#000000';
		mainCtx.textBaseline = 'top';

		if (!isNaN(stats.score)) {
			mainCtx.font = '30px Ubuntu';
			mainCtx.fillText(`Score: ${stats.score}`, 2, height);
			height += 30;
		}

		mainCtx.font = '20px Ubuntu';

		const gameStatsText = `${~~stats.fps} FPS` + (isNaN(stats.latency) ? '' : ` ${stats.latency}ms ping`);

		mainCtx.fillText(gameStatsText, 2, height);
		height += 24;

		if (stats.visible) {
			mainCtx.drawImage(stats.canvas, 2, height);
		}

		if (leaderboard.visible) {
			mainCtx.drawImage(leaderboard.canvas, mainCanvas.width / camera.viewportScale - 10 - leaderboard.canvas.width, 10);
		}

		if (settings.showChat && (chat.visible || isTyping)) {
			mainCtx.globalAlpha = isTyping ? 1 : Math.max(1000 - syncAppStamp + chat.waitUntil, 0) / 1000;
			mainCtx.drawImage(chat.canvas, 10 / camera.viewportScale, (mainCanvas.height - 55) / camera.viewportScale - chat.canvas.height);
			mainCtx.globalAlpha = 1;
		}

		drawMinimap();
		drawPosition();

		mainCtx.restore();

		if (minionControlled) {
			mainCtx.save();
			mainCtx.font = '18px Ubuntu';
			mainCtx.textAlign = 'center';
			mainCtx.textBaseline = 'hanging';
			mainCtx.fillStyle = '#eea236';
			const text = 'You are controlling a minion, press Q to switch back.';
			mainCtx.fillText(text, mainCanvas.width / 2, 5);
			mainCtx.restore();
		}

		cacheCleanup();
		window.requestAnimationFrame(drawGame);
	}

	function drawSkinPreview(url, canvas) {
		const image = new Image();
		image.crossOrigin = 'Anonymous';

		image.onload = function() {
			canvas.width = image.width;
			canvas.height = image.height;

			const ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0);
		};

		image.src = url;
	}

	function cellSort(a, b) {
		return a.s === b.s ? a.id - b.id : a.s - b.s;
	}

	function cameraUpdate() {
		const myCells = [];

		for (const id of cells.mine) {
			const cell = cells.byId.get(id);

			if (cell) myCells.push(cell);
		}

		if (myCells.length > 0) {
			let x = 0;
			let y = 0;
			let s = 0;
			let score = 0;

			for (const cell of myCells) {
				score += ~~(cell.ns * cell.ns / 100);
				x += cell.x;
				y += cell.y;
				s += cell.s;
			}

			camera.target.x = x / myCells.length;
			camera.target.y = y / myCells.length;
			camera.sizeScale = Math.pow(Math.min(64 / s, 1), 0.4);
			camera.target.scale = camera.sizeScale;
			camera.target.scale *= camera.viewportScale * camera.userZoom;
			camera.x = (camera.target.x + camera.x) / 2;
			camera.y = (camera.target.y + camera.y) / 2;
			stats.score = score;
			stats.maxScore = Math.max(stats.maxScore, score);
		} else {
			stats.score = NaN;
			stats.maxScore = 0;
			camera.x += (camera.target.x - camera.x) / 20;
			camera.y += (camera.target.y - camera.y) / 20;
		}

		camera.scale += (camera.target.scale - camera.scale) / 9;
	}

	function sqDist(a, b) {
		return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
	}

	function updateQuadtree() {
		const w = 1920 / camera.sizeScale;
		const h = 1080 / camera.sizeScale;
		const x = (camera.x - w / 2);
		const y = (camera.y - h / 2);
		quadtree = new window.PointQuadTree(x, y, w, h, QUADTREE_MAX_POINTS);
		for (const cell of cells.list) {
			for (const point of cell.points) quadtree.insert(point);
		}
	}

	function cacheCleanup() {
		for (const i of cachedNames.keys()) {
			for (const j of cachedNames.get(i).keys()) {
				if (syncAppStamp - cachedNames.get(i).get(j).accessTime >= 5000) {
					cachedNames.get(i).delete(j);
				}
			}
		}

		for (const i of cachedFp.keys()) {
			if (syncAppStamp - cachedFp.get(i).accessTime >= 5000) {
				cachedFp.delete(i);
			}
		}

		for (const i of cachedMass.keys()) {
			if (syncAppStamp - cachedMass.get(i).accessTime >= 5000) {
				cachedMass.delete(i);
			}
		}
	}

	function removeNameCache(name) {
		if (cachedNames.has(name)) {
			cachedNames.delete(name);
		}
	}

	const cachedNames = new Map();
	const cachedMass = new Map();
	const cachedFp = new Map();

	function drawTextOnto(canvas, ctx, text, size, color = '#ffffff') {
		ctx.font = size + 'px Ubuntu';
		ctx.lineWidth = Math.max(~~(size / 10), 2);
		canvas.width = ctx.measureText(text).width + 2 * ctx.lineWidth;
		canvas.height = 4 * size;
		ctx.font = size + 'px Ubuntu';
		ctx.lineWidth = Math.max(~~(size / 10), 2);
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';
		ctx.fillStyle = color;
		ctx.strokeStyle = '#000000';
		ctx.translate(canvas.width / 2, 2 * size);
		(ctx.lineWidth !== 1) && ctx.strokeText(text, 0, 0);
		ctx.fillText(text, 0, 0);
	}

	function drawIdenticon(canvas, ctx, hash, size, color = '#ffffff') {
		canvas.width = size;
		canvas.height = size;

		let blockWidth = size / 8;

		const arr = [];

		for (let i = 0; i < hash.length; i += 8) {
			const word = parseInt(hash.slice(i, i + 8), 16);

			for (let j = 0; j < 32; j++) {
				arr.push((word >> j) & 1);
			}
		}

		let r = 0, g = 0, b = 0;

		for (let i = 0; i < 8; i++) {
			r += arr[16 + i] << i;
			g += arr[24 + i] << i;
			b += arr[32 + i] << i;
		}

		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				if (arr[i * 4 + j] === 1) {
					ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
					ctx.lineWidth = 5;
					ctx.strokeStyle = color;
					ctx.fillRect(blockWidth * j, blockWidth * i, blockWidth, blockWidth);
					ctx.strokeRect(blockWidth * j, blockWidth * i, blockWidth, blockWidth);
					ctx.fillRect(size - blockWidth*( j + 1), blockWidth * i, blockWidth, blockWidth);
					ctx.strokeRect(size - blockWidth*( j + 1), blockWidth * i, blockWidth, blockWidth);
					ctx.fillRect(blockWidth*j, size - blockWidth *(i + 1), blockWidth, blockWidth);
					ctx.strokeRect(blockWidth*j, size - blockWidth *(i + 1), blockWidth, blockWidth);
					ctx.fillRect(size - blockWidth * (j + 1), size - blockWidth * (i + 1), blockWidth, blockWidth);
					ctx.strokeRect(size - blockWidth * (j + 1), size - blockWidth * (i + 1), blockWidth, blockWidth);
				}
			}
		}
	}

	function drawRaw(ctx, x, y, text, size, color = '#ffffff') {
		ctx.font = size + 'px Ubuntu';
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';
		ctx.lineWidth = Math.max(~~(size / 10), 2);
		ctx.fillStyle = color;
		ctx.strokeStyle = '#000000';
		(ctx.lineWidth !== 1) && ctx.strokeText(text, x, y);
		ctx.fillText(text, x, y);
		ctx.restore();
	}

	function newNameCache(value, size, color = '#ffffff') {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		drawTextOnto(canvas, ctx, value, size, color);

		if (!cachedNames.has(value)) {
			cachedNames.set(value, new Map());
		}

		const cache = {
			width: canvas.width,
			height: canvas.height,
			canvas: canvas,
			value: value,
			size: size,
			color: color,
			accessTime: syncAppStamp
		};

		cachedNames.get(value).set(size, cache);

		return cache;
	}

	function newFpCache(value, size, color = '#ffffff') {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		drawIdenticon(canvas, ctx, value, size, color);

		if (!cachedFp.has(value)) {
			cachedFp.set(value, new Map());
		}

		const cache = {
			width: canvas.width,
			height: canvas.height,
			canvas: canvas,
			value: value,
			size: size,
			color: color,
			accessTime: syncAppStamp
		};

		cachedFp.get(value).set(size, cache);

		return cache;
	}

	function newMassCache(size) {
		const canvases = {
			0: { }, 1: { }, 2: { }, 3: { }, 4: { },
			5: { }, 6: { }, 7: { }, 8: { }, 9: { }
		};

		for (const i in canvases) {
			const canvas = canvases[i].canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			drawTextOnto(canvas, ctx, i, size);
			canvases[i].canvas = canvas;
			canvases[i].width = canvas.width;
			canvases[i].height = canvas.height;
		}

		const cache = {
			canvases: canvases,
			size: size,
			lineWidth: Math.max(~~(size / 10), 2),
			accessTime: syncAppStamp
		};

		cachedMass.set(size, cache);

		return cache;
	}

	function toleranceTest(a, b, tolerance) {
		return (a - tolerance) <= b && b <= (a + tolerance);
	}

	function getNameCache(value, size, color = '#ffffff') {
		if (!cachedNames.has(value)) {
			return newNameCache(value, size, color);
		}

		const sizes = Array.from(cachedNames.get(value).keys());

		for (let i = 0, l = sizes.length; i < l; i++) {
			if (toleranceTest(size, sizes[i], size / 4)) {
				return cachedNames.get(value).get(sizes[i]);
			}
		}

		return newNameCache(value, size, color);
	}

	function getFpCache(value, size, color = '#ffffff') {
		if (!cachedFp.has(value)) {
			return newFpCache(value, size, color);
		}

		const sizes = Array.from(cachedFp.get(value).keys());

		for (let i = 0, l = sizes.length; i < l; i++) {
			if (toleranceTest(size, sizes[i], size / 4)) {
				return cachedFp.get(value).get(sizes[i]);
			}
		}

		return newFpCache(value, size, color);
	}

	function getMassCache(size) {
		const sizes = Array.from(cachedMass.keys());
		for (let i = 0, l = sizes.length; i < l; i++) {
			if (toleranceTest(size, sizes[i], size / 4)) {
				return cachedMass.get(sizes[i]);
			}
		}
		return newMassCache(size);
	}

	function drawText(ctx, type, x, y, size, drawSize, value, color = '#ffffff') {
		ctx.save();

		if (size > 500 && type !== 'fp') {
			return drawRaw(ctx, x, y, value, drawSize, color);
		}

		ctx.imageSmoothingQuality = 'high';

		switch(type) {
			case 'mass':
			{
				const cache = getMassCache(size);
				cache.accessTime = syncAppStamp;
				const canvases = cache.canvases;
				const correctionScale = drawSize / cache.size;

				let width = 0;

				for (let i = 0; i < value.length; i++) {
					width += canvases[value[i]].width - 2 * cache.lineWidth;
				}

				ctx.scale(correctionScale, correctionScale);
				x /= correctionScale;
				y /= correctionScale;
				x -= width / 2;

				for (let i = 0; i < value.length; i++) {
					const item = canvases[value[i]];
					ctx.drawImage(item.canvas, x, y - item.height / 2);
					x += item.width - 2 * cache.lineWidth;
				}
			}
			break;

			case 'name':
			{
				const cache = getNameCache(value, size, color);
				cache.accessTime = syncAppStamp;
				const canvas = cache.canvas;
				const correctionScale = drawSize / cache.size;
				ctx.scale(correctionScale, correctionScale);
				x /= correctionScale;
				y /= correctionScale;
				ctx.drawImage(canvas, x - canvas.width / 2, y - canvas.height / 2);
			}
			break;

			case 'fp':
			{
				const cache = getFpCache(value, size, color);
				cache.accessTime = syncAppStamp;
				const canvas = cache.canvas;
				const correctionScale = drawSize / cache.size;
				ctx.scale(correctionScale, correctionScale);
				x /= correctionScale;
				y /= correctionScale;
				ctx.drawImage(canvas, x - canvas.width / 2, y - canvas.height / 2);
			}
			break;
		}

		ctx.restore();
	}

	function processKey(event) {
		if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;
		let key = CODE_TO_KEY[event.code] || event?.key?.toLowerCase();
		if (Object.hasOwnProperty.call(IE_KEYS, key)) key = IE_KEYS[key]; // IE fix
		return key;
	}

	function keydown(event) {
		if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

		if (event.ctrlKey === true) {
			pressed['ctrl'] = true;

			if (event.which === 61 || event.which === 107 || event.which === 173 || event.which === 109 || event.which === 187 || event.which === 189) {
				event.preventDefault();
			}
		}

		const key = processKey(event);

		if (pressed[key]) return;

		if (Object.hasOwnProperty.call(pressed, key)) pressed[key] = true;

		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			const ctx = chat.canvas.getContext('2d');
			const font = '18px Ubuntu';
			const baseLineHeight = computeLineHeight(ctx, font);
			const lineHeight = baseLineHeight + chat.lineHeightSpacing;
			const effectiveViewportHeight = chat.viewportHeight - (chat.lineTopSpacing * lineHeight);
			const visibleCount = Math.floor(effectiveViewportHeight / lineHeight);

			if (event.key === 'ArrowUp') {
				if (chat.scrollOffset < chat.messages.length - visibleCount) {
					chat.scrollOffset++;
					drawChat();
				}
			} else if (event.key === 'ArrowDown') {
				if (chat.scrollOffset > 0) {
					chat.scrollOffset--;
					drawChat();
				}
			}
		}

		if (key === 'enter') {
			if (escOverlayShown || !settings.showChat) return;

			if (isTyping) {
				chatBox.blur();
				if (chatBox.value.length > 0) sendChat(chatBox.value);
				chatBox.value = '';
				resetChatScroll();
			} else {
				chatBox.focus();
			}
		} else if (key === 'escape') {
			escOverlayShown ? hideESCOverlay() : showESCOverlay();
		} else {
			if (isTyping || escOverlayShown) return;

			let code = KEY_TO_OPCODE[key];

			if (typeof code !== 'undefined') wsSend(code);

			if (key === 'w' || key === 'z') {
				clearInterval(feedMacroIntervalID);
				code = UINT8_CACHE[minionControlled ? 0x17 : 0x15];
				let macroCooldown = settings.feedMacro ? 0 : 1000 / 7;
				feedMacroIntervalID = setInterval(() => wsSend(code), macroCooldown);
				wsSend(code);
			}

			if (key === ' ') {
				code = UINT8_CACHE[minionControlled ? 0x16 : 0x11];
				wsSend(code);
			}

			if (key === 'x') {
				code = UINT8_CACHE[minionControlled ? 0x16 : 0x11];
				wsSend(code);
				wsSend(code);
			}

			if (key === 'c') {
				clearInterval(splitMacroIntervalID);
				code = UINT8_CACHE[minionControlled ? 0x16 : 0x11];
				let macroCooldown = settings.splitMacro ? 0 : 1000 / 7;
				splitMacroIntervalID = setInterval(() => wsSend(code), macroCooldown);
				wsSend(code);
			}

			if (key === 'q') {
				wsSend(UINT8_CACHE[0x12]);
				minionControlled = !minionControlled;
			}

			if (key === 'f') {
				camera.userZoom += 0.4;
				camera.userZoom = Math.max(camera.userZoom, settings.moreZoom ? 0.1 : 1);
				camera.userZoom = Math.min(camera.userZoom, 4);
				byId('zoom').value = camera.userZoom;
			}

			if (key === 'v') {
				camera.userZoom -= 0.4;
				camera.userZoom = Math.max(camera.userZoom, settings.moreZoom ? 0.1 : 1);
				camera.userZoom = Math.min(camera.userZoom, 4);
				byId('zoom').value = camera.userZoom;
			}
		}
	}

	function keyup(event) {
		if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

		if (event.ctrlKey === true) {
			pressed['ctrl'] = false;
		}

		const key = processKey(event);

		if (Object.hasOwnProperty.call(pressed, key)) pressed[key] = false;

		if (key === 'w' || key === 'z') clearInterval(feedMacroIntervalID);
		if (key === 'c') clearInterval(splitMacroIntervalID);
	}

	function handleScroll(event) {
		if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

		if (pressed['ctrl']) {
			event.preventDefault();
		}

		if (event.target !== mainCanvas) return;
		camera.userZoom *= event.deltaY > 0 ? 0.8 : 1.2;
		camera.userZoom = Math.max(camera.userZoom, settings.moreZoom ? 0.1 : 1);
		camera.userZoom = Math.min(camera.userZoom, 4);
		byId('zoom').value = camera.userZoom;
	}

	function checkBanCounter() {
		let banCounter = 0;

		for (let skin in settings.skinnames) {
			if (typeof settings.skinnames[skin] === 'string' && settings.skinnames[skin] !== '') {
				// noinspection JSUnusedLocalSymbols
				bannedSkins.forEach((value1, value2, set) => {
					if (settings.skinnames[skin] === value2) {
						banCounter++;
					}
				});
			}
		}

		return banCounter;
	}

	function openFullscreen(elem) {
		if (elem.requestFullscreen) {
			elem.requestFullscreen();
		} else if (elem.webkitRequestFullscreen) {
			elem.webkitRequestFullscreen();
		} else if (elem.webkitEnterFullscreen) {
			elem.webkitEnterFullscreen();
		} else if (elem.msRequestFullscreen) {
			elem.msRequestFullscreen();
		}
	}

	function closeFullscreen() {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		} else if (document.msExitFullscreen) {
			document.msExitFullscreen();
		}
	}

	function getBrowserInfo() {
		const ua = navigator.userAgent;
		const tokens = ua.trim().split(/\s+/);
		const candidates = [];

		for (let i = tokens.length - 1; i >= 0; i--) {
			const token = tokens[i];
			const match = token.match(/([A-Za-z]+)\/([\d.]+)/);

			if (match) {
				candidates.push({ name: match[1], version: match[2] });
			}
		}

		// Blink based
		if (candidates[0].name === 'Safari' && candidates[0].version === '537.36') {
			if (candidates.length > 1) {
				return { family: candidates[1].name, major: parseInt(candidates[1].version, 10) };
			}
		// Webkit based
		} else if (candidates[0].name === 'Safari' && candidates[0].version !== '537.36') {
			if (candidates.length > 1 && candidates[1].name === 'Version') {
				return { family: 'Safari', major: parseInt(candidates[1].version, 10) };
			}
		// Gecko based
		} else if (candidates[0].name === 'Firefox') {
			return { family: 'Firefox', major: parseInt(candidates[0].version, 10) };
		}

		return { family: 'unknown', major: null };
	}

	function checkBots() {
		function checkCDC() {
			function hasConstructorAlias(window, constructor) {
				for (const prop of window.Object.getOwnPropertyNames(window)) {
					if (prop === constructor.name || prop === 'token' || prop === 'getAsyncToken') continue;
					if (window[prop] === constructor) return true;
				}

				return false
			}

			for (const prop of window.Object.getOwnPropertyNames(window)) {
				if (/^cdc_[a-zA-Z0-9]{22}_(Array|Promise|Symbol)$/.test(prop)) return true;
			}

			return hasConstructorAlias(window, window.Array) && hasConstructorAlias(window, window.Promise) && hasConstructorAlias(window, window.Symbol);
		}

		function detectRandomProperties() {
			const allProps = Object.getOwnPropertyNames(window);
			const currentDetected = new Set();

			for (const key of allProps) {
				try {
					if (window[key] === key) {
						currentDetected.add(key);
					}
				} catch (e) {}
			}

			return currentDetected.size > 0;
		}

		function isCanvasPrototypeTampered() {
			let iframe = document.createElement('iframe');
			iframe.style.display = 'none';
			document.body.appendChild(iframe);

			let nativeCanvasProto = iframe.contentWindow.HTMLCanvasElement.prototype;
			let nativeCtxProto = iframe.contentWindow.CanvasRenderingContext2D.prototype;

			let currentCanvasProto = HTMLCanvasElement.prototype;
			let currentCtxProto = CanvasRenderingContext2D.prototype;

			const canvasMethods = ['toDataURL', 'toBlob'];
			const ctxMethods = ['getImageData'];
			let tampered = false;

			canvasMethods.forEach(method => {
				if (typeof currentCanvasProto[method] !== 'function' || currentCanvasProto[method].toString() !== nativeCanvasProto[method].toString()) {
					tampered = true;
					console.warn(`Method ${method} on HTMLCanvasElement.prototype appears to have been modified.`);
				}
			});

			ctxMethods.forEach(method => {
				if (typeof currentCtxProto[method] !== 'function' || currentCtxProto[method].toString() !== nativeCtxProto[method].toString()) {
					tampered = true;
					console.warn(`Method ${method} on CanvasRenderingContext2D.prototype appears to have been modified.`);
				}
			});

			document.body.removeChild(iframe);
			return tampered;
		}

		// noinspection JSUnresolvedReference
		return [
			checkCDC(),
			detectRandomProperties(),
			isCanvasPrototypeTampered()
		]
	}

	function announcePresence() {
		TC.postMessage({ type: 'check' });
		setTimeout(announcePresence, 1000);
	}

	function multiCheck() {
		hasResponded = false;

		MC.contentWindow.postMessage('agar2', 'https://emupedia.net');

		setTimeout(() => {
			if (!hasResponded) {
				MC.contentWindow.postMessage('active', 'https://emupedia.net');
			}
		}, 1000);
	}

	function init() {
		TC.postMessage({ type: 'check' });

		setTimeout(() => {
			if (!isActive) {
				isActive = true;
			}

			announcePresence();
		}, 500);

		mainCanvas = document.getElementById('canvas');
		mainCtx = mainCanvas.getContext('2d');
		chatBox = byId('chat_textbox');
		chatClear = byId('chat_clear');
		soundsVolume = byId('soundsVolume');
		transparentAlpha = byId('transparentAlpha');
		mainCanvas.focus();

		loadSettings();
		updateMutedPlayersList();

		clearInterval(interval);
		interval = setInterval(() => {
			FP.then(fp => fp.get()).then(result => {
				settings.fp = ident !== '' ? ident + '|' + result.visitorId : result.visitorId;
				// console.log('checkFPBanList()');
				storeSettings();

				fetch('../fpBanList.txt').then(resp => resp.text()).then(data => {
					const fp = data.split(',').filter(name => name.length > 0);

					for (const p of fp) bannedFP.add(p);

					fetch('../fp2BanList.txt').then(resp => resp.text()).then(data2 => {
						const fp2 = data2.split(',').filter(name => name.length > 0);

						for (const p of fp2) bannedFP2.add(p);

						let ban = false;
						let bot = false;

						bannedFP.forEach(val => {
							if (settings.fp === val) {
								ban = true;
							}
						});

						bannedFP2.forEach(val => {
							if (settings.fp2 === val) {
								ban = true;
							}
						});

						checkBots().forEach(val => {
							if (val) {
								bot = true;
							}
						});

						const browserInfo = getBrowserInfo();

						switch (browserInfo.family) {
							case 'Chrome':
							case 'Firefox':
								if (browserInfo.major < 125) {
									setInterval(() => {
										wsCleanup();
										hideESCOverlay();
										byId('chat_textbox').hide();
										byId('chat_clear').hide();
										byId('connecting-content').innerHTML = '<h3>Your Browser is very Old</h3><hr class="top" /><p style="text-align: center"><a href="https://www.whatismybrowser.com/" target="_blank">Please click here to update your Browser to a newer version.</a></p>';
										byId('connecting').show(0.5);
									}, 1000);
								}
								break;
							case 'Safari':
								if (browserInfo.major < 17) {
									setInterval(() => {
										wsCleanup();
										hideESCOverlay();
										byId('chat_textbox').hide();
										byId('chat_clear').hide();
										byId('connecting-content').innerHTML = '<h3>Your Browser is very Old</h3><hr class="top" /><p style="text-align: center"><a href="https://www.whatismybrowser.com/" target="_blank">Please click here to update your Browser to a newer version.</a></p>';
										byId('connecting').show(0.5);
									}, 1000);
								}
								break;
						}

						if (ban || bot) {
							setInterval(() => {
								wsCleanup();
								hideESCOverlay();
								byId('chat_textbox').hide();
								byId('chat_clear').hide();
								byId('connecting-content').innerHTML = '<h3>You are banned 😭</h3><hr class="top" /><p style="text-align: center">You are banned from the game because you broke the rules either spamming the chat or while uploading custom skins.</p><a class="text-center" style="display: block; color: red;" href="https://discord.gg/emupedia-510149138491506688" target="_blank">Join us on Discord!</a><h1 style="text-align: center;">Your unban code is<br /><br />' + btoa(settings.fp).replace(/(.{10})/g, "$1<br />") + '</h1>';
								byId('connecting').show(0.5);
							}, 1000);
						}
					});
				});
			});
		}, 60000);

		const joystickOptions = { zone: byId('touch'), mode: 'semi', dynamicPage: true, catchDistance: 80, color: settings.darkTheme ? 'white' : 'black' };
		let joystick = nipplejs.create(joystickOptions);

		joystick.on('move', (e, nipple) => {
			if (settings.useJoystick) {
				mouseX = innerWidth / 2 + nipple.instance.frontPosition.x * 5;
				mouseY = innerHeight / 2 + nipple.instance.frontPosition.y * 5;
			}
		});

		const touch = byId('touch');
		const touchCircle = byId('touchCircle');

		window.addEventListener('touchstart', event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;
			if (settings.disableTouchControls) return;

			if (!touched) {
				touched = true;
				byId('menuBtn').show();
				byId('fullscreenBtn').show();
				byId('splitBtn').show();
				byId('ejectBtn').show();
			} else {
				if (document.activeElement === chatBox) {
					chatBox.blur();
				}
			}

			if (event.target.id === 'splitBtn') {
				wsSend(UINT8_CACHE[minionControlled ? 0x16 : 0x11]);
			}

			if (event.target.id === 'ejectBtn') {
				clearInterval(feedMacroIntervalID);
				let code = UINT8_CACHE[minionControlled ? 0x17 : 0x15];
				let macroCooldown = settings.feedMacro ? 0 : 1000 / 7;
				feedMacroIntervalID = setInterval(() => wsSend(code), macroCooldown);
				wsSend(code);
			}

			if (!settings.useJoystick) {
				touchmove(event);

				touch.hide();
				touchCircle.show();
			} else {
				touch.show();
				touchCircle.hide();
			}
		});

		const touchmove = event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;
			if (settings.disableTouchControls) return;

			if (!settings.useJoystick) {
				const touch = event.touches[0];

				mouseX = touch.pageX;
				mouseY = touch.pageY;

				touchCircle.style.left = 'calc(' + touch.pageX + 'px - 3vw)';
				touchCircle.style.top = 'calc(' + touch.pageY + 'px - 3vw)';
			}
		};

		window.addEventListener('touchmove', touchmove);

		window.addEventListener('touchend', event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;
			if (settings.disableTouchControls) return;

			if (touched) {
				clearInterval(feedMacroIntervalID)
			}

			if (!settings.useJoystick) {
				if (event.touches.length === 0) {
					touchCircle.hide();
				}
			}
		});

		document.ondblclick = e => {
			e.preventDefault();
			return false;
		}

		const changeDarkTheme = () => {
			if (settings.darkTheme) {
				document.documentElement.classList.add('darkTheme');
				joystick.options.color = 'white';
			} else {
				document.documentElement.classList.remove('darkTheme');
				joystick.options.color = 'black';
			}

			if (typeof joystick[0] !== 'undefined') {
				joystick[0].destroy();
			}
		}

		changeDarkTheme();

		buildList('nicknames', settings.nicknames);
		buildList('skinnames', settings.skinnames);

		const randomColor = Color.randomColor();

		const changeNick = e => {
			byId('previewName').innerHTML = Cell.parseName(e.target.value);
		};

		const saveNick = e => {
			let nick = Cell.parseName(e.target.value);

			if (nick !== '' && settings.nicknames.indexOf(nick) === -1) {
				settings.nicknames.push(nick);
				buildList('nicknames', settings.nicknames);
				removeNameCache(settings.nick);
				// console.log('saveNick()');
				storeSettings();
			}

			e.target.blur();
		};

		const changeFullscreen = () => {
			if (!document.fullscreenElement) {
				openFullscreen(document.documentElement);

				if (byId('fullscreenBtn')) {
					byId('fullscreenBtn').src = 'assets/img/fullscreen_off.png';
				}
			} else {
				closeFullscreen();

				if (byId('fullscreenBtn')) {
					byId('fullscreenBtn').src = 'assets/img/fullscreen.png';
				}
			}
		}

		const changeBackgroundColor = e => {
			settings.bgColor = e.target.value;
			// console.log('changeBackgroundColor()');
			storeSettings();
		}

		const changeNameColor = e => {
			byId('previewName').style.color = e.target.value;
			settings.nameColor = e.target.value;
			removeNameCache(settings.nick);
			// console.log('changeNameColor()');
			storeSettings();
		};

		const changeCellColor = e => {
			drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
			byId('previewSkin').style.backgroundImage = 'none';
			byId('previewSkin').style.backgroundColor = settings.showColor ? e.target.value : '#ffffff';
			settings.cellColor = e.target.value;

			if (settings.cellColor !== '#ffffff') {
				byId('previewSkin').style.backgroundColor = settings.showColor ? e.target.value : '#ffffff';

				if (settings.showSkins) {
					let saved_skin = settings.skin;

					if (saved_skin !== '' && saved_skin !== ' ') {
						if (saved_skin.startsWith('https://iili.io/') && !saved_skin.endsWith('.gif')) {
							if (!bannedSkins.has(saved_skin)) {
								byId('previewSkin').onerror = () => {
									byId('previewSkin').onerror = null;
									drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
								};
								drawSkinPreview(saved_skin, byId('previewSkin'));
							} else {
								drawSkinPreview('./assets/img/banned.png', byId('previewSkin'));
							}
						} else {
							byId('previewSkin').onerror = () => {
								byId('previewSkin').onerror = null;
								drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
							};
							drawSkinPreview(`${SKIN_URL}${saved_skin}.png`, byId('previewSkin'));
						}

						if (settings.fillSkin) {
							byId('previewSkin').style.backgroundImage = 'none';
						} else {
							byId('previewSkin').style.backgroundImage = 'url(./assets/img/checkerboard.png)';
						}
					} else {
						drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
						byId('previewSkin').style.backgroundImage = 'none';
					}
				} else {
					drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
					byId('previewSkin').style.backgroundImage = 'none';
				}
			} else {
				if (settings.showSkins) {
					let saved_skin = settings.skin;

					if (saved_skin !== '' && saved_skin !== ' ') {
						if (saved_skin.startsWith('https://iili.io/') && !saved_skin.endsWith('.gif')) {
							if (!bannedSkins.has(saved_skin)) {
								byId('previewSkin').onerror = () => {
									byId('previewSkin').onerror = null;
									drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
								};
								drawSkinPreview(saved_skin, byId('previewSkin'));
							} else {
								drawSkinPreview('./assets/img/banned.png', byId('previewSkin'));
							}
						} else {
							byId('previewSkin').onerror = () => {
								byId('previewSkin').onerror = null;
								drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
							};
							drawSkinPreview(`${SKIN_URL}${saved_skin}.png`, byId('previewSkin'));
						}

						if (settings.fillSkin) {
							byId('previewSkin').style.backgroundImage = 'none';
						} else {
							byId('previewSkin').style.backgroundImage = 'url(./assets/img/checkerboard.png)';
						}
					} else {
						drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
						byId('previewSkin').style.backgroundImage = 'none';
					}
				} else {
					drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
					byId('previewSkin').style.backgroundImage = 'none';
				}
			}

			// console.log('changeCellColor()');
			storeSettings();
		};

		const changeBorderColor = e => {
			byId('previewSkin').style.borderColor = settings.showColor ? (e.target.value !== '#ffffff' ? e.target.value : Color.fromHex(randomColor).darker().toHex()) : Color.fromHex('#ffffff').darker().toHex();
			byId('previewSkin').style.borderWidth = '16px';

			if (byId('previewSkin').style.borderColor !== '#ffffff') {
				settings.borderColor = e.target.value;
			}

			// console.log('changeBorderColor()');
			storeSettings();
		};

		const changeShowColor = () => {
			byId('previewName').style.color = settings.showColor ? settings.nameColor : '#ffffff';
			byId('previewSkin').style.backgroundColor = settings.showColor ? settings.cellColor : '#ffffff';
			byId('previewSkin').style.borderColor = settings.showColor ? (settings.borderColor !== '#ffffff' ? settings.borderColor : Color.fromHex(randomColor).darker().toHex()) : Color.fromHex('#ffffff').darker().toHex();
		}

		const changeShowSkins = () => {
			if (settings.showSkins) {
				let saved_skin = settings.skin;

				if (saved_skin !== '' && saved_skin !== ' ') {
					if (saved_skin.startsWith('https://iili.io/') && !saved_skin.endsWith('.gif')) {
						if (!bannedSkins.has(saved_skin)) {
							byId('previewSkin').onerror = () => {
								byId('previewSkin').onerror = null;
								drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
							};
							drawSkinPreview(saved_skin, byId('previewSkin'));
						} else {
							drawSkinPreview('./assets/img/banned.png', byId('previewSkin'));
						}
					} else {
						byId('previewSkin').onerror = () => {
							byId('previewSkin').onerror = null;
							drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
						};
						drawSkinPreview(`${SKIN_URL}${saved_skin}.png`, byId('previewSkin'));
					}
				} else {
					drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
					byId('previewSkin').style.backgroundImage = 'none';
					byId('previewSkin').style.backgroundColor = settings.showColor ? (settings.cellColor !== '#ffffff' ? settings.cellColor : randomColor) : '#ffffff';
				}
			} else {
				drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
				byId('previewSkin').style.backgroundImage = 'none';
				byId('previewSkin').style.backgroundColor = settings.showColor ? (settings.cellColor !== '#ffffff' ? settings.cellColor : randomColor) : '#ffffff';
			}
		}

		const changeFillSkin = () => {
			if (settings.showSkins) {
				if (settings.fillSkin) {
					byId('previewSkin').style.backgroundImage = 'none';
				} else {
					if (settings.skin !== '' && settings.skin !== ' ') {
						byId('previewSkin').style.backgroundImage = 'url(./assets/img/checkerboard.png)';
					} else {
						drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
						byId('previewSkin').style.backgroundImage = 'none';
						byId('previewSkin').style.backgroundColor = settings.showColor ? randomColor : '#ffffff';
					}
				}
			}
		}

		const changeFlipTouchControls = () => {
			const html = document.getElementsByTagName('html')[0];
			html.classList.toggle('flipped-controls');
		}

		const changeDisableTouchControls = () => {
			if (settings.disableTouchControls) {
				touched = false;

				byId('menuBtn').hide();
				byId('fullscreenBtn').hide();
				byId('splitBtn').hide();
				byId('ejectBtn').hide();

				if (typeof joystick[0] !== 'undefined') {
					joystick[0].destroy();
				}
			}
		}

		const overlayClick = event => {
			if (event.target === byId('overlays')) {
				event.preventDefault();
				hideESCOverlay();

				if (!touched) {
					chatBox.focus();
					byId('menuBtn').show();
				} else {
					if (document.activeElement === chatBox) {
						chatBox.blur();
					}
				}
			}
		}

		const menuClick = () => {
			if (!escOverlayShown) {
				showESCOverlay();
			}
		}

		byId('previewName').innerHTML = Cell.parseName(settings.nick);

		if (settings.bgColor !== '#ffffff') {
			byId('bgColor').value = settings.bgColor;
		}

		if (settings.nameColor !== '#ffffff') {
			byId('nameColor').value = settings.nameColor;
			byId('previewName').style.color = settings.showColor ? settings.nameColor : '#ffffff';
		} else {
			byId('previewName').style.color = settings.showColor ? randomColor : '#ffffff';
		}

		if (settings.cellColor !== '#ffffff') {
			byId('cellColor').value = settings.cellColor;
			byId('previewSkin').style.backgroundColor = settings.showColor ? settings.cellColor : '#ffffff';
		} else {
			byId('previewSkin').style.backgroundColor = settings.showColor ? randomColor : '#ffffff';
		}

		if (settings.borderColor !== '#ffffff') {
			byId('borderColor').value = settings.borderColor;
			byId('previewSkin').style.borderColor = settings.showColor ? settings.borderColor : Color.fromHex('#ffffff').darker().toHex();
			byId('previewSkin').style.borderWidth = '16px';
		} else {
			byId('previewSkin').style.borderColor = settings.showColor ? Color.fromHex(randomColor).darker().toHex() : Color.fromHex('#ffffff').darker().toHex();
			byId('previewSkin').style.borderWidth = '16px';
		}

		changeShowSkins();
		changeFillSkin();

		byId('nick').addEventListener('input', changeNick);
		byId('nick').addEventListener('change', saveNick);
		byId('skin').addEventListener('change', changeSkin);
		byId('toggleFullscreen').addEventListener('change', changeFullscreen);
		byId('fullscreenBtn').addEventListener('click', () => byId('toggleFullscreen').click());
		byId('chat_clear').addEventListener('click', () => { chat.messages = chat.messages.slice(-1); drawChat() });
		byId('fillSkin').addEventListener('change', changeFillSkin);
		byId('disableTouchControls').addEventListener('change', changeDisableTouchControls);
		byId('flipTouchControls').addEventListener('change', changeFlipTouchControls);
		byId('bgColor').addEventListener('input', changeBackgroundColor);
		byId('bgColor').addEventListener('change', changeBackgroundColor);
		byId('nameColor').addEventListener('input', changeNameColor);
		byId('nameColor').addEventListener('change', changeNameColor);
		byId('cellColor').addEventListener('input', changeCellColor);
		byId('cellColor').addEventListener('change', changeCellColor);
		byId('borderColor').addEventListener('input', changeBorderColor);
		byId('borderColor').addEventListener('change', changeBorderColor);
		byId('showColor').addEventListener('change', changeShowColor);
		byId('showSkins').addEventListener('change', changeShowSkins);
		byId('darkTheme').addEventListener('change', changeDarkTheme);
		byId('overlays').addEventListener('click', overlayClick)
		byId('menuBtn').addEventListener('click', menuClick);
		byId('showZoom').addEventListener('change', e => e.target.checked ? byId('zoom_container').style.display = 'grid' : byId('zoom_container').style.display = 'none');
		byId('moreZoom').addEventListener('change', e => { byId('zoom').setAttribute('min', e.target.checked ? 0.1 : 1); camera.userZoom < (e.target.checked ? 0.1 : 1) ? (camera.userZoom = e.target.checked ? 0.1 : 1) : '' });
		byId('zoom').addEventListener('input', e => (camera.userZoom = e.target.value));

		byId('zoom').setAttribute('min', settings.moreZoom ? 0.1 : 1);

		if (settings.showZoom) {
			byId('zoom_container').style.display = 'grid';
		} else {
			byId('zoom_container').style.display = 'none';
		}

		if (settings.flipTouchControls) {
			changeFlipTouchControls()
		}

		if (checkBanCounter() > 2) {
			byClass('upload-btn-wrapper')[0].remove();
			byId('show-upload-btn').remove();
		}

		window.addEventListener('beforeunload', storeSettings);

		const isMultiCheckEnabled = new URLSearchParams(location.search).has('multicheck');

		if (isMultiCheckEnabled) {
			window.addEventListener('message', event => {
				if (event.origin !== 'https://emupedia.net') return;

				if (event.data === 'mc') {
					hasResponded = true;
					setInterval(() => {
						wsCleanup();
						hideESCOverlay();
						byId('chat_textbox').hide();
						byId('chat_clear').hide();
						byId('connecting-content').innerHTML = '<h3>Multisession Warning</h3><hr class="top" /><p style="text-align: center">Multiple game instances are not allowed.<br />Close all other game instances and reload.</p>';
						byId('connecting').show(0.5);
					}, 1000);
				}
			});

			MC.onload = () => {
				setInterval(multiCheck, 5000);
			};
		}

		document.addEventListener('wheel', handleScroll, { passive: false });

		document.addEventListener('mousedown', event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

			switch (event.button) {
				case 0:
					if (settings.leftClick) {
						if (touched) return;
						if (chat.isDraggingScroll) return;
						if (byId('overlays').contains(event.target) || byId('chat_textbox').contains(event.target) || byId('chat_clear').contains(event.target)) return;

						clearInterval(feedMacroIntervalID);
						let code = UINT8_CACHE[minionControlled ? 0x17 : 0x15];
						let macroCooldown = settings.feedMacro ? 0 : 1000 / 7;
						feedMacroIntervalID = setInterval(() => wsSend(code), macroCooldown);
						wsSend(code);
					}
					break;
				case 1:
					if (settings.middleClick) {
						clearInterval(splitMacroIntervalID);
						let code = UINT8_CACHE[minionControlled ? 0x16 : 0x11];
						let macroCooldown = settings.splitMacro ? 0 : 1000 / 7;
						splitMacroIntervalID = setInterval(() => wsSend(code), macroCooldown);
						wsSend(code);
					}
					break;
			}
		});

		document.addEventListener('mouseup', event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

			if (chat.isDraggingScroll) {
				chat.isDraggingScroll = false;

				const rect = mainCanvas.getBoundingClientRect();
				const mouseX = event.clientX - rect.left;
				const scaledMouseX = mouseX / camera.viewportScale;
				const chatX = 10 / camera.viewportScale;

				if (scaledMouseX - chatX <= chat.scrollbarWidth) {
					mainCanvas.style.cursor = 'grab';
				} else {
					mainCanvas.style.cursor = 'default';
				}
			}

			switch (event.button) {
				case 0:
					if (settings.leftClick) clearInterval(feedMacroIntervalID);
					break;
				case 1:
					if (settings.middleClick) clearInterval(splitMacroIntervalID);
					break;
			}
		});

		document.addEventListener('mousemove', event => {
			if (!chat.isDraggingScroll) return;

			const rect = mainCanvas.getBoundingClientRect();
			const mouseY = event.clientY - rect.top;
			const scaledMouseY = mouseY / camera.viewportScale;
			const chatY = (mainCanvas.height - 55) / camera.viewportScale - chat.canvas.height;
			const chatLocalY = scaledMouseY - chatY;

			updateChatScrollFromMouse(chatLocalY);
			drawChat();
		});

		document.addEventListener('contextmenu', event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

			if (settings.rightClick && event.button === 2) {
				if (byId('overlays').contains(event.target) || byId('chat_textbox').contains(event.target) || byId('chat_clear').contains(event.target)) return;

				let code = UINT8_CACHE[minionControlled ? 0x16 : 0x11];
				wsSend(code);
				wsSend(code);
			}

			if (!byId('overlays').contains(event.target) && !byId('chat_textbox').contains(event.target) && !byId('chat_clear').contains(event.target)) {
				event.preventDefault();
				return false;
			}
		});

		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) {
				mainCanvas.focus();
			}
		});

		byId('play-btn').addEventListener('click', event => {
			if (!allowClick && (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false)) return;

			const skin = settings.skin;
			const nameColor = settings.nameColor;
			const cellColor = settings.cellColor;
			const borderColor = settings.borderColor;
			const fp = settings.fp;
			const fp2 = settings.fp2;

			sendPlay('<' + (skin ? `${skin.trim().replace(/[<>|]/g, '').substring(0, 30)}` : '') + '|' + (nameColor ? `${nameColor.trim().replace(/[<>|]/g, '').substring(0, 7)}` : '') + '|' + (cellColor ? `${cellColor.trim().replace(/[<>|]/g, '').substring(0, 7)}` : '') + '|' + (borderColor ? `${borderColor.trim().replace(/[<>|]/g, '').substring(0, 7)}` : '') + '|' + (fp ? `${fp.trim().replace(/[<>|]/g, '').substring(0, 32)}` : '') + '|' + (fp2 ? `${fp2.trim().replace(/[<>|]/g, '').substring(0, 64)}` : '') + '>' + Cell.parseName(settings.nick));

			hideESCOverlay();

			// console.log('onPlayBtnClick()');
			storeSettings();
		});

		window.onkeydown = keydown;
		window.onkeyup = keyup;

		window.onblur = () => {
			clearInterval(feedMacroIntervalID);
			clearInterval(splitMacroIntervalID);
		}

		chatBox.onblur = () => {
			isTyping = false;
			drawChat();
		};

		chatBox.onfocus = () => {
			isTyping = true;
			drawChat();
		};

		/*chatBox.onpaste = () => {
			chat.messages.push({ color: Color.fromHex('#3f3fc0'), name: '[SERVER] ', message: '[AntiSpam] Your cannot paste messages, write them yourself.', time: Date.now(), server: true, admin: false, mod: false });
		 	if (settings.showChat) drawChat();

			return false;
		}*/

		mainCanvas.addEventListener('mousemove', event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

			mouseX = event.clientX;
			mouseY = event.clientY;

			if (chat.isDraggingScroll) return;

			const rect = mainCanvas.getBoundingClientRect();
			const chatMouseX = event.clientX - rect.left;
			const chatMouseY = event.clientY - rect.top;
			const scaledMouseX = chatMouseX / camera.viewportScale;
			const scaledMouseY = chatMouseY / camera.viewportScale;

			const chatX = 10 / camera.viewportScale;
			const chatY = (mainCanvas.height - 55) / camera.viewportScale - chat.canvas.height;
			const chatWidth = chat.canvas.width;
			const chatHeight = chat.canvas.height;

			if (scaledMouseX >= chatX && scaledMouseX <= chatX + chatWidth && scaledMouseY >= chatY && scaledMouseY <= chatY + chatHeight) {
				const chatLocalX = scaledMouseX - chatX;
				const chatLocalY = scaledMouseY - chatY;
				const thumbInfo = getChatScrollThumbInfo();
				const trackTop = thumbInfo.trackY;
				const trackBottom = thumbInfo.trackY + thumbInfo.trackHeight;

				if (chat.messages.length > thumbInfo.visibleCount && chatLocalX <= chat.scrollbarWidth && chatLocalY >= trackTop && chatLocalY <= trackBottom) {
					mainCanvas.style.cursor = 'grab';
				} else {
					mainCanvas.style.cursor = 'default';
				}
			} else {
				mainCanvas.style.cursor = 'default';
			}

			let found = false;

			for (let i = 0; i < chat.muteIconAreas.length; i++) {
				const area = chat.muteIconAreas[i];
				const areaX = chatX + area.x;
				const areaY = chatY + area.y;

				if (scaledMouseX >= areaX && scaledMouseX <= areaX + area.width &&
					scaledMouseY >= areaY && scaledMouseY <= areaY + area.height) {
					found = true;
					break;
				}
			}

			mainCanvas.style.cursor = found ? 'pointer' : 'default';
		});

		mainCanvas.addEventListener('mousedown', event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

			const rect = mainCanvas.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			const mouseY = event.clientY - rect.top;
			const scaledMouseX = mouseX / camera.viewportScale;
			const scaledMouseY = mouseY / camera.viewportScale;

			const chatX = 10 / camera.viewportScale;
			const chatY = (mainCanvas.height - 55) / camera.viewportScale - chat.canvas.height;
			const chatWidth = chat.canvas.width;
			const chatHeight = chat.canvas.height;

			if (scaledMouseX >= chatX && scaledMouseX <= chatX + chatWidth && scaledMouseY >= chatY && scaledMouseY <= chatY + chatHeight) {
				const chatLocalX = scaledMouseX - chatX;
				const chatLocalY = scaledMouseY - chatY;

				if (chatLocalX <= chat.scrollbarWidth) {
					const thumbInfo = getChatScrollThumbInfo();
					const currentThumbTop = thumbInfo.trackY + thumbInfo.trackHeight - thumbInfo.thumbHeight - ((chat.scrollOffset / (chat.messages.length - thumbInfo.visibleCount)) * (thumbInfo.trackHeight - thumbInfo.thumbHeight));

					if (chatLocalY >= currentThumbTop && chatLocalY <= currentThumbTop + thumbInfo.thumbHeight) {
						chat.scrollDragOffset = chatLocalY - currentThumbTop;
					} else {
						chat.scrollDragOffset = thumbInfo.thumbHeight / 2;
					}

					chat.isDraggingScroll = true;
					mainCanvas.style.cursor = 'grabbing';
					updateChatScrollFromMouse(chatLocalY);
					drawChat();
					event.preventDefault();
				}
			}
		});

		mainCanvas.addEventListener('click', event => {
			if (typeof event['isTrusted'] !== 'boolean' || event['isTrusted'] === false) return;

			if (!chat.visible || !settings.showChat || !chat.muteIconAreas) return;

			event.preventDefault();

			const rect = mainCanvas.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			const mouseY = event.clientY - rect.top;
			const scaledMouseX = mouseX / camera.viewportScale;
			const scaledMouseY = mouseY / camera.viewportScale;
			const chatX = 10 / camera.viewportScale;
			const chatY = (mainCanvas.height - 55) / camera.viewportScale - chat.canvas.height;

			for (let i = 0; i < chat.muteIconAreas.length; i++) {
				const area = chat.muteIconAreas[i];
				const areaX = chatX + area.x;
				const areaY = chatY + area.y;

				if (scaledMouseX >= areaX && scaledMouseX <= areaX + area.width && scaledMouseY >= areaY && scaledMouseY <= areaY + area.height) {
					const username = area.username;

					if (settings.mutedPlayers.includes(username)) {
						unmutePlayer(username);
					} else {
						mutePlayer(username);
					}

					return;
				}
			}
		});

		setInterval(() => sendMouseMove((mouseX - mainCanvas.width / 2) / camera.scale + camera.x, (mouseY - mainCanvas.height / 2) / camera.scale + camera.y), 40);

		window.onresize = () => {
			const width = mainCanvas.width = window.innerWidth;
			const height = mainCanvas.height = window.innerHeight;
			camera.viewportScale = Math.max(width / 1920, height / 1080);
		};

		window.onresize(null);

		gameReset();
		showESCOverlay();

		window.setserver(settings.server);

		drawGame();
		Logger.info(`Init done in ${Date.now() - LOAD_START}ms`);

		const mutePlayerBtn = byId('mute-user-btn');
		const mutePlayerInput = byId('mute-user-input');

		if (mutePlayerBtn && mutePlayerInput) {
			mutePlayerBtn.addEventListener('click', () => {
				const username = mutePlayerInput.value;
				mutePlayer(username);
				mutePlayerInput.value = '';
			});

			mutePlayerInput.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					const username = mutePlayerInput.value;
					mutePlayer(username);
					mutePlayerInput.value = '';
				}
			});
		}
	}

	function start() {
		let externallyFramed;

		try {
			externallyFramed = window.top.location.host !== window.location.host;
		} catch (e) {
			externallyFramed = true;
		}

		if (externallyFramed) {
			try {
				window.top.location = window.location;
			} catch (e) {}
		}

		try {
			fetch('skinList.txt').then(resp => resp.text()).then(data => {
				const skins = data.split(',').filter(name => name.length > 0);

				if (skins.length === 0) {
					init();
					return;
				}

				byId('gallery-btn').style.display = 'inline-block';

				const stamp = Date.now();

				for (const skin of skins) knownSkins.set(skin, stamp);

				for (const i of knownSkins.keys()) {
					if (knownSkins.get(i) !== stamp) knownSkins.delete(i);
				}

				fetch('../skinBanList.txt').then(resp => resp.text()).then(data => {
					const skins = data.split(',').filter(name => name.length > 0);

					if (skins.length === 0) return;

					for (const skin of skins) bannedSkins.add(skin);

					loadSettings();

					FP.then(fp => fp.get()).then(result => {
						settings.fp = ident !== '' ? ident + '|' + result.visitorId : result.visitorId;
						// console.log('startFPCheck()');
						storeSettings();

						fetch('../fpBanList.txt').then(resp => resp.text()).then(data => {
							const fp = data.split(',').filter(name => name.length > 0);

							for (const p of fp) bannedFP.add(p);

							fetch('../fp2BanList.txt').then(resp => resp.text()).then(data2 => {
								const fp2 = data2.split(',').filter(name => name.length > 0);

								for (const p of fp2) bannedFP2.add(p);

								let ban = false;
								let bot = false;

								loadSettings();

								bannedFP.forEach(val => {
									if (settings.fp === val) {
										ban = true;
									}
								});

								bannedFP2.forEach(val => {
									if (settings.fp2 === val) {
										ban = true;
									}
								});

								checkBots().forEach(val => {
									if (val) {
										bot = true;
									}
								});

								const browserInfo = getBrowserInfo();

								switch (browserInfo.family) {
									case 'Chrome':
									case 'Firefox':
										if (browserInfo.major < 125) {
											setInterval(() => {
												wsCleanup();
												hideESCOverlay();
												byId('chat_textbox').hide();
												byId('chat_clear').hide();
												byId('connecting-content').innerHTML = '<h3>Your Browser is very Old</h3><hr class="top" /><p style="text-align: center"><a href="https://www.whatismybrowser.com/" target="_blank">Please click here to update your Browser to a newer version.</a></p>';
												byId('connecting').show(0.5);
											}, 1000);
										}
										break;
									case 'Safari':
										if (browserInfo.major < 17) {
											setInterval(() => {
												wsCleanup();
												hideESCOverlay();
												byId('chat_textbox').hide();
												byId('chat_clear').hide();
												byId('connecting-content').innerHTML = '<h3>Your Browser is very Old</h3><hr class="top" /><p style="text-align: center"><a href="https://www.whatismybrowser.com/" target="_blank">Please click here to update your Browser to a newer version.</a></p>';
												byId('connecting').show(0.5);
											}, 1000);
										}
										break;
								}

								if (ban || bot) {
									setInterval(() => {
										wsCleanup();
										hideESCOverlay();
										byId('chat_textbox').hide();
										byId('chat_clear').hide();
										byId('connecting-content').innerHTML = '<h3>You are banned 😭</h3><hr class="top" /><p style="text-align: center">You are banned from the game because you broke the rules either spamming the chat or while uploading custom skins or because you are using bots.</p><a class="text-center" style="display: block; color: red;" href="https://discord.gg/emupedia-510149138491506688" target="_blank">Join us on Discord!</a><h1 style="text-align: center;">Your unban code is<br /><br />' + btoa(settings.fp).replace(/(.{10})/g, "$1<br />") + '</h1>';
										byId('connecting').show(0.5);
									}, 1000);
								} else {
									init();
								}
							});
						});
					});
				});
			});
		} catch (error) {
			console.error(error);

			init();

			byClass('upload-btn-wrapper')[0].remove();
		}
	}

	function textToNumber(text) {
		const asciiStr = encodeURIComponent(text);
		const chars = asciiStr.split('');
		const hexChars = chars.map((ch) => ch.codePointAt(0).toString(16).padStart(2, '0'));

		return hexChars.join('');
	}

	function numberToText(hexStr) {
		if (hexStr.length % 2 === 1) {
			hexStr = '0' + hexStr;
		}

		const hexChars = hexStr.match(/\w{2}/g);
		const chars = hexChars.map(hex => String.fromCodePoint(parseInt(hex, 16)));
		const asciiStr = chars.join('');

		return decodeURIComponent(asciiStr);
	}

	function isNumberSkin(hexStr) {
		if (typeof hexStr !== 'string' || hexStr.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hexStr)) {
			return false;
		}

		try {
			const str = numberToText(hexStr);

			return str.startsWith('https://iili.io/');
		} catch {
			return false;
		}
	}

	window.setserver = geo => {
		if (GEO[geo] === server.settings && ws && ws.readyState <= WebSocket.OPEN) return;
		settings.server = geo;
		// console.log('window.setserver()');
		storeSettings();
		wsInit(GEO[geo]);
	};

	window.spectate = sendSpectate

	window.changeSkin = (e, s) => {
		let sk;

		if (e === null) {
			sk = s.trim();
		} else {
			sk = e.target.value.trim();
		}

		// noinspection JSUnresolvedReference
		if (sk !== byId('skin').value) {
			byId('skin').value = sk;
		}

		settings.skin = sk.trim();

		if (sk !== '' && sk !== ' ' && settings.skinnames.indexOf(sk) === -1) {
			settings.skinnames.push(sk);
			buildList('skinnames', settings.skinnames);
		}

		if (e !== null) e.target.blur();

		if (settings.showSkins) {
			let saved_skin = isNumberSkin(settings.skin) ? numberToText(settings.skin) : settings.skin;

			if (saved_skin !== '' && saved_skin !== ' ') {
				if (saved_skin.startsWith('https://iili.io/') && !saved_skin.endsWith('.gif')) {
					if (!bannedSkins.has(saved_skin)) {
						byId('previewSkin').onerror = () => {
							byId('previewSkin').onerror = null;
							drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
						};
						drawSkinPreview(saved_skin, byId('previewSkin'));
					} else {
						drawSkinPreview('./assets/img/banned.png', byId('previewSkin'));
					}
				} else {
					byId('previewSkin').onerror = () => {
						byId('previewSkin').onerror = null;
						drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
					};
					drawSkinPreview(`${SKIN_URL}${saved_skin}.png`, byId('previewSkin'));
				}
			} else {
				drawSkinPreview('./assets/img/transparent.png', byId('previewSkin'));
			}
		}

		byId('gallery').hide();

		// console.log('window.setserver()');
		storeSettings();

		if (checkBanCounter() > 2) {
			byId('show-upload-btn').remove();
			byClass('upload-btn-wrapper')[0].remove();
		}
	};

	window.openSkinsList = () => {
		if (byId('gallery-body').innerHTML === '') buildGallery();
		byId('gallery').show(0.5);
	};

	window.openUpload = () => {
		// noinspection HtmlUnknownTarget
		byId('upload-skin-content').innerHTML = '<iframe src="../upload.html" allowtransparency="true"></iframe>';
		byId('upload-skin').show(0.5);
	}

	window.openUnban = () => {
		// noinspection HtmlUnknownTarget
		byId('unban-content').innerHTML = '<iframe src="../unban.html" allowtransparency="true"></iframe>';
		byId('unban').show(0.5);
	}

	window.closeUpload = () => {
		byId('upload-skin').hide();
	}

	window.copyToClipboard = (text, el) => {
		if ('clipboard' in navigator) {
			// noinspection JSIgnoredPromiseFromCall
			navigator.clipboard.writeText(text);
		} else {
			let element = document.createElement('input');

			element.type = 'text';
			element.disabled = true;

			element.style.setProperty('position', 'fixed');
			element.style.setProperty('z-index', '-100');
			element.style.setProperty('pointer-events', 'none');
			element.style.setProperty('opacity', '0');

			element.value = text;

			document.body.appendChild(element);

			element.click();
			element.select();
			// noinspection JSDeprecatedSymbols
			document.execCommand('copy');

			document.body.removeChild(element);
		}

		if (el) {
			let message = document.createElement('div');
			message.innerText = 'Skin URL Copied to Clipboard!';
			el.parentElement.parentElement.after(message);
			setTimeout(() => message.remove(), 2000);
		}
	}

	window.addEventListener('DOMContentLoaded', start);
})();