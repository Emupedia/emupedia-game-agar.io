// noinspection DuplicatedCode,JSUnresolvedReference,JSIgnoredPromiseFromCall

(async function () {
	'use strict';

	// @ts-expect-error
	const IS_WORKER_SCOPE = !self.document && self.WorkerGlobalScope;

	// Detect Browser
	function getEngine() {
		const x = [].constructor;

		try {
			(-1).toFixed(-1);
		} catch (err) {
			return err.message.length + (x + '').split(x.name).join('').length;
		}
	}

	const ENGINE_IDENTIFIER = getEngine();
	// noinspection EqualityComparisonWithCoercionJS
	const IS_BLINK = ENGINE_IDENTIFIER == 80;
	// noinspection EqualityComparisonWithCoercionJS
	const IS_GECKO = ENGINE_IDENTIFIER == 58;
	// noinspection EqualityComparisonWithCoercionJS
	const IS_WEBKIT = ENGINE_IDENTIFIER == 77;
	const JS_ENGINE = ({ 80: 'V8', 58: 'SpiderMonkey', 77: 'JavaScriptCore' })[ENGINE_IDENTIFIER] || null;
	const LIKE_BRAVE = IS_BLINK && 'flat' in Array.prototype /* Chrome 69 */ && !('ReportingObserver' in self /* Brave */);

	function braveBrowser() {
		// @ts-ignore
		// noinspection EqualityComparisonWithCoercionJS
		return ('brave' in navigator && Object.getPrototypeOf(navigator.brave).constructor.name == 'Brave' && navigator.brave.isBrave.toString() == 'function isBrave() { [native code] }');
	}

	function getBraveMode() {
		const mode = { unknown: false, allow: false, standard: false, strict: false };

		try {
			// strict mode adds float frequency data AnalyserNode
			const strictMode = () => {
				try {
					// @ts-ignore
					window.OfflineAudioContext = (OfflineAudioContext || webkitOfflineAudioContext);
				} catch (err) { }

				if (!window.OfflineAudioContext) {
					return false;
				}

				const context = new OfflineAudioContext(1, 1, 44100);
				const analyser = context.createAnalyser();
				const data = new Float32Array(analyser.frequencyBinCount);
				analyser.getFloatFrequencyData(data);
				const strict = new Set(data).size > 1; // native only has -Infinity

				return strict;
			};

			if (strictMode()) {
				mode.strict = true;

				return mode;
			}

			// standard and strict mode do not have chrome plugins
			const chromePlugins = /(Chrom(e|ium)|Microsoft Edge) PDF (Plugin|Viewer)/;
			const pluginsList = [...navigator.plugins];
			// noinspection EqualityComparisonWithCoercionJS
			const hasChromePlugins = pluginsList.filter((plugin) => chromePlugins.test(plugin.name)).length == 2;

			if (pluginsList.length && !hasChromePlugins) {
				mode.standard = true;

				return mode;
			}

			mode.allow = true;

			return mode;
		} catch (e) {
			mode.unknown = true;

			return mode;
		}
	}

	let gpuParameterCache;
	let canvas2DCache;
	let canvas3DCache;
	let cssCache;
	let cssMediaCache;
	let fontsCache;
	let clientRectsCache;
	let engineFeaturesCache;
	let windowFeaturesCache;
	let svgCache;

	let mpc = false;

	try {
		mpc = /C0DE/.test((x => x ? x.getParameter(x.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) : '')(document.createElement('canvas').getContext('webgl')));
	} catch { }

	const getBraveUnprotectedParameters = (parameters) => {
		const blocked = new Set(['FRAGMENT_SHADER.HIGH_FLOAT.precision', 'FRAGMENT_SHADER.HIGH_FLOAT.rangeMax', 'FRAGMENT_SHADER.HIGH_FLOAT.rangeMin', 'FRAGMENT_SHADER.HIGH_INT.precision', 'FRAGMENT_SHADER.HIGH_INT.rangeMax', 'FRAGMENT_SHADER.HIGH_INT.rangeMin', 'FRAGMENT_SHADER.LOW_FLOAT.precision', 'FRAGMENT_SHADER.LOW_FLOAT.rangeMax', 'FRAGMENT_SHADER.LOW_FLOAT.rangeMin', 'FRAGMENT_SHADER.MEDIUM_FLOAT.precision', 'FRAGMENT_SHADER.MEDIUM_FLOAT.rangeMax', 'FRAGMENT_SHADER.MEDIUM_FLOAT.rangeMin', 'MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS', 'MAX_COMBINED_UNIFORM_BLOCKS', 'MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS', 'MAX_DRAW_BUFFERS_WEBGL', 'MAX_FRAGMENT_INPUT_COMPONENTS', 'MAX_FRAGMENT_UNIFORM_BLOCKS', 'MAX_FRAGMENT_UNIFORM_COMPONENTS','MAX_TEXTURE_MAX_ANISOTROPY_EXT', 'MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS', 'MAX_UNIFORM_BUFFER_BINDINGS', 'MAX_VARYING_COMPONENTS', 'MAX_VERTEX_OUTPUT_COMPONENTS', 'MAX_VERTEX_UNIFORM_BLOCKS', 'MAX_VERTEX_UNIFORM_COMPONENTS', 'SHADING_LANGUAGE_VERSION', 'UNMASKED_RENDERER_WEBGL', 'UNMASKED_VENDOR_WEBGL', 'VERSION', 'VERTEX_SHADER.HIGH_FLOAT.precision', 'VERTEX_SHADER.HIGH_FLOAT.rangeMax', 'VERTEX_SHADER.HIGH_FLOAT.rangeMin', 'VERTEX_SHADER.HIGH_INT.precision', 'VERTEX_SHADER.HIGH_INT.rangeMax', 'VERTEX_SHADER.HIGH_INT.rangeMin', 'VERTEX_SHADER.LOW_FLOAT.precision', 'VERTEX_SHADER.LOW_FLOAT.rangeMax', 'VERTEX_SHADER.LOW_FLOAT.rangeMin', 'VERTEX_SHADER.MEDIUM_FLOAT.precision', 'VERTEX_SHADER.MEDIUM_FLOAT.rangeMax', 'VERTEX_SHADER.MEDIUM_FLOAT.rangeMin' ]);

		const safeParameters = Object.keys(parameters).reduce((acc, curr) => {
			if (blocked.has(curr)) {
				return acc;
			}

			acc[curr] = parameters[curr];

			return acc;
		}, {});

		return safeParameters;
	};

	// system
	const getOS = (userAgent) => {
		return (/windows phone/ig.test(userAgent) ? 'Windows Phone' : /win(dows|16|32|64|95|98|nt)|wow64/ig.test(userAgent) ? 'Windows' : /android/ig.test(userAgent) ? 'Android' : /cros/ig.test(userAgent) ? 'Chrome OS' : /linux/ig.test(userAgent) ? 'Linux' : /ipad/ig.test(userAgent) ? 'iPad' : /iphone/ig.test(userAgent) ? 'iPhone' : /ipod/ig.test(userAgent) ? 'iPod' : /ios/ig.test(userAgent) ? 'iOS' : /mac/ig.test(userAgent) ? 'Mac' : 'Other');
	};

	function getReportedPlatform(userAgent, platform) {
		// user agent os lie
		const userAgentOS = (/win(dows|16|32|64|95|98|nt)|wow64/ig.test(userAgent) ? "Windows" /* PlatformClassifier.WINDOWS */ : /android|linux|cros/ig.test(userAgent) ? "Linux" /* PlatformClassifier.LINUX */ : /(i(os|p(ad|hone|od)))|mac/ig.test(userAgent) ? "Apple" /* PlatformClassifier.APPLE */ : "Other" /* PlatformClassifier.OTHER */);

		if (!platform)
			return [userAgentOS];

		const platformOS = (/win/ig.test(platform) ? "Windows" /* PlatformClassifier.WINDOWS */ : /android|arm|linux/ig.test(platform) ? "Linux" /* PlatformClassifier.LINUX */ : /(i(os|p(ad|hone|od)))|mac/ig.test(platform) ? "Apple" /* PlatformClassifier.APPLE */ : "Other" /* PlatformClassifier.OTHER */);

		return [userAgentOS, platformOS];
	}

	const { userAgent: navUserAgent, platform: navPlatform } = self.navigator || {};
	const [USER_AGENT_OS, PLATFORM_OS] = getReportedPlatform(navUserAgent, navPlatform);

	const decryptUserAgent = ({ ua, os, isBrave }) => {
		const apple = /ipad|iphone|ipod|ios|mac/ig.test(os);
		const isOpera = /OPR\//g.test(ua);
		const isVivaldi = /Vivaldi/g.test(ua);
		const isDuckDuckGo = /DuckDuckGo/g.test(ua);
		const isYandex = /YaBrowser/g.test(ua);
		const paleMoon = ua.match(/(palemoon)\/(\d+)./i);
		const edge = ua.match(/(edgios|edg|edge|edga)\/(\d+)./i);
		const edgios = edge && /edgios/i.test(edge[1]);
		const chromium = ua.match(/(crios|chrome)\/(\d+)./i);
		const firefox = ua.match(/(fxios|firefox)\/(\d+)./i);
		const likeSafari = (/AppleWebKit/g.test(ua) && /Safari/g.test(ua));
		const safari = (likeSafari && !firefox && !chromium && !edge && ua.match(/(version)\/(\d+)\.(\d|\.)+\s(mobile|safari)/i));

		if (chromium) {
			const browser = chromium[1];
			const version = chromium[2];
			const like = (isOpera ? ' Opera' : isVivaldi ? ' Vivaldi' : isDuckDuckGo ? ' DuckDuckGo' : isYandex ? ' Yandex' : edge ? ' Edge' : isBrave ? ' Brave' : '');

			return `${browser} ${version}${like}`;
		} else if (edgios) {
			const browser = edge[1];
			const version = edge[2];

			return `${browser} ${version}`;
		} else if (firefox) {
			const browser = paleMoon ? paleMoon[1] : firefox[1];
			const version = paleMoon ? paleMoon[2] : firefox[2];

			return `${browser} ${version}`;
		} else if (apple && safari) {
			const browser = 'Safari';
			const version = safari[2];

			return `${browser} ${version}`;
		}

		return 'unknown';
	};

	const getUserAgentPlatform = ({ userAgent, excludeBuild = true }) => {
		if (!userAgent) {
			return 'unknown';
		}

		// patterns
		const nonPlatformParenthesis = /\((khtml|unlike|vizio|like gec|internal dummy|org\.eclipse|openssl|ipv6|via translate|safari|cardamon).+|xt\d+\)/ig;
		const parenthesis = /\((.+)\)/;
		const android = /((android).+)/i;
		const androidNoise = /^(linux|[a-z]|wv|mobile|[a-z]{2}(-|_)[a-z]{2}|[a-z]{2})$|windows|(rv:|trident|webview|iemobile).+/i;
		const androidBuild = /build\/.+\s|\sbuild\/.+/i;
		const androidRelease = /android( |-)\d+/i;
		const windows = /((windows).+)/i;
		const windowsNoise = /^(windows|ms(-|)office|microsoft|compatible|[a-z]|x64|[a-z]{2}(-|_)[a-z]{2}|[a-z]{2})$|(rv:|outlook|ms(-|)office|microsoft|trident|\.net|msie|httrack|media center|infopath|aol|opera|iemobile|webbrowser).+/i;
		const windows64bitCPU = /w(ow|in)64/i;
		const cros = /cros/i;
		const crosNoise = /^([a-z]|x11|[a-z]{2}(-|_)[a-z]{2}|[a-z]{2})$|(rv:|trident).+/i;
		const crosBuild = /\d+\.\d+\.\d+/i;
		const linux = /linux|x11|ubuntu|debian/i;
		const linuxNoise = /^([a-z]|x11|unknown|compatible|[a-z]{2}(-|_)[a-z]{2}|[a-z]{2})$|(rv:|java|oracle|\+http|http|unknown|mozilla|konqueror|valve).+/i;
		const apple = /(cpu iphone|cpu os|iphone os|mac os|macos|intel os|ppc mac).+/i;
		const appleNoise = /^([a-z]|macintosh|compatible|mimic|[a-z]{2}(-|_)[a-z]{2}|[a-z]{2}|rv|\d+\.\d+)$|(rv:|silk|valve).+/i;
		const appleRelease = /(ppc |intel |)(mac|mac |)os (x |x|)(\d{2}(_|\.)\d{1,2}|\d{2,})/i;
		const otherOS = /((symbianos|nokia|blackberry|morphos|mac).+)|\/linux|freebsd|symbos|series \d+|win\d+|unix|hp-ux|bsdi|bsd|x86_64/i;
		const isDevice = (list, device) => list.filter((x) => device.test(x)).length;

		userAgent = userAgent.trim().replace(/\s{2,}/, ' ').replace(nonPlatformParenthesis, '');

		if (parenthesis.test(userAgent)) {
			const platformSection = userAgent.match(parenthesis)[0];
			const identifiers = platformSection.slice(1, -1).replace(/,/g, ';').split(';').map((x) => x.trim());

			if (isDevice(identifiers, android)) {
				// @ts-ignore
				return identifiers.map((x) => androidRelease.test(x) ? androidRelease.exec(x)[0].replace('-', ' ') : x).filter((x) => !(androidNoise.test(x))).join(' ').replace((excludeBuild ? androidBuild : ''), '').trim().replace(/\s{2,}/, ' ');
			} else if (isDevice(identifiers, windows)) {
				return identifiers.filter((x) => !(windowsNoise.test(x))).join(' ').replace(/\sNT (\d+\.\d+)/, (match, version) => (version == '10.0' ? ' 10' : version == '6.3' ? ' 8.1' : version == '6.2' ? ' 8' : version == '6.1' ? ' 7' : version == '6.0' ? ' Vista' : version == '5.2' ? ' XP Pro' : version == '5.1' ? ' XP' : version == '5.0' ? ' 2000' : version == '4.0' ? match : ' ' + version)).replace(windows64bitCPU, '(64-bit)').trim().replace(/\s{2,}/, ' ');
			} else if (isDevice(identifiers, cros)) {
				return identifiers.filter((x) => !(crosNoise.test(x))).join(' ').replace((excludeBuild ? crosBuild : ''), '').trim().replace(/\s{2,}/, ' ');
			} else if (isDevice(identifiers, linux)) {
				return identifiers.filter((x) => !(linuxNoise.test(x))).join(' ').trim().replace(/\s{2,}/, ' ');
			} else if (isDevice(identifiers, apple)) {
				return identifiers.map((x) => {
					if (appleRelease.test(x)) {
						// @ts-ignore
						const release = appleRelease.exec(x)[0];
						const versionMap = { '10_7': 'Lion', '10_8': 'Mountain Lion', '10_9': 'Mavericks', '10_10': 'Yosemite', '10_11': 'El Capitan', '10_12': 'Sierra', '10_13': 'High Sierra', '10_14': 'Mojave', '10_15': 'Catalina', '11': 'Big Sur', '12': 'Monterey', '13': 'Ventura' };
						const version = ((/(\d{2}(_|\.)\d{1,2}|\d{2,})/.exec(release) || [])[0] || '').replace(/\./g, '_');
						const isOSX = /^10/.test(version);
						const id = isOSX ? version : (/^\d{2,}/.exec(version) || [])[0];
						const codeName = versionMap[id];

						return codeName ? `macOS ${codeName}` : release;
					}

					return x;
				}).filter((x) => !(appleNoise.test(x))).join(' ').replace(/\slike mac.+/ig, '').trim().replace(/\s{2,}/, ' ');
			} else {
				const other = identifiers.filter((x) => otherOS.test(x));

				if (other.length) {
					return other.join(' ').trim().replace(/\s{2,}/, ' ');
				}

				return identifiers.join(' ');
			}
		} else {
			return 'unknown';
		}
	};

	// attempt restore from User-Agent Reduction
	const isUAPostReduction = (userAgent) => {
		const matcher = /Mozilla\/5\.0 \((Macintosh; Intel Mac OS X 10_15_7|Windows NT 10\.0; Win64; x64|(X11; (CrOS|Linux) x86_64)|(Linux; Android 10(; K|)))\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/\d+\.0\.0\.0( Mobile|) Safari\/537\.36/;
		const unifiedPlatform = (matcher.exec(userAgent) || [])[1];
		return IS_BLINK && !!unifiedPlatform;
	};

	const createPerformanceLogger = () => {
		const log = {};

		let total = 0;

		return {
			logTestResult: ({ test, passed, time = 0 }) => {
				total += time;
				const timeString = `${time.toFixed(2)}ms`;
				log[test] = timeString;
				const color = passed ? '#4cca9f' : 'lightcoral'
				const result = passed ? 'passed' : 'failed'
				const symbol = passed ? '✔' : '-'

				//return console.log(`%c${symbol}${time ? ` (${timeString})` : ''} ${test} ${result}`, `color:${color}`)
			},
			getLog: () => log,
			getTotal: () => total
		};
	};

	const performanceLogger = createPerformanceLogger();
	const { logTestResult } = performanceLogger;

	const createTimer = () => {
		let start = 0;

		const log = [];

		return {
			stop: () => {
				if (start) {
					log.push(performance.now() - start);

					return log.reduce((acc, n) => acc += n, 0);
				}

				return start;
			},
			start: () => {
				start = performance.now();

				return start;
			}
		};
	};

	const queueEvent = (timer, delay = 0) => {
		timer.stop();

		return new Promise((resolve) => setTimeout(() => resolve(timer.start()), delay)).catch((e) => { });
	};

	const queueTask = () => new Promise((resolve) => setTimeout(() => resolve(null)));

	const EMOJIS = [
		[128512], [9786], [129333, 8205, 9794, 65039], [9832], [9784], [9895], [8265], [8505], [127987, 65039, 8205, 9895, 65039], [129394], [9785], [9760], [129489, 8205, 129456], [129487, 8205, 9794, 65039], [9975], [129489, 8205, 129309, 8205, 129489], [9752], [9968], [9961], [9972], [9992], [9201], [9928], [9730], [9969], [9731], [9732], [9976], [9823], [9937], [9000], [9993], [9999],
		[128105, 8205, 10084, 65039, 8205, 128139, 8205, 128104],
		[128104, 8205, 128105, 8205, 128103, 8205, 128102],
		[128104, 8205, 128105, 8205, 128102],
		// android 11
		[128512],
		[169], [174], [8482],
		[128065, 65039, 8205, 128488, 65039],
		// other
		[10002], [9986], [9935], [9874], [9876], [9881], [9939], [9879], [9904], [9905], [9888], [9762], [9763], [11014], [8599], [10145], [11013], [9883], [10017], [10013], [9766], [9654], [9197], [9199], [9167], [9792], [9794], [10006], [12336], [9877], [9884], [10004], [10035], [10055], [9724], [9642], [10083], [10084], [9996], [9757], [9997], [10052], [9878], [8618], [9775], [9770], [9774], [9745], [10036], [127344], [127359],
	].map((emojiCode) => String.fromCodePoint(...emojiCode));

	const CSS_FONT_FAMILY = `
	'Segoe Fluent Icons',
	'Ink Free',
	'Bahnschrift',
	'Segoe MDL2 Assets',
	'HoloLens MDL2 Assets',
	'Leelawadee UI',
	'Javanese Text',
	'Segoe UI Emoji',
	'Aldhabi',
	'Gadugi',
	'Myanmar Text',
	'Nirmala UI',
	'Lucida Console',
	'Cambria Math',
	'Bai Jamjuree',
	'Chakra Petch',
	'Charmonman',
	'Fahkwang',
	'K2D',
	'Kodchasan',
	'KoHo',
	'Sarabun',
	'Srisakdi',
	'Galvji',
	'MuktaMahee Regular',
	'InaiMathi Bold',
	'American Typewriter Semibold',
	'Futura Bold',
	'SignPainter-HouseScript Semibold',
	'PingFang HK Light',
	'Kohinoor Devanagari Medium',
	'Luminari',
	'Geneva',
	'Helvetica Neue',
	'Droid Sans Mono',
	'Dancing Script',
	'Roboto',
	'Ubuntu',
	'Liberation Mono',
	'Source Code Pro',
	'DejaVu Sans',
	'OpenSymbol',
	'Chilanka',
	'Cousine',
	'Arimo',
	'Jomolhari',
	'MONO',
	'Noto Color Emoji',
	sans-serif !important
`;

	function getGpuBrand(gpu) {
		if (!gpu)
			return null;
		const gpuBrandMatcher = /(adreno|amd|apple|intel|llvm|mali|microsoft|nvidia|parallels|powervr|samsung|swiftshader|virtualbox|vmware)/i;
		const brand = (/radeon/i.test(gpu) ? 'AMD' : /geforce/i.test(gpu) ? 'NVIDIA' : (gpuBrandMatcher.exec(gpu)?.[0] || 'other').toLocaleUpperCase());
		return brand;
	}

	// collect fingerprints for analysis
	const Analysis = {};

	// use if needed to stable fingerprint
	const LowerEntropy = { AUDIO: false, CANVAS: false, FONTS: false, SCREEN: false, TIME_ZONE: false, WEBGL: false };

	// template views
	function patch(oldEl, newEl, fn) {
		if (!oldEl)
			return null;

		oldEl.parentNode?.replaceChild(newEl, oldEl);

		return typeof fn === 'function' ? fn() : true;
	}

	function html(templateStr, ...expressionSet) {
		const template = document.createElement('template');
		template.innerHTML = templateStr.map((s, i) => `${s}${expressionSet[i] || ''}`).join('');

		return document.importNode(template.content, true);
	}

	const createErrorsCaptured = () => {
		const errors = [];

		return {
			getErrors: () => errors,
			captureError: (error, customMessage = '') => {
				const type = { Error: true, EvalError: true, InternalError: true, RangeError: true, ReferenceError: true, SyntaxError: true, TypeError: true, URIError: true, InvalidStateError: true, SecurityError: true};
				const hasInnerSpace = (s) => /.+(\s).+/g.test(s); // ignore AOPR noise
				console.error(error); // log error to educate
				const { name, message } = error;
				const trustedMessage = (!hasInnerSpace(message) ? undefined : !customMessage ? message : `${message} [${customMessage}]`);
				const trustedName = type[name] ? name : undefined;
				errors.push({ trustedName, trustedMessage });

				return undefined;
			}
		};
	};

	const errorsCaptured = createErrorsCaptured();

	const { captureError } = errorsCaptured;

	const attempt = (fn, customMessage = '') => {
		try {
			return fn();
		} catch (error) {
			if (customMessage) {
				return captureError(error, customMessage);
			}

			return captureError(error);
		}
	};

	const caniuse = (fn, objChainList = [], args = [], method = false) => {
		let api;

		try {
			api = fn();
		} catch (error) {
			return undefined;
		}

		let i;

		const len = objChainList.length;

		let chain = api;

		try {
			for (i = 0; i < len; i++) {
				const obj = objChainList[i];
				chain = chain[obj];
			}
		} catch (error) {
			return undefined;
		}

		return (method && args.length ? chain.apply(api, args) : method && !args.length ? chain.apply(api) : chain);
	};

	// Log performance time
	const timer = (logStart) => {
		logStart && console.log(logStart);
		let start = 0;

		try {
			start = performance.now();
		} catch (error) {
			captureError(error);
		}

		return (logEnd) => {
			let end = 0;

			try {
				end = performance.now() - start;
				logEnd && console.log(`${logEnd}: ${end / 1000} seconds`);

				return end;
			} catch (error) {
				captureError(error);

				return 0;
			}
		};
	};

	const getCapturedErrors = () => ({ data: errorsCaptured.getErrors() });

	/* eslint-disable new-cap */
	// warm up while we detect lies
	try { speechSynthesis.getVoices(); } catch (err) { }

	// Collect lies detected
	function createLieRecords() {
		const records = {};

		return {
			getRecords: () => records,
			documentLie: (name, lie) => {
				const isArray = lie instanceof Array;

				if (records[name]) {
					if (isArray) {
						return (records[name] = [...records[name], ...lie]);
					}

					return records[name].push(lie);
				}

				return isArray ? (records[name] = lie) : (records[name] = [lie]);
			}
		};
	}

	let lieRecords = createLieRecords();

	const { documentLie } = lieRecords;

	const GHOST = `
	height: 100vh;
	width: 100vw;
	position: absolute;
	left:-10000px;
	visibility: hidden;
`;

	function getRandomValues() {
		return (String.fromCharCode(Math.random() * 26 + 97) + Math.random().toString(36).slice(-7));
	}

	function getBehemothIframe(win) {
		try {
			if (!IS_BLINK)
				return win;

			const div = win.document.createElement('div');

			div.setAttribute('id', getRandomValues());
			div.setAttribute('style', GHOST);
			div.innerHTML = `<div><iframe></iframe></div>`;
			win.document.body.appendChild(div);

			const iframe = [...[...div.childNodes][0].childNodes][0];

			if (!iframe)
				return null;

			const { contentWindow } = iframe || {};

			if (!contentWindow)
				return null;

			const div2 = contentWindow.document.createElement('div');

			div2.innerHTML = `<div><iframe></iframe></div>`;
			contentWindow.document.body.appendChild(div2);

			const iframe2 = [...[...div2.childNodes][0].childNodes][0];

			return iframe2.contentWindow;
		} catch (error) {
			captureError(error, 'client blocked behemoth iframe');

			return win;
		}
	}

	const RAND = getRandomValues();
	const HAS_REFLECT = 'Reflect' in self;

	function isTypeError(err) {
		return err.constructor.name == 'TypeError';
	}

	function failsTypeError({ spawnErr, withStack, final }) {
		try {
			spawnErr();
			throw Error();
		}
		catch (err) {
			if (!isTypeError(err))
				return true;
			return withStack ? withStack(err) : false;
		}
		finally {
			final && final();
		}
	}

	function failsWithError(fn) {
		try {
			fn();
			return false;
		}
		catch (err) {
			return true;
		}
	}

	function hasKnownToString(name) {
		return {
			[`function ${name}() { [native code] }`]: true,
			[`function get ${name}() { [native code] }`]: true,
			[`function () { [native code] }`]: true,
			[`function ${name}() {${'\n'}	[native code]${'\n'}}`]: true,
			[`function get ${name}() {${'\n'}	[native code]${'\n'}}`]: true,
			[`function () {${'\n'}	[native code]${'\n'}}`]: true,
		};
	}

	function hasValidStack(err, reg, i = 1) {
		if (i === 0)
			return reg.test(err.message);
		return reg.test(err.stack.split('\n')[i]);
	}

	const AT_FUNCTION = /at Function\.toString /;
	const AT_OBJECT = /at Object\.toString/;
	const FUNCTION_INSTANCE = /at (Function\.)?\[Symbol.hasInstance\]/; // useful if < Chrome 102
	const PROXY_INSTANCE = /at (Proxy\.)?\[Symbol.hasInstance\]/; // useful if < Chrome 102
	const STRICT_MODE = /strict mode/;

	function queryLies({ scope, apiFunction, proto, obj, lieProps, }) {
		if (typeof apiFunction != 'function') {
			return { lied: 0, lieTypes: [] };
		}

		const name = apiFunction.name.replace(/get\s/, '');
		const objName = obj?.name;
		const nativeProto = Object.getPrototypeOf(apiFunction);

		let lies = {
			// custom lie string names
			['failed illegal error']: !!obj && failsTypeError({ spawnErr: () => obj.prototype[name] }),
			['failed undefined properties']: (!!obj && /^(screen|navigator)$/i.test(objName) && !!(Object.getOwnPropertyDescriptor(self[objName.toLowerCase()], name) || (HAS_REFLECT && Reflect.getOwnPropertyDescriptor(self[objName.toLowerCase()], name)))),
			['failed call interface error']: failsTypeError({
				spawnErr: () => {
					// @ts-expect-error
					new apiFunction();
					apiFunction.call(proto);
				}
			}),
			['failed apply interface error']: failsTypeError({
				spawnErr: () => {
					// @ts-expect-error
					new apiFunction();
					apiFunction.apply(proto);
				},
			}),
			['failed new instance error']: failsTypeError({
				// @ts-expect-error
				spawnErr: () => new apiFunction(),
			}),
			['failed class extends error']: !IS_WEBKIT && failsTypeError({
				spawnErr: () => {
					// @ts-expect-error
					class Fake extends apiFunction {
					}
				},
			}),
			['failed null conversion error']: failsTypeError({
				spawnErr: () => Object.setPrototypeOf(apiFunction, null).toString(),
				final: () => Object.setPrototypeOf(apiFunction, nativeProto)
			}),
			['failed toString']: (!hasKnownToString(name)[scope.Function.prototype.toString.call(apiFunction)] || !hasKnownToString('toString')[scope.Function.prototype.toString.call(apiFunction.toString)]),
			['failed "prototype" in function']: 'prototype' in apiFunction, ['failed descriptor']: !!(Object.getOwnPropertyDescriptor(apiFunction, 'arguments') || Reflect.getOwnPropertyDescriptor(apiFunction, 'arguments') || Object.getOwnPropertyDescriptor(apiFunction, 'caller') || Reflect.getOwnPropertyDescriptor(apiFunction, 'caller') || Object.getOwnPropertyDescriptor(apiFunction, 'prototype') || Reflect.getOwnPropertyDescriptor(apiFunction, 'prototype') || Object.getOwnPropertyDescriptor(apiFunction, 'toString') || Reflect.getOwnPropertyDescriptor(apiFunction, 'toString')),
			['failed own property']: !!(apiFunction.hasOwnProperty('arguments') || apiFunction.hasOwnProperty('caller') || apiFunction.hasOwnProperty('prototype') || apiFunction.hasOwnProperty('toString')),
			['failed descriptor keys']: (Object.keys(Object.getOwnPropertyDescriptors(apiFunction)).sort().toString() != 'length,name'),
			['failed own property names']: (Object.getOwnPropertyNames(apiFunction).sort().toString() != 'length,name'),
			['failed own keys names']: HAS_REFLECT && (Reflect.ownKeys(apiFunction).sort().toString() != 'length,name'),
			// Proxy Detection
			['failed object toString error']: (failsTypeError({
				spawnErr: () => Object.create(apiFunction).toString(),
				withStack: (err) => IS_BLINK && !hasValidStack(err, AT_FUNCTION)
			}) || failsTypeError({
				spawnErr: () => Object.create(new Proxy(apiFunction, {})).toString(),
				withStack: (err) => IS_BLINK && !hasValidStack(err, AT_OBJECT)
			})),
			['failed at incompatible proxy error']: failsTypeError({
				spawnErr: () => {
					apiFunction.arguments;
					apiFunction.caller;
				},
				withStack: (err) => IS_GECKO && !hasValidStack(err, STRICT_MODE, 0)
			}),
			['failed at toString incompatible proxy error']: failsTypeError({
				spawnErr: () => {
					// noinspection JSAnnotator
					apiFunction.toString.arguments;
					// noinspection JSAnnotator
					apiFunction.toString.caller;
				},
				withStack: (err) => IS_GECKO && !hasValidStack(err, STRICT_MODE, 0)
			}),
			['failed at too much recursion error']: failsTypeError({
				spawnErr: () => {
					Object.setPrototypeOf(apiFunction, Object.create(apiFunction)).toString();
				},
				final: () => Object.setPrototypeOf(apiFunction, nativeProto)
			})
		};

		// conditionally increase difficulty
		const detectProxies = (name == 'toString' || !!lieProps['Function.toString'] || !!lieProps['Permissions.query']);

		if (detectProxies) {
			const proxy1 = new Proxy(apiFunction, {});
			const proxy2 = new Proxy(apiFunction, {});
			const proxy3 = new Proxy(apiFunction, {});

			lies = {
				...lies,
				// Advanced Proxy Detection
				['failed at too much recursion __proto__ error']: !failsTypeError({
					spawnErr: () => {
						// @ts-expect-error
						apiFunction.__proto__ = proxy;
						apiFunction++;
					},
					final: () => Object.setPrototypeOf(apiFunction, nativeProto)
				}),
				['failed at chain cycle error']: !failsTypeError({
					spawnErr: () => {
						Object.setPrototypeOf(proxy1, Object.create(proxy1)).toString();
					},
					final: () => Object.setPrototypeOf(proxy1, nativeProto)
				}),
				['failed at chain cycle __proto__ error']: !failsTypeError({
					spawnErr: () => {
						// @ts-expect-error
						proxy2.__proto__ = proxy2;
						// noinspection JSConstantReassignment
						proxy2++;
					},
					final: () => Object.setPrototypeOf(proxy2, nativeProto)
				}),
				['failed at reflect set proto']: HAS_REFLECT && failsTypeError({
					spawnErr: () => {
						Reflect.setPrototypeOf(apiFunction, Object.create(apiFunction));
						RAND in apiFunction;
						throw new TypeError();
					},
					final: () => Object.setPrototypeOf(apiFunction, nativeProto)
				}),
				['failed at reflect set proto proxy']: HAS_REFLECT && !failsTypeError({
					spawnErr: () => {
						Reflect.setPrototypeOf(proxy3, Object.create(proxy3));
						RAND in proxy3;
					},
					final: () => Object.setPrototypeOf(proxy3, nativeProto)
				}),
				['failed at instanceof check error']: IS_BLINK && (failsTypeError({
					spawnErr: () => {
						apiFunction instanceof apiFunction;
					},
					withStack: (err) => !hasValidStack(err, FUNCTION_INSTANCE)
				}) || failsTypeError({
					spawnErr: () => {
						const proxy = new Proxy(apiFunction, {});
						proxy instanceof proxy;
					},
					withStack: (err) => !hasValidStack(err, PROXY_INSTANCE)
				})),
				['failed at define properties']: IS_BLINK && HAS_REFLECT && failsWithError(() => {
					Object.defineProperty(apiFunction, '', { configurable: true }).toString();
					Reflect.deleteProperty(apiFunction, '');
				})
			};
		}

		const lieTypes = Object.keys(lies).filter((key) => !!lies[key]);

		return { lied: lieTypes.length, lieTypes };
	}

	function createLieDetector(scope) {
		const isSupported = (obj) => typeof obj != 'undefined' && !!obj;
		const props = {}; // lie list and detail
		const propsSearched = []; // list of properties searched

		return {
			getProps: () => props,
			getPropsSearched: () => propsSearched,
			searchLies: (fn, config) => {
				const { target, ignore } = config || {};
				let obj;

				// check if api is blocked or not supported
				try {
					obj = fn();

					if (!isSupported(obj)) {
						return;
					}
				} catch (error) {
					return;
				}

				const interfaceObject = !!obj.prototype ? obj.prototype : obj;

				[...new Set([...Object.getOwnPropertyNames(interfaceObject), ...Object.keys(interfaceObject)])].sort().forEach((name) => {
					const skip = (name == 'constructor' || (target && !new Set(target).has(name)) || (ignore && new Set(ignore).has(name)));

					if (skip)
						return;

					const objectNameString = /\s(.+)\]/;

					const apiName = `${obj.name ? obj.name : objectNameString.test(obj) ? objectNameString.exec(obj)?.[1] : undefined}.${name}`;

					propsSearched.push(apiName);

					try {
						const proto = obj.prototype ? obj.prototype : obj;
						let res; // response from getLies
						// search if function

						try {
							const apiFunction = proto[name]; // may trigger TypeError

							if (typeof apiFunction == 'function') {
								res = queryLies({ scope, apiFunction: proto[name], proto, obj: null, lieProps: props });

								if (res.lied) {
									documentLie(apiName, res.lieTypes);

									return (props[apiName] = res.lieTypes);
								}

								return;
							}

							// since there is no TypeError and the typeof is not a function,
							// handle invalid values and ignore name, length, and constants
							if (name != 'name' && name != 'length' && name[0] !== name[0].toUpperCase()) {
								const lie = ['failed descriptor.value undefined'];
								documentLie(apiName, lie);

								return (props[apiName] = lie);
							}
						} catch (error) { }

						// else search getter function
						// @ts-ignore
						const getterFunction = Object.getOwnPropertyDescriptor(proto, name).get;

						res = queryLies({ scope, apiFunction: getterFunction, proto, obj, lieProps: props }); // send the obj for special tests

						if (res.lied) {
							documentLie(apiName, res.lieTypes);

							return (props[apiName] = res.lieTypes);
						}

						return;
					} catch (error) {
						const lie = `failed prototype test execution`;
						documentLie(apiName, lie);

						return (props[apiName] = [lie]);
					}
				});
			}
		};
	}

	function getPhantomIframe() {
		if (IS_WORKER_SCOPE)
			return { iframeWindow: self };
		try {
			const numberOfIframes = self.length;
			const frag = new DocumentFragment();
			const div = document.createElement('div');
			const id = getRandomValues();
			div.setAttribute('id', id);
			frag.appendChild(div);
			div.innerHTML = `<div style="${GHOST}"><iframe></iframe></div>`;
			document.body.appendChild(frag);
			const iframeWindow = self[numberOfIframes];
			const phantomWindow = getBehemothIframe(iframeWindow);

			return { iframeWindow: phantomWindow || self, div };
		} catch (error) {
			captureError(error, 'client blocked phantom iframe');

			return { iframeWindow: self };
		}
	}

	const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};

	function getPrototypeLies(scope) {
		const lieDetector = createLieDetector(scope);

		const { searchLies } = lieDetector;
		// search lies: remove target to search all properties
		// test Function.toString first to determine the depth of the search

		searchLies(() => Function, { target: ['toString'], ignore: ['caller', 'arguments'] });
		// other APIs
		searchLies(() => AnalyserNode);
		searchLies(() => AudioBuffer, { target: ['copyFromChannel', 'getChannelData'] });
		searchLies(() => BiquadFilterNode, { target: ['getFrequencyResponse'] });
		searchLies(() => CanvasRenderingContext2D, { target: ['getImageData', 'getLineDash', 'isPointInPath', 'isPointInStroke', 'measureText', 'quadraticCurveTo', 'fillText', 'strokeText', 'font'] });
		searchLies(() => CSSStyleDeclaration, { target: ['setProperty'] });
		// @ts-expect-error
		searchLies(() => CSS2Properties, { target: ['setProperty'] });
		searchLies(() => Date, { target: ['getDate', 'getDay', 'getFullYear', 'getHours', 'getMinutes', 'getMonth', 'getTime', 'getTimezoneOffset', 'setDate', 'setFullYear', 'setHours', 'setMilliseconds', 'setMonth', 'setSeconds', 'setTime', 'toDateString', 'toJSON', 'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString', 'toString', 'toTimeString', 'valueOf'] });
		// @ts-expect-error if not supported
		searchLies(() => GPU, { target: ['requestAdapter'] });
		// @ts-expect-error if not supported
		searchLies(() => GPUAdapter, { target: ['requestAdapterInfo'] });
		searchLies(() => Intl.DateTimeFormat, { target: ['format', 'formatRange', 'formatToParts', 'resolvedOptions'] });
		searchLies(() => Document, { target: ['createElement', 'createElementNS', 'getElementById', 'getElementsByClassName', 'getElementsByName', 'getElementsByTagName', 'getElementsByTagNameNS', 'referrer', 'write', 'writeln'], ignore: ['onreadystatechange', 'onmouseenter', 'onmouseleave'] });
		searchLies(() => DOMRect);
		searchLies(() => DOMRectReadOnly);
		searchLies(() => Element, { target: ['append', 'appendChild', 'getBoundingClientRect', 'getClientRects', 'insertAdjacentElement', 'insertAdjacentHTML', 'insertAdjacentText', 'insertBefore', 'prepend', 'replaceChild', 'replaceWith', 'setAttribute'] });
		searchLies(() => FontFace, { target: ['family', 'load', 'status'] });
		searchLies(() => HTMLCanvasElement);
		searchLies(() => HTMLElement, { target: ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth', 'scrollHeight', 'scrollWidth'], ignore: ['onmouseenter', 'onmouseleave'] });
		searchLies(() => HTMLIFrameElement, { target: ['contentDocument', 'contentWindow'] });
		searchLies(() => IntersectionObserverEntry, { target: ['boundingClientRect', 'intersectionRect', 'rootBounds'] });
		searchLies(() => Math, { target: ['acos', 'acosh', 'asinh', 'atan', 'atan2', 'atanh', 'cbrt', 'cos', 'cosh', 'exp', 'expm1', 'log', 'log10', 'log1p', 'sin', 'sinh', 'sqrt', 'tan', 'tanh'] });
		searchLies(() => MediaDevices, { target: ['enumerateDevices', 'getDisplayMedia', 'getUserMedia'] });
		searchLies(() => Navigator, { target: ['appCodeName', 'appName', 'appVersion', 'buildID', 'connection', 'deviceMemory', 'getBattery', 'getGamepads', 'getVRDisplays', 'hardwareConcurrency', 'language', 'languages', 'maxTouchPoints', 'mimeTypes', 'oscpu', 'platform', 'plugins', 'product', 'productSub', 'sendBeacon', 'serviceWorker', 'storage', 'userAgent', 'vendor', 'vendorSub', 'webdriver', 'gpu'] });
		searchLies(() => Node, { target: ['appendChild', 'insertBefore', 'replaceChild'] });
		// @ts-expect-error
		searchLies(() => OffscreenCanvas, { target: ['convertToBlob', 'getContext'] });
		// @ts-expect-error
		searchLies(() => OffscreenCanvasRenderingContext2D, { target: ['getImageData', 'getLineDash', 'isPointInPath', 'isPointInStroke', 'measureText', 'quadraticCurveTo', 'font'] });
		searchLies(() => Permissions, { target: ['query'] });
		searchLies(() => Range, { target: ['getBoundingClientRect', 'getClientRects'] });
		// @ts-expect-error
		searchLies(() => Intl.RelativeTimeFormat, { target: ['resolvedOptions'] });
		searchLies(() => Screen);
		searchLies(() => speechSynthesis, { target: ['getVoices'] });
		searchLies(() => String, { target: ['fromCodePoint'] });
		searchLies(() => StorageManager, { target: ['estimate'] });
		searchLies(() => SVGRect);
		searchLies(() => SVGRectElement, { target: ['getBBox'] });
		searchLies(() => SVGTextContentElement, { target: ['getExtentOfChar', 'getSubStringLength', 'getComputedTextLength'] });
		searchLies(() => TextMetrics);
		searchLies(() => WebGLRenderingContext, { target: ['bufferData', 'getParameter', 'readPixels'] });
		searchLies(() => WebGL2RenderingContext, { target: ['bufferData', 'getParameter', 'readPixels'] });

		/* potential targets: RTCPeerConnection Plugin PluginArray MimeType MimeTypeArray Worker History */

		// return lies list and detail
		const props = lieDetector.getProps();
		const propsSearched = lieDetector.getPropsSearched();

		return { lieDetector, lieList: Object.keys(props).sort(), lieDetail: props, lieCount: Object.keys(props).reduce((acc, key) => acc + props[key].length, 0), propsSearched };
	}

	// start program
	const start = performance.now();
	const { lieDetector, lieList, lieDetail, propsSearched, } = getPrototypeLies(PHANTOM_DARKNESS); // execute and destructure the list and detail
	// disregard Function.prototype.toString lies when determining if the API can be trusted
	const getNonFunctionToStringLies = (x) => !x ? x : x.filter((x) => !/object toString|toString incompatible proxy/.test(x)).length;

	let lieProps;
	let prototypeLies;

	let PROTO_BENCHMARK = 0;

	if (!IS_WORKER_SCOPE) {
		lieProps = (() => {
			const props = lieDetector.getProps();

			return Object.keys(props).reduce((acc, key) => {
				acc[key] = getNonFunctionToStringLies(props[key]);

				return acc;
			}, {});
		})();

		prototypeLies = JSON.parse(JSON.stringify(lieDetail));

		const perf = performance.now() - start;

		PROTO_BENCHMARK = +perf.toFixed(2);
		`${propsSearched.length} API properties analyzed in ${PROTO_BENCHMARK}ms (${lieList.length} corrupted)`;
		// setTimeout(() => console.log(message), 3000)
	}

	const getPluginLies = (plugins, mimeTypes) => {
		const lies = []; // collect lie types
		const pluginsOwnPropertyNames = Object.getOwnPropertyNames(plugins).filter((name) => isNaN(+name));
				const mimeTypesOwnPropertyNames = Object.getOwnPropertyNames(mimeTypes).filter((name) => isNaN(+name));

				// cast to array
		const pluginsList = [...plugins];
		const mimeTypesList = [...mimeTypes];

		// get initial trusted mimeType names
		const trustedMimeTypes = new Set(mimeTypesOwnPropertyNames);

		// get initial trusted plugin names
		const excludeDuplicates = (arr) => [...new Set(arr)];
		const mimeTypeEnabledPlugins = excludeDuplicates(mimeTypesList.map((mimeType) => mimeType.enabledPlugin));
		const trustedPluginNames = new Set(pluginsOwnPropertyNames);
		const mimeTypeEnabledPluginsNames = mimeTypeEnabledPlugins.map((plugin) => plugin && plugin.name);
		const trustedPluginNamesArray = [...trustedPluginNames];

		trustedPluginNamesArray.forEach((name) => {
			const validName = new Set(mimeTypeEnabledPluginsNames).has(name);

			if (!validName) {
				trustedPluginNames.delete(name);
			}
		});

		// 3. Expect MimeType object in plugins
		const invalidPlugins = pluginsList.filter((plugin) => {
			try {
				const validMimeType = Object.getPrototypeOf(plugin[0]).constructor.name == 'MimeType';

				if (!validMimeType) {
					trustedPluginNames.delete(plugin.name);
				}

				return !validMimeType;
			} catch (error) {
				trustedPluginNames.delete(plugin.name);
				return true; // sign of tampering
			}
		});

		if (invalidPlugins.length) {
			lies.push('missing mimetype');
		}

		// 4. Expect valid MimeType(s) in plugin
		const pluginMimeTypes = pluginsList.map((plugin) => Object.values(plugin)).flat();
		const pluginMimeTypesNames = pluginMimeTypes.map((mimetype) => mimetype.type);

		pluginMimeTypesNames.forEach((name) => {
			const validName = trustedMimeTypes.has(name);

			if (!validName) {
				trustedMimeTypes.delete(name);
			}
		});

		pluginsList.forEach((plugin) => {
			const pluginMimeTypes = Object.values(plugin).map((mimetype) => mimetype.type);

			return pluginMimeTypes.forEach((mimetype) => {
				if (!trustedMimeTypes.has(mimetype)) {
					lies.push('invalid mimetype');

					return trustedPluginNames.delete(plugin.name);
				}

				return;
			});
		});

		return {
			validPlugins: pluginsList.filter((plugin) => trustedPluginNames.has(plugin.name)),
			validMimeTypes: mimeTypesList.filter((mimeType) => trustedMimeTypes.has(mimeType.type)),
			lies: [...new Set(lies)], // remove duplicates
		};
	};

	const getLies = () => {
		const records = lieRecords.getRecords();

		const totalLies = Object.keys(records).reduce((acc, key) => {
			acc += records[key].length;

			return acc;
		}, 0);

		return { data: records, totalLies };
	};

	// Detect proxy behavior
	const proxyBehavior = (x) => typeof x == 'function' ? true : false;

	const GIBBERS = /[cC]f|[jJ][bcdfghlmprsty]|[qQ][bcdfghjklmnpsty]|[vV][bfhjkmpt]|[xX][dkrz]|[yY]y|[zZ][fr]|[cCxXzZ]j|[bBfFgGjJkKpPvVqQtTwWyYzZ]q|[cCfFgGjJpPqQwW]v|[jJqQvV]w|[bBcCdDfFgGhHjJkKmMpPqQsSvVwWxXzZ]x|[bBfFhHjJkKmMpPqQ]z/g;

	// Detect gibberish
	const gibberish = (str, { strict = false } = {}) => {
		if (!str)
			return [];

		// test letter case sequence
		const letterCaseSequenceGibbers = [];
		// a##...B
		const tests = [/([A-Z]{3,}[a-z])/g, /([a-z][A-Z]{3,})/g, /([a-z][A-Z]{2,}[a-z])/g, /([a-z][\d]{2,}[a-z])/g, /([A-Z][\d]{2,}[a-z])/g, /([a-z][\d]{2,}[A-Z])/g];

		tests.forEach((regExp) => {
			const match = str.match(regExp);

			if (match) {
				return letterCaseSequenceGibbers.push(match.join(', '));
			}

			return;
		});

		// test letter sequence
		const letterSequenceGibbers = [];
		const clean = str.replace(/\d|\W|_/g, ' ').replace(/\s+/g, ' ').trim().split(' ').join('_');
		const len = clean.length;
		const arr = [...clean];

		arr.forEach((char, index) => {
			const nextIndex = index + 1;
			const nextChar = arr[nextIndex];
			const isWordSequence = nextChar !== '_' && char !== '_' && nextIndex !== len;

			if (isWordSequence) {
				const combo = char + nextChar;

				if (GIBBERS.test(combo))
					letterSequenceGibbers.push(combo);
			}
		});

		const gibbers = [
			// ignore sequence if less than 3 exist
			...(!strict && (letterSequenceGibbers.length < 3) ? [] : letterSequenceGibbers),
			...(!strict && (letterCaseSequenceGibbers.length < 4) ? [] : letterCaseSequenceGibbers),
		];

		// known gibbers
		const allow = ['bz', 'cf', 'fx', 'mx', 'vb', 'xd', 'gx', 'PCIe', 'vm', 'NVIDIAGa'];

		return gibbers.filter((x) => !allow.includes(x));
	};

	// WebGL Renderer helpers
	function compressWebGLRenderer(x) {
		if (!x)
			return;

		return ('' + x).replace(/ANGLE \(|\sDirect3D.+|\sD3D.+|\svs_.+\)|\((DRM|POLARIS|LLVM).+|Mesa.+|(ATI|INTEL)-.+|Metal\s-\s.+|NVIDIA\s[\d|\.]+/ig, '').replace(/(\s(ti|\d{1,2}GB|super)$)/ig, '').replace(/\s{2,}/g, ' ').trim().replace(/((r|g)(t|)(x|s|\d) |Graphics |GeForce |Radeon (HD |Pro |))(\d+)/i, (...args) => {
			return `${args[1]}${args[6][0]}${args[6].slice(1).replace(/\d/g, '0')}s`;
		});
	}

	const getWebGLRendererParts = (x) => {
		const knownParts = ['AMD', 'ANGLE', 'ASUS', 'ATI', 'ATI Radeon', 'ATI Technologies Inc', 'Adreno', 'Android Emulator', 'Apple', 'Apple GPU', 'Apple M1', 'Chipset', 'D3D11', 'Direct3D', 'Express Chipset', 'GeForce', 'Generation', 'Generic Renderer', 'Google', 'Google SwiftShader', 'Graphics', 'Graphics Media Accelerator', 'HD Graphics Family', 'Intel', 'Intel(R) HD Graphics', 'Intel(R) UHD Graphics', 'Iris', 'KBL Graphics', 'Mali', 'Mesa', 'Mesa DRI', 'Metal', 'Microsoft', 'Microsoft Basic Render Driver', 'Microsoft Corporation', 'NVIDIA', 'NVIDIA Corporation', 'NVIDIAGameReadyD3D', 'OpenGL', 'OpenGL Engine', 'Open Source Technology Center', 'Parallels', 'Parallels Display Adapter', 'PCIe', 'Plus Graphics', 'PowerVR', 'Pro Graphics', 'Quadro', 'Radeon', 'Radeon Pro', 'Radeon Pro Vega', 'Samsung', 'SSE2', 'VMware', 'VMware SVGA 3D', 'Vega', 'VirtualBox', 'VirtualBox Graphics Adapter', 'Vulkan', 'Xe Graphics', 'llvmpipe'];
		const parts = [...knownParts].filter((name) => ('' + x).includes(name));

		return [...new Set(parts)].sort().join(', ');
	};

	const getWebGLRendererConfidence = (x) => {
		if (!x) {
			return;
		}

		const parts = getWebGLRendererParts(x);
		const hasKnownParts = parts.length;
		const hasBlankSpaceNoise = /\s{2,}|^\s|\s$/.test(x);
		const hasBrokenAngleStructure = /^ANGLE/.test(x) && !(/^ANGLE \((.+)\)/.exec(x) || [])[1];
		// https://chromium.googlesource.com/angle/angle/+/83fa18905d8fed4f394e4f30140a83a3e76b1577/src/gpu_info_util/SystemInfo.cpp
		// https://chromium.googlesource.com/angle/angle/+/83fa18905d8fed4f394e4f30140a83a3e76b1577/src/gpu_info_util/SystemInfo.h
		// https://chromium.googlesource.com/chromium/src/+/refs/heads/main/ui/gl/gl_version_info.cc
		/*
		 const knownVendors = [
		 'AMD',
		 'ARM',
		 'Broadcom',
		 'Google',
		 'ImgTec',
		 'Intel',
		 'Kazan',
		 'NVIDIA',
		 'Qualcomm',
		 'VeriSilicon',
		 'Vivante',
		 'VMWare',
		 'Apple',
		 'Unknown'
		 ]
		 const angle = {
		 vendorId: (/^ANGLE \(([^,]+),/.exec(x)||[])[1] || knownVendors.find(vendor => x.includes(vendor)),
		 deviceId: (
		 (x.match(/,/g)||[]).length == 2 ? (/^ANGLE \(([^,]+), ([^,]+)[,|\)]/.exec(x)||[])[2] :
		 (/^ANGLE \(([^,]+), ([^,]+)[,|\)]/.exec(x)||[])[1] || (/^ANGLE \((.+)\)$/.exec(x)||[])[1]
		 ).replace(/\sDirect3D.+/, '')
		 }
		 */
		const gibbers = gibberish(x, { strict: true }).join(', ');
		const valid = (hasKnownParts && !hasBlankSpaceNoise && !hasBrokenAngleStructure);
		const confidence = (valid && !gibbers.length ? 'high' : valid && gibbers.length ? 'moderate' : 'low');
		const grade = (confidence == 'high' ? 'A' : confidence == 'moderate' ? 'C' : 'F');
		const warnings = new Set([(hasBlankSpaceNoise ? 'found extra spaces' : undefined), (hasBrokenAngleStructure ? 'broken angle structure' : undefined)]);
		warnings.delete(undefined);

		return { parts, warnings: [...warnings], gibbers, confidence, grade };
	};

	// Collect trash values
	const createTrashBin = () => {
		const bin = [];
		return {
			getBin: () => bin,
			sendToTrash: (name, val, response = undefined) => {
				const proxyLike = proxyBehavior(val);
				const value = !proxyLike ? val : 'proxy behavior detected';
				bin.push({ name, value });
				return response;
			}
		};
	};

	let trashBin = createTrashBin();

	const { sendToTrash } = trashBin;

	const getTrash = () => ({ trashBin: trashBin.getBin() });

	function isFontOSBad(userAgentOS, fonts) {
		if (!userAgentOS || !fonts || !fonts.length)
			return false;

		const fontMap = fonts.reduce((acc, x) => {
			acc[x] = true;

			return acc;
		}, {});

		const isLikeWindows = ('Cambria Math' in fontMap || 'Nirmala UI' in fontMap || 'Leelawadee UI' in fontMap || 'HoloLens MDL2 Assets' in fontMap || 'Segoe Fluent Icons' in fontMap);
		const isLikeApple = ('Helvetica Neue' in fontMap || 'Luminari' in fontMap || 'PingFang HK Light' in fontMap || 'InaiMathi Bold' in fontMap || 'Galvji' in fontMap || 'Chakra Petch' in fontMap);
		const isLikeLinux = ('Arimo' in fontMap || 'MONO' in fontMap || 'Ubuntu' in fontMap || 'Noto Color Emoji' in fontMap || 'Dancing Script' in fontMap || 'Droid Sans Mono' in fontMap);

		if (isLikeWindows && userAgentOS != "Windows" /* PlatformClassifier.WINDOWS */) {
			return true;
		}

		else if (isLikeApple && userAgentOS != "Apple" /* PlatformClassifier.APPLE */) {
			return true;
		}

		else if (isLikeLinux && userAgentOS != "Linux" /* PlatformClassifier.LINUX */) {
			return true;
		}

		return false;
	}

	// inspired by Lalit Patel's fontdetect.js
	// https://www.lalit.org/wordpress/wp-content/uploads/2008/05/fontdetect.js?ver=0.3

	const WindowsFonts = {
		// https://docs.microsoft.com/en-us/typography/fonts/windows_11_font_list
		'7': ['Cambria Math', 'Lucida Console'],
		'8': ['Aldhabi', 'Gadugi', 'Myanmar Text', 'Nirmala UI'],
		'8.1': ['Leelawadee UI', 'Javanese Text', 'Segoe UI Emoji'],
		'10': ['HoloLens MDL2 Assets', 'Segoe MDL2 Assets', 'Bahnschrift', 'Ink Free'],
		'11': ['Segoe Fluent Icons']
	};

	const MacOSFonts = {
		// Mavericks and below
		'10.9': ['Helvetica Neue', 'Geneva'],
		// Yosemite
		'10.10': ['Kohinoor Devanagari Medium', 'Luminari'],
		// El Capitan
		'10.11': ['PingFang HK Light'],
		// Sierra: https://support.apple.com/en-ie/HT206872
		'10.12': ['American Typewriter Semibold', 'Futura Bold', 'SignPainter-HouseScript Semibold'],
		// High Sierra: https://support.apple.com/en-me/HT207962
		// Mojave: https://support.apple.com/en-us/HT208968
		'10.13-10.14': ['InaiMathi Bold'],
		// Catalina: https://support.apple.com/en-us/HT210192
		// Big Sur: https://support.apple.com/en-sg/HT211240
		'10.15-11': ['Galvji', 'MuktaMahee Regular'],
		// Monterey: https://support.apple.com/en-us/HT212587
		'12': ['Noto Sans Gunjala Gondi Regular', 'Noto Sans Masaram Gondi Regular', 'Noto Serif Yezidi Regular'],
		// Ventura: https://support.apple.com/en-us/HT213266
		'13': ['Apple SD Gothic Neo ExtraBold', 'STIX Two Math Regular', 'STIX Two Text Regular', 'Noto Sans Canadian Aboriginal Regular'],
	};

	const DesktopAppFonts = {
		// docs.microsoft.com/en-us/typography/font-list/ms-outlook
		'Microsoft Outlook': ['MS Outlook'],
		// https://community.adobe.com/t5/postscript-discussions/zwadobef-font/m-p/3730427#M785
		'Adobe Acrobat': ['ZWAdobeF'],
		// https://wiki.documentfoundation.org/Fonts
		'LibreOffice': ['Amiri', 'KACSTOffice', 'Liberation Mono', 'Source Code Pro'],
		// https://superuser.com/a/611804
		'OpenOffice': ['DejaVu Sans', 'Gentium Book Basic', 'OpenSymbol'],
	};

	const APPLE_FONTS = Object.keys(MacOSFonts).map((key) => MacOSFonts[key]).flat();
	const WINDOWS_FONTS = Object.keys(WindowsFonts).map((key) => WindowsFonts[key]).flat();
	const DESKTOP_APP_FONTS = (Object.keys(DesktopAppFonts).map((key) => DesktopAppFonts[key]).flat());
	const LINUX_FONTS = ['Arimo', 'Chilanka', 'Cousine', 'Jomolhari', 'MONO', 'Noto Color Emoji', 'Ubuntu'];
	const ANDROID_FONTS = ['Dancing Script', 'Droid Sans Mono', 'Roboto'];
	const FONT_LIST = [...APPLE_FONTS, ...WINDOWS_FONTS, ...LINUX_FONTS, ...ANDROID_FONTS, ...DESKTOP_APP_FONTS].sort();

	async function getFonts() {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};

		const getPixelEmojis = ({ doc, id, emojis }) => {
			try {
				patch(doc.getElementById(id), html `
					<div id="pixel-emoji-container">
						<style>
							.pixel-emoji {
								font-family: ${CSS_FONT_FAMILY};
								font-size: 200px !important;
								height: auto;
								position: absolute !important;
								transform: scale(1.000999);
							}
						</style>
						${emojis.map((emoji) => {
							return `<div class="pixel-emoji">${emoji}</div>`;
						}).join('')}
					</div>
				`);

				// get emoji set and system
				const getEmojiDimensions = (style) => {
					return { width: style.inlineSize, height: style.blockSize };
				};

				const pattern = new Set();
				const emojiElems = [...doc.getElementsByClassName('pixel-emoji')];

				const emojiSet = emojiElems.reduce((emojiSet, el, i) => {
					const style = getComputedStyle(el);
					const emoji = emojis[i];
					const { height, width } = getEmojiDimensions(style);
					const dimensions = `${width},${height}`;

					if (!pattern.has(dimensions)) {
						pattern.add(dimensions);
						emojiSet.add(emoji);
					}

					return emojiSet;
				}, new Set());

				const pixelToNumber = (pixels) => +(pixels.replace('px', ''));

				const pixelSizeSystemSum = 0.00001 * [...pattern].map((x) => {
					return x.split(',').map((x) => pixelToNumber(x)).reduce((acc, x) => acc += (+x || 0), 0);
				}).reduce((acc, x) => acc += x, 0);

				doc.body.removeChild(doc.getElementById('pixel-emoji-container'));

				return { emojiSet: [...emojiSet], pixelSizeSystemSum };
			} catch (error) {
				console.error(error);

				return { emojiSet: [], pixelSizeSystemSum: 0 };
			}
		};

		const getFontFaceLoadFonts = async (fontList) => {
			try {
				let fontsChecked = [];

				if (!document.fonts.check(`0px "${getRandomValues()}"`)) {
					fontsChecked = fontList.reduce((acc, font) => {
						const found = document.fonts.check(`0px "${font}"`);

						if (found)
							acc.push(font);

						return acc;
					}, []);
				}

				const fontFaceList = fontList.map((font) => new FontFace(font, `local("${font}")`));
				const responseCollection = await Promise.allSettled(fontFaceList.map((font) => font.load()));
				const fontsLoaded = responseCollection.reduce((acc, font) => {
					if (font.status == 'fulfilled') {
						acc.push(font.value.family);
					}

					return acc;
				}, []);

				return [...new Set([...fontsChecked, ...fontsLoaded])].sort();
			} catch (error) {
				console.error(error);
				return [];
			}
		};

		const getPlatformVersion = (fonts) => {
			const getWindows = ({ fonts, fontMap }) => {
				const fontVersion = {
					['11']: fontMap['11'].find((x) => fonts.includes(x)),
					['10']: fontMap['10'].find((x) => fonts.includes(x)),
					['8.1']: fontMap['8.1'].find((x) => fonts.includes(x)),
					['8']: fontMap['8'].find((x) => fonts.includes(x)),
					// require complete set of Windows 7 fonts
					['7']: fontMap['7'].filter((x) => fonts.includes(x)).length == fontMap['7'].length,
				};

				const hash = ('' + Object.keys(fontVersion).sort().filter((key) => !!fontVersion[key]));

				const hashMap = {
					'10,11,7,8,8.1': '11',
					'10,7,8,8.1': '10',
					'7,8,8.1': '8.1',
					'11,7,8,8.1': '8.1',
					'7,8': '8',
					'10,7,8': '8',
					'10,11,7,8': '8',
					'7': '7',
					'7,8.1': '7',
					'10,7,8.1': '7',
					'10,11,7,8.1': '7', // missing 8
				};

				const version = hashMap[hash];

				return version ? `Windows ${version}` : undefined;
			};

			const getMacOS = ({ fonts, fontMap }) => {
				const fontVersion = {
					['13']: fontMap['13'].find((x) => fonts.includes(x)),
					['12']: fontMap['12'].find((x) => fonts.includes(x)),
					['10.15-11']: fontMap['10.15-11'].find((x) => fonts.includes(x)),
					['10.13-10.14']: fontMap['10.13-10.14'].find((x) => fonts.includes(x)),
					['10.12']: fontMap['10.12'].find((x) => fonts.includes(x)),
					['10.11']: fontMap['10.11'].find((x) => fonts.includes(x)),
					['10.10']: fontMap['10.10'].find((x) => fonts.includes(x)),
					// require complete set of 10.9 fonts
					['10.9']: fontMap['10.9'].filter((x) => fonts.includes(x)).length == fontMap['10.9'].length,
				};

				const hash = ('' + Object.keys(fontVersion).sort().filter((key) => !!fontVersion[key]));

				const hashMap = {
					'10.10,10.11,10.12,10.13-10.14,10.15-11,10.9,12,13': 'Ventura',
					'10.10,10.11,10.12,10.13-10.14,10.15-11,10.9,12': 'Monterey',
					'10.10,10.11,10.12,10.13-10.14,10.15-11,10.9': '10.15-11',
					'10.10,10.11,10.12,10.13-10.14,10.9': '10.13-10.14',
					'10.10,10.11,10.12,10.9': 'Sierra',
					'10.10,10.11,10.9': 'El Capitan',
					'10.10,10.9': 'Yosemite',
					'10.9': 'Mavericks', // 10.9
				};

				const version = hashMap[hash];

				return version ? `macOS ${version}` : undefined;
			};

			return (getWindows({ fonts, fontMap: WindowsFonts }) || getMacOS({ fonts, fontMap: MacOSFonts }));
		};

		const getDesktopApps = (fonts) => {
			// @ts-ignore
			const apps = Object.keys(DesktopAppFonts).reduce((acc, key) => {
				const appFontSet = DesktopAppFonts[key];
				const match = appFontSet.filter((x) => fonts.includes(x)).length == appFontSet.length;

				return match ? [...acc, key] : acc;
			}, []);

			return apps;
		};

		try {
			const timer = createTimer();
			await queueEvent(timer);
			const doc = (PHANTOM_DARKNESS && PHANTOM_DARKNESS.document && PHANTOM_DARKNESS.document.body ? PHANTOM_DARKNESS.document : document);
			const id = `font-fingerprint`;
			const div = doc.createElement('div');

			div.setAttribute('id', id);
			doc.body.appendChild(div);

			const { emojiSet, pixelSizeSystemSum, } = getPixelEmojis({ doc, id, emojis: EMOJIS,}) || {};
			const fontList = FONT_LIST;
			const fontFaceLoadFonts = await getFontFaceLoadFonts(fontList);
			const platformVersion = getPlatformVersion(fontFaceLoadFonts);
			const apps = getDesktopApps(fontFaceLoadFonts);

			// detect lies
			const lied = (lieProps['FontFace.load'] || lieProps['FontFace.family'] || lieProps['FontFace.status'] || lieProps['String.fromCodePoint'] || lieProps['CSSStyleDeclaration.setProperty'] || lieProps['CSS2Properties.setProperty']);

			if (isFontOSBad(USER_AGENT_OS, fontFaceLoadFonts)) {
				LowerEntropy.FONTS = true, Analysis.FontOsIsBad = true;
				sendToTrash('platform', `${USER_AGENT_OS} system and fonts are uncommon`);
			}

			logTestResult({ time: timer.stop(), test: 'fonts', passed: true });

			PARENT_PHANTOM.remove();

			return { fontFaceLoadFonts, platformVersion, apps, emojiSet, pixelSizeSystemSum, lied };
		} catch (error) {
			logTestResult({ test: 'fonts', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	let WORKER_TYPE = '';
	let WORKER_NAME = '';

	async function spawnWorker() {
		const ask = (fn) => {
			try {
				return fn();
			} catch (e) {
				return;
			}
		};

		function getWorkerPrototypeLies(scope) {
			const lieDetector = createLieDetector(scope);
			const { searchLies, } = lieDetector;
			searchLies(() => Function, { target: ['toString'], ignore: ['caller', 'arguments'] });
			// @ts-expect-error
			searchLies(() => WorkerNavigator, { target: ['deviceMemory', 'hardwareConcurrency', 'language', 'languages', 'platform', 'userAgent'] });
			// return lies list and detail
			const props = lieDetector.getProps();
			const propsSearched = lieDetector.getPropsSearched();

			return { lieDetector, lieList: Object.keys(props).sort(), lieDetail: props, lieCount: Object.keys(props).reduce((acc, key) => acc + props[key].length, 0), propsSearched };
		}

		const getUserAgentData = async (navigator) => {
			if (!('userAgentData' in navigator)) {
				return;
			}

			const data = await navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'bitness', 'model', 'uaFullVersion']);

			const { brands, mobile } = navigator.userAgentData || {};

			const compressedBrands = (brands, captureVersion = false) => brands.filter((obj) => !/Not/.test(obj.brand)).map((obj) => `${obj.brand}${captureVersion ? ` ${obj.version}` : ''}`);

			const removeChromium = (brands) => (brands.length > 1 ? brands.filter((brand) => !/Chromium/.test(brand)) : brands);

			// compress brands
			if (!data.brands) {
				data.brands = brands;
			}

			data.brandsVersion = compressedBrands(data.brands, true);
			data.brands = compressedBrands(data.brands);
			data.brandsVersion = removeChromium(data.brandsVersion);
			data.brands = removeChromium(data.brands);

			if (!data.mobile) {
				data.mobile = mobile;
			}

			const dataSorted = Object.keys(data).sort().reduce((acc, key) => {
				acc[key] = data[key];
				return acc;
			}, {});

			return dataSorted;
		};

		const getWebglData = () => ask(() => {
			// @ts-ignore
			const canvasOffscreenWebgl = new OffscreenCanvas(256, 256);
			const contextWebgl = canvasOffscreenWebgl.getContext('webgl');
			const rendererInfo = contextWebgl.getExtension('WEBGL_debug_renderer_info');

			return { webglVendor: contextWebgl.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL), webglRenderer: contextWebgl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) };
		});

		const computeTimezoneOffset = () => {
			const date = new Date().getDate();
			const month = new Date().getMonth();
			// @ts-ignore
			const year = Date().split ` `[3]; // current year
			const format = (n) => ('' + n).length == 1 ? `0${n}` : n;
			const dateString = `${month + 1}/${format(date)}/${year}`;
			const dateStringUTC = `${year}-${format(month + 1)}-${format(date)}`;
			// @ts-ignore
			const utc = Date.parse(new Date(dateString));
			const now = +new Date(dateStringUTC);

			return +(((utc - now) / 60000).toFixed(0));
		};

		const getLocale = () => {
			const constructors = ['Collator', 'DateTimeFormat', 'DisplayNames', 'ListFormat', 'NumberFormat', 'PluralRules', 'RelativeTimeFormat'];
			// @ts-ignore
			const locale = constructors.reduce((acc, name) => {
				try {
					const obj = new Intl[name];

					if (!obj) {
						return acc;
					}

					const { locale } = obj.resolvedOptions() || {};

					return [...acc, locale];
				} catch (error) {
					return acc;
				}
			}, []);

			return [...new Set(locale)];
		};

		const getWorkerData = async () => {
			const timer = createTimer();
			await queueEvent(timer);
			const userAgentData = await getUserAgentData(navigator).catch((error) => console.error(error));
			// webgl
			const { webglVendor, webglRenderer } = getWebglData() || {};
			// timezone & locale
			const timezoneOffset = computeTimezoneOffset();
			// eslint-disable-next-line new-cap
			const timezoneLocation = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const locale = getLocale();
			// navigator
			// @ts-expect-error
			const { hardwareConcurrency, language, languages, platform, userAgent, deviceMemory, } = navigator || {};
			// prototype lies
			await queueEvent(timer);

			const {
				// lieDetector: lieProps,
				lieList, lieDetail,
				// lieCount,
				// propsSearched,
			} = getWorkerPrototypeLies(self); // execute and destructure the list and detail
			// const prototypeLies = JSON.parse(JSON.stringify(lieDetail))

			const protoLieLen = lieList.length;
			// match engine locale to system locale to determine if locale entropy is trusty
			let systemCurrencyLocale;

			const lang = ('' + language).split(',')[0];

			try { systemCurrencyLocale = (1).toLocaleString((lang || undefined), {
					style: 'currency',
					currency: 'USD',
					currencyDisplay: 'name',
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}); } catch (e) { }

			const engineCurrencyLocale = (1).toLocaleString(undefined, {
				style: 'currency',
				currency: 'USD',
				currencyDisplay: 'name',
				minimumFractionDigits: 0,
				maximumFractionDigits: 0,
			});
			const localeEntropyIsTrusty = engineCurrencyLocale == systemCurrencyLocale;
			const localeIntlEntropyIsTrusty = new Set(('' + language).split(',')).has('' + locale);

			const { href, pathname } = self.location || {};
			const locationPathNameLie = (!href || !pathname || !new RegExp(`${pathname}$`).test(href));

			return {
				lied: protoLieLen || +locationPathNameLie,
				lies: {
					proto: protoLieLen ? lieDetail : false,
				},
				locale: '' + locale,
				systemCurrencyLocale,
				engineCurrencyLocale,
				localeEntropyIsTrusty,
				localeIntlEntropyIsTrusty,
				timezoneOffset,
				timezoneLocation,
				deviceMemory,
				hardwareConcurrency,
				language,
				languages: '' + languages,
				platform,
				userAgent,
				webglRenderer,
				webglVendor,
				userAgentData,
			};
		};
		// Compute and communicate from worker scope
		const onEvent = (eventType, fn) => addEventListener(eventType, fn);
		const send = (source) => {
			return getWorkerData().then((data) => source.postMessage(data));
		};
		if (IS_WORKER_SCOPE) {
			globalThis.ServiceWorkerGlobalScope ? onEvent('message', (e) => send(e.source)) : globalThis.SharedWorkerGlobalScope ? onEvent('connect', (e) => send(e.ports[0])) : send(self); // DedicatedWorkerGlobalScope
		}
		return IS_WORKER_SCOPE ? 0 /* Scope.WORKER */ : 1 /* Scope.WINDOW */;
	}

	// https://stackoverflow.com/a/22429679
	const hashMini = (x) => {
		const json = `${JSON.stringify(x)}`;
		const hash = json.split('').reduce((hash, char, i) => {
			return Math.imul(31, hash) + json.charCodeAt(i) | 0;
		}, 0x811c9dc5);
		return ('0000000' + (hash >>> 0).toString(16)).substr(-8);
	};

	// instance id
	const instanceId = (String.fromCharCode(Math.random() * 26 + 97) + Math.random().toString(36).slice(-7));

	// https://stackoverflow.com/a/53490958
	// https://stackoverflow.com/a/43383990
	// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
	const hashify = (x, algorithm = 'SHA-256') => {
		const json = `${JSON.stringify(x)}`;
		const jsonBuffer = new TextEncoder().encode(json);
		return crypto.subtle.digest(algorithm, jsonBuffer).then((hashBuffer) => {
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const hashHex = hashArray.map((b) => ('00' + b.toString(16)).slice(-2)).join('');
			return hashHex;
		});
	};

	const AUDIO_TRAP = Math.random();

	async function hasFakeAudio() {
		const context = new OfflineAudioContext(1, 100, 44100);
		const oscillator = context.createOscillator();
		oscillator.frequency.value = 0;
		oscillator.start(0);
		context.startRendering();
		return new Promise((resolve) => {
			context.oncomplete = (event) => {
				const channelData = event.renderedBuffer.getChannelData?.(0);
				if (!channelData)
					resolve(false);
				resolve('' + [...new Set(channelData)] !== '0');
			};
		}).finally(() => oscillator.disconnect());
	}

	async function getOfflineAudioContext() {
		try {
			const timer = createTimer();
			await queueEvent(timer);
			try {
				// @ts-expect-error if unsupported
				window.OfflineAudioContext = OfflineAudioContext || webkitOfflineAudioContext;
			}
			catch (err) { }
			if (!window.OfflineAudioContext) {
				logTestResult({ test: 'audio', passed: false });
				return;
			}
			// detect lies
			const channelDataLie = lieProps['AudioBuffer.getChannelData'];
			const copyFromChannelLie = lieProps['AudioBuffer.copyFromChannel'];
			let lied = (channelDataLie || copyFromChannelLie) || false;
			const bufferLen = 5000;
			const context = new OfflineAudioContext(1, bufferLen, 44100);
			const analyser = context.createAnalyser();
			const oscillator = context.createOscillator();
			const dynamicsCompressor = context.createDynamicsCompressor();
			const biquadFilter = context.createBiquadFilter();
			// detect lie
			const dataArray = new Float32Array(analyser.frequencyBinCount);
			analyser.getFloatFrequencyData?.(dataArray);
			const floatFrequencyUniqueDataSize = new Set(dataArray).size;
			if (floatFrequencyUniqueDataSize > 1) {
				lied = true;
				const floatFrequencyDataLie = `expected -Infinity (silence) and got ${floatFrequencyUniqueDataSize} frequencies`;
				documentLie(`AnalyserNode.getFloatFrequencyData`, floatFrequencyDataLie);
			}
			const values = {
				['AnalyserNode.channelCount']: attempt(() => analyser.channelCount),
				['AnalyserNode.channelCountMode']: attempt(() => analyser.channelCountMode),
				['AnalyserNode.channelInterpretation']: attempt(() => analyser.channelInterpretation),
				['AnalyserNode.context.sampleRate']: attempt(() => analyser.context.sampleRate),
				['AnalyserNode.fftSize']: attempt(() => analyser.fftSize),
				['AnalyserNode.frequencyBinCount']: attempt(() => analyser.frequencyBinCount),
				['AnalyserNode.maxDecibels']: attempt(() => analyser.maxDecibels),
				['AnalyserNode.minDecibels']: attempt(() => analyser.minDecibels),
				['AnalyserNode.numberOfInputs']: attempt(() => analyser.numberOfInputs),
				['AnalyserNode.numberOfOutputs']: attempt(() => analyser.numberOfOutputs),
				['AnalyserNode.smoothingTimeConstant']: attempt(() => analyser.smoothingTimeConstant),
				['AnalyserNode.context.listener.forwardX.maxValue']: attempt(() => {
					return caniuse(() => analyser.context.listener.forwardX.maxValue);
				}),
				['BiquadFilterNode.gain.maxValue']: attempt(() => biquadFilter.gain.maxValue),
				['BiquadFilterNode.frequency.defaultValue']: attempt(() => biquadFilter.frequency.defaultValue),
				['BiquadFilterNode.frequency.maxValue']: attempt(() => biquadFilter.frequency.maxValue),
				['DynamicsCompressorNode.attack.defaultValue']: attempt(() => dynamicsCompressor.attack.defaultValue),
				['DynamicsCompressorNode.knee.defaultValue']: attempt(() => dynamicsCompressor.knee.defaultValue),
				['DynamicsCompressorNode.knee.maxValue']: attempt(() => dynamicsCompressor.knee.maxValue),
				['DynamicsCompressorNode.ratio.defaultValue']: attempt(() => dynamicsCompressor.ratio.defaultValue),
				['DynamicsCompressorNode.ratio.maxValue']: attempt(() => dynamicsCompressor.ratio.maxValue),
				['DynamicsCompressorNode.release.defaultValue']: attempt(() => dynamicsCompressor.release.defaultValue),
				['DynamicsCompressorNode.release.maxValue']: attempt(() => dynamicsCompressor.release.maxValue),
				['DynamicsCompressorNode.threshold.defaultValue']: attempt(() => dynamicsCompressor.threshold.defaultValue),
				['DynamicsCompressorNode.threshold.minValue']: attempt(() => dynamicsCompressor.threshold.minValue),
				['OscillatorNode.detune.maxValue']: attempt(() => oscillator.detune.maxValue),
				['OscillatorNode.detune.minValue']: attempt(() => oscillator.detune.minValue),
				['OscillatorNode.frequency.defaultValue']: attempt(() => oscillator.frequency.defaultValue),
				['OscillatorNode.frequency.maxValue']: attempt(() => oscillator.frequency.maxValue),
				['OscillatorNode.frequency.minValue']: attempt(() => oscillator.frequency.minValue),
			};
			const getRenderedBuffer = (context) => (new Promise((resolve) => {
				const analyser = context.createAnalyser();
				const oscillator = context.createOscillator();
				const dynamicsCompressor = context.createDynamicsCompressor();
				try {
					oscillator.type = 'triangle';
					oscillator.frequency.value = 10000;
					dynamicsCompressor.threshold.value = -50;
					dynamicsCompressor.knee.value = 40;
					dynamicsCompressor.attack.value = 0;
				}
				catch (err) { }
				oscillator.connect(dynamicsCompressor);
				dynamicsCompressor.connect(analyser);
				dynamicsCompressor.connect(context.destination);
				oscillator.start(0);
				context.startRendering();
				return context.addEventListener('complete', (event) => {
					try {
						dynamicsCompressor.disconnect();
						oscillator.disconnect();
						const floatFrequencyData = new Float32Array(analyser.frequencyBinCount);
						analyser.getFloatFrequencyData?.(floatFrequencyData);
						const floatTimeDomainData = new Float32Array(analyser.fftSize);
						if ('getFloatTimeDomainData' in analyser) {
							analyser.getFloatTimeDomainData(floatTimeDomainData);
						}
						return resolve({
							floatFrequencyData,
							floatTimeDomainData,
							buffer: event.renderedBuffer,
							compressorGainReduction: (
								// @ts-expect-error if unsupported
								dynamicsCompressor.reduction.value || // webkit
								dynamicsCompressor.reduction),
						});
					}
					catch (error) {
						return resolve(null);
					}
				});
			}));
			await queueEvent(timer);
			const [audioData, audioIsFake,] = await Promise.all([
				getRenderedBuffer(new OfflineAudioContext(1, bufferLen, 44100)),
				hasFakeAudio().catch(() => false),
			]);
			const { floatFrequencyData, floatTimeDomainData, buffer, compressorGainReduction, } = audioData || {};
			await queueEvent(timer);
			const getSnapshot = (arr, start, end) => {
				const collection = [];
				for (let i = start; i < end; i++) {
					collection.push(arr[i]);
				}
				return collection;
			};
			const getSum = (arr) => !arr ? 0 : [...arr]
				.reduce((acc, curr) => (acc += Math.abs(curr)), 0);
			const floatFrequencyDataSum = getSum(floatFrequencyData);
			const floatTimeDomainDataSum = getSum(floatTimeDomainData);
			const copy = new Float32Array(bufferLen);
			let bins = new Float32Array();
			if (buffer) {
				buffer.copyFromChannel?.(copy, 0);
				bins = buffer.getChannelData?.(0) || [];
			}
			const copySample = getSnapshot([...copy], 4500, 4600);
			const binsSample = getSnapshot([...bins], 4500, 4600);
			const sampleSum = getSum(getSnapshot([...bins], 4500, bufferLen));
			// detect lies
			if (audioIsFake) {
				lied = true;
				documentLie('AudioBuffer', 'audio is fake');
			}
			// sample matching
			const matching = '' + binsSample == '' + copySample;
			const copyFromChannelSupported = ('copyFromChannel' in AudioBuffer.prototype);
			if (copyFromChannelSupported && !matching) {
				lied = true;
				const audioSampleLie = 'getChannelData and copyFromChannel samples mismatch';
				documentLie('AudioBuffer', audioSampleLie);
			}
			// sample uniqueness
			const totalUniqueSamples = new Set([...bins]).size;
			if (totalUniqueSamples == bufferLen) {
				const audioUniquenessTrash = `${totalUniqueSamples} unique samples of ${bufferLen} is too high`;
				sendToTrash('AudioBuffer', audioUniquenessTrash);
			}
			// sample noise factor
			const getRandFromRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
			const getCopyFrom = (rand, buffer, copy) => {
				const { length } = buffer;
				const max = 20;
				const start = getRandFromRange(275, length - (max + 1));
				const mid = start + max / 2;
				const end = start + max;
				buffer.getChannelData(0)[start] = rand;
				buffer.getChannelData(0)[mid] = rand;
				buffer.getChannelData(0)[end] = rand;
				buffer.copyFromChannel(copy, 0);
				const attack = [
					buffer.getChannelData(0)[start] === 0 ? Math.random() : 0,
					buffer.getChannelData(0)[mid] === 0 ? Math.random() : 0,
					buffer.getChannelData(0)[end] === 0 ? Math.random() : 0,
				];
				return [...new Set([...buffer.getChannelData(0), ...copy, ...attack])].filter((x) => x !== 0);
			};
			const getCopyTo = (rand, buffer, copy) => {
				buffer.copyToChannel(copy.map(() => rand), 0);
				const frequency = buffer.getChannelData(0)[0];
				const dataAttacked = [...buffer.getChannelData(0)]
					.map((x) => x !== frequency || !x ? Math.random() : x);
				return dataAttacked.filter((x) => x !== frequency);
			};
			const getNoiseFactor = () => {
				const length = 2000;
				try {
					const result = [...new Set([
						...getCopyFrom(AUDIO_TRAP, new AudioBuffer({ length, sampleRate: 44100 }), new Float32Array(length)),
						...getCopyTo(AUDIO_TRAP, new AudioBuffer({ length, sampleRate: 44100 }), new Float32Array(length)),
					])];
					return +(result.length !== 1 &&
						result.reduce((acc, n) => acc += +n, 0));
				}
				catch (error) {
					console.error(error);
					return 0;
				}
			};
			const noiseFactor = getNoiseFactor();
			const noise = (noiseFactor || [...new Set(bins.slice(0, 100))]
				.reduce((acc, n) => acc += n, 0));
			// Locked Patterns
			const known = {
				/* BLINK */
				// 124.04347527516074/124.04347518575378
				'-20.538286209106445,164537.64796829224,502.5999283068122': [124.04347527516074],
				'-20.538288116455078,164537.64796829224,502.5999283068122': [124.04347527516074],
				'-20.538288116455078,164537.64795303345,502.5999283068122': [
					124.04347527516074,
					124.04347518575378,
					// sus:
					124.04347519320436,
					124.04347523045726,
				],
				'-20.538286209106445,164537.64805984497,502.5999283068122': [124.04347527516074],
				'-20.538288116455078,164537.64805984497,502.5999283068122': [
					124.04347527516074,
					124.04347518575378,
					// sus
					124.04347520065494,
					124.04347523790784,
					124.043475252809,
					124.04347526025958,
					124.04347522300668,
					124.04347523045726,
					124.04347524535842,
				],
				// 124.04344884395687
				'-20.538288116455078,164881.9727935791,502.59990317908887': [124.04344884395687],
				'-20.538288116455078,164881.9729309082,502.59990317908887': [124.04344884395687],
				// 124.0434488439787
				'-20.538286209106445,164882.2082748413,502.59990317911434': [124.0434488439787],
				'-20.538288116455078,164882.20836639404,502.59990317911434': [124.0434488439787],
				// 124.04344968475198
				'-20.538286209106445,164863.45319366455,502.5999033495791': [124.04344968475198],
				'-20.538288116455078,164863.45319366455,502.5999033495791': [
					124.04344968475198,
					124.04375314689969,
					// sus
					124.04341541208123,
				],
				// 124.04347503720783 (rare)
				'-20.538288116455078,164531.82670593262,502.59992767886797': [
					124.04347503720783,
					// sus
					124.04347494780086,
					124.04347495525144,
					124.04347499250434,
					124.0434750074055,
				],
				// 124.04347657808103
				'-20.538286209106445,164540.1567993164,502.59992209258417': [124.04347657808103],
				'-20.538288116455078,164540.1567993164,502.59992209258417': [
					124.04347657808103,
					124.0434765110258,
					124.04347656317987,
					// sus
					124.04347657063045,
					124.04378004022874,
				],
				'-20.538288116455078,164540.1580810547,502.59992209258417': [124.04347657808103],
				// 124.080722568091/124.04347730590962 (rare)
				'-20.535268783569336,164940.360786438,502.69695458233764': [124.080722568091],
				'-20.538288116455078,164538.55073928833,502.5999307175407': [124.04347730590962],
				// Android/Linux
				'-20.535268783569336,164948.14596557617,502.6969545823631': [124.08072256811283],
				'-20.535268783569336,164926.65912628174,502.6969610930064': [124.08072766105033],
				'-20.535268783569336,164932.96168518066,502.69696179985476': [124.08072787802666],
				'-20.535268783569336,164931.54252624512,502.6969617998802': [124.08072787804849],
				'-20.535268783569336,164591.9659729004,502.6969925059784': [124.08074500028306],
				'-20.535268783569336,164590.4111480713,502.6969947774742': [124.0807470110085],
				'-20.535268783569336,164590.41115570068,502.6969947774742': [124.0807470110085],
				'-20.535268783569336,164593.64263916016,502.69700490119067': [124.08075528279005],
				'-20.535268783569336,164595.0285797119,502.69700578315314': [124.08075643483608],
				// sus
				'-20.538288116455078,164860.96576690674,502.6075748118915': [124.0434496279413],
				'-20.538288116455078,164860.9938583374,502.6073723861407': [124.04344962817413],
				'-20.538288116455078,164862.14078521729,502.59991004130643': [124.04345734833623],
				'-20.538288116455078,164534.50047683716,502.61542110471055': [124.04347520368174],
				'-20.538288116455078,164535.1324043274,502.6079200572931': [124.04347521997988],
				'-20.538288116455078,164535.51135635376,502.60633126448374': [124.04347522952594],
				/* GECKO */
				'-31.509262084960938,167722.6894454956,148.42717787250876': [35.7383295930922],
				'-31.509262084960938,167728.72756958008,148.427184343338': [35.73833402246237],
				'-31.50218963623047,167721.27517700195,148.47537828609347': [35.74996031448245],
				'-31.502185821533203,167727.52931976318,148.47542023658752': [35.7499681673944],
				'-31.502185821533203,167700.7530517578,148.475412953645': [35.749968223273754],
				'-31.502187728881836,167697.23177337646,148.47541113197803': [35.74996626004577],
				/* WEBKIT */
				'-20.538288116455078,164873.80361557007,502.59989904452596': [124.0434485301812],
				'-20.538288116455078,164863.47760391235,502.5999033453372': [124.0434496849557],
				'-20.538288116455078,164876.62466049194,502.5998911961724': [124.043453265891],
				'-20.538288116455078,164862.14879989624,502.59991004130643': [124.04345734833623],
				'-20.538288116455078,164896.54167175293,502.5999054916465': [124.04345808873768],
				'-29.837873458862305,163206.43050384521,0': [35.10892717540264],
				'-29.837873458862305,163224.69785308838,0': [35.10892752557993],
				'-29.83786964416504,163209.17245483398,0': [35.10893232002854],
				'-29.83786964416504,163202.77336883545,0': [35.10893253237009],
			};
			if (noise) {
				lied = true;
				documentLie('AudioBuffer', 'sample noise detected');
			}
			const pattern = '' + [
				compressorGainReduction,
				floatFrequencyDataSum,
				floatTimeDomainDataSum,
			];
			const knownPattern = known[pattern];
			if (knownPattern && !knownPattern.includes(sampleSum)) {
				LowerEntropy.AUDIO = true;
				sendToTrash('AudioBuffer', 'suspicious frequency data');
			}
			logTestResult({ time: timer.stop(), test: 'audio', passed: true });
			return {
				totalUniqueSamples,
				compressorGainReduction,
				floatFrequencyDataSum,
				floatTimeDomainDataSum,
				sampleSum,
				binsSample,
				copySample: copyFromChannelSupported ? copySample : [undefined],
				values,
				noise,
				lied,
			};
		}
		catch (error) {
			logTestResult({ test: 'audio', passed: false });
			captureError(error, 'OfflineAudioContext failed or blocked by client');
			return;
		}
	}

	// inspired by https://arkenfox.github.io/TZP/tests/canvasnoise.html
	let pixelImageRandom = '';

	const getPixelMods = () => {
		const pattern1 = [];
		const pattern2 = [];
		const len = 8; // canvas dimensions
		const alpha = 255;
		const visualMultiplier = 5;

		try {
			// create 2 canvas contexts
			const options = { willReadFrequently: true, desynchronized: true };
			const canvasDisplay1 = document.createElement('canvas');
			const canvasDisplay2 = document.createElement('canvas');
			const canvas1 = document.createElement('canvas');
			const canvas2 = document.createElement('canvas');
			const contextDisplay1 = canvasDisplay1.getContext('2d', options);
			const contextDisplay2 = canvasDisplay2.getContext('2d', options);
			const context1 = canvas1.getContext('2d', options);
			const context2 = canvas2.getContext('2d', options);

			if (!contextDisplay1 || !contextDisplay2 || !context1 || !context2) {
				throw new Error('canvas context blocked');
			}

			// set the dimensions
			canvasDisplay1.width = len * visualMultiplier;
			canvasDisplay1.height = len * visualMultiplier;
			canvasDisplay2.width = len * visualMultiplier;
			canvasDisplay2.height = len * visualMultiplier;
			canvas1.width = len;
			canvas1.height = len;
			canvas2.width = len;
			canvas2.height = len;

			[...Array(len)].forEach((e, x) => [...Array(len)].forEach((e, y) => {
				const red = ~~(Math.random() * 256);
				const green = ~~(Math.random() * 256);
				const blue = ~~(Math.random() * 256);
				const colors = `${red}, ${green}, ${blue}, ${alpha}`;
				context1.fillStyle = `rgba(${colors})`;
				context1.fillRect(x, y, 1, 1);
				// capture data in visuals
				contextDisplay1.fillStyle = `rgba(${colors})`;
				contextDisplay1.fillRect(x * visualMultiplier, y * visualMultiplier, 1 * visualMultiplier, 1 * visualMultiplier);
				return pattern1.push(colors); // collect the pixel pattern
			}));

			[...Array(len)].forEach((e, x) => [...Array(len)].forEach((e, y) => {
				// get context1 pixel data and mirror to context2
				const { data: [red, green, blue, alpha], } = context1.getImageData(x, y, 1, 1) || {};
				const colors = `${red}, ${green}, ${blue}, ${alpha}`;
				context2.fillStyle = `rgba(${colors})`;
				context2.fillRect(x, y, 1, 1);
				// capture noise in visuals
				const { data: [red2, green2, blue2, alpha2], } = context2.getImageData(x, y, 1, 1) || {};
				const colorsDisplay = `
				${red != red2 ? red2 : 255},
				${green != green2 ? green2 : 255},
				${blue != blue2 ? blue2 : 255},
				${alpha != alpha2 ? alpha2 : 1}
			`;
				contextDisplay2.fillStyle = `rgba(${colorsDisplay})`;
				contextDisplay2.fillRect(x * visualMultiplier, y * visualMultiplier, 1 * visualMultiplier, 1 * visualMultiplier);
				return pattern2.push(colors); // collect the pixel pattern
			}));

			// compare the pattern collections and collect diffs
			const patternDiffs = [];
			const rgbaChannels = new Set();

			[...Array(pattern1.length)].forEach((e, i) => {
				const pixelColor1 = pattern1[i];
				const pixelColor2 = pattern2[i];

				if (pixelColor1 != pixelColor2) {
					const rgbaValues1 = pixelColor1.split(',');
					const rgbaValues2 = pixelColor2.split(',');
					const colors = [
						rgbaValues1[0] != rgbaValues2[0] ? 'r' : '',
						rgbaValues1[1] != rgbaValues2[1] ? 'g' : '',
						rgbaValues1[2] != rgbaValues2[2] ? 'b' : '',
						rgbaValues1[3] != rgbaValues2[3] ? 'a' : '',
					].join('');
					rgbaChannels.add(colors);
					patternDiffs.push([i, colors]);
				}
			});
			pixelImageRandom = canvasDisplay1.toDataURL(); // template use only
			const pixelImage = canvasDisplay2.toDataURL();
			const rgba = rgbaChannels.size ? [...rgbaChannels].sort().join(', ') : undefined;
			const pixels = patternDiffs.length || undefined;

			return { rgba, pixels, pixelImage };
		} catch (error) {
			return console.error(error);
		}
	};

	// based on and inspired by https://github.com/antoinevastel/picasso-like-canvas-fingerprinting
	const paintCanvas = ({ canvas, context, strokeText = false, cssFontFamily = '', area = { width: 50, height: 50 }, rounds = 10, maxShadowBlur = 50, seed = 500, offset = 2001000001, multiplier = 15000, }) => {
		if (!context) {
			return;
		}
		context.clearRect(0, 0, canvas.width, canvas.height);
		canvas.width = area.width;
		canvas.height = area.height;
		if (canvas.style) {
			canvas.style.display = 'none';
		}
		const createPicassoSeed = ({ seed, offset, multiplier }) => {
			let current = Number(seed) % Number(offset);
			const getNextSeed = () => {
				current = (Number(multiplier) * current) % Number(offset);
				return current;
			};
			return {
				getNextSeed,
			};
		};
		const picassoSeed = createPicassoSeed({ seed, offset, multiplier });
		const { getNextSeed } = picassoSeed;
		const patchSeed = (current, offset, maxBound, computeFloat) => {
			const result = (((current - 1) / offset) * (maxBound || 1)) || 0;
			return computeFloat ? result : Math.floor(result);
		};
		const addRandomCanvasGradient = (context, offset, area, colors, getNextSeed) => {
			const { width, height } = area;
			const canvasGradient = context.createRadialGradient(patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height), patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height), patchSeed(getNextSeed(), offset, width));
			canvasGradient.addColorStop(0, colors[patchSeed(getNextSeed(), offset, colors.length)]);
			canvasGradient.addColorStop(1, colors[patchSeed(getNextSeed(), offset, colors.length)]);
			context.fillStyle = canvasGradient;
		};
		const colors = [
			'#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6',
			'#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
			'#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A',
			'#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
			'#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC',
			'#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
			'#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680',
			'#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
			'#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3',
			'#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF',
		];
		const drawOutlineOfText = (context, offset, area, getNextSeed) => {
			const { width, height } = area;
			const fontSize = 2.99;
			context.font = `${height / fontSize}px ${cssFontFamily.replace(/!important/gm, '')}`;
			context.strokeText('👾A', patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height), patchSeed(getNextSeed(), offset, width));
		};
		const createCircularArc = (context, offset, area, getNextSeed) => {
			const { width, height } = area;
			context.beginPath();
			context.arc(patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height), patchSeed(getNextSeed(), offset, Math.min(width, height)), patchSeed(getNextSeed(), offset, 2 * Math.PI, true), patchSeed(getNextSeed(), offset, 2 * Math.PI, true));
			context.stroke();
		};
		const createBezierCurve = (context, offset, area, getNextSeed) => {
			const { width, height } = area;
			context.beginPath();
			context.moveTo(patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height));
			context.bezierCurveTo(patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height), patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height), patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height));
			context.stroke();
		};
		const createQuadraticCurve = (context, offset, area, getNextSeed) => {
			const { width, height } = area;
			context.beginPath();
			context.moveTo(patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height));
			context.quadraticCurveTo(patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height), patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height));
			context.stroke();
		};
		const createEllipticalArc = (context, offset, area, getNextSeed) => {
			if (!('ellipse' in context)) {
				return;
			}
			const { width, height } = area;
			context.beginPath();
			context.ellipse(patchSeed(getNextSeed(), offset, width), patchSeed(getNextSeed(), offset, height), patchSeed(getNextSeed(), offset, Math.floor(width / 2)), patchSeed(getNextSeed(), offset, Math.floor(height / 2)), patchSeed(getNextSeed(), offset, 2 * Math.PI, true), patchSeed(getNextSeed(), offset, 2 * Math.PI, true), patchSeed(getNextSeed(), offset, 2 * Math.PI, true));
			context.stroke();
		};
		const methods = [
			createCircularArc,
			createBezierCurve,
			createQuadraticCurve,
		];
		if (!IS_WEBKIT)
			methods.push(createEllipticalArc); // unstable in webkit
		if (strokeText)
			methods.push(drawOutlineOfText);
		[...Array(rounds)].forEach((x) => {
			addRandomCanvasGradient(context, offset, area, colors, getNextSeed);
			context.shadowBlur = patchSeed(getNextSeed(), offset, maxShadowBlur, true);
			context.shadowColor = colors[patchSeed(getNextSeed(), offset, colors.length)];
			const nextMethod = methods[patchSeed(getNextSeed(), offset, methods.length)];
			nextMethod(context, offset, area, getNextSeed);
			context.fill();
		});
		return;
	};

	async function getCanvas2d() {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};

		try {
			const timer = createTimer();
			await queueEvent(timer);
			const dataLie = lieProps['HTMLCanvasElement.toDataURL'];
			const contextLie = lieProps['HTMLCanvasElement.getContext'];
			const imageDataLie = (lieProps['CanvasRenderingContext2D.fillText'] || lieProps['CanvasRenderingContext2D.font'] || lieProps['CanvasRenderingContext2D.getImageData'] || lieProps['CanvasRenderingContext2D.strokeText']);
			const codePointLie = lieProps['String.fromCodePoint'];
			let textMetricsLie = (lieProps['CanvasRenderingContext2D.measureText'] || lieProps['TextMetrics.actualBoundingBoxAscent'] || lieProps['TextMetrics.actualBoundingBoxDescent'] || lieProps['TextMetrics.actualBoundingBoxLeft'] || lieProps['TextMetrics.actualBoundingBoxRight'] || lieProps['TextMetrics.fontBoundingBoxAscent'] || lieProps['TextMetrics.fontBoundingBoxDescent'] || lieProps['TextMetrics.width']);
			let lied = (dataLie || contextLie || imageDataLie || textMetricsLie || codePointLie) || false;
			// create canvas context
			let win = window;

			if (!LIKE_BRAVE && PHANTOM_DARKNESS) {
				win = PHANTOM_DARKNESS;
			}

			const doc = win.document;
			const canvas = doc.createElement('canvas');
			const context = canvas.getContext('2d');
			const canvasCPU = doc.createElement('canvas');
			const contextCPU = canvasCPU.getContext('2d', { desynchronized: true, willReadFrequently: true });

			if (!context) {
				throw new Error('canvas context blocked');
			}

			await queueEvent(timer);
			const imageSizeMax = IS_WEBKIT ? 50 : 75; // webkit is unstable
			paintCanvas({ canvas, context, strokeText: true, cssFontFamily: CSS_FONT_FAMILY, area: { width: imageSizeMax, height: imageSizeMax }, rounds: 10 });
			const dataURI = canvas.toDataURL();
			await queueEvent(timer);
			const mods = getPixelMods();
			// TextMetrics: get emoji set and system
			await queueEvent(timer);
			context.font = `10px ${CSS_FONT_FAMILY.replace(/!important/gm, '')}`;
			const pattern = new Set();

			const emojiSet = EMOJIS.reduce((emojiSet, emoji) => {
				const { actualBoundingBoxAscent, actualBoundingBoxDescent, actualBoundingBoxLeft, actualBoundingBoxRight, fontBoundingBoxAscent, fontBoundingBoxDescent, width, } = context.measureText(emoji) || {};
				const dimensions = [actualBoundingBoxAscent, actualBoundingBoxDescent, actualBoundingBoxLeft, actualBoundingBoxRight, fontBoundingBoxAscent, fontBoundingBoxDescent, width].join(',');

				if (!pattern.has(dimensions)) {
					pattern.add(dimensions);
					emojiSet.add(emoji);
				}

				return emojiSet;
			}, new Set());

			// textMetrics System Sum
			const textMetricsSystemSum = 0.00001 * [...pattern].map((x) => {
				return x.split(',').reduce((acc, x) => acc += (+x || 0), 0);
			}).reduce((acc, x) => acc += x, 0);

			// Paint
			const maxSize = 75;
			await queueEvent(timer);
			paintCanvas({ canvas, context, area: { width: maxSize, height: maxSize } }); // clears image
			const paintURI = canvas.toDataURL();
			// Paint with CPU
			await queueEvent(timer);
			paintCanvas({ canvas: canvasCPU, context: contextCPU, area: { width: maxSize, height: maxSize } }); // clears image
			const paintCpuURI = canvasCPU.toDataURL();
			// Text
			context.restore();
			context.clearRect(0, 0, canvas.width, canvas.height);
			canvas.width = 50;
			canvas.height = 50;
			context.font = `50px ${CSS_FONT_FAMILY.replace(/!important/gm, '')}`;
			context.fillText('A', 7, 37);
			const textURI = canvas.toDataURL();
			// Emoji
			context.restore();
			context.clearRect(0, 0, canvas.width, canvas.height);
			canvas.width = 50;
			canvas.height = 50;
			context.font = `35px ${CSS_FONT_FAMILY.replace(/!important/gm, '')}`;
			context.fillText('👾', 0, 37);
			const emojiURI = canvas.toDataURL();
			// lies
			context.clearRect(0, 0, canvas.width, canvas.height);

			if ((mods && mods.pixels) || !!Math.max(...context.getImageData(0, 0, 8, 8).data)) {
				lied = true;
				documentLie(`CanvasRenderingContext2D.getImageData`, `pixel data modified`);
			}

			// verify low entropy image data
			canvas.width = 2;
			canvas.height = 2;
			context.fillStyle = '#000';
			context.fillRect(0, 0, canvas.width, canvas.height);
			context.fillStyle = '#fff';
			context.fillRect(2, 2, 1, 1);
			context.beginPath();
			context.arc(0, 0, 2, 0, 1, true);
			context.closePath();
			context.fill();

			const imageDataLowEntropy = context.getImageData(0, 0, 2, 2).data.join('');

			const KnownImageData = { BLINK: ['255255255255178178178255246246246255555555255', '255255255255192192192255240240240255484848255', '255255255255177177177255246246246255535353255', '255255255255128128128255191191191255646464255', '255255255255178178178255247247247255565656255', '255255255255174174174255242242242255474747255', '255255255255229229229255127127127255686868255', '255255255255192192192255244244244255535353255'], GECKO: ['255255255255191191191255207207207255646464255', '255255255255192192192255240240240255484848255', '255255255255191191191255239239239255646464255', '255255255255191191191255223223223255606060255', '255255255255171171171255223223223255606060255', '255255255255188188188255245245245255525252255'], WEBKIT: ['255255255255185185185255233233233255474747255', '255255255255185185185255229229229255474747255', '255255255255185185185255218218218255474747255', '255255255255192192192255240240240255484848255', '255255255255178178178255247247247255565656255', '255255255255178178178255247247247255565656255', '255255255255192192192255240240240255484848255', '255255255255186186186255218218218255464646255'] };

			Analysis.imageDataLowEntropy = imageDataLowEntropy;

			if (IS_BLINK && !KnownImageData.BLINK.includes(imageDataLowEntropy)) {
				LowerEntropy.CANVAS = true;
			} else if (IS_GECKO && !KnownImageData.GECKO.includes(imageDataLowEntropy)) {
				LowerEntropy.CANVAS = true;
			} else if (IS_WEBKIT && !KnownImageData.WEBKIT.includes(imageDataLowEntropy)) {
				LowerEntropy.CANVAS = true;
			}

			if (LowerEntropy.CANVAS) {
				sendToTrash('CanvasRenderingContext2D.getImageData', 'suspicious pixel data');
			}

			const getTextMetricsFloatLie = (context) => {
				const isFloat = (n) => n % 1 !== 0;
				const { actualBoundingBoxAscent: abba, actualBoundingBoxDescent: abbd, actualBoundingBoxLeft: abbl, actualBoundingBoxRight: abbr, fontBoundingBoxAscent: fbba, fontBoundingBoxDescent: fbbd, /*width: w,*/} = context.measureText('') || {};
				const lied = [abba, abbd, abbl, abbr, fbba, fbbd].find((x) => isFloat((x || 0)));

				return lied;
			};

			await queueEvent(timer);

			if (getTextMetricsFloatLie(context)) {
				textMetricsLie = true;
				lied = true;
				documentLie('CanvasRenderingContext2D.measureText', 'metric noise detected');
			}

			logTestResult({ time: timer.stop(), test: 'canvas 2d', passed: true });

			PARENT_PHANTOM.remove();

			return { dataURI, paintURI, paintCpuURI, textURI, emojiURI, mods, textMetricsSystemSum, liedTextMetrics: textMetricsLie, emojiSet: [...emojiSet], lied };
		} catch (error) {
			logTestResult({ test: 'canvas 2d', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	function getCSS() {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};

		const computeStyle = (type, { require: [captureError] }) => {
			try {
				// get CSSStyleDeclaration
				// @ts-ignore
				const cssStyleDeclaration = (type == 'getComputedStyle' ? getComputedStyle(document.body) : type == 'HTMLElement.style' ? document.body.style : type == 'CSSRuleList.style' ? document.styleSheets[0].cssRules[0].style : undefined);

				if (!cssStyleDeclaration) {
					throw new TypeError('invalid argument string');
				}

				// get properties
				const proto = Object.getPrototypeOf(cssStyleDeclaration);
				const prototypeProperties = Object.getOwnPropertyNames(proto);
				const ownEnumerablePropertyNames = [];
				const cssVar = /^--.*$/;

				Object.keys(cssStyleDeclaration).forEach((key) => {
					const numericKey = !isNaN(+key);
					const value = cssStyleDeclaration[key];
					const customPropKey = cssVar.test(key);
					const customPropValue = cssVar.test(value);

					if (numericKey && !customPropValue) {
						return ownEnumerablePropertyNames.push(value);
					} else if (!numericKey && !customPropKey) {
						return ownEnumerablePropertyNames.push(key);
					}

					return;
				});

				// get properties in prototype chain (required only in chrome)
				const propertiesInPrototypeChain = {};
				const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
				const uncapitalize = (str) => str.charAt(0).toLowerCase() + str.slice(1);
				const removeFirstChar = (str) => str.slice(1);
				const caps = /[A-Z]/g;

				ownEnumerablePropertyNames.forEach((key) => {
					if (propertiesInPrototypeChain[key]) {
						return;
					}

					// determine attribute type
					const isNamedAttribute = key.indexOf('-') > -1;
					const isAliasAttribute = caps.test(key);
					// reduce key for computation
					const firstChar = key.charAt(0);
					const isPrefixedName = isNamedAttribute && firstChar == '-';
					const isCapitalizedAlias = isAliasAttribute && firstChar == firstChar.toUpperCase();
					key = (isPrefixedName ? removeFirstChar(key) : isCapitalizedAlias ? uncapitalize(key) : key);
					// find counterpart in CSSStyleDeclaration object or its prototype chain

					if (isNamedAttribute) {
						const aliasAttribute = key.split('-').map((word, index) => index == 0 ? word : capitalize(word)).join('');

						if (aliasAttribute in cssStyleDeclaration) {
							propertiesInPrototypeChain[aliasAttribute] = true;
						} else if (capitalize(aliasAttribute) in cssStyleDeclaration) {
							propertiesInPrototypeChain[capitalize(aliasAttribute)] = true;
						}
					}
					else if (isAliasAttribute) {
						const namedAttribute = key.replace(caps, (char) => '-' + char.toLowerCase());

						if (namedAttribute in cssStyleDeclaration) {
							propertiesInPrototypeChain[namedAttribute] = true;
						} else if (`-${namedAttribute}` in cssStyleDeclaration) {
							propertiesInPrototypeChain[`-${namedAttribute}`] = true;
						}
					}

					return;
				});

				// compile keys
				const keys = [...new Set([...prototypeProperties, ...ownEnumerablePropertyNames, ...Object.keys(propertiesInPrototypeChain)])];
				// @ts-ignore
				const interfaceName = ('' + proto).match(/\[object (.+)\]/)[1];

				return { keys, interfaceName };
			} catch (error) {
				captureError(error);

				return;
			}
		};

		const getSystemStyles = (el) => {
			try {
				const colors = ['ActiveBorder', 'ActiveCaption', 'ActiveText', 'AppWorkspace', 'Background', 'ButtonBorder', 'ButtonFace', 'ButtonHighlight', 'ButtonShadow', 'ButtonText', 'Canvas', 'CanvasText', 'CaptionText', 'Field', 'FieldText', 'GrayText', 'Highlight', 'HighlightText', 'InactiveBorder', 'InactiveCaption', 'InactiveCaptionText', 'InfoBackground', 'InfoText', 'LinkText', 'Mark', 'MarkText', 'Menu', 'MenuText', 'Scrollbar', 'ThreeDDarkShadow', 'ThreeDFace', 'ThreeDHighlight', 'ThreeDLightShadow', 'ThreeDShadow', 'VisitedText', 'Window', 'WindowFrame', 'WindowText'];
				const fonts = ['caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar'];

				const getStyles = (el) => ({
					colors: colors.map((color) => {
						el.setAttribute('style', `background-color: ${color} !important`);

						return { [color]: getComputedStyle(el).backgroundColor };
					}),
					fonts: fonts.map((font) => {
						el.setAttribute('style', `font: ${font} !important`);
						const computedStyle = getComputedStyle(el);

						return { [font]: `${computedStyle.fontSize} ${computedStyle.fontFamily}` };
					})
				});

				if (!el) {
					el = document.createElement('div');
					document.body.append(el);
					const systemStyles = getStyles(el);
					el.parentNode.removeChild(el);

					return systemStyles;
				}

				return getStyles(el);
			} catch (error) {
				captureError(error);

				return;
			}
		};

		try {
			const timer = createTimer();
			timer.start();
			const computedStyle = computeStyle('getComputedStyle', { require: [captureError] });
			const system = getSystemStyles(PARENT_PHANTOM);
			logTestResult({ time: timer.stop(), test: 'computed style', passed: true });

			PARENT_PHANTOM.remove();

			return { computedStyle, system };
		} catch (error) {
			logTestResult({ test: 'computed style', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	function getCSSMedia() {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};
		const gcd = (a, b) => b == 0 ? a : gcd(b, a % b);

		const getAspectRatio = (width, height) => {
			const r = gcd(width, height);
			const aspectRatio = `${width / r}/${height / r}`;

			return aspectRatio;
		};

		const query = ({ body, type, rangeStart, rangeLen }) => {
			const html = [...Array(rangeLen)].map((slot, i) => {
				i += rangeStart;

				return `@media(device-${type}:${i}px){body{--device-${type}:${i};}}`;
			}).join('');
			body.innerHTML = `<style>${html}</style>`;
			const style = getComputedStyle(body);
			return style.getPropertyValue(`--device-${type}`).trim();
		};

		const getScreenMedia = ({ body, width, height }) => {
			let widthMatch = query({ body, type: 'width', rangeStart: width, rangeLen: 1 });
			let heightMatch = query({ body, type: 'height', rangeStart: height, rangeLen: 1 });

			if (widthMatch && heightMatch) {
				return { width, height };
			}

			const rangeLen = 1000;

			[...Array(10)].find((slot, i) => {
				if (!widthMatch) {
					widthMatch = query({ body, type: 'width', rangeStart: i * rangeLen, rangeLen });
				}

				if (!heightMatch) {
					heightMatch = query({ body, type: 'height', rangeStart: i * rangeLen, rangeLen });
				}

				return widthMatch && heightMatch;
			});

			return { width: +widthMatch, height: +heightMatch };
		};

		try {
			const timer = createTimer();
			timer.start();
			const win = PHANTOM_DARKNESS.window;
			const { body } = win.document;
			const { width, availWidth, height, availHeight } = win.screen;
			const noTaskbar = !(width - availWidth || height - availHeight);

			if (screen.width !== width || (width > 800 && noTaskbar)) {
				LowerEntropy.IFRAME_SCREEN = true;
			}

			const deviceAspectRatio = getAspectRatio(width, height);

			const matchMediaCSS = {
				['prefers-reduced-motion']: (win.matchMedia('(prefers-reduced-motion: no-preference)').matches ? 'no-preference' : win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : undefined),
				['prefers-color-scheme']: (win.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : undefined),
				monochrome: (win.matchMedia('(monochrome)').matches ? 'monochrome' : win.matchMedia('(monochrome: 0)').matches ? 'non-monochrome' : undefined),
				['inverted-colors']: (win.matchMedia('(inverted-colors: inverted)').matches ? 'inverted' : win.matchMedia('(inverted-colors: none)').matches ? 'none' : undefined),
				['forced-colors']: (win.matchMedia('(forced-colors: none)').matches ? 'none' : win.matchMedia('(forced-colors: active)').matches ? 'active' : undefined),
				['any-hover']: (win.matchMedia('(any-hover: hover)').matches ? 'hover' : win.matchMedia('(any-hover: none)').matches ? 'none' : undefined),
				hover: (win.matchMedia('(hover: hover)').matches ? 'hover' : win.matchMedia('(hover: none)').matches ? 'none' : undefined),
				['any-pointer']: (win.matchMedia('(any-pointer: fine)').matches ? 'fine' : win.matchMedia('(any-pointer: coarse)').matches ? 'coarse' : win.matchMedia('(any-pointer: none)').matches ? 'none' : undefined),
				pointer: (win.matchMedia('(pointer: fine)').matches ? 'fine' : win.matchMedia('(pointer: coarse)').matches ? 'coarse' : win.matchMedia('(pointer: none)').matches ? 'none' : undefined),
				['device-aspect-ratio']: (win.matchMedia(`(device-aspect-ratio: ${deviceAspectRatio})`).matches ? deviceAspectRatio : undefined),
				['device-screen']: (win.matchMedia(`(device-width: ${width}px) and (device-height: ${height}px)`).matches ? `${width} x ${height}` : undefined),
				['display-mode']: (win.matchMedia('(display-mode: fullscreen)').matches ? 'fullscreen' : win.matchMedia('(display-mode: standalone)').matches ? 'standalone' : win.matchMedia('(display-mode: minimal-ui)').matches ? 'minimal-ui' : win.matchMedia('(display-mode: browser)').matches ? 'browser' : undefined),
				['color-gamut']: (win.matchMedia('(color-gamut: srgb)').matches ? 'srgb' : win.matchMedia('(color-gamut: p3)').matches ? 'p3' : win.matchMedia('(color-gamut: rec2020)').matches ? 'rec2020' : undefined),
				orientation: (win.matchMedia('(orientation: landscape)').matches ? 'landscape' : win.matchMedia('(orientation: portrait)').matches ? 'portrait' : undefined),
			};

			body.innerHTML = `
		<!--suppress CssInvalidMediaFeature -->
<style>
		@media (prefers-reduced-motion: no-preference) {body {--prefers-reduced-motion: no-preference}}
		@media (prefers-reduced-motion: reduce) {body {--prefers-reduced-motion: reduce}}
		@media (prefers-color-scheme: light) {body {--prefers-color-scheme: light}}
		@media (prefers-color-scheme: dark) {body {--prefers-color-scheme: dark}}
		@media (monochrome) {body {--monochrome: monochrome}}
		@media (monochrome: 0) {body {--monochrome: non-monochrome}}
		@media (inverted-colors: inverted) {body {--inverted-colors: inverted}}
		@media (inverted-colors: none) {body {--inverted-colors: none}}
		@media (forced-colors: none) {body {--forced-colors: none}}
		@media (forced-colors: active) {body {--forced-colors: active}}
		@media (any-hover: hover) {body {--any-hover: hover}}
		@media (any-hover: none) {body {--any-hover: none}}
		@media (hover: hover) {body {--hover: hover}}
		@media (hover: none) {body {--hover: none}}
		@media (any-pointer: fine) {body {--any-pointer: fine}}
		@media (any-pointer: coarse) {body {--any-pointer: coarse}}
		@media (any-pointer: none) {body {--any-pointer: none}}
		@media (pointer: fine) {body {--pointer: fine}}
		@media (pointer: coarse) {body {--pointer: coarse}}
		@media (pointer: none) {body {--pointer: none}}
		@media (device-aspect-ratio: ${deviceAspectRatio}) {body {--device-aspect-ratio: ${deviceAspectRatio}}}
		@media (device-width: ${width}px) and (device-height: ${height}px) {body {--device-screen: ${width} x ${height}}}
		@media (display-mode: fullscreen) {body {--display-mode: fullscreen}}
		@media (display-mode: standalone) {body {--display-mode: standalone}}
		@media (display-mode: minimal-ui) {body {--display-mode: minimal-ui}}
		@media (display-mode: browser) {body {--display-mode: browser}}
		@media (color-gamut: srgb) {body {--color-gamut: srgb}}
		@media (color-gamut: p3) {body {--color-gamut: p3}}
		@media (color-gamut: rec2020) {body {--color-gamut: rec2020}}
		@media (orientation: landscape) {body {--orientation: landscape}}
		@media (orientation: portrait) {body {--orientation: portrait}}
		</style>
		`;

			const style = getComputedStyle(body);

			const mediaCSS = {
				['prefers-reduced-motion']: style.getPropertyValue('--prefers-reduced-motion').trim() || undefined,
				['prefers-color-scheme']: style.getPropertyValue('--prefers-color-scheme').trim() || undefined,
				monochrome: style.getPropertyValue('--monochrome').trim() || undefined,
				['inverted-colors']: style.getPropertyValue('--inverted-colors').trim() || undefined,
				['forced-colors']: style.getPropertyValue('--forced-colors').trim() || undefined,
				['any-hover']: style.getPropertyValue('--any-hover').trim() || undefined,
				hover: style.getPropertyValue('--hover').trim() || undefined,
				['any-pointer']: style.getPropertyValue('--any-pointer').trim() || undefined,
				pointer: style.getPropertyValue('--pointer').trim() || undefined,
				['device-aspect-ratio']: style.getPropertyValue('--device-aspect-ratio').trim() || undefined,
				['device-screen']: style.getPropertyValue('--device-screen').trim() || undefined,
				['display-mode']: style.getPropertyValue('--display-mode').trim() || undefined,
				['color-gamut']: style.getPropertyValue('--color-gamut').trim() || undefined,
				orientation: style.getPropertyValue('--orientation').trim() || undefined,
			};

			// get screen query
			const screenQuery = getScreenMedia({ body, width, height });
			logTestResult({ time: timer.stop(), test: 'css media', passed: true });
			PARENT_PHANTOM.remove();

			return { mediaCSS, matchMediaCSS, screenQuery };
		} catch (error) {
			logTestResult({ test: 'css media', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	function getHTMLElementVersion() {
		try {
			const timer = createTimer();
			timer.start();
			const keys = [];

			// eslint-disable-next-line guard-for-in
			for (const key in document.documentElement) {
				keys.push(key);
			}

			logTestResult({ time: timer.stop(), test: 'html element', passed: true });

			return { keys };
		}
		catch (error) {
			logTestResult({ test: 'html element', passed: false });
			captureError(error);

			return;
		}
	}

	// inspired by
	// https://privacycheck.sec.lrz.de/active/fp_gcr/fp_getclientrects.html
	// https://privacycheck.sec.lrz.de/active/fp_e/fp_emoji.html
	async function getClientRects() {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};

		try {
			const timer = createTimer();
			await queueEvent(timer);
			const toNativeObject = (domRect) => {
				return {
					bottom: domRect.bottom,
					height: domRect.height,
					left: domRect.left,
					right: domRect.right,
					width: domRect.width,
					top: domRect.top,
					x: domRect.x,
					y: domRect.y,
				};
			};
			let lied = (lieProps['Element.getClientRects'] || lieProps['Element.getBoundingClientRect'] || lieProps['Range.getClientRects'] || lieProps['Range.getBoundingClientRect'] || lieProps['String.fromCodePoint']) || false;
			const DOC = (PHANTOM_DARKNESS && PHANTOM_DARKNESS.document && PHANTOM_DARKNESS.document.body ? PHANTOM_DARKNESS.document : document);
			const getBestRect = (el) => {
				let range;
				if (!lieProps['Element.getClientRects']) {
					return el.getClientRects()[0];
				}
				else if (!lieProps['Element.getBoundingClientRect']) {
					return el.getBoundingClientRect();
				}
				else if (!lieProps['Range.getClientRects']) {
					range = DOC.createRange();
					range.selectNode(el);
					return range.getClientRects()[0];
				}
				range = DOC.createRange();
				range.selectNode(el);
				return range.getBoundingClientRect();
			};
			const rectsId = `${instanceId}-client-rects-div`;
			const divElement = document.createElement('div');
			divElement.setAttribute('id', rectsId);
			DOC.body.appendChild(divElement);
			patch(divElement, html `
				<div id="${rectsId}">
			<style>
			.rect-ghost,
			.rect-known {
				top: 0;
				left: 0;
				position: absolute;
				visibility: hidden;
			}
			.rect-known {
				width: 100px;
				height: 100px;
				transform: rotate(45deg);
			}
			.rect-ghost {
				width: 0;
				height: 0;
			}
			</style>
			<div class="rect-known"></div>
			<div class="rect-ghost"></div>
			<div style="perspective:100px;width:1000.099%;" id="rect-container">
				<style>
				.rects {
					width: 1000%;
					height: 1000%;
					max-width: 1000%;
				}
				.absolute {
					position: absolute;
				}
				#cRect1 {
					border: solid 2.715px;
					border-color: #F72585;
					padding: 3.98px;
					margin-left: 12.12px;
				}
				#cRect2 {
					border: solid 2px;
					border-color: #7209B7;
					font-size: 30px;
					margin-top: 20px;
					padding: 3.98px;
					transform: skewY(23.1753218deg) rotate3d(10.00099, 90, 0.100000000000009, 60000000000008.00000009deg);
				}
				#cRect3 {
					border: solid 2.89px;
					border-color: #3A0CA3;
					font-size: 45px;
					transform: skewY(-23.1753218deg) scale(1099.0000000099, 1.89) matrix(1.11, 2.0001, -1.0001, 1.009, 150, 94.4);
					margin-top: 50px;
				}
				#cRect4 {
					border: solid 2px;
					border-color: #4361EE;
					transform: matrix(1.11, 2.0001, -1.0001, 1.009, 150, 94.4);
					margin-top: 11.1331px;
					margin-left: 12.1212px;
					padding: 4.4545px;
					left: 239.4141px;
					top: 8.5050px;
				}
				#cRect5 {
					border: solid 2px;
					border-color: #4CC9F0;
					margin-left: 42.395pt;
				}
				#cRect6 {
					border: solid 2px;
					border-color: #F72585;
					transform: perspective(12890px) translateZ(101.5px);
					padding: 12px;
				}
				#cRect7 {
					margin-top: -350.552px;
					margin-left: 0.9099rem;
					border: solid 2px;
					border-color: #4361EE;
				}
				#cRect8 {
					margin-top: -150.552px;
					margin-left: 15.9099rem;
					border: solid 2px;
					border-color: #3A0CA3;
				}
				#cRect9 {
					margin-top: -110.552px;
					margin-left: 15.9099rem;
					border: solid 2px;
					border-color: #7209B7;
				}
				#cRect10 {
					margin-top: -315.552px;
					margin-left: 15.9099rem;
					border: solid 2px;
					border-color: #F72585;
				}
				#cRect11 {
					width: 10px;
					height: 10px;
					margin-left: 15.0000009099rem;
					border: solid 2px;
					border-color: #F72585;
				}
				#cRect12 {
					width: 10px;
					height: 10px;
					margin-left: 15.0000009099rem;
					border: solid 2px;
					border-color: #F72585;
				}
				#rect-container .shift-dom-rect {
					top: 1px !important;
					left: 1px !important;
				}
				</style>
				<div id="cRect1" class="rects"></div>
				<div id="cRect2" class="rects"></div>
				<div id="cRect3" class="rects"></div>
				<div id="cRect4" class="rects absolute"></div>
				<div id="cRect5" class="rects"></div>
				<div id="cRect6" class="rects"></div>
				<div id="cRect7" class="rects absolute"></div>
				<div id="cRect8" class="rects absolute"></div>
				<div id="cRect9" class="rects absolute"></div>
				<div id="cRect10" class="rects absolute"></div>
				<div id="cRect11" class="rects"></div>
				<div id="cRect12" class="rects"></div>
				<div id="emoji" class="emojis"></div>
			</div>
			<div id="emoji-container">
				<style>
				.domrect-emoji {
					font-family: ${CSS_FONT_FAMILY};
					font-size: 200px !important;
					height: auto;
					position: absolute !important;
					transform: scale(1.000999);
				}
				</style>
				${EMOJIS.map((emoji) => {
				return `<div class="domrect-emoji">${emoji}</div>`;
			}).join('')}
			</div>
		</div>
			`);
			// get emoji set and system
			const pattern = new Set();
			await queueEvent(timer);
			const emojiElems = [...DOC.getElementsByClassName('domrect-emoji')];
			const emojiSet = emojiElems.reduce((emojiSet, el, i) => {
				const emoji = EMOJIS[i];
				const { height, width } = getBestRect(el);
				const dimensions = `${width},${height}`;
				if (!pattern.has(dimensions)) {
					pattern.add(dimensions);
					emojiSet.add(emoji);
				}
				return emojiSet;
			}, new Set());
			const domrectSystemSum = 0.00001 * [...pattern].map((x) => {
				return x.split(',').reduce((acc, x) => acc += (+x || 0), 0);
			}).reduce((acc, x) => acc += x, 0);
			// get clientRects
			const range = document.createRange();
			const rectElems = DOC.getElementsByClassName('rects');
			const elementClientRects = [...rectElems].map((el) => {
				return toNativeObject(el.getClientRects()[0]);
			});
			const elementBoundingClientRect = [...rectElems].map((el) => {
				return toNativeObject(el.getBoundingClientRect());
			});
			const rangeClientRects = [...rectElems].map((el) => {
				range.selectNode(el);
				return toNativeObject(range.getClientRects()[0]);
			});
			const rangeBoundingClientRect = [...rectElems].map((el) => {
				range.selectNode(el);
				return toNativeObject(el.getBoundingClientRect());
			});
			// detect failed shift calculation
			// inspired by https://arkenfox.github.io/TZP
			const rect4 = [...rectElems][3];
			const { top: initialTop } = elementClientRects[3];
			rect4.classList.add('shift-dom-rect');
			const { top: shiftedTop } = toNativeObject(rect4.getClientRects()[0]);
			rect4.classList.remove('shift-dom-rect');
			const { top: unshiftedTop } = toNativeObject(rect4.getClientRects()[0]);
			const diff = initialTop - shiftedTop;
			const unshiftLie = diff != (unshiftedTop - shiftedTop);
			if (unshiftLie) {
				lied = true;
				documentLie('Element.getClientRects', 'failed unshift calculation');
			}
			// detect failed math calculation lie
			let mathLie = false;
			elementClientRects.forEach((rect) => {
				const { right, left, width, bottom, top, height, x, y } = rect;
				if (right - left != width ||
					bottom - top != height ||
					right - x != width ||
					bottom - y != height) {
					lied = true;
					mathLie = true;
				}
				return;
			});
			if (mathLie) {
				documentLie('Element.getClientRects', 'failed math calculation');
			}
			// detect equal elements mismatch lie
			const { right: right1, left: left1 } = elementClientRects[10];
			const { right: right2, left: left2 } = elementClientRects[11];
			if (right1 != right2 || left1 != left2) {
				documentLie('Element.getClientRects', 'equal elements mismatch');
				lied = true;
			}
			// detect unknown rotate dimensions
			const knownEl = [...DOC.getElementsByClassName('rect-known')][0];
			const knownDimensions = toNativeObject(knownEl.getClientRects()[0]);
			const knownHash = hashMini(knownDimensions);

			if (IS_BLINK) {
				const Rotate = { '9d9215cc': true, '47ded322': true, 'd0eceaa8': true };

				if (!Rotate[knownHash]) {
					documentLie('Element.getClientRects', 'unknown rotate dimensions');
					lied = true;
				}
			} else if (IS_GECKO) {
				const Rotate = { 'e38453f0': true };

				if (!Rotate[knownHash]) {
					documentLie('Element.getClientRects', 'unknown rotate dimensions');
					lied = true;
				}
			}

			// detect ghost dimensions
			const ghostEl = [...DOC.getElementsByClassName('rect-ghost')][0];
			const ghostDimensions = toNativeObject(ghostEl.getClientRects()[0]);
			const hasGhostDimensions = Object.keys(ghostDimensions)	.some((key) => ghostDimensions[key] !== 0);

			if (hasGhostDimensions) {
				documentLie('Element.getClientRects', 'unknown ghost dimensions');
				lied = true;
			}

			DOC.body.removeChild(DOC.getElementById(rectsId));

			logTestResult({ time: timer.stop(), test: 'rects', passed: true });

			PARENT_PHANTOM.remove();

			return { elementClientRects, elementBoundingClientRect, rangeClientRects, rangeBoundingClientRect, emojiSet: [...emojiSet], domrectSystemSum, lied };
		} catch (error) {
			logTestResult({ test: 'rects', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	function getErrors(errFns) {
		const errors = [];
		let i;
		const len = errFns.length;

		for (i = 0; i < len; i++) {
			try {
				errFns[i]();
			} catch (err) {
				errors.push(err.message);
			}
		}

		return errors;
	}

	function getConsoleErrors() {
		try {
			const timer = createTimer();

			timer.start();

			const errorTests = [
				() => new Function('alert(")')(),
				() => new Function('const foo;foo.bar')(),
				() => new Function('null.bar')(),
				() => new Function('abc.xyz = 123')(),
				() => new Function('const foo;foo.bar')(),
				() => new Function('(1).toString(1000)')(),
				() => new Function('[...undefined].length')(),
				() => new Function('var x = new Array(-1)')(),
				() => new Function('const a=1; const a=2;')(),
			];

			const errors = getErrors(errorTests);

			logTestResult({ time: timer.stop(), test: 'console errors', passed: true });

			return { errors };
		} catch (error) {
			logTestResult({ test: 'console errors', passed: false });
			captureError(error);

			return;
		}
	}

	/*
	 Steps to update:
	 0. get beta release desktop/mobile
	 1. get diffs from template
	 2. update feature list
	 3. update stable features object
	 */
	const getStableFeatures = () => ({
		'Chrome': {
			version: 115,
			windowKeys: `Object, Function, Array, Number, parseFloat, parseInt, Infinity, NaN, undefined, Boolean, String, Symbol, Date, Promise, RegExp, Error, AggregateError, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, globalThis, JSON, Math, Intl, ArrayBuffer, Atomics, Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray, BigUint64Array, BigInt64Array, DataView, Map, BigInt, Set, WeakMap, WeakSet, Proxy, Reflect, FinalizationRegistry, WeakRef, decodeURI, decodeURIComponent, encodeURI, encodeURIComponent, escape, unescape, eval, isFinite, isNaN, console, Option, Image, Audio, webkitURL, webkitRTCPeerConnection, webkitMediaStream, WebKitMutationObserver, WebKitCSSMatrix, XSLTProcessor, XPathResult, XPathExpression, XPathEvaluator, XMLSerializer, XMLHttpRequestUpload, XMLHttpRequestEventTarget, XMLHttpRequest, XMLDocument, WritableStreamDefaultWriter, WritableStreamDefaultController, WritableStream, Worker, Window, WheelEvent, WebSocket, WebGLVertexArrayObject, WebGLUniformLocation, WebGLTransformFeedback, WebGLTexture, WebGLSync, WebGLShaderPrecisionFormat, WebGLShader, WebGLSampler, WebGLRenderingContext, WebGLRenderbuffer, WebGLQuery, WebGLProgram, WebGLFramebuffer, WebGLContextEvent, WebGLBuffer, WebGLActiveInfo, WebGL2RenderingContext, WaveShaperNode, VisualViewport, VirtualKeyboardGeometryChangeEvent, ValidityState, VTTCue, UserActivation, URLSearchParams, URLPattern, URL, UIEvent, TrustedTypePolicyFactory, TrustedTypePolicy, TrustedScriptURL, TrustedScript, TrustedHTML, TreeWalker, TransitionEvent, TransformStreamDefaultController, TransformStream, TrackEvent, TouchList, TouchEvent, Touch, TimeRanges, TextTrackList, TextTrackCueList, TextTrackCue, TextTrack, TextMetrics, TextEvent, TextEncoderStream, TextEncoder, TextDecoderStream, TextDecoder, Text, TaskSignal, TaskPriorityChangeEvent, TaskController, TaskAttributionTiming, SyncManager, SubmitEvent, StyleSheetList, StyleSheet, StylePropertyMapReadOnly, StylePropertyMap, StorageEvent, Storage, StereoPannerNode, StaticRange, SourceBufferList, SourceBuffer, ShadowRoot, Selection, SecurityPolicyViolationEvent, ScriptProcessorNode, ScreenOrientation, Screen, Scheduling, Scheduler, SVGViewElement, SVGUseElement, SVGUnitTypes, SVGTransformList, SVGTransform, SVGTitleElement, SVGTextPositioningElement, SVGTextPathElement, SVGTextElement, SVGTextContentElement, SVGTSpanElement, SVGSymbolElement, SVGSwitchElement, SVGStyleElement, SVGStringList, SVGStopElement, SVGSetElement, SVGScriptElement, SVGSVGElement, SVGRectElement, SVGRect, SVGRadialGradientElement, SVGPreserveAspectRatio, SVGPolylineElement, SVGPolygonElement, SVGPointList, SVGPoint, SVGPatternElement, SVGPathElement, SVGNumberList, SVGNumber, SVGMetadataElement, SVGMatrix, SVGMaskElement, SVGMarkerElement, SVGMPathElement, SVGLinearGradientElement, SVGLineElement, SVGLengthList, SVGLength, SVGImageElement, SVGGraphicsElement, SVGGradientElement, SVGGeometryElement, SVGGElement, SVGForeignObjectElement, SVGFilterElement, SVGFETurbulenceElement, SVGFETileElement, SVGFESpotLightElement, SVGFESpecularLightingElement, SVGFEPointLightElement, SVGFEOffsetElement, SVGFEMorphologyElement, SVGFEMergeNodeElement, SVGFEMergeElement, SVGFEImageElement, SVGFEGaussianBlurElement, SVGFEFuncRElement, SVGFEFuncGElement, SVGFEFuncBElement, SVGFEFuncAElement, SVGFEFloodElement, SVGFEDropShadowElement, SVGFEDistantLightElement, SVGFEDisplacementMapElement, SVGFEDiffuseLightingElement, SVGFEConvolveMatrixElement, SVGFECompositeElement, SVGFEComponentTransferElement, SVGFEColorMatrixElement, SVGFEBlendElement, SVGEllipseElement, SVGElement, SVGDescElement, SVGDefsElement, SVGComponentTransferFunctionElement, SVGClipPathElement, SVGCircleElement, SVGAnimationElement, SVGAnimatedTransformList, SVGAnimatedString, SVGAnimatedRect, SVGAnimatedPreserveAspectRatio, SVGAnimatedNumberList, SVGAnimatedNumber, SVGAnimatedLengthList, SVGAnimatedLength, SVGAnimatedInteger, SVGAnimatedEnumeration, SVGAnimatedBoolean, SVGAnimatedAngle, SVGAnimateTransformElement, SVGAnimateMotionElement, SVGAnimateElement, SVGAngle, SVGAElement, Response, ResizeObserverSize, ResizeObserverEntry, ResizeObserver, Request, ReportingObserver, ReadableStreamDefaultReader, ReadableStreamDefaultController, ReadableStreamBYOBRequest, ReadableStreamBYOBReader, ReadableStream, ReadableByteStreamController, Range, RadioNodeList, RTCTrackEvent, RTCStatsReport, RTCSessionDescription, RTCSctpTransport, RTCRtpTransceiver, RTCRtpSender, RTCRtpReceiver, RTCPeerConnectionIceEvent, RTCPeerConnectionIceErrorEvent, RTCPeerConnection, RTCIceTransport, RTCIceCandidate, RTCErrorEvent, RTCError, RTCEncodedVideoFrame, RTCEncodedAudioFrame, RTCDtlsTransport, RTCDataChannelEvent, RTCDataChannel, RTCDTMFToneChangeEvent, RTCDTMFSender, RTCCertificate, PromiseRejectionEvent, ProgressEvent, Profiler, ProcessingInstruction, PopStateEvent, PointerEvent, PluginArray, Plugin, PictureInPictureWindow, PictureInPictureEvent, PeriodicWave, PerformanceTiming, PerformanceServerTiming, PerformanceResourceTiming, PerformancePaintTiming, PerformanceObserverEntryList, PerformanceObserver, PerformanceNavigationTiming, PerformanceNavigation, PerformanceMeasure, PerformanceMark, PerformanceLongTaskTiming, PerformanceEventTiming, PerformanceEntry, PerformanceElementTiming, Performance, Path2D, PannerNode, PageTransitionEvent, OverconstrainedError, OscillatorNode, OffscreenCanvasRenderingContext2D, OffscreenCanvas, OfflineAudioContext, OfflineAudioCompletionEvent, NodeList, NodeIterator, NodeFilter, Node, NetworkInformation, Navigator, NavigationTransition, NavigationHistoryEntry, NavigationDestination, NavigationCurrentEntryChangeEvent, Navigation, NavigateEvent, NamedNodeMap, MutationRecord, MutationObserver, MutationEvent, MouseEvent, MimeTypeArray, MimeType, MessagePort, MessageEvent, MessageChannel, MediaStreamTrackProcessor, MediaStreamTrackGenerator, MediaStreamTrackEvent, MediaStreamTrack, MediaStreamEvent, MediaStreamAudioSourceNode, MediaStreamAudioDestinationNode, MediaStream, MediaSourceHandle, MediaSource, MediaRecorder, MediaQueryListEvent, MediaQueryList, MediaList, MediaError, MediaEncryptedEvent, MediaElementAudioSourceNode, MediaCapabilities, Location, LayoutShiftAttribution, LayoutShift, LargestContentfulPaint, KeyframeEffect, KeyboardEvent, IntersectionObserverEntry, IntersectionObserver, InputEvent, InputDeviceInfo, InputDeviceCapabilities, ImageData, ImageCapture, ImageBitmapRenderingContext, ImageBitmap, IdleDeadline, IIRFilterNode, IDBVersionChangeEvent, IDBTransaction, IDBRequest, IDBOpenDBRequest, IDBObjectStore, IDBKeyRange, IDBIndex, IDBFactory, IDBDatabase, IDBCursorWithValue, IDBCursor, History, Headers, HashChangeEvent, HTMLVideoElement, HTMLUnknownElement, HTMLUListElement, HTMLTrackElement, HTMLTitleElement, HTMLTimeElement, HTMLTextAreaElement, HTMLTemplateElement, HTMLTableSectionElement, HTMLTableRowElement, HTMLTableElement, HTMLTableColElement, HTMLTableCellElement, HTMLTableCaptionElement, HTMLStyleElement, HTMLSpanElement, HTMLSourceElement, HTMLSlotElement, HTMLSelectElement, HTMLScriptElement, HTMLQuoteElement, HTMLProgressElement, HTMLPreElement, HTMLPictureElement, HTMLParamElement, HTMLParagraphElement, HTMLOutputElement, HTMLOptionsCollection, HTMLOptionElement, HTMLOptGroupElement, HTMLObjectElement, HTMLOListElement, HTMLModElement, HTMLMeterElement, HTMLMetaElement, HTMLMenuElement, HTMLMediaElement, HTMLMarqueeElement, HTMLMapElement, HTMLLinkElement, HTMLLegendElement, HTMLLabelElement, HTMLLIElement, HTMLInputElement, HTMLImageElement, HTMLIFrameElement, HTMLHtmlElement, HTMLHeadingElement, HTMLHeadElement, HTMLHRElement, HTMLFrameSetElement, HTMLFrameElement, HTMLFormElement, HTMLFormControlsCollection, HTMLFontElement, HTMLFieldSetElement, HTMLEmbedElement, HTMLElement, HTMLDocument, HTMLDivElement, HTMLDirectoryElement, HTMLDialogElement, HTMLDetailsElement, HTMLDataListElement, HTMLDataElement, HTMLDListElement, HTMLCollection, HTMLCanvasElement, HTMLButtonElement, HTMLBodyElement, HTMLBaseElement, HTMLBRElement, HTMLAudioElement, HTMLAreaElement, HTMLAnchorElement, HTMLAllCollection, GeolocationPositionError, GeolocationPosition, GeolocationCoordinates, Geolocation, GamepadHapticActuator, GamepadEvent, GamepadButton, Gamepad, GainNode, FormDataEvent, FormData, FontFaceSetLoadEvent, FontFace, FocusEvent, FileReader, FileList, File, FeaturePolicy, External, EventTarget, EventSource, EventCounts, Event, ErrorEvent, ElementInternals, Element, DynamicsCompressorNode, DragEvent, DocumentType, DocumentFragment, Document, DelayNode, DecompressionStream, DataTransferItemList, DataTransferItem, DataTransfer, DOMTokenList, DOMStringMap, DOMStringList, DOMRectReadOnly, DOMRectList, DOMRect, DOMQuad, DOMPointReadOnly, DOMPoint, DOMParser, DOMMatrixReadOnly, DOMMatrix, DOMImplementation, DOMException, DOMError, CustomStateSet, CustomEvent, CustomElementRegistry, Crypto, CountQueuingStrategy, ConvolverNode, ConstantSourceNode, CompressionStream, CompositionEvent, Comment, CloseEvent, ClipboardEvent, CharacterData, ChannelSplitterNode, ChannelMergerNode, CanvasRenderingContext2D, CanvasPattern, CanvasGradient, CanvasCaptureMediaStreamTrack, CSSVariableReferenceValue, CSSUnparsedValue, CSSUnitValue, CSSTranslate, CSSTransformValue, CSSTransformComponent, CSSSupportsRule, CSSStyleValue, CSSStyleSheet, CSSStyleRule, CSSStyleDeclaration, CSSSkewY, CSSSkewX, CSSSkew, CSSScale, CSSRuleList, CSSRule, CSSRotate, CSSPropertyRule, CSSPositionValue, CSSPerspective, CSSPageRule, CSSNumericValue, CSSNumericArray, CSSNamespaceRule, CSSMediaRule, CSSMatrixComponent, CSSMathValue, CSSMathSum, CSSMathProduct, CSSMathNegate, CSSMathMin, CSSMathMax, CSSMathInvert, CSSMathClamp, CSSLayerStatementRule, CSSLayerBlockRule, CSSKeywordValue, CSSKeyframesRule, CSSKeyframeRule, CSSImportRule, CSSImageValue, CSSGroupingRule, CSSFontPaletteValuesRule, CSSFontFaceRule, CSSCounterStyleRule, CSSContainerRule, CSSConditionRule, CSS, CDATASection, ByteLengthQueuingStrategy, BroadcastChannel, BlobEvent, Blob, BiquadFilterNode, BeforeUnloadEvent, BeforeInstallPromptEvent, BaseAudioContext, BarProp, AudioWorkletNode, AudioSinkInfo, AudioScheduledSourceNode, AudioProcessingEvent, AudioParamMap, AudioParam, AudioNode, AudioListener, AudioDestinationNode, AudioContext, AudioBufferSourceNode, AudioBuffer, Attr, AnimationEvent, AnimationEffect, Animation, AnalyserNode, AbstractRange, AbortSignal, AbortController, window, self, document, name, location, customElements, history, navigation, locationbar, menubar, personalbar, scrollbars, statusbar, toolbar, status, closed, frames, length, top, opener, parent, frameElement, navigator, origin, external, screen, innerWidth, innerHeight, scrollX, pageXOffset, scrollY, pageYOffset, visualViewport, screenX, screenY, outerWidth, outerHeight, devicePixelRatio, event, clientInformation, offscreenBuffering, screenLeft, screenTop, styleMedia, onsearch, isSecureContext, trustedTypes, performance, onappinstalled, onbeforeinstallprompt, crypto, indexedDB, sessionStorage, localStorage, onbeforexrselect, onabort, onbeforeinput, onblur, oncancel, oncanplay, oncanplaythrough, onchange, onclick, onclose, oncontextlost, oncontextmenu, oncontextrestored, oncuechange, ondblclick, ondrag, ondragend, ondragenter, ondragleave, ondragover, ondragstart, ondrop, ondurationchange, onemptied, onended, onerror, onfocus, onformdata, oninput, oninvalid, onkeydown, onkeypress, onkeyup, onload, onloadeddata, onloadedmetadata, onloadstart, onmousedown, onmouseenter, onmouseleave, onmousemove, onmouseout, onmouseover, onmouseup, onmousewheel, onpause, onplay, onplaying, onprogress, onratechange, onreset, onresize, onscroll, onsecuritypolicyviolation, onseeked, onseeking, onselect, onslotchange, onstalled, onsubmit, onsuspend, ontimeupdate, ontoggle, onvolumechange, onwaiting, onwebkitanimationend, onwebkitanimationiteration, onwebkitanimationstart, onwebkittransitionend, onwheel, onauxclick, ongotpointercapture, onlostpointercapture, onpointerdown, onpointermove, onpointerrawupdate, onpointerup, onpointercancel, onpointerover, onpointerout, onpointerenter, onpointerleave, onselectstart, onselectionchange, onanimationend, onanimationiteration, onanimationstart, ontransitionrun, ontransitionstart, ontransitionend, ontransitioncancel, onafterprint, onbeforeprint, onbeforeunload, onhashchange, onlanguagechange, onmessage, onmessageerror, onoffline, ononline, onpagehide, onpageshow, onpopstate, onrejectionhandled, onstorage, onunhandledrejection, onunload, crossOriginIsolated, scheduler, alert, atob, blur, btoa, cancelAnimationFrame, cancelIdleCallback, captureEvents, clearInterval, clearTimeout, close, confirm, createImageBitmap, fetch, find, focus, getComputedStyle, getSelection, matchMedia, moveBy, moveTo, open, postMessage, print, prompt, queueMicrotask, releaseEvents, reportError, requestAnimationFrame, requestIdleCallback, resizeBy, resizeTo, scroll, scrollBy, scrollTo, setInterval, setTimeout, stop, structuredClone, webkitCancelAnimationFrame, webkitRequestAnimationFrame, chrome, WebAssembly, credentialless, caches, cookieStore, ondevicemotion, ondeviceorientation, ondeviceorientationabsolute, launchQueue, onbeforematch, onbeforetoggle, AbsoluteOrientationSensor, Accelerometer, AudioWorklet, BatteryManager, Cache, CacheStorage, Clipboard, ClipboardItem, CookieChangeEvent, CookieStore, CookieStoreManager, Credential, CredentialsContainer, CryptoKey, DeviceMotionEvent, DeviceMotionEventAcceleration, DeviceMotionEventRotationRate, DeviceOrientationEvent, FederatedCredential, GravitySensor, Gyroscope, Keyboard, KeyboardLayoutMap, LinearAccelerationSensor, Lock, LockManager, MIDIAccess, MIDIConnectionEvent, MIDIInput, MIDIInputMap, MIDIMessageEvent, MIDIOutput, MIDIOutputMap, MIDIPort, MediaDeviceInfo, MediaDevices, MediaKeyMessageEvent, MediaKeySession, MediaKeyStatusMap, MediaKeySystemAccess, MediaKeys, NavigationPreloadManager, NavigatorManagedData, OrientationSensor, PasswordCredential, RelativeOrientationSensor, Sanitizer, ScreenDetailed, ScreenDetails, Sensor, SensorErrorEvent, ServiceWorker, ServiceWorkerContainer, ServiceWorkerRegistration, StorageManager, SubtleCrypto, VirtualKeyboard, WebTransport, WebTransportBidirectionalStream, WebTransportDatagramDuplexStream, WebTransportError, Worklet, XRDOMOverlayState, XRLayer, XRWebGLBinding, AudioData, EncodedAudioChunk, EncodedVideoChunk, ImageTrack, ImageTrackList, VideoColorSpace, VideoFrame, AudioDecoder, AudioEncoder, ImageDecoder, VideoDecoder, VideoEncoder, AuthenticatorAssertionResponse, AuthenticatorAttestationResponse, AuthenticatorResponse, PublicKeyCredential, Bluetooth, BluetoothCharacteristicProperties, BluetoothDevice, BluetoothRemoteGATTCharacteristic, BluetoothRemoteGATTDescriptor, BluetoothRemoteGATTServer, BluetoothRemoteGATTService, CaptureController, EyeDropper, FileSystemDirectoryHandle, FileSystemFileHandle, FileSystemHandle, FileSystemWritableFileStream, FontData, FragmentDirective, GPU, GPUAdapter, GPUAdapterInfo, GPUBindGroup, GPUBindGroupLayout, GPUBuffer, GPUBufferUsage, GPUCanvasContext, GPUColorWrite, GPUCommandBuffer, GPUCommandEncoder, GPUCompilationInfo, GPUCompilationMessage, GPUComputePassEncoder, GPUComputePipeline, GPUDevice, GPUDeviceLostInfo, GPUError, GPUExternalTexture, GPUInternalError, GPUMapMode, GPUOutOfMemoryError, GPUPipelineError, GPUPipelineLayout, GPUQuerySet, GPUQueue, GPURenderBundle, GPURenderBundleEncoder, GPURenderPassEncoder, GPURenderPipeline, GPUSampler, GPUShaderModule, GPUShaderStage, GPUSupportedFeatures, GPUSupportedLimits, GPUTexture, GPUTextureUsage, GPUTextureView, GPUUncapturedErrorEvent, GPUValidationError, HID, HIDConnectionEvent, HIDDevice, HIDInputReportEvent, IdentityCredential, IdleDetector, LaunchParams, LaunchQueue, OTPCredential, PaymentAddress, PaymentRequest, PaymentResponse, PaymentMethodChangeEvent, Presentation, PresentationAvailability, PresentationConnection, PresentationConnectionAvailableEvent, PresentationConnectionCloseEvent, PresentationConnectionList, PresentationReceiver, PresentationRequest, Serial, SerialPort, ToggleEvent, USB, USBAlternateInterface, USBConfiguration, USBConnectionEvent, USBDevice, USBEndpoint, USBInTransferResult, USBInterface, USBIsochronousInTransferPacket, USBIsochronousInTransferResult, USBIsochronousOutTransferPacket, USBIsochronousOutTransferResult, USBOutTransferResult, WakeLock, WakeLockSentinel, WindowControlsOverlay, WindowControlsOverlayGeometryChangeEvent, XRAnchor, XRAnchorSet, XRBoundedReferenceSpace, XRCPUDepthInformation, XRCamera, XRDepthInformation, XRFrame, XRHitTestResult, XRHitTestSource, XRInputSource, XRInputSourceArray, XRInputSourceEvent, XRInputSourcesChangeEvent, XRLightEstimate, XRLightProbe, XRPose, XRRay, XRReferenceSpace, XRReferenceSpaceEvent, XRRenderState, XRRigidTransform, XRSession, XRSessionEvent, XRSpace, XRSystem, XRTransientInputHitTestResult, XRTransientInputHitTestSource, XRView, XRViewerPose, XRViewport, XRWebGLDepthInformation, XRWebGLLayer, getScreenDetails, queryLocalFonts, showDirectoryPicker, showOpenFilePicker, showSaveFilePicker, originAgentCluster, speechSynthesis, oncontentvisibilityautostatechange, onscrollend, AnimationPlaybackEvent, AnimationTimeline, CSSAnimation, CSSTransition, DocumentTimeline, BackgroundFetchManager, BackgroundFetchRecord, BackgroundFetchRegistration, BluetoothUUID, BrowserCaptureMediaStreamTrack, CropTarget, ContentVisibilityAutoStateChangeEvent, DelegatedInkTrailPresenter, Ink, Highlight, HighlightRegistry, MathMLElement, MediaMetadata, MediaSession, NavigatorUAData, Notification, PaymentManager, PaymentRequestUpdateEvent, PeriodicSyncManager, PermissionStatus, Permissions, PushManager, PushSubscription, PushSubscriptionOptions, RemotePlayback, SharedWorker, SpeechSynthesisErrorEvent, SpeechSynthesisEvent, SpeechSynthesisUtterance, VideoPlaybackQuality, ViewTransition, webkitSpeechGrammar, webkitSpeechGrammarList, webkitSpeechRecognition, webkitSpeechRecognitionError, webkitSpeechRecognitionEvent, openDatabase, webkitRequestFileSystem, webkitResolveLocalFileSystemURL`,
			cssKeys: `cssText, length, parentRule, cssFloat, getPropertyPriority, getPropertyValue, item, removeProperty, setProperty, constructor, accent-color, align-content, align-items, align-self, alignment-baseline, animation-composition, animation-delay, animation-direction, animation-duration, animation-fill-mode, animation-iteration-count, animation-name, animation-play-state, animation-timing-function, app-region, appearance, backdrop-filter, backface-visibility, background-attachment, background-blend-mode, background-clip, background-color, background-image, background-origin, background-position, background-repeat, background-size, baseline-shift, baseline-source, block-size, border-block-end-color, border-block-end-style, border-block-end-width, border-block-start-color, border-block-start-style, border-block-start-width, border-bottom-color, border-bottom-left-radius, border-bottom-right-radius, border-bottom-style, border-bottom-width, border-collapse, border-end-end-radius, border-end-start-radius, border-image-outset, border-image-repeat, border-image-slice, border-image-source, border-image-width, border-inline-end-color, border-inline-end-style, border-inline-end-width, border-inline-start-color, border-inline-start-style, border-inline-start-width, border-left-color, border-left-style, border-left-width, border-right-color, border-right-style, border-right-width, border-start-end-radius, border-start-start-radius, border-top-color, border-top-left-radius, border-top-right-radius, border-top-style, border-top-width, bottom, box-shadow, box-sizing, break-after, break-before, break-inside, buffered-rendering, caption-side, caret-color, clear, clip, clip-path, clip-rule, color, color-interpolation, color-interpolation-filters, color-rendering, column-count, column-gap, column-rule-color, column-rule-style, column-rule-width, column-span, column-width, contain-intrinsic-block-size, contain-intrinsic-height, contain-intrinsic-inline-size, contain-intrinsic-size, contain-intrinsic-width, container-name, container-type, content, cursor, cx, cy, d, direction, display, dominant-baseline, empty-cells, fill, fill-opacity, fill-rule, filter, flex-basis, flex-direction, flex-grow, flex-shrink, flex-wrap, float, flood-color, flood-opacity, font-family, font-kerning, font-optical-sizing, font-palette, font-size, font-stretch, font-style, font-synthesis-small-caps, font-synthesis-style, font-synthesis-weight, font-variant, font-variant-alternates, font-variant-caps, font-variant-east-asian, font-variant-ligatures, font-variant-numeric, font-weight, grid-auto-columns, grid-auto-flow, grid-auto-rows, grid-column-end, grid-column-start, grid-row-end, grid-row-start, grid-template-areas, grid-template-columns, grid-template-rows, height, hyphenate-character, hyphenate-limit-chars, hyphens, image-orientation, image-rendering, initial-letter, inline-size, inset-block-end, inset-block-start, inset-inline-end, inset-inline-start, isolation, justify-content, justify-items, justify-self, left, letter-spacing, lighting-color, line-break, line-height, list-style-image, list-style-position, list-style-type, margin-block-end, margin-block-start, margin-bottom, margin-inline-end, margin-inline-start, margin-left, margin-right, margin-top, marker-end, marker-mid, marker-start, mask-type, math-depth, math-shift, math-style, max-block-size, max-height, max-inline-size, max-width, min-block-size, min-height, min-inline-size, min-width, mix-blend-mode, object-fit, object-position, object-view-box, offset-distance, offset-path, offset-rotate, opacity, order, orphans, outline-color, outline-offset, outline-style, outline-width, overflow-anchor, overflow-clip-margin, overflow-wrap, overflow-x, overflow-y, overscroll-behavior-block, overscroll-behavior-inline, padding-block-end, padding-block-start, padding-bottom, padding-inline-end, padding-inline-start, padding-left, padding-right, padding-top, paint-order, perspective, perspective-origin, pointer-events, position, r, resize, right, rotate, row-gap, ruby-position, rx, ry, scale, scroll-behavior, scroll-margin-block-end, scroll-margin-block-start, scroll-margin-inline-end, scroll-margin-inline-start, scroll-padding-block-end, scroll-padding-block-start, scroll-padding-inline-end, scroll-padding-inline-start, scrollbar-gutter, shape-image-threshold, shape-margin, shape-outside, shape-rendering, speak, stop-color, stop-opacity, stroke, stroke-dasharray, stroke-dashoffset, stroke-linecap, stroke-linejoin, stroke-miterlimit, stroke-opacity, stroke-width, tab-size, table-layout, text-align, text-align-last, text-anchor, text-decoration, text-decoration-color, text-decoration-line, text-decoration-skip-ink, text-decoration-style, text-emphasis-color, text-emphasis-position, text-emphasis-style, text-indent, text-overflow, text-rendering, text-shadow, text-size-adjust, text-transform, text-underline-position, text-wrap, top, touch-action, transform, transform-origin, transform-style, transition-delay, transition-duration, transition-property, transition-timing-function, translate, unicode-bidi, user-select, vector-effect, vertical-align, view-transition-name, visibility, white-space-collapse, widows, width, will-change, word-break, word-spacing, writing-mode, x, y, z-index, zoom, -webkit-border-horizontal-spacing, -webkit-border-image, -webkit-border-vertical-spacing, -webkit-box-align, -webkit-box-decoration-break, -webkit-box-direction, -webkit-box-flex, -webkit-box-ordinal-group, -webkit-box-orient, -webkit-box-pack, -webkit-box-reflect, -webkit-font-smoothing, -webkit-highlight, -webkit-line-break, -webkit-line-clamp, -webkit-locale, -webkit-mask-box-image, -webkit-mask-box-image-outset, -webkit-mask-box-image-repeat, -webkit-mask-box-image-slice, -webkit-mask-box-image-source, -webkit-mask-box-image-width, -webkit-mask-clip, -webkit-mask-composite, -webkit-mask-image, -webkit-mask-origin, -webkit-mask-position, -webkit-mask-repeat, -webkit-mask-size, -webkit-print-color-adjust, -webkit-rtl-ordering, -webkit-tap-highlight-color, -webkit-text-combine, -webkit-text-decorations-in-effect, -webkit-text-fill-color, -webkit-text-orientation, -webkit-text-security, -webkit-text-stroke-color, -webkit-text-stroke-width, -webkit-user-drag, -webkit-user-modify, -webkit-writing-mode, accentColor, additiveSymbols, alignContent, alignItems, alignSelf, alignmentBaseline, all, animation, animationComposition, animationDelay, animationDirection, animationDuration, animationFillMode, animationIterationCount, animationName, animationPlayState, animationTimingFunction, appRegion, ascentOverride, aspectRatio, backdropFilter, backfaceVisibility, background, backgroundAttachment, backgroundBlendMode, backgroundClip, backgroundColor, backgroundImage, backgroundOrigin, backgroundPosition, backgroundPositionX, backgroundPositionY, backgroundRepeat, backgroundRepeatX, backgroundRepeatY, backgroundSize, basePalette, baselineShift, baselineSource, blockSize, border, borderBlock, borderBlockColor, borderBlockEnd, borderBlockEndColor, borderBlockEndStyle, borderBlockEndWidth, borderBlockStart, borderBlockStartColor, borderBlockStartStyle, borderBlockStartWidth, borderBlockStyle, borderBlockWidth, borderBottom, borderBottomColor, borderBottomLeftRadius, borderBottomRightRadius, borderBottomStyle, borderBottomWidth, borderCollapse, borderColor, borderEndEndRadius, borderEndStartRadius, borderImage, borderImageOutset, borderImageRepeat, borderImageSlice, borderImageSource, borderImageWidth, borderInline, borderInlineColor, borderInlineEnd, borderInlineEndColor, borderInlineEndStyle, borderInlineEndWidth, borderInlineStart, borderInlineStartColor, borderInlineStartStyle, borderInlineStartWidth, borderInlineStyle, borderInlineWidth, borderLeft, borderLeftColor, borderLeftStyle, borderLeftWidth, borderRadius, borderRight, borderRightColor, borderRightStyle, borderRightWidth, borderSpacing, borderStartEndRadius, borderStartStartRadius, borderStyle, borderTop, borderTopColor, borderTopLeftRadius, borderTopRightRadius, borderTopStyle, borderTopWidth, borderWidth, boxShadow, boxSizing, breakAfter, breakBefore, breakInside, bufferedRendering, captionSide, caretColor, clipPath, clipRule, colorInterpolation, colorInterpolationFilters, colorRendering, colorScheme, columnCount, columnFill, columnGap, columnRule, columnRuleColor, columnRuleStyle, columnRuleWidth, columnSpan, columnWidth, columns, contain, containIntrinsicBlockSize, containIntrinsicHeight, containIntrinsicInlineSize, containIntrinsicSize, containIntrinsicWidth, container, containerName, containerType, contentVisibility, counterIncrement, counterReset, counterSet, descentOverride, dominantBaseline, emptyCells, fallback, fillOpacity, fillRule, flex, flexBasis, flexDirection, flexFlow, flexGrow, flexShrink, flexWrap, floodColor, floodOpacity, font, fontDisplay, fontFamily, fontFeatureSettings, fontKerning, fontOpticalSizing, fontPalette, fontSize, fontStretch, fontStyle, fontSynthesis, fontSynthesisSmallCaps, fontSynthesisStyle, fontSynthesisWeight, fontVariant, fontVariantAlternates, fontVariantCaps, fontVariantEastAsian, fontVariantLigatures, fontVariantNumeric, fontVariationSettings, fontWeight, forcedColorAdjust, gap, grid, gridArea, gridAutoColumns, gridAutoFlow, gridAutoRows, gridColumn, gridColumnEnd, gridColumnGap, gridColumnStart, gridGap, gridRow, gridRowEnd, gridRowGap, gridRowStart, gridTemplate, gridTemplateAreas, gridTemplateColumns, gridTemplateRows, hyphenateCharacter, hyphenateLimitChars, imageOrientation, imageRendering, inherits, initialLetter, initialValue, inlineSize, inset, insetBlock, insetBlockEnd, insetBlockStart, insetInline, insetInlineEnd, insetInlineStart, justifyContent, justifyItems, justifySelf, letterSpacing, lightingColor, lineBreak, lineGapOverride, lineHeight, listStyle, listStyleImage, listStylePosition, listStyleType, margin, marginBlock, marginBlockEnd, marginBlockStart, marginBottom, marginInline, marginInlineEnd, marginInlineStart, marginLeft, marginRight, marginTop, marker, markerEnd, markerMid, markerStart, mask, maskType, mathDepth, mathShift, mathStyle, maxBlockSize, maxHeight, maxInlineSize, maxWidth, minBlockSize, minHeight, minInlineSize, minWidth, mixBlendMode, negative, objectFit, objectPosition, objectViewBox, offset, offsetDistance, offsetPath, offsetRotate, outline, outlineColor, outlineOffset, outlineStyle, outlineWidth, overflow, overflowAnchor, overflowClipMargin, overflowWrap, overflowX, overflowY, overrideColors, overscrollBehavior, overscrollBehaviorBlock, overscrollBehaviorInline, overscrollBehaviorX, overscrollBehaviorY, pad, padding, paddingBlock, paddingBlockEnd, paddingBlockStart, paddingBottom, paddingInline, paddingInlineEnd, paddingInlineStart, paddingLeft, paddingRight, paddingTop, page, pageBreakAfter, pageBreakBefore, pageBreakInside, pageOrientation, paintOrder, perspectiveOrigin, placeContent, placeItems, placeSelf, pointerEvents, prefix, quotes, range, rowGap, rubyPosition, scrollBehavior, scrollMargin, scrollMarginBlock, scrollMarginBlockEnd, scrollMarginBlockStart, scrollMarginBottom, scrollMarginInline, scrollMarginInlineEnd, scrollMarginInlineStart, scrollMarginLeft, scrollMarginRight, scrollMarginTop, scrollPadding, scrollPaddingBlock, scrollPaddingBlockEnd, scrollPaddingBlockStart, scrollPaddingBottom, scrollPaddingInline, scrollPaddingInlineEnd, scrollPaddingInlineStart, scrollPaddingLeft, scrollPaddingRight, scrollPaddingTop, scrollSnapAlign, scrollSnapStop, scrollSnapType, scrollbarGutter, shapeImageThreshold, shapeMargin, shapeOutside, shapeRendering, size, sizeAdjust, speakAs, src, stopColor, stopOpacity, strokeDasharray, strokeDashoffset, strokeLinecap, strokeLinejoin, strokeMiterlimit, strokeOpacity, strokeWidth, suffix, symbols, syntax, system, tabSize, tableLayout, textAlign, textAlignLast, textAnchor, textCombineUpright, textDecoration, textDecorationColor, textDecorationLine, textDecorationSkipInk, textDecorationStyle, textDecorationThickness, textEmphasis, textEmphasisColor, textEmphasisPosition, textEmphasisStyle, textIndent, textOrientation, textOverflow, textRendering, textShadow, textSizeAdjust, textTransform, textUnderlineOffset, textUnderlinePosition, textWrap, touchAction, transformBox, transformOrigin, transformStyle, transition, transitionDelay, transitionDuration, transitionProperty, transitionTimingFunction, unicodeBidi, unicodeRange, userSelect, vectorEffect, verticalAlign, viewTransitionName, webkitAlignContent, webkitAlignItems, webkitAlignSelf, webkitAnimation, webkitAnimationDelay, webkitAnimationDirection, webkitAnimationDuration, webkitAnimationFillMode, webkitAnimationIterationCount, webkitAnimationName, webkitAnimationPlayState, webkitAnimationTimingFunction, webkitAppRegion, webkitAppearance, webkitBackfaceVisibility, webkitBackgroundClip, webkitBackgroundOrigin, webkitBackgroundSize, webkitBorderAfter, webkitBorderAfterColor, webkitBorderAfterStyle, webkitBorderAfterWidth, webkitBorderBefore, webkitBorderBeforeColor, webkitBorderBeforeStyle, webkitBorderBeforeWidth, webkitBorderBottomLeftRadius, webkitBorderBottomRightRadius, webkitBorderEnd, webkitBorderEndColor, webkitBorderEndStyle, webkitBorderEndWidth, webkitBorderHorizontalSpacing, webkitBorderImage, webkitBorderRadius, webkitBorderStart, webkitBorderStartColor, webkitBorderStartStyle, webkitBorderStartWidth, webkitBorderTopLeftRadius, webkitBorderTopRightRadius, webkitBorderVerticalSpacing, webkitBoxAlign, webkitBoxDecorationBreak, webkitBoxDirection, webkitBoxFlex, webkitBoxOrdinalGroup, webkitBoxOrient, webkitBoxPack, webkitBoxReflect, webkitBoxShadow, webkitBoxSizing, webkitClipPath, webkitColumnBreakAfter, webkitColumnBreakBefore, webkitColumnBreakInside, webkitColumnCount, webkitColumnGap, webkitColumnRule, webkitColumnRuleColor, webkitColumnRuleStyle, webkitColumnRuleWidth, webkitColumnSpan, webkitColumnWidth, webkitColumns, webkitFilter, webkitFlex, webkitFlexBasis, webkitFlexDirection, webkitFlexFlow, webkitFlexGrow, webkitFlexShrink, webkitFlexWrap, webkitFontFeatureSettings, webkitFontSmoothing, webkitHighlight, webkitHyphenateCharacter, webkitJustifyContent, webkitLineBreak, webkitLineClamp, webkitLocale, webkitLogicalHeight, webkitLogicalWidth, webkitMarginAfter, webkitMarginBefore, webkitMarginEnd, webkitMarginStart, webkitMask, webkitMaskBoxImage, webkitMaskBoxImageOutset, webkitMaskBoxImageRepeat, webkitMaskBoxImageSlice, webkitMaskBoxImageSource, webkitMaskBoxImageWidth, webkitMaskClip, webkitMaskComposite, webkitMaskImage, webkitMaskOrigin, webkitMaskPosition, webkitMaskPositionX, webkitMaskPositionY, webkitMaskRepeat, webkitMaskRepeatX, webkitMaskRepeatY, webkitMaskSize, webkitMaxLogicalHeight, webkitMaxLogicalWidth, webkitMinLogicalHeight, webkitMinLogicalWidth, webkitOpacity, webkitOrder, webkitPaddingAfter, webkitPaddingBefore, webkitPaddingEnd, webkitPaddingStart, webkitPerspective, webkitPerspectiveOrigin, webkitPerspectiveOriginX, webkitPerspectiveOriginY, webkitPrintColorAdjust, webkitRtlOrdering, webkitRubyPosition, webkitShapeImageThreshold, webkitShapeMargin, webkitShapeOutside, webkitTapHighlightColor, webkitTextCombine, webkitTextDecorationsInEffect, webkitTextEmphasis, webkitTextEmphasisColor, webkitTextEmphasisPosition, webkitTextEmphasisStyle, webkitTextFillColor, webkitTextOrientation, webkitTextSecurity, webkitTextSizeAdjust, webkitTextStroke, webkitTextStrokeColor, webkitTextStrokeWidth, webkitTransform, webkitTransformOrigin, webkitTransformOriginX, webkitTransformOriginY, webkitTransformOriginZ, webkitTransformStyle, webkitTransition, webkitTransitionDelay, webkitTransitionDuration, webkitTransitionProperty, webkitTransitionTimingFunction, webkitUserDrag, webkitUserModify, webkitUserSelect, webkitWritingMode, whiteSpace, whiteSpaceCollapse, willChange, wordBreak, wordSpacing, wordWrap, writingMode, zIndex, additive-symbols, ascent-override, aspect-ratio, background-position-x, background-position-y, background-repeat-x, background-repeat-y, base-palette, border-block, border-block-color, border-block-end, border-block-start, border-block-style, border-block-width, border-bottom, border-color, border-image, border-inline, border-inline-color, border-inline-end, border-inline-start, border-inline-style, border-inline-width, border-left, border-radius, border-right, border-spacing, border-style, border-top, border-width, color-scheme, column-fill, column-rule, content-visibility, counter-increment, counter-reset, counter-set, descent-override, flex-flow, font-display, font-feature-settings, font-synthesis, font-variation-settings, forced-color-adjust, grid-area, grid-column, grid-column-gap, grid-gap, grid-row, grid-row-gap, grid-template, initial-value, inset-block, inset-inline, line-gap-override, list-style, margin-block, margin-inline, override-colors, overscroll-behavior, overscroll-behavior-x, overscroll-behavior-y, padding-block, padding-inline, page-break-after, page-break-before, page-break-inside, page-orientation, place-content, place-items, place-self, scroll-margin, scroll-margin-block, scroll-margin-bottom, scroll-margin-inline, scroll-margin-left, scroll-margin-right, scroll-margin-top, scroll-padding, scroll-padding-block, scroll-padding-bottom, scroll-padding-inline, scroll-padding-left, scroll-padding-right, scroll-padding-top, scroll-snap-align, scroll-snap-stop, scroll-snap-type, size-adjust, speak-as, text-combine-upright, text-decoration-thickness, text-emphasis, text-orientation, text-underline-offset, transform-box, unicode-range, -webkit-align-content, -webkit-align-items, -webkit-align-self, -webkit-animation, -webkit-animation-delay, -webkit-animation-direction, -webkit-animation-duration, -webkit-animation-fill-mode, -webkit-animation-iteration-count, -webkit-animation-name, -webkit-animation-play-state, -webkit-animation-timing-function, -webkit-app-region, -webkit-appearance, -webkit-backface-visibility, -webkit-background-clip, -webkit-background-origin, -webkit-background-size, -webkit-border-after, -webkit-border-after-color, -webkit-border-after-style, -webkit-border-after-width, -webkit-border-before, -webkit-border-before-color, -webkit-border-before-style, -webkit-border-before-width, -webkit-border-bottom-left-radius, -webkit-border-bottom-right-radius, -webkit-border-end, -webkit-border-end-color, -webkit-border-end-style, -webkit-border-end-width, -webkit-border-radius, -webkit-border-start, -webkit-border-start-color, -webkit-border-start-style, -webkit-border-start-width, -webkit-border-top-left-radius, -webkit-border-top-right-radius, -webkit-box-shadow, -webkit-box-sizing, -webkit-clip-path, -webkit-column-break-after, -webkit-column-break-before, -webkit-column-break-inside, -webkit-column-count, -webkit-column-gap, -webkit-column-rule, -webkit-column-rule-color, -webkit-column-rule-style, -webkit-column-rule-width, -webkit-column-span, -webkit-column-width, -webkit-columns, -webkit-filter, -webkit-flex, -webkit-flex-basis, -webkit-flex-direction, -webkit-flex-flow, -webkit-flex-grow, -webkit-flex-shrink, -webkit-flex-wrap, -webkit-font-feature-settings, -webkit-hyphenate-character, -webkit-justify-content, -webkit-logical-height, -webkit-logical-width, -webkit-margin-after, -webkit-margin-before, -webkit-margin-end, -webkit-margin-start, -webkit-mask, -webkit-mask-position-x, -webkit-mask-position-y, -webkit-mask-repeat-x, -webkit-mask-repeat-y, -webkit-max-logical-height, -webkit-max-logical-width, -webkit-min-logical-height, -webkit-min-logical-width, -webkit-opacity, -webkit-order, -webkit-padding-after, -webkit-padding-before, -webkit-padding-end, -webkit-padding-start, -webkit-perspective, -webkit-perspective-origin, -webkit-perspective-origin-x, -webkit-perspective-origin-y, -webkit-ruby-position, -webkit-shape-image-threshold, -webkit-shape-margin, -webkit-shape-outside, -webkit-text-emphasis, -webkit-text-emphasis-color, -webkit-text-emphasis-position, -webkit-text-emphasis-style, -webkit-text-size-adjust, -webkit-text-stroke, -webkit-transform, -webkit-transform-origin, -webkit-transform-origin-x, -webkit-transform-origin-y, -webkit-transform-origin-z, -webkit-transform-style, -webkit-transition, -webkit-transition-delay, -webkit-transition-duration, -webkit-transition-property, -webkit-transition-timing-function, -webkit-user-select, white-space, word-wrap`,
			jsKeys: 'Object.assign, Object.getOwnPropertyDescriptor, Object.getOwnPropertyDescriptors, Object.getOwnPropertyNames, Object.getOwnPropertySymbols, Object.hasOwn, Object.is, Object.preventExtensions, Object.seal, Object.create, Object.defineProperties, Object.defineProperty, Object.freeze, Object.getPrototypeOf, Object.setPrototypeOf, Object.isExtensible, Object.isFrozen, Object.isSealed, Object.keys, Object.entries, Object.fromEntries, Object.values, Object.__defineGetter__, Object.__defineSetter__, Object.hasOwnProperty, Object.__lookupGetter__, Object.__lookupSetter__, Object.isPrototypeOf, Object.propertyIsEnumerable, Object.toString, Object.valueOf, Object.__proto__, Object.toLocaleString, Function.apply, Function.bind, Function.call, Function.toString, Boolean.toString, Boolean.valueOf, Symbol.for, Symbol.keyFor, Symbol.asyncIterator, Symbol.hasInstance, Symbol.isConcatSpreadable, Symbol.iterator, Symbol.match, Symbol.matchAll, Symbol.replace, Symbol.search, Symbol.species, Symbol.split, Symbol.toPrimitive, Symbol.toStringTag, Symbol.unscopables, Symbol.toString, Symbol.valueOf, Symbol.description, Error.captureStackTrace, Error.stackTraceLimit, Error.message, Error.toString, Number.isFinite, Number.isInteger, Number.isNaN, Number.isSafeInteger, Number.parseFloat, Number.parseInt, Number.MAX_VALUE, Number.MIN_VALUE, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.EPSILON, Number.toExponential, Number.toFixed, Number.toPrecision, Number.toString, Number.valueOf, Number.toLocaleString, BigInt.asUintN, BigInt.asIntN, BigInt.toLocaleString, BigInt.toString, BigInt.valueOf, Math.abs, Math.acos, Math.acosh, Math.asin, Math.asinh, Math.atan, Math.atanh, Math.atan2, Math.ceil, Math.cbrt, Math.expm1, Math.clz32, Math.cos, Math.cosh, Math.exp, Math.floor, Math.fround, Math.hypot, Math.imul, Math.log, Math.log1p, Math.log2, Math.log10, Math.max, Math.min, Math.pow, Math.random, Math.round, Math.sign, Math.sin, Math.sinh, Math.sqrt, Math.tan, Math.tanh, Math.trunc, Math.E, Math.LN10, Math.LN2, Math.LOG10E, Math.LOG2E, Math.PI, Math.SQRT1_2, Math.SQRT2, Date.now, Date.parse, Date.UTC, Date.toString, Date.toDateString, Date.toTimeString, Date.toISOString, Date.toUTCString, Date.toGMTString, Date.getDate, Date.setDate, Date.getDay, Date.getFullYear, Date.setFullYear, Date.getHours, Date.setHours, Date.getMilliseconds, Date.setMilliseconds, Date.getMinutes, Date.setMinutes, Date.getMonth, Date.setMonth, Date.getSeconds, Date.setSeconds, Date.getTime, Date.setTime, Date.getTimezoneOffset, Date.getUTCDate, Date.setUTCDate, Date.getUTCDay, Date.getUTCFullYear, Date.setUTCFullYear, Date.getUTCHours, Date.setUTCHours, Date.getUTCMilliseconds, Date.setUTCMilliseconds, Date.getUTCMinutes, Date.setUTCMinutes, Date.getUTCMonth, Date.setUTCMonth, Date.getUTCSeconds, Date.setUTCSeconds, Date.valueOf, Date.getYear, Date.setYear, Date.toJSON, Date.toLocaleString, Date.toLocaleDateString, Date.toLocaleTimeString, String.fromCharCode, String.fromCodePoint, String.raw, String.anchor, String.at, String.big, String.blink, String.bold, String.charAt, String.charCodeAt, String.codePointAt, String.concat, String.endsWith, String.fontcolor, String.fontsize, String.fixed, String.includes, String.indexOf, String.italics, String.lastIndexOf, String.link, String.localeCompare, String.match, String.matchAll, String.normalize, String.padEnd, String.padStart, String.repeat, String.replace, String.replaceAll, String.search, String.slice, String.small, String.split, String.strike, String.sub, String.substr, String.substring, String.sup, String.startsWith, String.toString, String.trim, String.trimStart, String.trimLeft, String.trimEnd, String.trimRight, String.toLocaleLowerCase, String.toLocaleUpperCase, String.toLowerCase, String.toUpperCase, String.valueOf, String.isWellFormed, String.toWellFormed, RegExp.input, RegExp.$_, RegExp.lastMatch, RegExp.$&, RegExp.lastParen, RegExp.$+, RegExp.leftContext, RegExp.$`, RegExp.rightContext, RegExp.$\', RegExp.$1, RegExp.$2, RegExp.$3, RegExp.$4, RegExp.$5, RegExp.$6, RegExp.$7, RegExp.$8, RegExp.$9, RegExp.exec, RegExp.dotAll, RegExp.flags, RegExp.global, RegExp.hasIndices, RegExp.ignoreCase, RegExp.multiline, RegExp.source, RegExp.sticky, RegExp.unicode, RegExp.compile, RegExp.toString, RegExp.test, RegExp.unicodeSets, Array.isArray, Array.from, Array.of, Array.at, Array.concat, Array.copyWithin, Array.fill, Array.find, Array.findIndex, Array.findLast, Array.findLastIndex, Array.lastIndexOf, Array.pop, Array.push, Array.reverse, Array.shift, Array.unshift, Array.slice, Array.sort, Array.splice, Array.includes, Array.indexOf, Array.join, Array.keys, Array.entries, Array.values, Array.forEach, Array.filter, Array.flat, Array.flatMap, Array.map, Array.every, Array.some, Array.reduce, Array.reduceRight, Array.toLocaleString, Array.toString, Array.toReversed, Array.toSorted, Array.toSpliced, Array.with, Map.get, Map.set, Map.has, Map.delete, Map.clear, Map.entries, Map.forEach, Map.keys, Map.size, Map.values, Set.has, Set.add, Set.delete, Set.clear, Set.entries, Set.forEach, Set.size, Set.values, Set.keys, WeakMap.delete, WeakMap.get, WeakMap.set, WeakMap.has, WeakSet.delete, WeakSet.has, WeakSet.add, Atomics.load, Atomics.store, Atomics.add, Atomics.sub, Atomics.and, Atomics.or, Atomics.xor, Atomics.exchange, Atomics.compareExchange, Atomics.isLockFree, Atomics.wait, Atomics.waitAsync, Atomics.notify, JSON.parse, JSON.stringify, JSON.rawJSON, JSON.isRawJSON, Promise.all, Promise.allSettled, Promise.any, Promise.race, Promise.resolve, Promise.reject, Promise.then, Promise.catch, Promise.finally, Reflect.defineProperty, Reflect.deleteProperty, Reflect.apply, Reflect.construct, Reflect.get, Reflect.getOwnPropertyDescriptor, Reflect.getPrototypeOf, Reflect.has, Reflect.isExtensible, Reflect.ownKeys, Reflect.preventExtensions, Reflect.set, Reflect.setPrototypeOf, Proxy.revocable, Intl.getCanonicalLocales, Intl.supportedValuesOf, Intl.DateTimeFormat, Intl.NumberFormat, Intl.Collator, Intl.v8BreakIterator, Intl.PluralRules, Intl.RelativeTimeFormat, Intl.ListFormat, Intl.Locale, Intl.DisplayNames, Intl.Segmenter, WebAssembly.compile, WebAssembly.validate, WebAssembly.instantiate, WebAssembly.compileStreaming, WebAssembly.instantiateStreaming, WebAssembly.Module, WebAssembly.Instance, WebAssembly.Table, WebAssembly.Memory, WebAssembly.Global, WebAssembly.Tag, WebAssembly.Exception, WebAssembly.CompileError, WebAssembly.LinkError, WebAssembly.RuntimeError, Document.implementation, Document.URL, Document.documentURI, Document.compatMode, Document.characterSet, Document.charset, Document.inputEncoding, Document.contentType, Document.doctype, Document.documentElement, Document.xmlEncoding, Document.xmlVersion, Document.xmlStandalone, Document.domain, Document.referrer, Document.cookie, Document.lastModified, Document.readyState, Document.title, Document.dir, Document.body, Document.head, Document.images, Document.embeds, Document.plugins, Document.links, Document.forms, Document.scripts, Document.currentScript, Document.defaultView, Document.designMode, Document.onreadystatechange, Document.anchors, Document.applets, Document.fgColor, Document.linkColor, Document.vlinkColor, Document.alinkColor, Document.bgColor, Document.all, Document.scrollingElement, Document.onpointerlockchange, Document.onpointerlockerror, Document.hidden, Document.visibilityState, Document.wasDiscarded, Document.prerendering, Document.featurePolicy, Document.webkitVisibilityState, Document.webkitHidden, Document.onbeforecopy, Document.onbeforecut, Document.onbeforepaste, Document.onfreeze, Document.onprerenderingchange, Document.onresume, Document.onsearch, Document.onvisibilitychange, Document.fullscreenEnabled, Document.fullscreen, Document.onfullscreenchange, Document.onfullscreenerror, Document.webkitIsFullScreen, Document.webkitCurrentFullScreenElement, Document.webkitFullscreenEnabled, Document.webkitFullscreenElement, Document.onwebkitfullscreenchange, Document.onwebkitfullscreenerror, Document.rootElement, Document.pictureInPictureEnabled, Document.pictureInPictureElement, Document.onbeforexrselect, Document.onabort, Document.onbeforeinput, Document.onblur, Document.oncancel, Document.oncanplay, Document.oncanplaythrough, Document.onchange, Document.onclick, Document.onclose, Document.oncontextlost, Document.oncontextmenu, Document.oncontextrestored, Document.oncuechange, Document.ondblclick, Document.ondrag, Document.ondragend, Document.ondragenter, Document.ondragleave, Document.ondragover, Document.ondragstart, Document.ondrop, Document.ondurationchange, Document.onemptied, Document.onended, Document.onerror, Document.onfocus, Document.onformdata, Document.oninput, Document.oninvalid, Document.onkeydown, Document.onkeypress, Document.onkeyup, Document.onload, Document.onloadeddata, Document.onloadedmetadata, Document.onloadstart, Document.onmousedown, Document.onmouseenter, Document.onmouseleave, Document.onmousemove, Document.onmouseout, Document.onmouseover, Document.onmouseup, Document.onmousewheel, Document.onpause, Document.onplay, Document.onplaying, Document.onprogress, Document.onratechange, Document.onreset, Document.onresize, Document.onscroll, Document.onsecuritypolicyviolation, Document.onseeked, Document.onseeking, Document.onselect, Document.onslotchange, Document.onstalled, Document.onsubmit, Document.onsuspend, Document.ontimeupdate, Document.ontoggle, Document.onvolumechange, Document.onwaiting, Document.onwebkitanimationend, Document.onwebkitanimationiteration, Document.onwebkitanimationstart, Document.onwebkittransitionend, Document.onwheel, Document.onauxclick, Document.ongotpointercapture, Document.onlostpointercapture, Document.onpointerdown, Document.onpointermove, Document.onpointerrawupdate, Document.onpointerup, Document.onpointercancel, Document.onpointerover, Document.onpointerout, Document.onpointerenter, Document.onpointerleave, Document.onselectstart, Document.onselectionchange, Document.onanimationend, Document.onanimationiteration, Document.onanimationstart, Document.ontransitionrun, Document.ontransitionstart, Document.ontransitionend, Document.ontransitioncancel, Document.oncopy, Document.oncut, Document.onpaste, Document.children, Document.firstElementChild, Document.lastElementChild, Document.childElementCount, Document.activeElement, Document.styleSheets, Document.pointerLockElement, Document.fullscreenElement, Document.adoptedStyleSheets, Document.fonts, Document.adoptNode, Document.append, Document.captureEvents, Document.caretRangeFromPoint, Document.clear, Document.close, Document.createAttribute, Document.createAttributeNS, Document.createCDATASection, Document.createComment, Document.createDocumentFragment, Document.createElement, Document.createElementNS, Document.createEvent, Document.createExpression, Document.createNSResolver, Document.createNodeIterator, Document.createProcessingInstruction, Document.createRange, Document.createTextNode, Document.createTreeWalker, Document.elementFromPoint, Document.elementsFromPoint, Document.evaluate, Document.execCommand, Document.exitFullscreen, Document.exitPictureInPicture, Document.exitPointerLock, Document.getElementById, Document.getElementsByClassName, Document.getElementsByName, Document.getElementsByTagName, Document.getElementsByTagNameNS, Document.getSelection, Document.hasFocus, Document.importNode, Document.open, Document.prepend, Document.queryCommandEnabled, Document.queryCommandIndeterm, Document.queryCommandState, Document.queryCommandSupported, Document.queryCommandValue, Document.querySelector, Document.querySelectorAll, Document.releaseEvents, Document.replaceChildren, Document.webkitCancelFullScreen, Document.webkitExitFullscreen, Document.write, Document.writeln, Document.fragmentDirective, Document.onbeforematch, Document.onbeforetoggle, Document.timeline, Document.oncontentvisibilityautostatechange, Document.onscrollend, Document.getAnimations, Document.startViewTransition, Element.namespaceURI, Element.prefix, Element.localName, Element.tagName, Element.id, Element.className, Element.classList, Element.slot, Element.attributes, Element.shadowRoot, Element.part, Element.assignedSlot, Element.innerHTML, Element.outerHTML, Element.scrollTop, Element.scrollLeft, Element.scrollWidth, Element.scrollHeight, Element.clientTop, Element.clientLeft, Element.clientWidth, Element.clientHeight, Element.onbeforecopy, Element.onbeforecut, Element.onbeforepaste, Element.onsearch, Element.elementTiming, Element.onfullscreenchange, Element.onfullscreenerror, Element.onwebkitfullscreenchange, Element.onwebkitfullscreenerror, Element.role, Element.ariaAtomic, Element.ariaAutoComplete, Element.ariaBusy, Element.ariaBrailleLabel, Element.ariaBrailleRoleDescription, Element.ariaChecked, Element.ariaColCount, Element.ariaColIndex, Element.ariaColSpan, Element.ariaCurrent, Element.ariaDescription, Element.ariaDisabled, Element.ariaExpanded, Element.ariaHasPopup, Element.ariaHidden, Element.ariaInvalid, Element.ariaKeyShortcuts, Element.ariaLabel, Element.ariaLevel, Element.ariaLive, Element.ariaModal, Element.ariaMultiLine, Element.ariaMultiSelectable, Element.ariaOrientation, Element.ariaPlaceholder, Element.ariaPosInSet, Element.ariaPressed, Element.ariaReadOnly, Element.ariaRelevant, Element.ariaRequired, Element.ariaRoleDescription, Element.ariaRowCount, Element.ariaRowIndex, Element.ariaRowSpan, Element.ariaSelected, Element.ariaSetSize, Element.ariaSort, Element.ariaValueMax, Element.ariaValueMin, Element.ariaValueNow, Element.ariaValueText, Element.children, Element.firstElementChild, Element.lastElementChild, Element.childElementCount, Element.previousElementSibling, Element.nextElementSibling, Element.after, Element.animate, Element.append, Element.attachShadow, Element.before, Element.closest, Element.computedStyleMap, Element.getAttribute, Element.getAttributeNS, Element.getAttributeNames, Element.getAttributeNode, Element.getAttributeNodeNS, Element.getBoundingClientRect, Element.getClientRects, Element.getElementsByClassName, Element.getElementsByTagName, Element.getElementsByTagNameNS, Element.getInnerHTML, Element.hasAttribute, Element.hasAttributeNS, Element.hasAttributes, Element.hasPointerCapture, Element.insertAdjacentElement, Element.insertAdjacentHTML, Element.insertAdjacentText, Element.matches, Element.prepend, Element.querySelector, Element.querySelectorAll, Element.releasePointerCapture, Element.remove, Element.removeAttribute, Element.removeAttributeNS, Element.removeAttributeNode, Element.replaceChildren, Element.replaceWith, Element.requestFullscreen, Element.requestPointerLock, Element.scroll, Element.scrollBy, Element.scrollIntoView, Element.scrollIntoViewIfNeeded, Element.scrollTo, Element.setAttribute, Element.setAttributeNS, Element.setAttributeNode, Element.setAttributeNodeNS, Element.setPointerCapture, Element.toggleAttribute, Element.webkitMatchesSelector, Element.webkitRequestFullScreen, Element.webkitRequestFullscreen, Element.checkVisibility, Element.getAnimations, Element.setHTML',
		},
		'Firefox': {
			version: 112,
			windowKeys: `undefined, globalThis, Array, Boolean, JSON, Date, Math, Number, String, RegExp, Error, InternalError, AggregateError, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, ArrayBuffer, Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, Uint8ClampedArray, BigInt64Array, BigUint64Array, BigInt, Proxy, WeakMap, Set, DataView, Symbol, Intl, Reflect, WeakSet, Atomics, WebAssembly, FinalizationRegistry, WeakRef, NaN, Infinity, isNaN, isFinite, parseFloat, parseInt, escape, unescape, decodeURI, encodeURI, decodeURIComponent, encodeURIComponent, CryptoKey, FocusEvent, CSSRuleList, MediaStreamTrackAudioSourceNode, SVGGeometryElement, SVGElement, SVGPatternElement, WebSocket, HTMLAllCollection, UIEvent, PageTransitionEvent, AuthenticatorAssertionResponse, ScreenOrientation, MediaCapabilitiesInfo, SVGImageElement, NodeIterator, SVGFEOffsetElement, AnimationPlaybackEvent, MessageChannel, TextDecoderStream, ShadowRoot, SVGAnimatedNumberList, SVGEllipseElement, DOMStringMap, AudioWorkletNode, TextMetrics, SVGPointList, SVGSymbolElement, DocumentType, StorageEvent, SVGAnimatedLength, PerformanceObserver, WebGLSampler, PushSubscription, CustomElementRegistry, SVGUnitTypes, SVGFEMorphologyElement, NodeFilter, File, Geolocation, ProcessingInstruction, AudioScheduledSourceNode, FileReader, IDBObjectStore, SVGStringList, HTMLParagraphElement, IDBDatabase, SVGLinearGradientElement, Animation, HTMLIFrameElement, HTMLTableSectionElement, Worker, TimeRanges, Navigator, InputEvent, GamepadHapticActuator, SVGMatrix, Worklet, SVGFEMergeNodeElement, DOMTokenList, MediaQueryListEvent, HTMLParamElement, MessagePort, SVGLengthList, ResizeObserverSize, TextEncoderStream, PromiseRejectionEvent, SVGTransformList, DOMPoint, SVGTextElement, WebGL2RenderingContext, PluginArray, IDBVersionChangeEvent, FontFaceSetLoadEvent, CSSStyleDeclaration, SVGGraphicsElement, HTMLOListElement, HTMLTextAreaElement, Storage, XPathEvaluator, MouseScrollEvent, HTMLCanvasElement, HTMLBodyElement, HTMLCollection, HTMLHtmlElement, MediaList, HTMLAudioElement, IDBFactory, SVGAnimatedTransformList, MimeType, SVGAnimatedPreserveAspectRatio, HTMLFrameElement, HTMLLegendElement, HTMLMapElement, SVGAnimateMotionElement, HTMLFrameSetElement, CSSGroupingRule, Clipboard, IIRFilterNode, ReadableStreamDefaultController, FileSystemFileHandle, HTMLElement, CSSConditionRule, CSS, SVGFEComponentTransferElement, DOMRectList, AudioWorklet, SourceBuffer, HTMLStyleElement, DocumentTimeline, IDBKeyRange, DOMRequest, PerformanceTiming, GeolocationPosition, SVGTextPositioningElement, OfflineResourceList, IDBOpenDBRequest, SVGFEFuncGElement, MouseEvent, FontFaceSet, OffscreenCanvasRenderingContext2D, OscillatorNode, SpeechSynthesisUtterance, AudioContext, FileSystemEntry, PaintRequest, SVGFEConvolveMatrixElement, ChannelSplitterNode, AudioBufferSourceNode, CaretPosition, AbortSignal, HTMLBRElement, XSLTProcessor, SVGFESpecularLightingElement, mozRTCPeerConnection, XMLSerializer, StorageManager, HTMLImageElement, WebGLQuery, FileSystemHandle, Permissions, BaseAudioContext, MediaStream, History, DOMStringList, StereoPannerNode, ReadableStreamDefaultReader, HTMLDListElement, MutationEvent, SVGComponentTransferFunctionElement, Notification, DynamicsCompressorNode, LockManager, Option, HTMLMeterElement, RTCPeerConnection, CloseEvent, AudioBuffer, ByteLengthQueuingStrategy, SVGFECompositeElement, HTMLTrackElement, ServiceWorkerContainer, MediaStreamTrack, WebGLContextEvent, WritableStreamDefaultController, SVGPathElement, BarProp, PerformanceObserverEntryList, RTCRtpReceiver, StyleSheet, WebGLUniformLocation, HTMLMetaElement, CanvasPattern, OffscreenCanvas, SVGTransform, SVGTextContentElement, PerformanceServerTiming, TrackEvent, XPathExpression, AnimationTimeline, MediaError, HTMLAnchorElement, XMLHttpRequest, SecurityPolicyViolationEvent, CSSMozDocumentRule, CSSImportRule, SVGLength, WaveShaperNode, RTCTrackEvent, RTCRtpSender, CSSAnimation, CSSFontPaletteValuesRule, AnimationEffect, CSSContainerRule, RTCStatsReport, SourceBufferList, HTMLHeadingElement, CanvasCaptureMediaStream, HTMLOptionElement, SVGSVGElement, WebGLActiveInfo, MIDIPort, HTMLUListElement, XPathResult, SVGUseElement, Credential, PublicKeyCredential, DOMQuad, Selection, HTMLDataElement, CSSLayerStatementRule, WebGLShader, Location, MIDIAccess, MediaRecorderErrorEvent, SVGFEGaussianBlurElement, MediaStreamEvent, CSSFontFeatureValuesRule, AbortController, RTCIceCandidate, HTMLLabelElement, PerformanceMeasure, HTMLDirectoryElement, SVGStopElement, PermissionStatus, PerformancePaintTiming, FileSystemFileEntry, SVGMarkerElement, console, SharedWorker, WebGLVertexArrayObject, HTMLOptionsCollection, HTMLTitleElement, TreeWalker, CompositionEvent, IDBCursor, TransformStream, PerformanceNavigation, Blob, SpeechSynthesisErrorEvent, CSSStyleSheet, HTMLUnknownElement, KeyEvent, HTMLOptGroupElement, CanvasGradient, AnalyserNode, Element, AnimationEvent, HTMLFieldSetElement, MediaSession, MutationObserver, SVGAnimateTransformElement, OfflineAudioContext, CacheStorage, MediaKeyStatusMap, GamepadEvent, RTCPeerConnectionIceEvent, AudioParam, AbstractRange, TextEncoder, FileSystemDirectoryHandle, CSSSupportsRule, SVGPreserveAspectRatio, PerformanceEntry, mozRTCSessionDescription, VideoPlaybackQuality, HTMLTableRowElement, HTMLFontElement, MediaKeys, DataTransfer, CSSPageRule, SVGAngle, WebGLFramebuffer, WebGLRenderbuffer, Directory, HTMLAreaElement, MimeTypeArray, NamedNodeMap, CSSKeyframeRule, XMLDocument, HTMLSlotElement, MediaDevices, IDBTransaction, HTMLModElement, MediaKeyError, SVGFEFloodElement, DOMParser, HTMLScriptElement, ReadableStreamBYOBReader, HTMLDataListElement, MediaElementAudioSourceNode, PeriodicWave, DragEvent, SVGStyleElement, SubtleCrypto, TransformStreamDefaultController, MessageEvent, WebGLProgram, SVGSetElement, WebGLShaderPrecisionFormat, ErrorEvent, NodeList, GamepadButton, MediaDeviceInfo, HTMLMediaElement, DeviceMotionEvent, ImageData, Range, PushSubscriptionOptions, OfflineAudioCompletionEvent, DOMPointReadOnly, DocumentFragment, Attr, BroadcastChannel, HTMLLinkElement, DOMMatrixReadOnly, AuthenticatorAttestationResponse, IdleDeadline, ImageBitmapRenderingContext, MediaKeySystemAccess, SVGPoint, SVGFEDropShadowElement, SVGFEDiffuseLightingElement, SVGRadialGradientElement, RTCDataChannelEvent, Headers, FileSystemDirectoryReader, SVGFEDisplacementMapElement, SVGDefsElement, SVGFEDistantLightElement, HTMLFormControlsCollection, WebGLRenderingContext, HTMLTableElement, SVGNumber, SVGAnimatedInteger, VisualViewport, SpeechSynthesisVoice, WheelEvent, SVGAnimatedNumber, GamepadPose, ResizeObserver, TextDecoder, FormDataEvent, FileSystem, IntersectionObserverEntry, SVGPolylineElement, Text, CanvasRenderingContext2D, CSSFontFaceRule, SVGGradientElement, WritableStream, SVGNumberList, SpeechSynthesisEvent, WritableStreamDefaultWriter, SVGFilterElement, URL, SVGRect, SVGFEImageElement, AudioDestinationNode, IDBRequest, MathMLElement, HTMLTimeElement, TextTrackCue, RadioNodeList, SVGTSpanElement, SVGAnimatedLengthList, SVGAnimatedString, HTMLSourceElement, Lock, ProgressEvent, PopupBlockedEvent, ValidityState, WebKitCSSMatrix, AudioListener, HTMLFormElement, PerformanceEventTiming, HTMLProgressElement, Gamepad, MediaKeySession, MediaStreamAudioSourceNode, CSSRule, HTMLPreElement, webkitURL, AuthenticatorResponse, HTMLEmbedElement, HTMLDivElement, MediaStreamAudioDestinationNode, CredentialsContainer, SVGScriptElement, MutationRecord, ConvolverNode, SVGFEPointLightElement, Screen, ClipboardEvent, SVGFETurbulenceElement, SVGFEBlendElement, GeolocationCoordinates, TextTrackList, FontFace, HTMLInputElement, Request, SVGGElement, SVGClipPathElement, TimeEvent, TextTrackCueList, BiquadFilterNode, SVGTitleElement, SVGFETileElement, SVGFEFuncRElement, HTMLButtonElement, Path2D, HTMLTableCellElement, StaticRange, SVGLineElement, CSSCounterStyleRule, HTMLQuoteElement, AudioParamMap, DeviceOrientationEvent, IDBCursorWithValue, MediaKeyMessageEvent, SVGAnimatedEnumeration, MIDIOutput, HTMLHRElement, ImageBitmap, CSSStyleRule, MIDIOutputMap, SVGAElement, ElementInternals, VTTCue, MediaMetadata, PannerNode, SVGForeignObjectElement, SVGSwitchElement, HTMLVideoElement, MediaEncryptedEvent, EventSource, SVGAnimateElement, DOMException, CSSTransition, Image, VTTRegion, CharacterData, SVGFEFuncAElement, SVGDescElement, SubmitEvent, RTCSessionDescription, SVGAnimatedBoolean, StyleSheetList, HTMLTableColElement, HTMLMarqueeElement, CSSKeyframesRule, SVGMetadataElement, MIDIInputMap, PushManager, GainNode, DOMRect, SVGMaskElement, HTMLMenuElement, RTCDTMFToneChangeEvent, IDBIndex, CSSMediaRule, HashChangeEvent, ServiceWorker, SVGFEFuncBElement, BlobEvent, DOMImplementation, GeolocationPositionError, SVGMPathElement, SVGFEColorMatrixElement, KeyboardEvent, HTMLLIElement, RTCCertificate, SpeechSynthesis, ReadableStreamBYOBRequest, DelayNode, XMLHttpRequestEventTarget, PopStateEvent, Cache, ScrollAreaEvent, RTCDtlsTransport, SVGTextPathElement, XMLHttpRequestUpload, HTMLOutputElement, MediaRecorder, PaintRequestList, SVGRectElement, AudioNode, DOMMatrix, MediaSource, FormData, NavigationPreloadManager, HTMLTableCaptionElement, CustomEvent, MediaCapabilities, SVGFEMergeElement, MediaStreamTrackEvent, Audio, CSS2Properties, FileList, SVGAnimatedRect, FileSystemWritableFileStream, ReadableStream, HTMLPictureElement, HTMLSelectElement, AudioProcessingEvent, PerformanceResourceTiming, Plugin, Crypto, CSSLayerBlockRule, ConstantSourceNode, HTMLSpanElement, DataTransferItem, ServiceWorkerRegistration, WebGLTransformFeedback, SVGViewElement, CSSNamespaceRule, URLSearchParams, WebGLBuffer, MediaQueryList, PointerEvent, SVGPolygonElement, KeyframeEffect, RTCDTMFSender, ResizeObserverEntry, SVGCircleElement, SVGAnimationElement, WebGLTexture, DOMRectReadOnly, WebGLSync, IntersectionObserver, MIDIMessageEvent, ReadableByteStreamController, HTMLBaseElement, CountQueuingStrategy, mozRTCIceCandidate, DataTransferItemList, HTMLHeadElement, CDATASection, HTMLDialogElement, HTMLTemplateElement, RTCDataChannel, PerformanceMark, SVGFESpotLightElement, BeforeUnloadEvent, MIDIConnectionEvent, RTCRtpTransceiver, TextTrack, TransitionEvent, HTMLDetailsElement, Comment, HTMLObjectElement, ChannelMergerNode, SVGAnimatedAngle, Response, FileSystemDirectoryEntry, MIDIInput, ScriptProcessorNode, Function, Object, eval, EventTarget, Window, close, stop, focus, blur, open, alert, confirm, prompt, print, postMessage, captureEvents, releaseEvents, getSelection, getComputedStyle, matchMedia, moveTo, moveBy, resizeTo, resizeBy, scroll, scrollTo, scrollBy, getDefaultComputedStyle, scrollByLines, scrollByPages, sizeToContent, updateCommands, find, dump, setResizable, requestIdleCallback, cancelIdleCallback, requestAnimationFrame, cancelAnimationFrame, reportError, btoa, atob, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, createImageBitmap, structuredClone, fetch, self, name, history, customElements, locationbar, menubar, personalbar, scrollbars, statusbar, toolbar, status, closed, event, frames, length, opener, parent, frameElement, navigator, clientInformation, external, applicationCache, screen, innerWidth, innerHeight, scrollX, pageXOffset, scrollY, pageYOffset, screenLeft, screenTop, screenX, screenY, outerWidth, outerHeight, performance, mozInnerScreenX, mozInnerScreenY, devicePixelRatio, scrollMaxX, scrollMaxY, fullScreen, ondevicemotion, ondeviceorientation, ondeviceorientationabsolute, InstallTrigger, visualViewport, crypto, onabort, onblur, onfocus, onauxclick, onbeforeinput, oncanplay, oncanplaythrough, onchange, onclick, onclose, oncontextmenu, oncopy, oncuechange, oncut, ondblclick, ondrag, ondragend, ondragenter, ondragexit, ondragleave, ondragover, ondragstart, ondrop, ondurationchange, onemptied, onended, onformdata, oninput, oninvalid, onkeydown, onkeypress, onkeyup, onload, onloadeddata, onloadedmetadata, onloadstart, onmousedown, onmouseenter, onmouseleave, onmousemove, onmouseout, onmouseover, onmouseup, onwheel, onpaste, onpause, onplay, onplaying, onprogress, onratechange, onreset, onresize, onscroll, onscrollend, onsecuritypolicyviolation, onseeked, onseeking, onselect, onslotchange, onstalled, onsubmit, onsuspend, ontimeupdate, onvolumechange, onwaiting, onselectstart, onselectionchange, ontoggle, onpointercancel, onpointerdown, onpointerup, onpointermove, onpointerout, onpointerover, onpointerenter, onpointerleave, ongotpointercapture, onlostpointercapture, onmozfullscreenchange, onmozfullscreenerror, onanimationcancel, onanimationend, onanimationiteration, onanimationstart, ontransitioncancel, ontransitionend, ontransitionrun, ontransitionstart, onwebkitanimationend, onwebkitanimationiteration, onwebkitanimationstart, onwebkittransitionend, onerror, speechSynthesis, onafterprint, onbeforeprint, onbeforeunload, onhashchange, onlanguagechange, onmessage, onmessageerror, onoffline, ononline, onpagehide, onpageshow, onpopstate, onrejectionhandled, onstorage, onunhandledrejection, onunload, ongamepadconnected, ongamepaddisconnected, localStorage, origin, crossOriginIsolated, isSecureContext, indexedDB, caches, sessionStorage, window, document, location, top, netscape, Node, Document, HTMLDocument, EventCounts, Map, Promise, Event`,
			cssKeys: `alignContent, align-content, alignItems, align-items, alignSelf, align-self, aspectRatio, aspect-ratio, backfaceVisibility, backface-visibility, borderCollapse, border-collapse, borderImageRepeat, border-image-repeat, boxDecorationBreak, box-decoration-break, boxSizing, box-sizing, breakInside, break-inside, captionSide, caption-side, clear, colorInterpolation, color-interpolation, colorInterpolationFilters, color-interpolation-filters, columnCount, column-count, columnFill, column-fill, columnSpan, column-span, contain, containerType, container-type, direction, display, dominantBaseline, dominant-baseline, emptyCells, empty-cells, flexDirection, flex-direction, flexWrap, flex-wrap, cssFloat, float, fontKerning, font-kerning, fontLanguageOverride, font-language-override, fontOpticalSizing, font-optical-sizing, fontSizeAdjust, font-size-adjust, fontStretch, font-stretch, fontStyle, font-style, fontVariantCaps, font-variant-caps, fontVariantEastAsian, font-variant-east-asian, fontVariantLigatures, font-variant-ligatures, fontVariantNumeric, font-variant-numeric, fontVariantPosition, font-variant-position, fontWeight, font-weight, gridAutoFlow, grid-auto-flow, hyphens, imageOrientation, image-orientation, imageRendering, image-rendering, imeMode, ime-mode, isolation, justifyContent, justify-content, justifyItems, justify-items, justifySelf, justify-self, lineBreak, line-break, listStylePosition, list-style-position, maskType, mask-type, mixBlendMode, mix-blend-mode, MozBoxAlign, -moz-box-align, MozBoxDirection, -moz-box-direction, MozBoxOrient, -moz-box-orient, MozBoxPack, -moz-box-pack, MozFloatEdge, -moz-float-edge, MozOrient, -moz-orient, MozTextSizeAdjust, -moz-text-size-adjust, MozUserFocus, -moz-user-focus, MozUserInput, -moz-user-input, MozUserModify, -moz-user-modify, MozWindowDragging, -moz-window-dragging, objectFit, object-fit, offsetRotate, offset-rotate, outlineStyle, outline-style, overflowAnchor, overflow-anchor, overflowWrap, overflow-wrap, paintOrder, paint-order, pointerEvents, pointer-events, position, printColorAdjust, print-color-adjust, resize, rubyAlign, ruby-align, rubyPosition, ruby-position, scrollBehavior, scroll-behavior, scrollSnapAlign, scroll-snap-align, scrollSnapStop, scroll-snap-stop, scrollSnapType, scroll-snap-type, scrollbarGutter, scrollbar-gutter, scrollbarWidth, scrollbar-width, shapeRendering, shape-rendering, strokeLinecap, stroke-linecap, strokeLinejoin, stroke-linejoin, tableLayout, table-layout, textAlign, text-align, textAlignLast, text-align-last, textAnchor, text-anchor, textCombineUpright, text-combine-upright, textDecorationLine, text-decoration-line, textDecorationSkipInk, text-decoration-skip-ink, textDecorationStyle, text-decoration-style, textEmphasisPosition, text-emphasis-position, textJustify, text-justify, textOrientation, text-orientation, textRendering, text-rendering, textTransform, text-transform, textUnderlinePosition, text-underline-position, touchAction, touch-action, transformBox, transform-box, transformStyle, transform-style, unicodeBidi, unicode-bidi, userSelect, user-select, vectorEffect, vector-effect, visibility, webkitLineClamp, WebkitLineClamp, -webkit-line-clamp, whiteSpace, white-space, wordBreak, word-break, writingMode, writing-mode, zIndex, z-index, appearance, MozForceBrokenImageIcon, -moz-force-broken-image-icon, breakAfter, break-after, breakBefore, break-before, clipRule, clip-rule, fillRule, fill-rule, fillOpacity, fill-opacity, strokeOpacity, stroke-opacity, fontSynthesisSmallCaps, font-synthesis-small-caps, fontSynthesisStyle, font-synthesis-style, fontSynthesisWeight, font-synthesis-weight, MozBoxOrdinalGroup, -moz-box-ordinal-group, order, flexGrow, flex-grow, flexShrink, flex-shrink, MozBoxFlex, -moz-box-flex, strokeMiterlimit, stroke-miterlimit, overflowBlock, overflow-block, overflowInline, overflow-inline, overflowX, overflow-x, overflowY, overflow-y, overscrollBehaviorBlock, overscroll-behavior-block, overscrollBehaviorInline, overscroll-behavior-inline, overscrollBehaviorX, overscroll-behavior-x, overscrollBehaviorY, overscroll-behavior-y, floodOpacity, flood-opacity, opacity, shapeImageThreshold, shape-image-threshold, stopOpacity, stop-opacity, borderBlockEndStyle, border-block-end-style, borderBlockStartStyle, border-block-start-style, borderBottomStyle, border-bottom-style, borderInlineEndStyle, border-inline-end-style, borderInlineStartStyle, border-inline-start-style, borderLeftStyle, border-left-style, borderRightStyle, border-right-style, borderTopStyle, border-top-style, columnRuleStyle, column-rule-style, accentColor, accent-color, animationDelay, animation-delay, animationDirection, animation-direction, animationDuration, animation-duration, animationFillMode, animation-fill-mode, animationIterationCount, animation-iteration-count, animationName, animation-name, animationPlayState, animation-play-state, animationTimingFunction, animation-timing-function, backdropFilter, backdrop-filter, backgroundAttachment, background-attachment, backgroundBlendMode, background-blend-mode, backgroundClip, background-clip, backgroundImage, background-image, backgroundOrigin, background-origin, backgroundPositionX, background-position-x, backgroundPositionY, background-position-y, backgroundRepeat, background-repeat, backgroundSize, background-size, borderImageOutset, border-image-outset, borderImageSlice, border-image-slice, borderImageWidth, border-image-width, borderSpacing, border-spacing, boxShadow, box-shadow, caretColor, caret-color, clip, clipPath, clip-path, color, colorScheme, color-scheme, columnWidth, column-width, containerName, container-name, content, counterIncrement, counter-increment, counterReset, counter-reset, counterSet, counter-set, cursor, d, filter, flexBasis, flex-basis, fontFamily, font-family, fontFeatureSettings, font-feature-settings, fontPalette, font-palette, fontSize, font-size, fontVariantAlternates, font-variant-alternates, fontVariationSettings, font-variation-settings, gridTemplateAreas, grid-template-areas, hyphenateCharacter, hyphenate-character, letterSpacing, letter-spacing, lineHeight, line-height, listStyleType, list-style-type, maskClip, mask-clip, maskComposite, mask-composite, maskImage, mask-image, maskMode, mask-mode, maskOrigin, mask-origin, maskPositionX, mask-position-x, maskPositionY, mask-position-y, maskRepeat, mask-repeat, maskSize, mask-size, offsetPath, offset-path, page, perspective, quotes, rotate, scale, scrollbarColor, scrollbar-color, shapeOutside, shape-outside, strokeDasharray, stroke-dasharray, strokeDashoffset, stroke-dashoffset, strokeWidth, stroke-width, tabSize, tab-size, textDecorationThickness, text-decoration-thickness, textEmphasisStyle, text-emphasis-style, textOverflow, text-overflow, textShadow, text-shadow, transitionDelay, transition-delay, transitionDuration, transition-duration, transitionProperty, transition-property, transitionTimingFunction, transition-timing-function, translate, verticalAlign, vertical-align, willChange, will-change, wordSpacing, word-spacing, objectPosition, object-position, perspectiveOrigin, perspective-origin, offsetAnchor, offset-anchor, fill, stroke, transformOrigin, transform-origin, gridTemplateColumns, grid-template-columns, gridTemplateRows, grid-template-rows, borderImageSource, border-image-source, listStyleImage, list-style-image, gridAutoColumns, grid-auto-columns, gridAutoRows, grid-auto-rows, transform, columnGap, column-gap, rowGap, row-gap, markerEnd, marker-end, markerMid, marker-mid, markerStart, marker-start, containIntrinsicBlockSize, contain-intrinsic-block-size, containIntrinsicHeight, contain-intrinsic-height, containIntrinsicInlineSize, contain-intrinsic-inline-size, containIntrinsicWidth, contain-intrinsic-width, gridColumnEnd, grid-column-end, gridColumnStart, grid-column-start, gridRowEnd, grid-row-end, gridRowStart, grid-row-start, maxBlockSize, max-block-size, maxHeight, max-height, maxInlineSize, max-inline-size, maxWidth, max-width, cx, cy, offsetDistance, offset-distance, textIndent, text-indent, x, y, borderBottomLeftRadius, border-bottom-left-radius, borderBottomRightRadius, border-bottom-right-radius, borderEndEndRadius, border-end-end-radius, borderEndStartRadius, border-end-start-radius, borderStartEndRadius, border-start-end-radius, borderStartStartRadius, border-start-start-radius, borderTopLeftRadius, border-top-left-radius, borderTopRightRadius, border-top-right-radius, blockSize, block-size, height, inlineSize, inline-size, minBlockSize, min-block-size, minHeight, min-height, minInlineSize, min-inline-size, minWidth, min-width, width, paddingBlockEnd, padding-block-end, paddingBlockStart, padding-block-start, paddingBottom, padding-bottom, paddingInlineEnd, padding-inline-end, paddingInlineStart, padding-inline-start, paddingLeft, padding-left, paddingRight, padding-right, paddingTop, padding-top, r, shapeMargin, shape-margin, rx, ry, scrollPaddingBlockEnd, scroll-padding-block-end, scrollPaddingBlockStart, scroll-padding-block-start, scrollPaddingBottom, scroll-padding-bottom, scrollPaddingInlineEnd, scroll-padding-inline-end, scrollPaddingInlineStart, scroll-padding-inline-start, scrollPaddingLeft, scroll-padding-left, scrollPaddingRight, scroll-padding-right, scrollPaddingTop, scroll-padding-top, borderBlockEndWidth, border-block-end-width, borderBlockStartWidth, border-block-start-width, borderBottomWidth, border-bottom-width, borderInlineEndWidth, border-inline-end-width, borderInlineStartWidth, border-inline-start-width, borderLeftWidth, border-left-width, borderRightWidth, border-right-width, borderTopWidth, border-top-width, columnRuleWidth, column-rule-width, outlineWidth, outline-width, webkitTextStrokeWidth, WebkitTextStrokeWidth, -webkit-text-stroke-width, outlineOffset, outline-offset, overflowClipMargin, overflow-clip-margin, scrollMarginBlockEnd, scroll-margin-block-end, scrollMarginBlockStart, scroll-margin-block-start, scrollMarginBottom, scroll-margin-bottom, scrollMarginInlineEnd, scroll-margin-inline-end, scrollMarginInlineStart, scroll-margin-inline-start, scrollMarginLeft, scroll-margin-left, scrollMarginRight, scroll-margin-right, scrollMarginTop, scroll-margin-top, bottom, insetBlockEnd, inset-block-end, insetBlockStart, inset-block-start, insetInlineEnd, inset-inline-end, insetInlineStart, inset-inline-start, left, marginBlockEnd, margin-block-end, marginBlockStart, margin-block-start, marginBottom, margin-bottom, marginInlineEnd, margin-inline-end, marginInlineStart, margin-inline-start, marginLeft, margin-left, marginRight, margin-right, marginTop, margin-top, right, textUnderlineOffset, text-underline-offset, top, backgroundColor, background-color, borderBlockEndColor, border-block-end-color, borderBlockStartColor, border-block-start-color, borderBottomColor, border-bottom-color, borderInlineEndColor, border-inline-end-color, borderInlineStartColor, border-inline-start-color, borderLeftColor, border-left-color, borderRightColor, border-right-color, borderTopColor, border-top-color, columnRuleColor, column-rule-color, floodColor, flood-color, lightingColor, lighting-color, outlineColor, outline-color, stopColor, stop-color, textDecorationColor, text-decoration-color, textEmphasisColor, text-emphasis-color, webkitTextFillColor, WebkitTextFillColor, -webkit-text-fill-color, webkitTextStrokeColor, WebkitTextStrokeColor, -webkit-text-stroke-color, background, backgroundPosition, background-position, borderColor, border-color, borderStyle, border-style, borderWidth, border-width, borderTop, border-top, borderRight, border-right, borderBottom, border-bottom, borderLeft, border-left, borderBlockStart, border-block-start, borderBlockEnd, border-block-end, borderInlineStart, border-inline-start, borderInlineEnd, border-inline-end, border, borderRadius, border-radius, borderImage, border-image, borderBlockWidth, border-block-width, borderBlockStyle, border-block-style, borderBlockColor, border-block-color, borderInlineWidth, border-inline-width, borderInlineStyle, border-inline-style, borderInlineColor, border-inline-color, borderBlock, border-block, borderInline, border-inline, overflow, overscrollBehavior, overscroll-behavior, container, pageBreakBefore, page-break-before, pageBreakAfter, page-break-after, pageBreakInside, page-break-inside, offset, columns, columnRule, column-rule, font, fontVariant, font-variant, fontSynthesis, font-synthesis, marker, textEmphasis, text-emphasis, webkitTextStroke, WebkitTextStroke, -webkit-text-stroke, listStyle, list-style, margin, marginBlock, margin-block, marginInline, margin-inline, scrollMargin, scroll-margin, scrollMarginBlock, scroll-margin-block, scrollMarginInline, scroll-margin-inline, outline, padding, paddingBlock, padding-block, paddingInline, padding-inline, scrollPadding, scroll-padding, scrollPaddingBlock, scroll-padding-block, scrollPaddingInline, scroll-padding-inline, flexFlow, flex-flow, flex, gap, gridRow, grid-row, gridColumn, grid-column, gridArea, grid-area, gridTemplate, grid-template, grid, placeContent, place-content, placeSelf, place-self, placeItems, place-items, inset, insetBlock, inset-block, insetInline, inset-inline, containIntrinsicSize, contain-intrinsic-size, mask, maskPosition, mask-position, textDecoration, text-decoration, transition, animation, all, webkitBackgroundClip, WebkitBackgroundClip, -webkit-background-clip, webkitBackgroundOrigin, WebkitBackgroundOrigin, -webkit-background-origin, webkitBackgroundSize, WebkitBackgroundSize, -webkit-background-size, MozBorderStartColor, -moz-border-start-color, MozBorderStartStyle, -moz-border-start-style, MozBorderStartWidth, -moz-border-start-width, MozBorderEndColor, -moz-border-end-color, MozBorderEndStyle, -moz-border-end-style, MozBorderEndWidth, -moz-border-end-width, webkitBorderTopLeftRadius, WebkitBorderTopLeftRadius, -webkit-border-top-left-radius, webkitBorderTopRightRadius, WebkitBorderTopRightRadius, -webkit-border-top-right-radius, webkitBorderBottomRightRadius, WebkitBorderBottomRightRadius, -webkit-border-bottom-right-radius, webkitBorderBottomLeftRadius, WebkitBorderBottomLeftRadius, -webkit-border-bottom-left-radius, MozTransform, -moz-transform, webkitTransform, WebkitTransform, -webkit-transform, MozPerspective, -moz-perspective, webkitPerspective, WebkitPerspective, -webkit-perspective, MozPerspectiveOrigin, -moz-perspective-origin, webkitPerspectiveOrigin, WebkitPerspectiveOrigin, -webkit-perspective-origin, MozBackfaceVisibility, -moz-backface-visibility, webkitBackfaceVisibility, WebkitBackfaceVisibility, -webkit-backface-visibility, MozTransformStyle, -moz-transform-style, webkitTransformStyle, WebkitTransformStyle, -webkit-transform-style, MozTransformOrigin, -moz-transform-origin, webkitTransformOrigin, WebkitTransformOrigin, -webkit-transform-origin, MozAppearance, -moz-appearance, webkitAppearance, WebkitAppearance, -webkit-appearance, webkitBoxShadow, WebkitBoxShadow, -webkit-box-shadow, webkitFilter, WebkitFilter, -webkit-filter, MozFontFeatureSettings, -moz-font-feature-settings, MozFontLanguageOverride, -moz-font-language-override, colorAdjust, color-adjust, MozHyphens, -moz-hyphens, webkitTextSizeAdjust, WebkitTextSizeAdjust, -webkit-text-size-adjust, wordWrap, word-wrap, MozTabSize, -moz-tab-size, MozMarginStart, -moz-margin-start, MozMarginEnd, -moz-margin-end, MozPaddingStart, -moz-padding-start, MozPaddingEnd, -moz-padding-end, webkitFlexDirection, WebkitFlexDirection, -webkit-flex-direction, webkitFlexWrap, WebkitFlexWrap, -webkit-flex-wrap, webkitJustifyContent, WebkitJustifyContent, -webkit-justify-content, webkitAlignContent, WebkitAlignContent, -webkit-align-content, webkitAlignItems, WebkitAlignItems, -webkit-align-items, webkitFlexGrow, WebkitFlexGrow, -webkit-flex-grow, webkitFlexShrink, WebkitFlexShrink, -webkit-flex-shrink, webkitAlignSelf, WebkitAlignSelf, -webkit-align-self, webkitOrder, WebkitOrder, -webkit-order, webkitFlexBasis, WebkitFlexBasis, -webkit-flex-basis, MozBoxSizing, -moz-box-sizing, webkitBoxSizing, WebkitBoxSizing, -webkit-box-sizing, gridColumnGap, grid-column-gap, gridRowGap, grid-row-gap, webkitClipPath, WebkitClipPath, -webkit-clip-path, webkitMaskRepeat, WebkitMaskRepeat, -webkit-mask-repeat, webkitMaskPositionX, WebkitMaskPositionX, -webkit-mask-position-x, webkitMaskPositionY, WebkitMaskPositionY, -webkit-mask-position-y, webkitMaskClip, WebkitMaskClip, -webkit-mask-clip, webkitMaskOrigin, WebkitMaskOrigin, -webkit-mask-origin, webkitMaskSize, WebkitMaskSize, -webkit-mask-size, webkitMaskComposite, WebkitMaskComposite, -webkit-mask-composite, webkitMaskImage, WebkitMaskImage, -webkit-mask-image, MozUserSelect, -moz-user-select, webkitUserSelect, WebkitUserSelect, -webkit-user-select, MozTransitionDuration, -moz-transition-duration, webkitTransitionDuration, WebkitTransitionDuration, -webkit-transition-duration, MozTransitionTimingFunction, -moz-transition-timing-function, webkitTransitionTimingFunction, WebkitTransitionTimingFunction, -webkit-transition-timing-function, MozTransitionProperty, -moz-transition-property, webkitTransitionProperty, WebkitTransitionProperty, -webkit-transition-property, MozTransitionDelay, -moz-transition-delay, webkitTransitionDelay, WebkitTransitionDelay, -webkit-transition-delay, MozAnimationName, -moz-animation-name, webkitAnimationName, WebkitAnimationName, -webkit-animation-name, MozAnimationDuration, -moz-animation-duration, webkitAnimationDuration, WebkitAnimationDuration, -webkit-animation-duration, MozAnimationTimingFunction, -moz-animation-timing-function, webkitAnimationTimingFunction, WebkitAnimationTimingFunction, -webkit-animation-timing-function, MozAnimationIterationCount, -moz-animation-iteration-count, webkitAnimationIterationCount, WebkitAnimationIterationCount, -webkit-animation-iteration-count, MozAnimationDirection, -moz-animation-direction, webkitAnimationDirection, WebkitAnimationDirection, -webkit-animation-direction, MozAnimationPlayState, -moz-animation-play-state, webkitAnimationPlayState, WebkitAnimationPlayState, -webkit-animation-play-state, MozAnimationFillMode, -moz-animation-fill-mode, webkitAnimationFillMode, WebkitAnimationFillMode, -webkit-animation-fill-mode, MozAnimationDelay, -moz-animation-delay, webkitAnimationDelay, WebkitAnimationDelay, -webkit-animation-delay, webkitBoxAlign, WebkitBoxAlign, -webkit-box-align, webkitBoxDirection, WebkitBoxDirection, -webkit-box-direction, webkitBoxFlex, WebkitBoxFlex, -webkit-box-flex, webkitBoxOrient, WebkitBoxOrient, -webkit-box-orient, webkitBoxPack, WebkitBoxPack, -webkit-box-pack, webkitBoxOrdinalGroup, WebkitBoxOrdinalGroup, -webkit-box-ordinal-group, MozBorderStart, -moz-border-start, MozBorderEnd, -moz-border-end, webkitBorderRadius, WebkitBorderRadius, -webkit-border-radius, MozBorderImage, -moz-border-image, webkitBorderImage, WebkitBorderImage, -webkit-border-image, webkitFlexFlow, WebkitFlexFlow, -webkit-flex-flow, webkitFlex, WebkitFlex, -webkit-flex, gridGap, grid-gap, webkitMask, WebkitMask, -webkit-mask, webkitMaskPosition, WebkitMaskPosition, -webkit-mask-position, MozTransition, -moz-transition, webkitTransition, WebkitTransition, -webkit-transition, MozAnimation, -moz-animation, webkitAnimation, WebkitAnimation, -webkit-animation, constructor`,
			jsKeys: 'Object.assign, Object.getPrototypeOf, Object.setPrototypeOf, Object.getOwnPropertyDescriptor, Object.getOwnPropertyDescriptors, Object.keys, Object.values, Object.entries, Object.is, Object.defineProperty, Object.defineProperties, Object.create, Object.getOwnPropertyNames, Object.getOwnPropertySymbols, Object.isExtensible, Object.preventExtensions, Object.freeze, Object.isFrozen, Object.seal, Object.isSealed, Object.fromEntries, Object.hasOwn, Object.toString, Object.toLocaleString, Object.valueOf, Object.hasOwnProperty, Object.isPrototypeOf, Object.propertyIsEnumerable, Object.__defineGetter__, Object.__defineSetter__, Object.__lookupGetter__, Object.__lookupSetter__, Object.__proto__, Function.toString, Function.apply, Function.call, Function.bind, Boolean.toString, Boolean.valueOf, Symbol.for, Symbol.keyFor, Symbol.isConcatSpreadable, Symbol.iterator, Symbol.match, Symbol.replace, Symbol.search, Symbol.species, Symbol.hasInstance, Symbol.split, Symbol.toPrimitive, Symbol.toStringTag, Symbol.unscopables, Symbol.asyncIterator, Symbol.matchAll, Symbol.toString, Symbol.valueOf, Symbol.description, Error.toString, Error.message, Error.stack, Number.isFinite, Number.isInteger, Number.isNaN, Number.isSafeInteger, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_VALUE, Number.MIN_VALUE, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.EPSILON, Number.parseInt, Number.parseFloat, Number.NaN, Number.toString, Number.toLocaleString, Number.valueOf, Number.toFixed, Number.toExponential, Number.toPrecision, BigInt.asUintN, BigInt.asIntN, BigInt.valueOf, BigInt.toString, BigInt.toLocaleString, Math.abs, Math.acos, Math.asin, Math.atan, Math.atan2, Math.ceil, Math.clz32, Math.cos, Math.exp, Math.floor, Math.imul, Math.fround, Math.log, Math.max, Math.min, Math.pow, Math.random, Math.round, Math.sin, Math.sqrt, Math.tan, Math.log10, Math.log2, Math.log1p, Math.expm1, Math.cosh, Math.sinh, Math.tanh, Math.acosh, Math.asinh, Math.atanh, Math.hypot, Math.trunc, Math.sign, Math.cbrt, Math.E, Math.LOG2E, Math.LOG10E, Math.LN2, Math.LN10, Math.PI, Math.SQRT2, Math.SQRT1_2, Date.UTC, Date.parse, Date.now, Date.getTime, Date.getTimezoneOffset, Date.getYear, Date.getFullYear, Date.getUTCFullYear, Date.getMonth, Date.getUTCMonth, Date.getDate, Date.getUTCDate, Date.getDay, Date.getUTCDay, Date.getHours, Date.getUTCHours, Date.getMinutes, Date.getUTCMinutes, Date.getSeconds, Date.getUTCSeconds, Date.getMilliseconds, Date.getUTCMilliseconds, Date.setTime, Date.setYear, Date.setFullYear, Date.setUTCFullYear, Date.setMonth, Date.setUTCMonth, Date.setDate, Date.setUTCDate, Date.setHours, Date.setUTCHours, Date.setMinutes, Date.setUTCMinutes, Date.setSeconds, Date.setUTCSeconds, Date.setMilliseconds, Date.setUTCMilliseconds, Date.toUTCString, Date.toLocaleString, Date.toLocaleDateString, Date.toLocaleTimeString, Date.toDateString, Date.toTimeString, Date.toISOString, Date.toJSON, Date.toString, Date.valueOf, Date.toGMTString, String.fromCharCode, String.fromCodePoint, String.raw, String.toString, String.valueOf, String.toLowerCase, String.toUpperCase, String.charAt, String.charCodeAt, String.substring, String.padStart, String.padEnd, String.codePointAt, String.includes, String.indexOf, String.lastIndexOf, String.startsWith, String.endsWith, String.trim, String.trimStart, String.trimEnd, String.toLocaleLowerCase, String.toLocaleUpperCase, String.localeCompare, String.repeat, String.normalize, String.match, String.matchAll, String.search, String.replace, String.replaceAll, String.split, String.substr, String.concat, String.slice, String.at, String.bold, String.italics, String.fixed, String.strike, String.small, String.big, String.blink, String.sup, String.sub, String.anchor, String.link, String.fontcolor, String.fontsize, String.trimLeft, String.trimRight, RegExp.input, RegExp.lastMatch, RegExp.lastParen, RegExp.leftContext, RegExp.rightContext, RegExp.$1, RegExp.$2, RegExp.$3, RegExp.$4, RegExp.$5, RegExp.$6, RegExp.$7, RegExp.$8, RegExp.$9, RegExp.$_, RegExp.$&, RegExp.$+, RegExp.$`, RegExp.$\', RegExp.toString, RegExp.compile, RegExp.exec, RegExp.test, RegExp.flags, RegExp.hasIndices, RegExp.global, RegExp.ignoreCase, RegExp.multiline, RegExp.dotAll, RegExp.source, RegExp.sticky, RegExp.unicode, Array.isArray, Array.from, Array.of, Array.toString, Array.toLocaleString, Array.join, Array.reverse, Array.sort, Array.push, Array.pop, Array.shift, Array.unshift, Array.splice, Array.concat, Array.slice, Array.lastIndexOf, Array.indexOf, Array.forEach, Array.map, Array.filter, Array.reduce, Array.reduceRight, Array.some, Array.every, Array.find, Array.findIndex, Array.copyWithin, Array.fill, Array.entries, Array.keys, Array.values, Array.includes, Array.flatMap, Array.flat, Array.at, Array.findLast, Array.findLastIndex, Map.get, Map.has, Map.set, Map.delete, Map.keys, Map.values, Map.clear, Map.forEach, Map.entries, Map.size, Set.has, Set.add, Set.delete, Set.entries, Set.clear, Set.forEach, Set.values, Set.keys, Set.size, WeakMap.has, WeakMap.get, WeakMap.delete, WeakMap.set, WeakSet.add, WeakSet.delete, WeakSet.has, Atomics.compareExchange, Atomics.load, Atomics.store, Atomics.exchange, Atomics.add, Atomics.sub, Atomics.and, Atomics.or, Atomics.xor, Atomics.isLockFree, Atomics.wait, Atomics.notify, Atomics.wake, JSON.parse, JSON.stringify, Promise.all, Promise.allSettled, Promise.any, Promise.race, Promise.reject, Promise.resolve, Promise.then, Promise.catch, Promise.finally, Reflect.apply, Reflect.construct, Reflect.defineProperty, Reflect.deleteProperty, Reflect.get, Reflect.getOwnPropertyDescriptor, Reflect.getPrototypeOf, Reflect.has, Reflect.isExtensible, Reflect.ownKeys, Reflect.preventExtensions, Reflect.set, Reflect.setPrototypeOf, Proxy.revocable, Intl.getCanonicalLocales, Intl.supportedValuesOf, Intl.Collator, Intl.DateTimeFormat, Intl.DisplayNames, Intl.ListFormat, Intl.Locale, Intl.NumberFormat, Intl.PluralRules, Intl.RelativeTimeFormat, WebAssembly.compile, WebAssembly.instantiate, WebAssembly.validate, WebAssembly.compileStreaming, WebAssembly.instantiateStreaming, WebAssembly.Module, WebAssembly.Instance, WebAssembly.Memory, WebAssembly.Table, WebAssembly.Global, WebAssembly.CompileError, WebAssembly.LinkError, WebAssembly.RuntimeError, WebAssembly.Tag, WebAssembly.Exception, Document.getElementsByTagName, Document.getElementsByTagNameNS, Document.getElementsByClassName, Document.getElementById, Document.createElement, Document.createElementNS, Document.createDocumentFragment, Document.createTextNode, Document.createComment, Document.createProcessingInstruction, Document.importNode, Document.adoptNode, Document.createEvent, Document.createRange, Document.createNodeIterator, Document.createTreeWalker, Document.createCDATASection, Document.createAttribute, Document.createAttributeNS, Document.getElementsByName, Document.open, Document.close, Document.write, Document.writeln, Document.hasFocus, Document.execCommand, Document.queryCommandEnabled, Document.queryCommandIndeterm, Document.queryCommandState, Document.queryCommandSupported, Document.queryCommandValue, Document.releaseCapture, Document.mozSetImageElement, Document.clear, Document.captureEvents, Document.releaseEvents, Document.exitFullscreen, Document.mozCancelFullScreen, Document.exitPointerLock, Document.enableStyleSheetsForSet, Document.caretPositionFromPoint, Document.querySelector, Document.querySelectorAll, Document.getSelection, Document.hasStorageAccess, Document.requestStorageAccess, Document.elementFromPoint, Document.elementsFromPoint, Document.getAnimations, Document.prepend, Document.append, Document.replaceChildren, Document.createExpression, Document.createNSResolver, Document.evaluate, Document.implementation, Document.URL, Document.documentURI, Document.compatMode, Document.characterSet, Document.charset, Document.inputEncoding, Document.contentType, Document.doctype, Document.documentElement, Document.domain, Document.referrer, Document.cookie, Document.lastModified, Document.readyState, Document.title, Document.dir, Document.body, Document.head, Document.images, Document.embeds, Document.plugins, Document.links, Document.forms, Document.scripts, Document.defaultView, Document.designMode, Document.onreadystatechange, Document.onbeforescriptexecute, Document.onafterscriptexecute, Document.currentScript, Document.fgColor, Document.linkColor, Document.vlinkColor, Document.alinkColor, Document.bgColor, Document.anchors, Document.applets, Document.all, Document.fullscreen, Document.mozFullScreen, Document.fullscreenEnabled, Document.mozFullScreenEnabled, Document.onfullscreenchange, Document.onfullscreenerror, Document.onpointerlockchange, Document.onpointerlockerror, Document.hidden, Document.visibilityState, Document.onvisibilitychange, Document.selectedStyleSheetSet, Document.lastStyleSheetSet, Document.preferredStyleSheetSet, Document.styleSheetSets, Document.scrollingElement, Document.timeline, Document.rootElement, Document.activeElement, Document.styleSheets, Document.pointerLockElement, Document.fullscreenElement, Document.mozFullScreenElement, Document.adoptedStyleSheets, Document.fonts, Document.onabort, Document.onblur, Document.onfocus, Document.onauxclick, Document.onbeforeinput, Document.oncanplay, Document.oncanplaythrough, Document.onchange, Document.onclick, Document.onclose, Document.oncontextmenu, Document.oncopy, Document.oncuechange, Document.oncut, Document.ondblclick, Document.ondrag, Document.ondragend, Document.ondragenter, Document.ondragexit, Document.ondragleave, Document.ondragover, Document.ondragstart, Document.ondrop, Document.ondurationchange, Document.onemptied, Document.onended, Document.onformdata, Document.oninput, Document.oninvalid, Document.onkeydown, Document.onkeypress, Document.onkeyup, Document.onload, Document.onloadeddata, Document.onloadedmetadata, Document.onloadstart, Document.onmousedown, Document.onmouseenter, Document.onmouseleave, Document.onmousemove, Document.onmouseout, Document.onmouseover, Document.onmouseup, Document.onwheel, Document.onpaste, Document.onpause, Document.onplay, Document.onplaying, Document.onprogress, Document.onratechange, Document.onreset, Document.onresize, Document.onscroll, Document.onscrollend, Document.onsecuritypolicyviolation, Document.onseeked, Document.onseeking, Document.onselect, Document.onslotchange, Document.onstalled, Document.onsubmit, Document.onsuspend, Document.ontimeupdate, Document.onvolumechange, Document.onwaiting, Document.onselectstart, Document.onselectionchange, Document.ontoggle, Document.onpointercancel, Document.onpointerdown, Document.onpointerup, Document.onpointermove, Document.onpointerout, Document.onpointerover, Document.onpointerenter, Document.onpointerleave, Document.ongotpointercapture, Document.onlostpointercapture, Document.onmozfullscreenchange, Document.onmozfullscreenerror, Document.onanimationcancel, Document.onanimationend, Document.onanimationiteration, Document.onanimationstart, Document.ontransitioncancel, Document.ontransitionend, Document.ontransitionrun, Document.ontransitionstart, Document.onwebkitanimationend, Document.onwebkitanimationiteration, Document.onwebkitanimationstart, Document.onwebkittransitionend, Document.onerror, Document.children, Document.firstElementChild, Document.lastElementChild, Document.childElementCount, Element.getAttributeNames, Element.getAttribute, Element.getAttributeNS, Element.toggleAttribute, Element.setAttribute, Element.setAttributeNS, Element.removeAttribute, Element.removeAttributeNS, Element.hasAttribute, Element.hasAttributeNS, Element.hasAttributes, Element.closest, Element.matches, Element.webkitMatchesSelector, Element.getElementsByTagName, Element.getElementsByTagNameNS, Element.getElementsByClassName, Element.insertAdjacentElement, Element.insertAdjacentText, Element.mozMatchesSelector, Element.setPointerCapture, Element.releasePointerCapture, Element.hasPointerCapture, Element.setCapture, Element.releaseCapture, Element.getAttributeNode, Element.setAttributeNode, Element.removeAttributeNode, Element.getAttributeNodeNS, Element.setAttributeNodeNS, Element.getClientRects, Element.getBoundingClientRect, Element.checkVisibility, Element.scrollIntoView, Element.scroll, Element.scrollTo, Element.scrollBy, Element.insertAdjacentHTML, Element.querySelector, Element.querySelectorAll, Element.attachShadow, Element.requestFullscreen, Element.mozRequestFullScreen, Element.requestPointerLock, Element.animate, Element.getAnimations, Element.before, Element.after, Element.replaceWith, Element.remove, Element.prepend, Element.append, Element.replaceChildren, Element.namespaceURI, Element.prefix, Element.localName, Element.tagName, Element.id, Element.className, Element.classList, Element.part, Element.attributes, Element.scrollTop, Element.scrollLeft, Element.scrollWidth, Element.scrollHeight, Element.clientTop, Element.clientLeft, Element.clientWidth, Element.clientHeight, Element.scrollTopMax, Element.scrollLeftMax, Element.innerHTML, Element.outerHTML, Element.shadowRoot, Element.assignedSlot, Element.slot, Element.onfullscreenchange, Element.onfullscreenerror, Element.previousElementSibling, Element.nextElementSibling, Element.children, Element.firstElementChild, Element.lastElementChild, Element.childElementCount',
		}
	});

	const BROWSER = (IS_BLINK ? 'Chrome' : IS_GECKO ? 'Firefox' : '');

	const getEngineMaps = (browser) => {
		// Blink
		const blinkJS = {
			'76': ['Document.onsecuritypolicyviolation', 'Promise.allSettled'],
			'77': ['Document.onformdata', 'Document.onpointerrawupdate'],
			'78': ['Element.elementTiming'],
			'79': ['Document.onanimationend', 'Document.onanimationiteration', 'Document.onanimationstart', 'Document.ontransitionend'],
			'80': ['!Document.registerElement', '!Element.createShadowRoot', '!Element.getDestinationInsertionPoints'],
			'81': ['Document.onwebkitanimationend', 'Document.onwebkitanimationiteration', 'Document.onwebkitanimationstart', 'Document.onwebkittransitionend', 'Element.ariaAtomic', 'Element.ariaAutoComplete', 'Element.ariaBusy', 'Element.ariaChecked', 'Element.ariaColCount', 'Element.ariaColIndex', 'Element.ariaColSpan', 'Element.ariaCurrent', 'Element.ariaDisabled', 'Element.ariaExpanded', 'Element.ariaHasPopup', 'Element.ariaHidden', 'Element.ariaKeyShortcuts', 'Element.ariaLabel', 'Element.ariaLevel', 'Element.ariaLive', 'Element.ariaModal', 'Element.ariaMultiLine', 'Element.ariaMultiSelectable', 'Element.ariaOrientation', 'Element.ariaPlaceholder', 'Element.ariaPosInSet', 'Element.ariaPressed', 'Element.ariaReadOnly', 'Element.ariaRelevant', 'Element.ariaRequired', 'Element.ariaRoleDescription', 'Element.ariaRowCount', 'Element.ariaRowIndex', 'Element.ariaRowSpan', 'Element.ariaSelected', 'Element.ariaSort', 'Element.ariaValueMax', 'Element.ariaValueMin', 'Element.ariaValueNow', 'Element.ariaValueText', 'Intl.DisplayNames'],
			'83': ['Element.ariaDescription', 'Element.onbeforexrselect'],
			'84': ['Document.getAnimations', 'Document.timeline', 'Element.ariaSetSize', 'Element.getAnimations'],
			'85': ['Promise.any', 'String.replaceAll'],
			'86': ['Document.fragmentDirective', 'Document.replaceChildren', 'Element.replaceChildren', '!Atomics.wake'],
			'87-89': ['Atomics.waitAsync', 'Document.ontransitioncancel', 'Document.ontransitionrun', 'Document.ontransitionstart', 'Intl.Segmenter'],
			'90': ['Document.onbeforexrselect', 'RegExp.hasIndices', '!Element.onbeforexrselect'],
			'91': ['Element.getInnerHTML'],
			'92': ['Array.at', 'String.at'],
			'93': ['Error.cause', 'Object.hasOwn'],
			'94': ['!Error.cause', 'Object.hasOwn'],
			'95-96': ['WebAssembly.Exception', 'WebAssembly.Tag'],
			'97-98': ['Array.findLast', 'Array.findLastIndex', 'Document.onslotchange'],
			'99-101': ['Intl.supportedValuesOf', 'Document.oncontextlost', 'Document.oncontextrestored'],
			'102': ['Element.ariaInvalid', 'Document.onbeforematch'],
			'103-106': ['Element.role'],
			'107-109': ['Element.ariaBrailleLabel', 'Element.ariaBrailleRoleDescription'],
			'110': ['Array.toReversed', 'Array.toSorted', 'Array.toSpliced', 'Array.with'],
			'111': ['String.isWellFormed', 'String.toWellFormed', 'Document.startViewTransition'],
			'112-113': ['RegExp.unicodeSets'],
			'114-115': ['JSON.rawJSON', 'JSON.isRawJSON']
		};

		const blinkCSS = {
			'76': ['backdrop-filter'],
			'77-80': ['overscroll-behavior-block', 'overscroll-behavior-inline'],
			'81': ['color-scheme', 'image-orientation'],
			'83': ['contain-intrinsic-size'],
			'84': ['appearance', 'ruby-position'],
			'85-86': ['content-visibility', 'counter-set', 'inherits', 'initial-value', 'page-orientation', 'syntax'],
			'87': ['ascent-override', 'border-block', 'border-block-color', 'border-block-style', 'border-block-width', 'border-inline', 'border-inline-color', 'border-inline-style', 'border-inline-width', 'descent-override', 'inset', 'inset-block', 'inset-block-end', 'inset-block-start', 'inset-inline', 'inset-inline-end', 'inset-inline-start', 'line-gap-override', 'margin-block', 'margin-inline', 'padding-block', 'padding-inline', 'text-decoration-thickness', 'text-underline-offset'],
			'88': ['aspect-ratio'],
			'89': ['border-end-end-radius', 'border-end-start-radius', 'border-start-end-radius', 'border-start-start-radius', 'forced-color-adjust'],
			'90': ['overflow-clip-margin'],
			'91': ['additive-symbols', 'fallback', 'negative', 'pad', 'prefix', 'range', 'speak-as', 'suffix', 'symbols', 'system'],
			'92': ['size-adjust'],
			'93': ['accent-color'],
			'94': ['scrollbar-gutter'],
			'95-96': ['app-region', 'contain-intrinsic-block-size', 'contain-intrinsic-height', 'contain-intrinsic-inline-size', 'contain-intrinsic-width'],
			'97-98': ['font-synthesis-small-caps', 'font-synthesis-style', 'font-synthesis-weight', 'font-synthesis'],
			'99-100': ['text-emphasis-color', 'text-emphasis-position', 'text-emphasis-style', 'text-emphasis'],
			'101-103': ['font-palette', 'base-palette', 'override-colors'],
			'104': ['object-view-box'],
			'105': ['container-name', 'container-type', 'container'],
			'106-107': ['hyphenate-character'],
			'108': ['hyphenate-character', '!orientation', '!max-zoom', '!min-zoom', '!user-zoom'],
			'109': ['hyphenate-limit-chars', 'math-depth', 'math-shift', 'math-style'],
			'110': ['initial-letter'],
			'111-113': ['baseline-source', 'font-variant-alternates', 'view-transition-name'],
			'114-115': ['text-wrap', 'white-space-collapse']
		};

		const blinkWindow = {
			'80': ['CompressionStream', 'DecompressionStream', 'FeaturePolicy', 'FragmentDirective', 'PeriodicSyncManager', 'VideoPlaybackQuality'],
			'81': ['SubmitEvent', 'XRHitTestResult', 'XRHitTestSource', 'XRRay', 'XRTransientInputHitTestResult', 'XRTransientInputHitTestSource'],
			'83': ['BarcodeDetector', 'XRDOMOverlayState', 'XRSystem'],
			'84': ['AnimationPlaybackEvent', 'AnimationTimeline', 'CSSAnimation', 'CSSTransition', 'DocumentTimeline', 'FinalizationRegistry', 'LayoutShiftAttribution', 'ResizeObserverSize', 'WakeLock', 'WakeLockSentinel', 'WeakRef', 'XRLayer'],
			'85': ['AggregateError', 'CSSPropertyRule', 'EventCounts', 'XRAnchor', 'XRAnchorSet'],
			'86': ['RTCEncodedAudioFrame', 'RTCEncodedVideoFrame'],
			'87': ['CookieChangeEvent', 'CookieStore', 'CookieStoreManager', 'Scheduling'],
			'88': ['Scheduling', '!BarcodeDetector'],
			'89': ['ReadableByteStreamController', 'ReadableStreamBYOBReader', 'ReadableStreamBYOBRequest', 'ReadableStreamDefaultController', 'XRWebGLBinding'],
			'90': ['AbstractRange', 'CustomStateSet', 'NavigatorUAData', 'XRCPUDepthInformation', 'XRDepthInformation', 'XRLightEstimate', 'XRLightProbe', 'XRWebGLDepthInformation'],
			'91': ['CSSCounterStyleRule', 'GravitySensor', 'NavigatorManagedData'],
			'92': ['CSSCounterStyleRule', '!SharedArrayBuffer'],
			'93': ['WritableStreamDefaultController'],
			'94': ['AudioData', 'AudioDecoder', 'AudioEncoder', 'EncodedAudioChunk', 'EncodedVideoChunk', 'IdleDetector', 'ImageDecoder', 'ImageTrack', 'ImageTrackList', 'VideoColorSpace', 'VideoDecoder', 'VideoEncoder', 'VideoFrame', 'MediaStreamTrackGenerator', 'MediaStreamTrackProcessor', 'Profiler', 'VirtualKeyboard', 'DelegatedInkTrailPresenter', 'Ink', 'Scheduler', 'TaskController', 'TaskPriorityChangeEvent', 'TaskSignal', 'VirtualKeyboardGeometryChangeEvent'],
			'95-96': ['URLPattern'],
			'97-98': ['WebTransport', 'WebTransportBidirectionalStream', 'WebTransportDatagramDuplexStream', 'WebTransportError'],
			'99': ['CanvasFilter', 'CSSLayerBlockRule', 'CSSLayerStatementRule'],
			'100': ['CSSMathClamp'],
			'101-104': ['CSSFontPaletteValuesRule'],
			'105-106': ['CSSContainerRule'],
			'107-108': ['XRCamera'],
			'109': ['MathMLElement'],
			'110': ['AudioSinkInfo'],
			'111-112': ['ViewTransition'],
			'113-115': ['ViewTransition', '!CanvasFilter']
		};

		// Gecko
		const geckoJS = {
			'71': ['Promise.allSettled'],
			'72-73': ['Document.onformdata', 'Element.part'],
			'74': ['!Array.toSource', '!Boolean.toSource', '!Date.toSource', '!Error.toSource', '!Function.toSource', '!Intl.toSource', '!JSON.toSource', '!Math.toSource', '!Number.toSource', '!Object.toSource', '!RegExp.toSource', '!String.toSource', '!WebAssembly.toSource'],
			'75-76': ['Document.getAnimations', 'Document.timeline', 'Element.getAnimations', 'Intl.Locale'],
			'77': ['String.replaceAll'],
			'78': ['Atomics.add', 'Atomics.and', 'Atomics.compareExchange', 'Atomics.exchange', 'Atomics.isLockFree', 'Atomics.load', 'Atomics.notify', 'Atomics.or', 'Atomics.store', 'Atomics.sub', 'Atomics.wait', 'Atomics.wake', 'Atomics.xor', 'Document.replaceChildren', 'Element.replaceChildren', 'Intl.ListFormat', 'RegExp.dotAll'],
			'79-84': ['Promise.any'],
			'85': ['!Document.onshow', 'Promise.any'],
			'86': ['Intl.DisplayNames'],
			'87': ['Document.onbeforeinput'],
			'88-89': ['RegExp.hasIndices'],
			'90-91': ['Array.at', 'String.at'],
			'92': ['Object.hasOwn'],
			'93-99': ['Intl.supportedValuesOf', 'Document.onsecuritypolicyviolation', 'Document.onslotchange'],
			'100': ['WebAssembly.Tag', 'WebAssembly.Exception'],
			'101-103': ['Document.adoptedStyleSheets'],
			'104-108': ['Array.findLast', 'Array.findLastIndex'],
			'109-112': ['Document.onscrollend']
		};

		// {"added":[],"removed":[]}	{"added":["Document.onscrollend"],"removed":[]}	{"added":["onscrollend"],"removed":[]}
		const geckoCSS = {
			'71': ['-moz-column-span'],
			'72': ['offset', 'offset-anchor', 'offset-distance', 'offset-path', 'offset-rotate', 'rotate', 'scale', 'translate'],
			'73': ['overscroll-behavior-block', 'overscroll-behavior-inline'],
			'74-79': ['!-moz-stack-sizing', 'text-underline-position'],
			'80-88': ['appearance'],
			'89-90': ['!-moz-outline-radius', '!-moz-outline-radius-bottomleft', '!-moz-outline-radius-bottomright', '!-moz-outline-radius-topleft', '!-moz-outline-radius-topright', 'aspect-ratio'],
			'91': ['tab-size'],
			'92-95': ['accent-color'],
			'96': ['color-scheme'],
			'97': ['print-color-adjust', 'scrollbar-gutter', 'd'],
			'98-101': ['hyphenate-character'],
			'102': ['overflow-clip-margin'],
			'103-106': ['scroll-snap-stop'],
			'107-108': ['backdrop-filter', 'font-palette', 'contain-intrinsic-block-size', 'contain-intrinsic-height', 'contain-intrinsic-inline-size', 'contain-intrinsic-width', 'contain-intrinsic-size'],
			'109': ['-webkit-clip-path'],
			'110': ['container-type', 'container-name', 'page', 'container'],
			'111': ['font-synthesis-small-caps', 'font-synthesis-style', 'font-synthesis-weight'],
			'112': ['font-synthesis-small-caps', '!-moz-image-region']
		};

		const geckoWindow = {
			// disregard: 'reportError','onsecuritypolicyviolation','onslotchange'
			'71': ['MathMLElement', '!SVGZoomAndPan'],
			'72-73': ['!BatteryManager', 'FormDataEvent', 'Geolocation', 'GeolocationCoordinates', 'GeolocationPosition', 'GeolocationPositionError', '!mozPaintCount'],
			'74': ['FormDataEvent', '!uneval'],
			'75': ['AnimationTimeline', 'CSSAnimation', 'CSSTransition', 'DocumentTimeline', 'SubmitEvent'],
			'76-77': ['AudioParamMap', 'AudioWorklet', 'AudioWorkletNode', 'Worklet'],
			'78': ['Atomics'],
			'79-81': ['AggregateError', 'FinalizationRegistry'],
			'82': ['MediaMetadata', 'MediaSession', 'Sanitizer'],
			'83': ['MediaMetadata', 'MediaSession', '!Sanitizer'],
			'84': ['PerformancePaintTiming'],
			'85-86': ['PerformancePaintTiming', '!HTMLMenuItemElement', '!onshow'],
			'87': ['onbeforeinput'],
			'88': ['onbeforeinput', '!VisualViewport'],
			'89-92': ['!ondevicelight', '!ondeviceproximity', '!onuserproximity'],
			'93-95': ['ElementInternals'],
			'96': ['Lock', 'LockManager'],
			'97': ['CSSLayerBlockRule', 'CSSLayerStatementRule'],
			'98': ['HTMLDialogElement'],
			'99': ['NavigationPreloadManager'],
			'100-104': ['WritableStream'],
			'105-106': ['TextDecoderStream', 'OffscreenCanvasRenderingContext2D', 'OffscreenCanvas', 'TextEncoderStream'],
			'107-109': ['CSSFontPaletteValuesRule'],
			'110': ['CSSContainerRule'],
			'111': ['FileSystemFileHandle', 'FileSystemDirectoryHandle'],
			'112': ['FileSystemFileHandle', '!U2F']
		};

		const IS_BLINK = browser == 'Chrome';
		const IS_GECKO = browser == 'Firefox';
		const css = (IS_BLINK ? blinkCSS : IS_GECKO ? geckoCSS : {});
		const win = (IS_BLINK ? blinkWindow : IS_GECKO ? geckoWindow : {});
		const js = (IS_BLINK ? blinkJS : IS_GECKO ? geckoJS : {});

		return { css, win, js };
	};

	const getJSCoreFeatures = (win) => {
		const globalObjects = ['Object', 'Function', 'Boolean', 'Symbol', 'Error', 'Number', 'BigInt', 'Math', 'Date', 'String', 'RegExp', 'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Atomics', 'JSON', 'Promise', 'Reflect', 'Proxy', 'Intl', 'WebAssembly', 'Document', 'Element'];

		try {
			// @ts-ignore
			const features = globalObjects.reduce((acc, name) => {
				const ignore = ['name', 'length', 'constructor', 'prototype', 'arguments', 'caller'];
				const descriptorKeys = Object.keys(Object.getOwnPropertyDescriptors(win[name] || {}));
				const descriptorProtoKeys = Object.keys(Object.getOwnPropertyDescriptors((win[name] || {}).prototype || {}));
				const uniques = [...new Set([...descriptorKeys, ...descriptorProtoKeys].filter((key) => !ignore.includes(key)))];
				const keys = uniques.map((key) => `${name}.${key}`);

				return [...acc, ...keys];
			}, []);

			return features;
		} catch (error) {
			console.error(error);

			return [];
		}
	};

	// @ts-ignore
	const versionSort = (x) => x.sort((a, b) => /\d+/.exec(a)[0] - /\d+/.exec(b)[0]).reverse();

	const getVersionLie = (vReport, version, forgivenessOffset = 0) => {
		const stable = getStableFeatures();
		const { version: maxVersion } = stable[BROWSER] || {};
		const validMetrics = vReport && version;

		if (!validMetrics) {
			return {};
		}

		const [vStart, vEnd] = version ? version.split('-') : [];
		const vMax = (vEnd || vStart);
		const reportIsTooHigh = +vReport > (+vMax + forgivenessOffset);
		const reportIsTooLow = +vReport < (+vStart - forgivenessOffset);
		const reportIsOff = (reportIsTooHigh || reportIsTooLow);
		const versionIsAboveMax = ((+vMax == maxVersion) && (+vReport > maxVersion));
		const liedVersion = !versionIsAboveMax && reportIsOff;
		const distance = !liedVersion ? 0 : (Math.abs(vReport - (reportIsTooLow ? vStart : vMax)));

		return { liedVersion, distance };
	};

	async function getEngineFeatures({ cssComputed, navigatorComputed, windowFeaturesComputed, }) {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};

		try {
			const timer = createTimer();
			await queueEvent(timer);
			const win = PHANTOM_DARKNESS ? PHANTOM_DARKNESS : window;

			if (!cssComputed || !windowFeaturesComputed) {
				logTestResult({ test: 'features', passed: false });

				return;
			}

			const jsFeaturesKeys = getJSCoreFeatures(win);
			const { keys: computedStyleKeys } = cssComputed.computedStyle || {};
			const { keys: windowFeaturesKeys } = windowFeaturesComputed || {};
			const { userAgentParsed: decryptedName } = navigatorComputed || {};
			const isNative = (win, x) => (/\[native code\]/.test(win[x] + '') && 'prototype' in win[x] && win[x].prototype.constructor.name === x);

			// @ts-ignore
			const getFeatures = ({ context, allKeys, engineMap, checkNative = false } = {}) => {
				const allKeysSet = new Set(allKeys);
				const features = new Set();

				// @ts-ignore
				const match = Object.keys(engineMap || {}).reduce((acc, key) => {
					const version = engineMap[key];
					const versionLen = version.length;

					const featureLen = version.filter((prop) => {
						const removedFromVersion = prop.charAt(0) == '!';

						if (removedFromVersion) {
							const propName = prop.slice(1);

							return !allKeysSet.has(propName) && features.add(prop);
						}

						return (allKeysSet.has(prop) && (checkNative ? isNative(context, prop) : true) && features.add(prop));
					}).length;

					return versionLen == featureLen ? [...acc, key] : acc;
				}, []);

				const version = versionSort(match)[0];

				return { version, features };
			};

			// engine maps
			const { css: engineMapCSS, win: engineMapWindow, js: engineMapJS, } = getEngineMaps(BROWSER);

			// css version
			const { version: cssVersion, features: cssFeatures, } = getFeatures({ context: win, allKeys: computedStyleKeys, engineMap: engineMapCSS });

			// window version
			const { version: windowVersion, features: windowFeatures, } = getFeatures({ context: win, allKeys: windowFeaturesKeys, engineMap: engineMapWindow, checkNative: true });

			// js version
			const { version: jsVersion, features: jsFeatures, } = getFeatures({ context: win, allKeys: jsFeaturesKeys, engineMap: engineMapJS });

			// determine version based on 3 factors
			const getVersionFromRange = (range, versionCollection) => {
				const exactVersion = versionCollection.find((version) => version && !/-/.test(version));

				if (exactVersion) {
					return exactVersion;
				}

				const len = range.length;
				const first = range[0];
				const last = range[len - 1];

				return (!len ? '' : len == 1 ? first : `${last}-${first}`);
			};

			const versionSet = new Set([cssVersion, windowVersion, jsVersion]);

			versionSet.delete(undefined);

			const versionRange = versionSort([...versionSet].reduce((acc, x) => [...acc, ...x.split('-')], []));
			const version = getVersionFromRange(versionRange, [cssVersion, windowVersion, jsVersion]);
			const vReport = (/\d+/.exec(decryptedName) || [])[0];
			const { liedVersion: liedCSS, distance: distanceCSS, } = getVersionLie(vReport, cssVersion);
			const { liedVersion: liedJS, distance: distanceJS, } = getVersionLie(vReport, jsVersion);
			const { liedVersion: liedWindow, distance: distanceWindow, } = getVersionLie(vReport, windowVersion);

			if (liedCSS) {
				sendToTrash('userAgent', `v${vReport} failed v${cssVersion} CSS features`);

				if (distanceCSS > 1) {
					documentLie(`Navigator.userAgent`, `v${vReport} failed CSS features by ${distanceCSS} versions`);
				}
			}

			if (liedJS) {
				sendToTrash('userAgent', `v${vReport} failed v${jsVersion} JS features`);

				if (distanceJS > 2) {
					documentLie(`Navigator.userAgent`, `v${vReport} failed JS features by ${distanceJS} versions`);
				}
			}

			if (liedWindow) {
				sendToTrash('userAgent', `v${vReport} failed v${windowVersion} Window features`);

				if (distanceWindow > 3) {
					documentLie(`Navigator.userAgent`, `v${vReport} failed Window features by ${distanceWindow} versions`);
				}
			}

			logTestResult({ time: timer.stop(), test: 'features', passed: true });
			PARENT_PHANTOM.remove();

			return { versionRange, version, cssVersion, windowVersion, jsVersion, cssFeatures: [...cssFeatures], windowFeatures: [...windowFeatures], jsFeatures: [...jsFeatures], jsFeaturesKeys };
		} catch (error) {
			logTestResult({ test: 'features', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	function getPlatformEstimate() {
		if (!IS_BLINK)
			return [];

		const v80 = 'getVideoPlaybackQuality' in HTMLVideoElement.prototype;
		const v81 = CSS.supports('color-scheme: initial');
		const v84 = CSS.supports('appearance: initial');
		const v86 = 'DisplayNames' in Intl;
		const v88 = CSS.supports('aspect-ratio: initial');
		const v89 = CSS.supports('border-end-end-radius: initial');
		const v95 = 'randomUUID' in Crypto.prototype;
		const hasBarcodeDetector = 'BarcodeDetector' in window;

		// @ts-expect-error if not supported
		const hasDownlinkMax = 'downlinkMax' in (window.NetworkInformation?.prototype || {});
		const hasContentIndex = 'ContentIndex' in window;
		const hasContactsManager = 'ContactsManager' in window;
		const hasEyeDropper = 'EyeDropper' in window;
		const hasFileSystemWritableFileStream = 'FileSystemWritableFileStream' in window;
		const hasHid = 'HID' in window && 'HIDDevice' in window;
		const hasSerialPort = 'SerialPort' in window && 'Serial' in window;
		const hasSharedWorker = 'SharedWorker' in window;
		const hasTouch = 'ontouchstart' in Window && 'TouchEvent' in window;
		const hasAppBadge = 'setAppBadge' in Navigator.prototype;

		const hasFeature = (version, condition) => {
			return (version ? [condition] : []);
		};

		const estimate = {
			["Android" /* Platform.ANDROID */]: [...hasFeature(v88, hasBarcodeDetector), ...hasFeature(v84, hasContentIndex), ...hasFeature(v80, hasContactsManager), hasDownlinkMax, ...hasFeature(v95, !hasEyeDropper), ...hasFeature(v86, !hasFileSystemWritableFileStream), ...hasFeature(v89, !hasHid), ...hasFeature(v89, !hasSerialPort), !hasSharedWorker, hasTouch, ...hasFeature(v81, !hasAppBadge)],
			["Chrome OS" /* Platform.CHROME_OS */]: [...hasFeature(v88, hasBarcodeDetector), ...hasFeature(v84, !hasContentIndex), ...hasFeature(v80, !hasContactsManager), hasDownlinkMax, ...hasFeature(v95, hasEyeDropper), ...hasFeature(v86, hasFileSystemWritableFileStream), ...hasFeature(v89, hasHid), ...hasFeature(v89, hasSerialPort), hasSharedWorker, hasTouch || !hasTouch, ...hasFeature(v81, !hasAppBadge)],
			["Windows" /* Platform.WINDOWS */]: [...hasFeature(v88, !hasBarcodeDetector), ...hasFeature(v84, !hasContentIndex), ...hasFeature(v80, !hasContactsManager), !hasDownlinkMax, ...hasFeature(v95, hasEyeDropper), ...hasFeature(v86, hasFileSystemWritableFileStream), ...hasFeature(v89, hasHid), ...hasFeature(v89, hasSerialPort), hasSharedWorker, hasTouch || !hasTouch, ...hasFeature(v81, hasAppBadge)],
			["Mac" /* Platform.MAC */]: [...hasFeature(v88, hasBarcodeDetector), ...hasFeature(v84, !hasContentIndex), ...hasFeature(v80, !hasContactsManager), !hasDownlinkMax, ...hasFeature(v95, hasEyeDropper), ...hasFeature(v86, hasFileSystemWritableFileStream), ...hasFeature(v89, hasHid), ...hasFeature(v89, hasSerialPort), hasSharedWorker, !hasTouch, ...hasFeature(v81, hasAppBadge)],
			["Linux" /* Platform.LINUX */]: [...hasFeature(v88, !hasBarcodeDetector), ...hasFeature(v84, !hasContentIndex), ...hasFeature(v80, !hasContactsManager), !hasDownlinkMax, ...hasFeature(v95, hasEyeDropper), ...hasFeature(v86, hasFileSystemWritableFileStream), ...hasFeature(v89, hasHid), ...hasFeature(v89, hasSerialPort), hasSharedWorker, !hasTouch || !hasTouch, ...hasFeature(v81, !hasAppBadge)]
		};

		// Chrome only features
		const headlessEstimate = { noContentIndex: v84 && !hasContentIndex, noContactsManager: v80 && !hasContactsManager, noDownlinkMax: !hasDownlinkMax };

		const scores = Object.keys(estimate).reduce((acc, key) => {
			const list = estimate[key];
			const score = +((list.filter((x) => x).length / list.length).toFixed(2));
			acc[key] = score;

			return acc;
		}, {});

		const platform = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
		const highestScore = scores[platform];

		return [scores, highestScore, headlessEstimate];
	}

	const SYSTEM_FONTS = ['caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar'];

	const GeckoFonts = {
		'-apple-system': "Mac" /* Platform.MAC */,
		'Segoe UI': "Windows" /* Platform.WINDOWS */,
		'Tahoma': "Windows" /* Platform.WINDOWS */,
		'Yu Gothic UI': "Windows" /* Platform.WINDOWS */,
		'Microsoft JhengHei UI': "Windows" /* Platform.WINDOWS */,
		'Microsoft YaHei UI': "Windows" /* Platform.WINDOWS */,
		'Meiryo UI': "Windows" /* Platform.WINDOWS */,
		'Cantarell': "Linux" /* Platform.LINUX */,
		'Ubuntu': "Linux" /* Platform.LINUX */,
		'Sans': "Linux" /* Platform.LINUX */,
		'sans-serif': "Linux" /* Platform.LINUX */,
		'Fira Sans': "Linux" /* Platform.LINUX */,
		'Roboto': "Android" /* Platform.ANDROID */,
	};

	function getSystemFonts() {
		const { body } = document;
		const el = document.createElement('div');

		body.appendChild(el);

		try {
			const systemFonts = String([...SYSTEM_FONTS.reduce((acc, font) => {
				el.setAttribute('style', `font: ${font} !important`);

				return acc.add(getComputedStyle(el).fontFamily);
			}, new Set())]);

			const geckoPlatform = GeckoFonts[systemFonts];

			return GeckoFonts[systemFonts] ? `${systemFonts}:${geckoPlatform}` : systemFonts;
		} catch (err) {
			return '';
		} finally {
			body.removeChild(el);
		}
	}

	/* eslint-disable new-cap */
	async function getHeadlessFeatures({ webgl, workerScope }) {
		try {
			const timer = createTimer();
			await queueEvent(timer);
			const mimeTypes = Object.keys({ ...navigator.mimeTypes });
			const systemFonts = getSystemFonts();
			const [scores, highestScore, headlessEstimate] = getPlatformEstimate();
			const data = {
				chromium: IS_BLINK,
				likeHeadless: {
					noChrome: IS_BLINK && !('chrome' in window),
					hasPermissionsBug: (IS_BLINK && 'permissions' in navigator && await (async () => {
						const res = await navigator.permissions.query({ name: 'notifications' });

						return (res.state == 'prompt' && 'Notification' in window && Notification.permission === 'denied');
					})()),
					noPlugins: IS_BLINK && navigator.plugins.length === 0,
					noMimeTypes: IS_BLINK && mimeTypes.length === 0,
					notificationIsDenied: (IS_BLINK && 'Notification' in window && (Notification.permission == 'denied')),
					hasKnownBgColor: IS_BLINK && (() => {
						let rendered = PARENT_PHANTOM;

						if (!PARENT_PHANTOM) {
							rendered = document.createElement('div');
							document.body.appendChild(rendered);
						}

						if (!rendered)
							return false;

						rendered.setAttribute('style', `background-color: ActiveText`);

						const { backgroundColor: activeText } = getComputedStyle(rendered) || [];

						if (!PARENT_PHANTOM) {
							document.body.removeChild(rendered);
						}

						return activeText === 'rgb(255, 0, 0)';
					})(),
					prefersLightColor: matchMedia('(prefers-color-scheme: light)').matches,
					// @ts-expect-error if userAgentData is null
					uaDataIsBlank: ('userAgentData' in navigator && (navigator.userAgentData?.platform === '' || await navigator.userAgentData.getHighEntropyValues(['platform']).platform === '')),
					pdfIsDisabled: ('pdfViewerEnabled' in navigator && navigator.pdfViewerEnabled === false),
					noTaskbar: (screen.height === screen.availHeight && screen.width === screen.availWidth),
					// @ts-expect-error if unsupported
					hasVvpScreenRes: ((innerWidth === screen.width && outerHeight === screen.height) || ('visualViewport' in window && (visualViewport.width === screen.width && visualViewport.height === screen.height))),
					hasSwiftShader: /SwiftShader/.test(workerScope?.webglRenderer),
					noWebShare: IS_BLINK && CSS.supports('accent-color: initial') && (!('share' in navigator) || !('canShare' in navigator)),
					noContentIndex: !!headlessEstimate?.noContentIndex,
					noContactsManager: !!headlessEstimate?.noContactsManager,
					noDownlinkMax: !!headlessEstimate?.noDownlinkMax,
				},
				headless: {
					webDriverIsOn: ((CSS.supports('border-end-end-radius: initial') && navigator.webdriver === undefined) || !!navigator.webdriver || !!lieProps['Navigator.webdriver']),
					hasHeadlessUA: (/HeadlessChrome/.test(navigator.userAgent) || /HeadlessChrome/.test(navigator.appVersion)),
					hasHeadlessWorkerUA: !!workerScope && (/HeadlessChrome/.test(workerScope.userAgent)),
				},
				stealth: {
					hasIframeProxy: (() => {
						try {
							const iframe = document.createElement('iframe');
							iframe.srcdoc = instanceId;

							return !!iframe.contentWindow;
						} catch (err) {
							return true;
						}
					})(),

					hasHighChromeIndex: (() => {
						const key = 'chrome';
						const highIndexRange = -50;

						return (Object.keys(window).slice(highIndexRange).includes(key) && Object.getOwnPropertyNames(window).slice(highIndexRange).includes(key));
					})(),
					hasBadChromeRuntime: (() => {
						// @ts-expect-error if unsupported
						if (!('chrome' in window && 'runtime' in chrome)) {
							return false;

						}
						try {
							// @ts-expect-error if unsupported
							if ('prototype' in chrome.runtime.sendMessage || 'prototype' in chrome.runtime.connect) {
								return true;
							}

							// @ts-expect-error if unsupported
							new chrome.runtime.sendMessage;
							// @ts-expect-error if unsupported
							// noinspection JSPotentiallyInvalidConstructorUsage
							new chrome.runtime.connect;

							return true;
						} catch (err) {
							return err.constructor.name != 'TypeError';
						}
					})(),
					hasToStringProxy: (!!lieProps['Function.toString']),
					hasBadWebGL: (() => {
						const { UNMASKED_RENDERER_WEBGL: gpu } = webgl?.parameters || {};
						const { webglRenderer: workerGPU } = workerScope || {};

						return (gpu && workerGPU && (gpu !== workerGPU));
					})(),
				},
			};

			const { likeHeadless, headless, stealth } = data;
			const likeHeadlessKeys = Object.keys(likeHeadless);
			const headlessKeys = Object.keys(headless);
			const stealthKeys = Object.keys(stealth);
			const likeHeadlessRating = +((likeHeadlessKeys.filter((key) => likeHeadless[key]).length / likeHeadlessKeys.length) * 100).toFixed(0);
			const headlessRating = +((headlessKeys.filter((key) => headless[key]).length / headlessKeys.length) * 100).toFixed(0);
			const stealthRating = +((stealthKeys.filter((key) => stealth[key]).length / stealthKeys.length) * 100).toFixed(0);

			logTestResult({ time: timer.stop(), test: 'headless', passed: true });

			return { ...data, likeHeadlessRating, headlessRating, stealthRating, systemFonts, platformEstimate: [scores, highestScore] };
		} catch (error) {
			logTestResult({ test: 'headless', passed: false });
			captureError(error);

			return;
		}
	}

	async function getIntl() {
		const getLocale = (intl) => {
			const constructors = [
				'Collator',
				'DateTimeFormat',
				'DisplayNames',
				'ListFormat',
				'NumberFormat',
				'PluralRules',
				'RelativeTimeFormat',
			];
			// @ts-ignore
			const locale = constructors.reduce((acc, name) => {
				try {
					const obj = new intl[name];
					if (!obj) {
						return acc;
					}
					const { locale } = obj.resolvedOptions() || {};
					return [...acc, locale];
				}
				catch (error) {
					return acc;
				}
			}, []);
			return [...new Set(locale)];
		};
		try {
			const timer = createTimer();
			await queueEvent(timer);
			const lied = (lieProps['Intl.Collator.resolvedOptions'] ||
				lieProps['Intl.DateTimeFormat.resolvedOptions'] ||
				lieProps['Intl.DisplayNames.resolvedOptions'] ||
				lieProps['Intl.ListFormat.resolvedOptions'] ||
				lieProps['Intl.NumberFormat.resolvedOptions'] ||
				lieProps['Intl.PluralRules.resolvedOptions'] ||
				lieProps['Intl.RelativeTimeFormat.resolvedOptions']) || false;
			const dateTimeFormat = caniuse(() => {
				return new Intl.DateTimeFormat(undefined, {
					month: 'long',
					timeZoneName: 'long',
				}).format(963644400000);
			});
			const displayNames = caniuse(() => {
				return new Intl.DisplayNames(undefined, {
					type: 'language',
				}).of('en-US');
			});
			const listFormat = caniuse(() => {
				// @ts-ignore
				return new Intl.ListFormat(undefined, {
					style: 'long',
					type: 'disjunction',
				}).format(['0', '1']);
			});
			const numberFormat = caniuse(() => {
				return new Intl.NumberFormat(undefined, {
					notation: 'compact',
					compactDisplay: 'long',
				}).format(21000000);
			});
			const pluralRules = caniuse(() => {
				return new Intl.PluralRules().select(1);
			});
			const relativeTimeFormat = caniuse(() => {
				return new Intl.RelativeTimeFormat(undefined, {
					localeMatcher: 'best fit',
					numeric: 'auto',
					style: 'long',
				}).format(1, 'year');
			});
			const locale = getLocale(Intl);
			logTestResult({ time: timer.stop(), test: 'intl', passed: true });
			return {
				dateTimeFormat,
				displayNames,
				listFormat,
				numberFormat,
				pluralRules,
				relativeTimeFormat,
				locale: '' + locale,
				lied,
			};
		}
		catch (error) {
			logTestResult({ test: 'intl', passed: false });
			captureError(error);
			return;
		}
	}

	function getMaths() {
		try {
			const timer = createTimer();
			timer.start();
			// detect failed math equality lie
			const check = [
				'acos',
				'acosh',
				'asin',
				'asinh',
				'atan',
				'atanh',
				'atan2',
				'cbrt',
				'cos',
				'cosh',
				'expm1',
				'exp',
				'hypot',
				'log',
				'log1p',
				'log10',
				'sin',
				'sinh',
				'sqrt',
				'tan',
				'tanh',
				'pow',
			];
			let lied = false;
			check.forEach((prop) => {
				if (!!lieProps[`Math.${prop}`]) {
					lied = true;
				}
				const test = (prop == 'cos' ? [1e308] :
					prop == 'acos' || prop == 'asin' || prop == 'atanh' ? [0.5] :
						prop == 'pow' || prop == 'atan2' ? [Math.PI, 2] :
							[Math.PI]);
				const res1 = Math[prop](...test);
				const res2 = Math[prop](...test);
				const matching = isNaN(res1) && isNaN(res2) ? true : res1 == res2;
				if (!matching) {
					lied = true;
					const mathLie = `expected x and got y`;
					documentLie(`Math.${prop}`, mathLie);
				}
				return;
			});
			const n = 0.123;
			const bigN = 5.860847362277284e+38;
			const fns = [
				['acos', [n], `acos(${n})`, 1.4474840516030247, NaN, NaN, 1.4474840516030245],
				['acos', [Math.SQRT1_2], 'acos(Math.SQRT1_2)', 0.7853981633974483, NaN, NaN, NaN],
				['acosh', [1e308], 'acosh(1e308)', 709.889355822726, NaN, NaN, NaN],
				['acosh', [Math.PI], 'acosh(Math.PI)', 1.811526272460853, NaN, NaN, NaN],
				['acosh', [Math.SQRT2], 'acosh(Math.SQRT2)', 0.881373587019543, NaN, NaN, 0.8813735870195432],
				['asin', [n], `asin(${n})`, 0.12331227519187199, NaN, NaN, NaN],
				['asinh', [1e300], 'asinh(1e308)', 691.4686750787736, NaN, NaN, NaN],
				['asinh', [Math.PI], 'asinh(Math.PI)', 1.8622957433108482, NaN, NaN, NaN],
				['atan', [2], 'atan(2)', 1.1071487177940904, NaN, NaN, 1.1071487177940906],
				['atan', [Math.PI], 'atan(Math.PI)', 1.2626272556789115, NaN, NaN, NaN],
				['atanh', [0.5], 'atanh(0.5)', 0.5493061443340548, NaN, NaN, 0.5493061443340549],
				['atan2', [1e-310, 2], 'atan2(1e-310, 2)', 5e-311, NaN, NaN, NaN],
				['atan2', [Math.PI, 2], 'atan2(Math.PI)', 1.0038848218538872, NaN, NaN, NaN],
				['cbrt', [100], 'cbrt(100)', 4.641588833612779, NaN, NaN, NaN],
				['cbrt', [Math.PI], 'cbrt(Math.PI)', 1.4645918875615231, NaN, NaN, 1.4645918875615234],
				['cos', [n], `cos(${n})`, 0.9924450321351935, NaN, NaN, NaN],
				['cos', [Math.PI], 'cos(Math.PI)', -1, NaN, NaN, NaN],
				['cos', [bigN], `cos(${bigN})`, -0.10868049424995659, NaN, -0.9779661551196617, NaN],
				['cos', [-1e308], 'cos(-1e308)', -0.8913089376870335, NaN, 0.99970162388838, NaN],
				['cos', [13 * Math.E], 'cos(13*Math.E)', -0.7108118501064331, -0.7108118501064332, NaN, NaN],
				['cos', [57 * Math.E], 'cos(57*Math.E)', -0.536911695749024, -0.5369116957490239, NaN, NaN],
				['cos', [21 * Math.LN2], 'cos(21*Math.LN2)', -0.4067775970251724, -0.40677759702517235, -0.6534063185820197, NaN],
				['cos', [51 * Math.LN2], 'cos(51*Math.LN2)', -0.7017203400855446, -0.7017203400855445, NaN, NaN],
				['cos', [21 * Math.LOG2E], 'cos(21*Math.LOG2E)', 0.4362848063618998, 0.43628480636189976, NaN, NaN],
				['cos', [25 * Math.SQRT2], 'cos(25*Math.SQRT2)', -0.6982689820462377, -0.6982689820462376, NaN, NaN],
				['cos', [50 * Math.SQRT1_2], 'cos(50*Math.SQRT1_2)', -0.6982689820462377, -0.6982689820462376, NaN, NaN],
				['cos', [21 * Math.SQRT1_2], 'cos(21*Math.SQRT1_2)', -0.6534063185820198, NaN, NaN, NaN],
				['cos', [17 * Math.LOG10E], 'cos(17*Math.LOG10E)', 0.4537557425982784, 0.45375574259827833, NaN, NaN],
				['cos', [2 * Math.LOG10E], 'cos(2*Math.LOG10E)', 0.6459044007438142, NaN, 0.6459044007438141, NaN],
				['cosh', [1], 'cosh(1)', 1.5430806348152437, NaN, NaN, NaN],
				['cosh', [Math.PI], 'cosh(Math.PI)', 11.591953275521519, NaN, NaN, NaN],
				['cosh', [492 * Math.LOG2E], 'cosh(492*Math.LOG2E)', 9.199870313877772e+307, 9.199870313877774e+307, NaN, NaN],
				['cosh', [502 * Math.SQRT2], 'cosh(502*Math.SQRT2)', 1.0469199669023138e+308, 1.046919966902314e+308, NaN, NaN],
				['expm1', [1], 'expm1(1)', 1.718281828459045, NaN, NaN, 1.7182818284590453],
				['expm1', [Math.PI], 'expm1(Math.PI)', 22.140692632779267, NaN, NaN, NaN],
				['exp', [n], `exp(${n})`, 1.1308844209474893, NaN, NaN, NaN],
				['exp', [Math.PI], 'exp(Math.PI)', 23.140692632779267, NaN, NaN, NaN],
				['hypot', [1, 2, 3, 4, 5, 6], 'hypot(1, 2, 3, 4, 5, 6)', 9.539392014169456, NaN, NaN, NaN],
				['hypot', [bigN, bigN], `hypot(${bigN}, ${bigN})`, 8.288489826731116e+38, 8.288489826731114e+38, NaN, NaN],
				['hypot', [2 * Math.E, -100], 'hypot(2*Math.E, -100)', 100.14767208675259, 100.14767208675258, NaN, NaN],
				['hypot', [6 * Math.PI, -100], 'hypot(6*Math.PI, -100)', 101.76102278593319, 101.7610227859332, NaN, NaN],
				['hypot', [2 * Math.LN2, -100], 'hypot(2*Math.LN2, -100)', 100.0096085986525, 100.00960859865252, NaN, NaN],
				['hypot', [Math.LOG2E, -100], 'hypot(Math.LOG2E, -100)', 100.01040630344929, 100.01040630344927, NaN, NaN],
				['hypot', [Math.SQRT2, -100], 'hypot(Math.SQRT2, -100)', 100.00999950004999, 100.00999950005, NaN, NaN],
				['hypot', [Math.SQRT1_2, -100], 'hypot(Math.SQRT1_2, -100)', 100.0024999687508, 100.00249996875078, NaN, NaN],
				['hypot', [2 * Math.LOG10E, -100], 'hypot(2*Math.LOG10E, -100)', 100.00377216279416, 100.00377216279418, NaN, NaN],
				['log', [n], `log(${n})`, -2.0955709236097197, NaN, NaN, NaN],
				['log', [Math.PI], 'log(Math.PI)', 1.1447298858494002, NaN, NaN, NaN],
				['log1p', [n], `log1p(${n})`, 0.11600367575630613, NaN, NaN, NaN],
				['log1p', [Math.PI], 'log1p(Math.PI)', 1.4210804127942926, NaN, NaN, NaN],
				['log10', [n], `log10(${n})`, -0.9100948885606021, NaN, NaN, NaN],
				['log10', [Math.PI], 'log10(Math.PI)', 0.4971498726941338, 0.49714987269413385, NaN, NaN],
				['log10', [Math.E], 'log10(Math.E)', 0.4342944819032518, NaN, NaN, NaN],
				['log10', [34 * Math.E], 'log10(34*Math.E)', 1.9657733989455068, 1.965773398945507, NaN, NaN],
				['log10', [Math.LN2], 'log10(Math.LN2)', -0.1591745389548616, NaN, NaN, NaN],
				['log10', [11 * Math.LN2], 'log10(11*Math.LN2)', 0.8822181462033634, 0.8822181462033635, NaN, NaN],
				['log10', [Math.LOG2E], 'log10(Math.LOG2E)', 0.15917453895486158, NaN, NaN, NaN],
				['log10', [43 * Math.LOG2E], 'log10(43*Math.LOG2E)', 1.792642994534448, 1.7926429945344482, NaN, NaN],
				['log10', [Math.LOG10E], 'log10(Math.LOG10E)', -0.36221568869946325, NaN, NaN, NaN],
				['log10', [7 * Math.LOG10E], 'log10(7*Math.LOG10E)', 0.4828823513147936, 0.48288235131479357, NaN, NaN],
				['log10', [Math.SQRT1_2], 'log10(Math.SQRT1_2)', -0.15051499783199057, NaN, NaN, NaN],
				['log10', [2 * Math.SQRT1_2], 'log10(2*Math.SQRT1_2)', 0.1505149978319906, 0.15051499783199063, NaN, NaN],
				['log10', [Math.SQRT2], 'log10(Math.SQRT2)', 0.1505149978319906, 0.15051499783199063, NaN, NaN],
				['sin', [bigN], `sin(${bigN})`, 0.994076732536068, NaN, -0.20876350121720488, NaN],
				['sin', [Math.PI], 'sin(Math.PI)', 1.2246467991473532e-16, NaN, 1.2246063538223773e-16, NaN],
				['sin', [39 * Math.E], 'sin(39*Math.E)', -0.7181630308570677, -0.7181630308570678, NaN, NaN],
				['sin', [35 * Math.LN2], 'sin(35*Math.LN2)', -0.7659964138980511, -0.765996413898051, NaN, NaN],
				['sin', [110 * Math.LOG2E], 'sin(110*Math.LOG2E)', 0.9989410140273756, 0.9989410140273757, NaN, NaN],
				['sin', [7 * Math.LOG10E], 'sin(7*Math.LOG10E)', 0.10135692924965616, 0.10135692924965614, NaN, NaN],
				['sin', [35 * Math.SQRT1_2], 'sin(35*Math.SQRT1_2)', -0.3746357547858202, -0.37463575478582023, NaN, NaN],
				['sin', [21 * Math.SQRT2], 'sin(21*Math.SQRT2)', -0.9892668187780498, -0.9892668187780497, NaN, NaN],
				['sinh', [1], 'sinh(1)', 1.1752011936438014, NaN, NaN, NaN],
				['sinh', [Math.PI], 'sinh(Math.PI)', 11.548739357257748, NaN, NaN, 11.548739357257746],
				['sinh', [Math.E], 'sinh(Math.E)', 7.544137102816975, NaN, NaN, NaN],
				['sinh', [Math.LN2], 'sinh(Math.LN2)', 0.75, NaN, NaN, NaN],
				['sinh', [Math.LOG2E], 'sinh(Math.LOG2E)', 1.9978980091062795, NaN, NaN, NaN],
				['sinh', [492 * Math.LOG2E], 'sinh(492*Math.LOG2E)', 9.199870313877772e+307, 9.199870313877774e+307, NaN, NaN],
				['sinh', [Math.LOG10E], 'sinh(Math.LOG10E)', 0.44807597941469024, NaN, NaN, NaN],
				['sinh', [Math.SQRT1_2], 'sinh(Math.SQRT1_2)', 0.7675231451261164, NaN, NaN, NaN],
				['sinh', [Math.SQRT2], 'sinh(Math.SQRT2)', 1.935066822174357, NaN, NaN, 1.9350668221743568],
				['sinh', [502 * Math.SQRT2], 'sinh(502*Math.SQRT2)', 1.0469199669023138e+308, 1.046919966902314e+308, NaN, NaN],
				['sqrt', [n], `sqrt(${n})`, 0.3507135583350036, NaN, NaN, NaN],
				['sqrt', [Math.PI], 'sqrt(Math.PI)', 1.7724538509055159, NaN, NaN, NaN],
				['tan', [-1e308], 'tan(-1e308)', 0.5086861259107568, NaN, NaN, 0.5086861259107567],
				['tan', [Math.PI], 'tan(Math.PI)', -1.2246467991473532e-16, NaN, NaN, NaN],
				['tan', [6 * Math.E], 'tan(6*Math.E)', 0.6866761546452431, 0.686676154645243, NaN, NaN],
				['tan', [6 * Math.LN2], 'tan(6*Math.LN2)', 1.6182817135715877, 1.618281713571588, NaN, 1.6182817135715875],
				['tan', [10 * Math.LOG2E], 'tan(10*Math.LOG2E)', -3.3537128705376014, -3.353712870537601, NaN, -3.353712870537602],
				['tan', [17 * Math.SQRT2], 'tan(17*Math.SQRT2)', -1.9222955461799982, -1.922295546179998, NaN, NaN],
				['tan', [34 * Math.SQRT1_2], 'tan(34*Math.SQRT1_2)', -1.9222955461799982, -1.922295546179998, NaN, NaN],
				['tan', [10 * Math.LOG10E], 'tan(10*Math.LOG10E)', 2.5824856130712432, 2.5824856130712437, NaN, NaN],
				['tanh', [n], `tanh(${n})`, 0.12238344189440875, NaN, NaN, 0.12238344189440876],
				['tanh', [Math.PI], 'tanh(Math.PI)', 0.99627207622075, NaN, NaN, NaN],
				['pow', [n, -100], `pow(${n}, -100)`, 1.022089333584519e+91, 1.0220893335845176e+91, NaN, NaN],
				['pow', [Math.PI, -100], 'pow(Math.PI, -100)', 1.9275814160560204e-50, 1.9275814160560185e-50, NaN, 1.9275814160560206e-50],
				['pow', [Math.E, -100], 'pow(Math.E, -100)', 3.7200759760208555e-44, 3.720075976020851e-44, NaN, NaN],
				['pow', [Math.LN2, -100], 'pow(Math.LN2, -100)', 8269017203802394, 8269017203802410, NaN, NaN],
				['pow', [Math.LN10, -100], 'pow(Math.LN10, -100)', 6.003867926738829e-37, 6.003867926738811e-37, NaN, NaN],
				['pow', [Math.LOG2E, -100], 'pow(Math.LOG2E, -100)', 1.20933355845501e-16, 1.2093335584550061e-16, NaN, NaN],
				['pow', [Math.LOG10E, -100], 'pow(Math.LOG10E, -100)', 1.6655929347585958e+36, 1.665592934758592e+36, NaN, 1.6655929347585955e+36],
				['pow', [Math.SQRT1_2, -100], 'pow(Math.SQRT1_2, -100)', 1125899906842616.2, 1125899906842611.5, NaN, NaN],
				['pow', [Math.SQRT2, -100], 'pow(Math.SQRT2, -100)', 8.881784197001191e-16, 8.881784197001154e-16, NaN, NaN],
				['polyfill', [2e-3 ** -100], 'polyfill pow(2e-3, -100)', 7.888609052210102e+269, 7.888609052210126e+269, NaN, NaN],
			];
			const data = {};
			fns.forEach((fn) => {
				data[fn[2]] = attempt(() => {
					// @ts-ignore
					const result = fn[0] != 'polyfill' ? Math[fn[0]](...fn[1]) : fn[1];
					const chrome = result == fn[3];
					const firefox = fn[4] ? result == fn[4] : false;
					const torBrowser = fn[5] ? result == fn[5] : false;
					const safari = fn[6] ? result == fn[6] : false;
					return { result, chrome, firefox, torBrowser, safari };
				});
			});
			logTestResult({ time: timer.stop(), test: 'math', passed: true });
			return { data, lied };
		}
		catch (error) {
			logTestResult({ test: 'math', passed: false });
			captureError(error);
			return;
		}
	}

	// inspired by
	// - https://privacycheck.sec.lrz.de/active/fp_cpt/fp_can_play_type.html
	// - https://arkenfox.github.io/TZP
	const getMimeTypeShortList = () => [
		'audio/ogg; codecs="vorbis"',
		'audio/mpeg',
		'audio/mpegurl',
		'audio/wav; codecs="1"',
		'audio/x-m4a',
		'audio/aac',
		'video/ogg; codecs="theora"',
		'video/quicktime',
		'video/mp4; codecs="avc1.42E01E"',
		'video/webm; codecs="vp8"',
		'video/webm; codecs="vp9"',
		'video/x-matroska',
	].sort();

	async function getMedia() {
		const getMimeTypes = () => {
			try {
				const mimeTypes = getMimeTypeShortList();
				const videoEl = document.createElement('video');
				const audioEl = new Audio();
				const isMediaRecorderSupported = 'MediaRecorder' in window;
				const types = mimeTypes.reduce((acc, type) => {
					const data = {
						mimeType: type,
						audioPlayType: audioEl.canPlayType(type),
						videoPlayType: videoEl.canPlayType(type),
						mediaSource: MediaSource.isTypeSupported(type),
						mediaRecorder: isMediaRecorderSupported ? MediaRecorder.isTypeSupported(type) : false,
					};
					if (!data.audioPlayType && !data.videoPlayType && !data.mediaSource && !data.mediaRecorder) {
						return acc;
					}
					// @ts-ignore
					acc.push(data);
					return acc;
				}, []);
				return types;
			}
			catch (error) {
				return;
			}
		};
		try {
			const timer = createTimer();
			timer.start();
			const mimeTypes = getMimeTypes();
			logTestResult({ time: timer.stop(), test: 'media', passed: true });
			return { mimeTypes };
		}
		catch (error) {
			logTestResult({ test: 'media', passed: false });
			captureError(error);
			return;
		}
	}

	// special thanks to https://arh.antoinevastel.com for inspiration
	async function getNavigator(workerScope) {
		try {
			const timer = createTimer();

			await queueEvent(timer);

			let lied = (lieProps['Navigator.appVersion'] || lieProps['Navigator.deviceMemory'] || lieProps['Navigator.doNotTrack'] || lieProps['Navigator.hardwareConcurrency'] || lieProps['Navigator.language'] || lieProps['Navigator.languages'] || lieProps['Navigator.maxTouchPoints'] || lieProps['Navigator.oscpu'] || lieProps['Navigator.platform'] || lieProps['Navigator.userAgent'] || lieProps['Navigator.vendor'] || lieProps['Navigator.plugins'] || lieProps['Navigator.mimeTypes']) || false;

			const credibleUserAgent = ('chrome' in window ? navigator.userAgent.includes(navigator.appVersion) : true);

			const data = {
				platform: attempt(() => {
					const { platform } = navigator;
					const systems = ['win', 'linux', 'mac', 'arm', 'pike', 'linux', 'iphone', 'ipad', 'ipod', 'android', 'x11'];
					const trusted = typeof platform == 'string' && systems.filter((val) => platform.toLowerCase().includes(val))[0];

					if (!trusted) {
						sendToTrash(`platform`, `${platform} is unusual`);
					}

					// user agent os lie
					if (USER_AGENT_OS !== PLATFORM_OS) {
						lied = true;
						documentLie(`Navigator.platform`, `${PLATFORM_OS} platform and ${USER_AGENT_OS} user agent do not match`);
					}

					return platform;
				}),
				system: attempt(() => getOS(navigator.userAgent), 'userAgent system failed'),
				userAgentParsed: await attempt(async () => {
					const reportedUserAgent = caniuse(() => navigator.userAgent);
					const reportedSystem = getOS(reportedUserAgent);
					const isBrave = await braveBrowser();
					const report = decryptUserAgent({ ua: reportedUserAgent, os: reportedSystem, isBrave });

					return report;
				}),
				device: attempt(() => getUserAgentPlatform({ userAgent: navigator.userAgent }), 'userAgent device failed'),
				userAgent: attempt(() => {
					const { userAgent } = navigator;

					if (!credibleUserAgent) {
						sendToTrash('userAgent', `${userAgent} does not match appVersion`);
					}

					if (/\s{2,}|^\s|\s$/g.test(userAgent)) {
						sendToTrash('userAgent', `extra spaces detected`);
					}

					const gibbers = gibberish(userAgent);

					if (!!gibbers.length) {
						sendToTrash(`userAgent is gibberish`, userAgent);
					}

					return userAgent.trim().replace(/\s{2,}/, ' ');
				}, 'userAgent failed'),
				uaPostReduction: isUAPostReduction((navigator || {}).userAgent),
				appVersion: attempt(() => {
					const { appVersion } = navigator;

					if (!credibleUserAgent) {
						sendToTrash('appVersion', `${appVersion} does not match userAgent`);
					}

					if ('appVersion' in navigator && !appVersion) {
						sendToTrash('appVersion', 'Living Standard property returned falsy value');
					}

					if (/\s{2,}|^\s|\s$/g.test(appVersion)) {
						sendToTrash('appVersion', `extra spaces detected`);
					}

					return appVersion.trim().replace(/\s{2,}/, ' ');
				}, 'appVersion failed'),
				deviceMemory: attempt(() => {
					if (!('deviceMemory' in navigator)) {
						return undefined;
					}

					// @ts-ignore
					const { deviceMemory } = navigator;
					const trusted = { '0.25': true, '0.5': true, '1': true, '2': true, '4': true, '8': true };

					if (!trusted[deviceMemory]) {
						sendToTrash('deviceMemory', `${deviceMemory} is not a valid value [0.25, 0.5, 1, 2, 4, 8]`);
					}

					// @ts-expect-error memory is undefined if not supported
					const memory = performance?.memory?.jsHeapSizeLimit || null;
					const memoryInGigabytes = memory ? +(memory / 1073741824).toFixed(1) : 0;

					if (memoryInGigabytes > deviceMemory) {
						sendToTrash('deviceMemory', `available memory ${memoryInGigabytes}GB is greater than device memory ${deviceMemory}GB`);
					}

					return deviceMemory;
				}, 'deviceMemory failed'),
				doNotTrack: attempt(() => {
					const { doNotTrack } = navigator;

					const trusted = { '1': !0, 'true': !0, 'yes': !0, '0': !0, 'false': !0, 'no': !0, 'unspecified': !0, 'null': !0, 'undefined': !0 };

					if (!trusted[doNotTrack]) {
						sendToTrash('doNotTrack - unusual result', doNotTrack);
					}

					return doNotTrack;
				}, 'doNotTrack failed'),
				globalPrivacyControl: attempt(() => {
					if (!('globalPrivacyControl' in navigator)) {
						return undefined;
					}

					// @ts-ignore
					const { globalPrivacyControl } = navigator;

					const trusted = { '1': !0, 'true': !0, 'yes': !0, '0': !0, 'false': !0, 'no': !0, 'unspecified': !0, 'null': !0, 'undefined': !0 };

					if (!trusted[globalPrivacyControl]) {
						sendToTrash('globalPrivacyControl - unusual result', globalPrivacyControl);
					}

					return globalPrivacyControl;
				}, 'globalPrivacyControl failed'),

				hardwareConcurrency: attempt(() => {
					if (!('hardwareConcurrency' in navigator)) {
						return undefined;
					}

					const { hardwareConcurrency } = navigator;

					return hardwareConcurrency;
				}, 'hardwareConcurrency failed'),
				language: attempt(() => {
					const { language, languages } = navigator;

					if (language && languages) {
						// @ts-ignore
						const lang = /^.{0,2}/g.exec(language)[0];
						// @ts-ignore
						const langs = /^.{0,2}/g.exec(languages[0])[0];

						if (langs != lang) {
							sendToTrash('language/languages', `${[language, languages].join(' ')} mismatch`);
						}

						return `${languages.join(', ')} (${language})`;
					}

					if (language != workerScope.language) {
						lied = true;
						documentLie(`Navigator.language`, `${language} does not match worker scope`);
					}

					if (languages !== workerScope.languages) {
						lied = true;
						documentLie(`Navigator.languages`, `${languages} does not match worker scope`);
					}

					return `${language} ${languages}`;
				}, 'language(s) failed'),
				maxTouchPoints: attempt(() => {
					if (!('maxTouchPoints' in navigator)) {
						return null;
					}

					return navigator.maxTouchPoints;
				}, 'maxTouchPoints failed'),
				vendor: attempt(() => navigator.vendor, 'vendor failed'),
				mimeTypes: attempt(() => {
					const { mimeTypes } = navigator;

					return mimeTypes ? [...mimeTypes].map((m) => m.type) : [];
				}, 'mimeTypes failed'),
				// @ts-ignore
				oscpu: attempt(() => navigator.oscpu, 'oscpu failed'),
				plugins: attempt(() => {
					// https://html.spec.whatwg.org/multipage/system-state.html#pdf-viewing-support
					const { plugins } = navigator;

					if (!(plugins instanceof PluginArray)) {
						return;
					}

					// @ts-ignore
					const response = plugins ? [...plugins].map((p) => ({ name: p.name, description: p.description, filename: p.filename, version: p.version })) : [];

					const { lies } = getPluginLies(plugins, navigator.mimeTypes);

					if (lies.length) {
						lied = true;

						lies.forEach((lie) => {
							return documentLie(`Navigator.plugins`, lie);
						});
					}

					if (response.length) {
						response.forEach((plugin) => {
							const { name, description } = plugin;
							const nameGibbers = gibberish(name);
							const descriptionGibbers = gibberish(description);

							if (nameGibbers.length) {
								sendToTrash(`plugin name is gibberish`, name);
							}

							if (descriptionGibbers.length) {
								sendToTrash(`plugin description is gibberish`, description);
							}

							return;
						});
					}

					return response;
				}, 'plugins failed'),

				properties: attempt(() => {
					const keys = Object.keys(Object.getPrototypeOf(navigator));

					return keys;
				}, 'navigator keys failed'),
			};

			const getUserAgentData = () => attempt(() => {
				// @ts-ignore
				if (!navigator.userAgentData || !navigator.userAgentData.getHighEntropyValues) {
					return;
				}
				// @ts-ignore
				return navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'bitness', 'model', 'uaFullVersion']).then((data) => {
					// @ts-ignore
					const { brands, mobile } = navigator.userAgentData || {};
					const compressedBrands = (brands, captureVersion = false) => brands.filter((obj) => !/Not/.test(obj.brand)).map((obj) => `${obj.brand}${captureVersion ? ` ${obj.version}` : ''}`);
					const removeChromium = (brands) => (brands.length > 1 ? brands.filter((brand) => !/Chromium/.test(brand)) : brands);

					// compress brands
					if (!data.brands) {
						data.brands = brands;
					}

					data.brandsVersion = compressedBrands(data.brands, true);
					data.brands = compressedBrands(data.brands);
					data.brandsVersion = removeChromium(data.brandsVersion);
					data.brands = removeChromium(data.brands);

					if (!data.mobile) {
						data.mobile = mobile;
					}

					const dataSorted = Object.keys(data).sort().reduce((acc, key) => {
						acc[key] = data[key];

						return acc;
					}, {});

					return dataSorted;
				});
			}, 'userAgentData failed');

			const getBluetoothAvailability = () => attempt(() => {
				// @ts-ignore
				if (!('bluetooth' in navigator) || !navigator.bluetooth || !navigator.bluetooth.getAvailability) {
					return undefined;
				}
				// @ts-ignore
				return navigator.bluetooth.getAvailability();
			}, 'bluetoothAvailability failed');

			const getPermissions = () => attempt(() => {
				const getPermissionState = (name) => navigator.permissions.query({ name }).then((res) => ({ name, state: res.state })).catch((error) => ({ name, state: 'unknown' }));
				// https://w3c.github.io/permissions/#permission-registry
				const permissions = !('permissions' in navigator) ? undefined : Promise.all([getPermissionState('accelerometer'), getPermissionState('ambient-light-sensor'), getPermissionState('background-fetch'), getPermissionState('background-sync'), getPermissionState('bluetooth'), getPermissionState('camera'), getPermissionState('clipboard'), getPermissionState('device-info'), getPermissionState('display-capture'), getPermissionState('gamepad'), getPermissionState('geolocation'), getPermissionState('gyroscope'), getPermissionState('magnetometer'), getPermissionState('microphone'), getPermissionState('midi'), getPermissionState('nfc'), getPermissionState('notifications'), getPermissionState('persistent-storage'), getPermissionState('push'), getPermissionState('screen-wake-lock'), getPermissionState('speaker'), getPermissionState('speaker-selection')]).then((permissions) => permissions.reduce((acc, perm) => {
					const { state, name } = perm || {};
					if (acc[state]) {
						acc[state].push(name);
						return acc;
					}
					acc[state] = [name];
					return acc;
				}, {})).catch((error) => console.error(error));

				return permissions;
			}, 'permissions failed');

			const getWebGpu = () => attempt(() => {
				if (!('gpu' in navigator)) {
					return;
				}
				// @ts-expect-error if unsupported
				return navigator.gpu.requestAdapter().then((adapter) => {
					if (!adapter)
						return;

					const { limits = {}, features = [] } = adapter || {};

					// @ts-expect-error if unsupported
					const handleInfo = (info) => {
						const { architecture, description, device, vendor } = info;
						const adapterInfo = [vendor, architecture, description, device];
						const featureValues = [...features.values()];
						const limitsData = ((limits) => {
							const data = {};
							// eslint-disable-next-line guard-for-in
							for (const prop in limits) {
								data[prop] = limits[prop];
							}

							return data;
						})(limits);

						Analysis.webGpuAdapter = adapterInfo;
						Analysis.webGpuFeatures = featureValues;
						Analysis.webGpuLimits = hashMini(limitsData);

						return {
							adapterInfo,
							limits: limitsData,
						};
					};

					const { info } = adapter;

					return info ? handleInfo(info) : adapter.requestAdapterInfo().then(handleInfo);
				});
			}, 'webgpu failed');

			await queueEvent(timer);

			return Promise.all([getUserAgentData(), getBluetoothAvailability(), getPermissions(), getWebGpu()]).then(([userAgentData, bluetoothAvailability, permissions, webgpu,]) => {
				logTestResult({ time: timer.stop(), test: 'navigator', passed: true });
				return {
					...data,
					userAgentData,
					bluetoothAvailability,
					permissions,
					webgpu,
					lied,
				};
			}).catch((error) => {
				console.error(error);
				logTestResult({ time: timer.stop(), test: 'navigator', passed: true });
				return { ...data, lied };
			});
		} catch (error) {
			logTestResult({ test: 'navigator', passed: false });
			captureError(error, 'Navigator failed or blocked by client');

			return;
		}
	}

	async function getResistance() {
		try {
			const timer = createTimer();
			await queueEvent(timer);
			const data = {
				privacy: undefined,
				security: undefined,
				mode: undefined,
				extension: undefined,
				engine: (IS_BLINK ? 'Blink' :
					IS_GECKO ? 'Gecko' :
						''),
			};
			// Firefox/Tor Browser
			const regex = (n) => new RegExp(`${n}+$`);
			const delay = (ms, baseNumber, baseDate) => new Promise((resolve) => setTimeout(() => {
				const date = baseDate ? baseDate : +new Date();
				// @ts-ignore
				const value = regex(baseNumber).test(date) ? regex(baseNumber).exec(date)[0] : date;
				return resolve(value);
			}, ms));
			const getTimerPrecision = async () => {
				const baseDate = +new Date();
				const baseNumber = +('' + baseDate).slice(-1);
				const a = await delay(0, baseNumber, baseDate);
				const b = await delay(1, baseNumber);
				const c = await delay(2, baseNumber);
				const d = await delay(3, baseNumber);
				const e = await delay(4, baseNumber);
				const f = await delay(5, baseNumber);
				const g = await delay(6, baseNumber);
				const h = await delay(7, baseNumber);
				const i = await delay(8, baseNumber);
				const j = await delay(9, baseNumber);
				const lastCharA = ('' + a).slice(-1);
				const lastCharB = ('' + b).slice(-1);
				const lastCharC = ('' + c).slice(-1);
				const lastCharD = ('' + d).slice(-1);
				const lastCharE = ('' + e).slice(-1);
				const lastCharF = ('' + f).slice(-1);
				const lastCharG = ('' + g).slice(-1);
				const lastCharH = ('' + h).slice(-1);
				const lastCharI = ('' + i).slice(-1);
				const lastCharJ = ('' + j).slice(-1);
				const protection = (lastCharA == lastCharB &&
					lastCharA == lastCharC &&
					lastCharA == lastCharD &&
					lastCharA == lastCharE &&
					lastCharA == lastCharF &&
					lastCharA == lastCharG &&
					lastCharA == lastCharH &&
					lastCharA == lastCharI &&
					lastCharA == lastCharJ);
				const baseLen = ('' + a).length;
				const collection = [a, b, c, d, e, f, g, h, i, j];
				return {
					protection,
					delays: collection.map((n) => ('' + n).length > baseLen ? ('' + n).slice(-baseLen) : n),
					precision: protection ? Math.min(...collection.map((val) => ('' + val).length)) : undefined,
					precisionValue: protection ? lastCharA : undefined,
				};
			};
			const [isBrave, timerPrecision,] = await Promise.all([
				braveBrowser(),
				IS_BLINK ? undefined : getTimerPrecision(),
			]);
			if (isBrave) {
				const braveMode = getBraveMode();
				data.privacy = 'Brave';
				// @ts-ignore
				data.security = {
					'FileSystemWritableFileStream': 'FileSystemWritableFileStream' in window,
					'Serial': 'Serial' in window,
					'ReportingObserver': 'ReportingObserver' in window,
				};
				data.mode = (braveMode.allow ? 'allow' :
					braveMode.standard ? 'standard' :
						braveMode.strict ? 'strict' :
							'');
			}
			const { protection } = timerPrecision || {};
			if (IS_GECKO && protection) {
				const features = {
					'OfflineAudioContext': 'OfflineAudioContext' in window,
					'WebGL2RenderingContext': 'WebGL2RenderingContext' in window,
					'WebAssembly': 'WebAssembly' in window,
					'maxTouchPoints': 'maxTouchPoints' in navigator,
					'RTCRtpTransceiver': 'RTCRtpTransceiver' in window,
					'MediaDevices': 'MediaDevices' in window,
					'Credential': 'Credential' in window,
				};
				const featureKeys = Object.keys(features);
				const targetSet = new Set([
					'RTCRtpTransceiver',
					'MediaDevices',
					'Credential',
				]);
				const torBrowser = featureKeys.filter((key) => targetSet.has(key) && !features[key]).length == targetSet.size;
				const safer = !features.WebAssembly;
				data.privacy = torBrowser ? 'Tor Browser' : 'Firefox';
				// @ts-ignore
				data.security = {
					'reduceTimerPrecision': true,
					...features,
				};
				data.mode = (!torBrowser ? 'resistFingerprinting' :
					safer ? 'safer' :
						'standard');
			}
			// extension
			// - this technique gets a small sample of known lie patterns
			// - patterns vary based on extensions settings, version, browser
			const prototypeLiesLen = Object.keys(prototypeLies).length;
			// patterns based on settings
			const disabled = 'c767712b';
			const pattern = {
				noscript: {
					contentDocumentHash: ['0b637a33', '37e2f32e', '318390d1'],
					contentWindowHash: ['0b637a33', '37e2f32e', '318390d1'],
					getContextHash: ['0b637a33', '081d6d1b', disabled],
				},
				trace: {
					contentDocumentHash: ['ca9d9c2f'],
					contentWindowHash: ['ca9d9c2f'],
					createElementHash: ['77dea834'],
					getElementByIdHash: ['77dea834'],
					getImageDataHash: ['77dea834'],
					toBlobHash: ['77dea834', disabled],
					toDataURLHash: ['77dea834', disabled],
				},
				cydec: {
					// [FF, FF Anti OFF, Chrome, Chrome Anti Off, no iframe Chrome, no iframe Chrome Anti Off]
					contentDocumentHash: ['945b0c78', '15771efa', '403a1a21', '55e9b959'],
					contentWindowHash: ['945b0c78', '15771efa', '403a1a21', '55e9b959'],
					createElementHash: ['3dd86d6f', 'cc7cb598', '4237b44c', '1466aaf0', '0cb0c682', '73c662d9', '72b1ee2b', 'ae3d02c9'],
					getElementByIdHash: ['3dd86d6f', 'cc7cb598', '4237b44c', '1466aaf0', '0cb0c682', '73c662d9', '72b1ee2b', 'ae3d02c9'],
					getImageDataHash: ['044f14c2', 'db60d7f9', '15771efa', 'db60d7f9', '55e9b959'],
					toBlobHash: ['044f14c2', '15771efa', 'afec348d', '55e9b959', '0dbbf456'],
					toDataURLHash: ['ecb498d9', '15771efa', '6b838fb6', 'd19104ec', '6985d315', '55e9b959', 'fe88259f'],
				},
				canvasblocker: {
					contentDocumentHash: ['98ec858e', 'dbbaf31f'],
					contentWindowHash: ['98ec858e', 'dbbaf31f'],
					appendHash: ['98ec858e', 'dbbaf31f'],
					getImageDataHash: ['98ec858e', 'a2971888', 'dbbaf31f', disabled],
					toBlobHash: ['9f1c3dfe', 'a2971888', 'dbbaf31f', disabled],
					toDataURLHash: ['98ec858e', 'a2971888', 'dbbaf31f', disabled],
				},
				chameleon: {
					appendHash: ['77dea834'],
					insertAdjacentElementHash: ['77dea834'],
					insertAdjacentHTMLHash: ['77dea834'],
					insertAdjacentTextHash: ['77dea834'],
					prependHash: ['77dea834'],
					replaceWithHash: ['77dea834'],
					appendChildHash: ['77dea834'],
					insertBeforeHash: ['77dea834'],
					replaceChildHash: ['77dea834'],
				},
				duckduckgo: {
					toDataURLHash: ['fd00bf5d', '8ee7df22', disabled],
					toBlobHash: ['fd00bf5d', '8ee7df22', disabled],
					getImageDataHash: ['fd00bf5d', '8ee7df22', disabled],
					getByteFrequencyDataHash: ['fd00bf5d', '8ee7df22', disabled],
					getByteTimeDomainDataHash: ['fd00bf5d', '8ee7df22', disabled],
					getFloatFrequencyDataHash: ['fd00bf5d', '8ee7df22', disabled],
					getFloatTimeDomainDataHash: ['fd00bf5d', '8ee7df22', disabled],
					copyFromChannelHash: ['fd00bf5d', '8ee7df22', disabled],
					getChannelDataHash: ['fd00bf5d', '8ee7df22', disabled],
					hardwareConcurrencyHash: ['dfd41ab4'],
					availHeightHash: ['dfd41ab4'],
					availLeftHash: ['dfd41ab4'],
					availTopHash: ['dfd41ab4'],
					availWidthHash: ['dfd41ab4'],
					colorDepthHash: ['dfd41ab4'],
					pixelDepthHash: ['dfd41ab4'],
				},
				// mode: Learn to block new trackers from your browsing
				privacybadger: {
					getImageDataHash: ['0cb0c682'],
					toDataURLHash: ['0cb0c682'],
				},
				privacypossum: {
					hardwareConcurrencyHash: ['452924d5'],
					availWidthHash: ['452924d5'],
					colorDepthHash: ['452924d5'],
				},
				jshelter: {
					contentDocumentHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					contentWindowHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					appendHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					insertAdjacentElementHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					insertAdjacentHTMLHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					prependHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					replaceWithHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					appendChildHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					insertBeforeHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					replaceChildHash: ['0007ab4e', '0b637a33', '866fa7e7', '318390d1'],
					hardwareConcurrencyHash: ['dfd41ab4'],
				},
				puppeteerExtra: {
					contentDocumentHash: ['55e9b959'],
					contentWindowHash: [
						'55e9b959',
						'50a281b5', // @2.10.0
					],
					createElementHash: ['55e9b959'],
					getElementByIdHash: ['55e9b959'],
					appendHash: ['55e9b959'],
					insertAdjacentElementHash: ['55e9b959'],
					insertAdjacentHTMLHash: ['55e9b959'],
					insertAdjacentTextHash: ['55e9b959'],
					prependHash: ['55e9b959'],
					replaceWithHash: ['55e9b959'],
					appendChildHash: ['55e9b959'],
					insertBeforeHash: ['55e9b959'],
					replaceChildHash: ['55e9b959'],
					getContextHash: ['55e9b959', disabled],
					toDataURLHash: ['55e9b959', disabled],
					toBlobHash: ['55e9b959', disabled],
					getImageDataHash: ['55e9b959'],
					hardwareConcurrencyHash: ['efbd4cf9', 'a63491fb', 'b011fd1c', '194ecf17', '55e9b959'],
				},
				fakeBrowser: {
					appendChildHash: ['8dfec2ec', 'f43e6134'],
					getContextHash: ['83b825ab', 'a63491fb'],
					toDataURLHash: ['83b825ab', 'a63491fb'],
					toBlobHash: ['83b825ab', 'a63491fb'],
					getImageDataHash: ['83b825ab', 'a63491fb'],
					hardwareConcurrencyHash: ['83b825ab', 'a63491fb'],
					availHeightHash: ['83b825ab', 'a63491fb'],
					availLeftHash: ['83b825ab', 'a63491fb'],
					availTopHash: ['83b825ab', 'a63491fb'],
					availWidthHash: ['83b825ab', 'a63491fb'],
					colorDepthHash: ['83b825ab', 'a63491fb'],
					pixelDepthHash: ['83b825ab', 'a63491fb'],
				},
			};
			/*
			 Random User-Agent
			 User Agent Switcher and Manager
			 ScriptSafe
			 Windscribe
			 */
			await queueEvent(timer);
			const hash = {
				// iframes
				contentDocumentHash: hashMini(prototypeLies['HTMLIFrameElement.contentDocument']),
				contentWindowHash: hashMini(prototypeLies['HTMLIFrameElement.contentWindow']),
				createElementHash: hashMini(prototypeLies['Document.createElement']),
				getElementByIdHash: hashMini(prototypeLies['Document.getElementById']),
				appendHash: hashMini(prototypeLies['Element.append']),
				insertAdjacentElementHash: hashMini(prototypeLies['Element.insertAdjacentElement']),
				insertAdjacentHTMLHash: hashMini(prototypeLies['Element.insertAdjacentHTML']),
				insertAdjacentTextHash: hashMini(prototypeLies['Element.insertAdjacentText']),
				prependHash: hashMini(prototypeLies['Element.prepend']),
				replaceWithHash: hashMini(prototypeLies['Element.replaceWith']),
				appendChildHash: hashMini(prototypeLies['Node.appendChild']),
				insertBeforeHash: hashMini(prototypeLies['Node.insertBefore']),
				replaceChildHash: hashMini(prototypeLies['Node.replaceChild']),
				// canvas
				getContextHash: hashMini(prototypeLies['HTMLCanvasElement.getContext']),
				toDataURLHash: hashMini(prototypeLies['HTMLCanvasElement.toDataURL']),
				toBlobHash: hashMini(prototypeLies['HTMLCanvasElement.toBlob']),
				getImageDataHash: hashMini(prototypeLies['CanvasRenderingContext2D.getImageData']),
				// Audio
				getByteFrequencyDataHash: hashMini(prototypeLies['AnalyserNode.getByteFrequencyData']),
				getByteTimeDomainDataHash: hashMini(prototypeLies['AnalyserNode.getByteTimeDomainData']),
				getFloatFrequencyDataHash: hashMini(prototypeLies['AnalyserNode.getFloatFrequencyData']),
				getFloatTimeDomainDataHash: hashMini(prototypeLies['AnalyserNode.getFloatTimeDomainData']),
				copyFromChannelHash: hashMini(prototypeLies['AudioBuffer.copyFromChannel']),
				getChannelDataHash: hashMini(prototypeLies['AudioBuffer.getChannelData']),
				// Hardware
				hardwareConcurrencyHash: hashMini(prototypeLies['Navigator.hardwareConcurrency']),
				// Screen
				availHeightHash: hashMini(prototypeLies['Screen.availHeight']),
				availLeftHash: hashMini(prototypeLies['Screen.availLeft']),
				availTopHash: hashMini(prototypeLies['Screen.availTop']),
				availWidthHash: hashMini(prototypeLies['Screen.availWidth']),
				colorDepthHash: hashMini(prototypeLies['Screen.colorDepth']),
				pixelDepthHash: hashMini(prototypeLies['Screen.pixelDepth']),
			};
			data.extensionHashPattern = Object.keys(hash).reduce((acc, key) => {
				const val = hash[key];
				if (val == disabled) {
					return acc;
				}
				acc[key.replace('Hash', '')] = val;
				return acc;
			}, {});
			const getExtension = ({ pattern, hash, prototypeLiesLen }) => {
				const { noscript, trace, cydec, canvasblocker, chameleon, duckduckgo, privacybadger, privacypossum, jshelter, puppeteerExtra, fakeBrowser, } = pattern;
				const disabled = 'c767712b';
				if (prototypeLiesLen) {
					if (prototypeLiesLen >= 7 &&
						trace.contentDocumentHash.includes(hash.contentDocumentHash) &&
						trace.contentWindowHash.includes(hash.contentWindowHash) &&
						trace.createElementHash.includes(hash.createElementHash) &&
						trace.getElementByIdHash.includes(hash.getElementByIdHash) &&
						trace.toDataURLHash.includes(hash.toDataURLHash) &&
						trace.toBlobHash.includes(hash.toBlobHash) &&
						trace.getImageDataHash.includes(hash.getImageDataHash)) {
						return 'Trace';
					}
					if (prototypeLiesLen >= 7 &&
						cydec.contentDocumentHash.includes(hash.contentDocumentHash) &&
						cydec.contentWindowHash.includes(hash.contentWindowHash) &&
						cydec.createElementHash.includes(hash.createElementHash) &&
						cydec.getElementByIdHash.includes(hash.getElementByIdHash) &&
						cydec.toDataURLHash.includes(hash.toDataURLHash) &&
						cydec.toBlobHash.includes(hash.toBlobHash) &&
						cydec.getImageDataHash.includes(hash.getImageDataHash)) {
						return 'CyDec';
					}
					if (prototypeLiesLen >= 6 &&
						canvasblocker.contentDocumentHash.includes(hash.contentDocumentHash) &&
						canvasblocker.contentWindowHash.includes(hash.contentWindowHash) &&
						canvasblocker.appendHash.includes(hash.appendHash) &&
						canvasblocker.toDataURLHash.includes(hash.toDataURLHash) &&
						canvasblocker.toBlobHash.includes(hash.toBlobHash) &&
						canvasblocker.getImageDataHash.includes(hash.getImageDataHash)) {
						return 'CanvasBlocker';
					}
					if (prototypeLiesLen >= 9 &&
						chameleon.appendHash.includes(hash.appendHash) &&
						chameleon.insertAdjacentElementHash.includes(hash.insertAdjacentElementHash) &&
						chameleon.insertAdjacentHTMLHash.includes(hash.insertAdjacentHTMLHash) &&
						chameleon.insertAdjacentTextHash.includes(hash.insertAdjacentTextHash) &&
						chameleon.prependHash.includes(hash.prependHash) &&
						chameleon.replaceWithHash.includes(hash.replaceWithHash) &&
						chameleon.appendChildHash.includes(hash.appendChildHash) &&
						chameleon.insertBeforeHash.includes(hash.insertBeforeHash) &&
						chameleon.replaceChildHash.includes(hash.replaceChildHash)) {
						return 'Chameleon';
					}
					if (prototypeLiesLen >= 7 &&
						duckduckgo.toDataURLHash.includes(hash.toDataURLHash) &&
						duckduckgo.toBlobHash.includes(hash.toBlobHash) &&
						duckduckgo.getImageDataHash.includes(hash.getImageDataHash) &&
						duckduckgo.getByteFrequencyDataHash.includes(hash.getByteFrequencyDataHash) &&
						duckduckgo.getByteTimeDomainDataHash.includes(hash.getByteTimeDomainDataHash) &&
						duckduckgo.getFloatFrequencyDataHash.includes(hash.getFloatFrequencyDataHash) &&
						duckduckgo.getFloatTimeDomainDataHash.includes(hash.getFloatTimeDomainDataHash) &&
						duckduckgo.copyFromChannelHash.includes(hash.copyFromChannelHash) &&
						duckduckgo.getChannelDataHash.includes(hash.getChannelDataHash) &&
						duckduckgo.hardwareConcurrencyHash.includes(hash.hardwareConcurrencyHash) &&
						duckduckgo.availHeightHash.includes(hash.availHeightHash) &&
						duckduckgo.availLeftHash.includes(hash.availLeftHash) &&
						duckduckgo.availTopHash.includes(hash.availTopHash) &&
						duckduckgo.availWidthHash.includes(hash.availWidthHash) &&
						duckduckgo.colorDepthHash.includes(hash.colorDepthHash) &&
						duckduckgo.pixelDepthHash.includes(hash.pixelDepthHash)) {
						return 'DuckDuckGo';
					}
					if (prototypeLiesLen >= 2 &&
						privacybadger.getImageDataHash.includes(hash.getImageDataHash) &&
						privacybadger.toDataURLHash.includes(hash.toDataURLHash)) {
						return 'Privacy Badger';
					}
					if (prototypeLiesLen >= 3 &&
						privacypossum.hardwareConcurrencyHash.includes(hash.hardwareConcurrencyHash) &&
						privacypossum.availWidthHash.includes(hash.availWidthHash) &&
						privacypossum.colorDepthHash.includes(hash.colorDepthHash)) {
						return 'Privacy Possum';
					}
					if (prototypeLiesLen >= 2 &&
						noscript.contentDocumentHash.includes(hash.contentDocumentHash) &&
						noscript.contentWindowHash.includes(hash.contentDocumentHash) &&
						noscript.getContextHash.includes(hash.getContextHash) &&
						// distinguish NoScript from JShelter
						hash.hardwareConcurrencyHash == disabled) {
						return 'NoScript';
					}
					if (prototypeLiesLen >= 14 &&
						jshelter.contentDocumentHash.includes(hash.contentDocumentHash) &&
						jshelter.contentWindowHash.includes(hash.contentDocumentHash) &&
						jshelter.appendHash.includes(hash.appendHash) &&
						jshelter.insertAdjacentElementHash.includes(hash.insertAdjacentElementHash) &&
						jshelter.insertAdjacentHTMLHash.includes(hash.insertAdjacentHTMLHash) &&
						jshelter.prependHash.includes(hash.prependHash) &&
						jshelter.replaceWithHash.includes(hash.replaceWithHash) &&
						jshelter.appendChildHash.includes(hash.appendChildHash) &&
						jshelter.insertBeforeHash.includes(hash.insertBeforeHash) &&
						jshelter.replaceChildHash.includes(hash.replaceChildHash) &&
						jshelter.hardwareConcurrencyHash.includes(hash.hardwareConcurrencyHash)) {
						return 'JShelter';
					}
					if (prototypeLiesLen >= 13 &&
						puppeteerExtra.contentDocumentHash.includes(hash.contentDocumentHash) &&
						puppeteerExtra.contentWindowHash.includes(hash.contentWindowHash) &&
						puppeteerExtra.createElementHash.includes(hash.createElementHash) &&
						puppeteerExtra.getElementByIdHash.includes(hash.getElementByIdHash) &&
						puppeteerExtra.appendHash.includes(hash.appendHash) &&
						puppeteerExtra.insertAdjacentElementHash.includes(hash.insertAdjacentElementHash) &&
						puppeteerExtra.insertAdjacentHTMLHash.includes(hash.insertAdjacentHTMLHash) &&
						puppeteerExtra.insertAdjacentTextHash.includes(hash.insertAdjacentTextHash) &&
						puppeteerExtra.prependHash.includes(hash.prependHash) &&
						puppeteerExtra.replaceWithHash.includes(hash.replaceWithHash) &&
						puppeteerExtra.appendChildHash.includes(hash.appendChildHash) &&
						puppeteerExtra.insertBeforeHash.includes(hash.insertBeforeHash) &&
						puppeteerExtra.contentDocumentHash.includes(hash.contentDocumentHash) &&
						puppeteerExtra.replaceChildHash.includes(hash.replaceChildHash) &&
						puppeteerExtra.getContextHash.includes(hash.getContextHash) &&
						puppeteerExtra.toDataURLHash.includes(hash.toDataURLHash) &&
						puppeteerExtra.toBlobHash.includes(hash.toBlobHash) &&
						puppeteerExtra.getImageDataHash.includes(hash.getImageDataHash) &&
						puppeteerExtra.hardwareConcurrencyHash.includes(hash.hardwareConcurrencyHash)) {
						return 'puppeteer-extra';
					}
					if (prototypeLiesLen >= 12 &&
						fakeBrowser.appendChildHash.includes(hash.appendChildHash) &&
						fakeBrowser.getContextHash.includes(hash.getContextHash) &&
						fakeBrowser.toDataURLHash.includes(hash.toDataURLHash) &&
						fakeBrowser.toBlobHash.includes(hash.toBlobHash) &&
						fakeBrowser.getImageDataHash.includes(hash.getImageDataHash) &&
						fakeBrowser.hardwareConcurrencyHash.includes(hash.hardwareConcurrencyHash) &&
						fakeBrowser.availHeightHash.includes(hash.availHeightHash) &&
						fakeBrowser.availLeftHash.includes(hash.availLeftHash) &&
						fakeBrowser.availTopHash.includes(hash.availTopHash) &&
						fakeBrowser.availWidthHash.includes(hash.availWidthHash) &&
						fakeBrowser.colorDepthHash.includes(hash.colorDepthHash) &&
						fakeBrowser.pixelDepthHash.includes(hash.pixelDepthHash)) {
						return 'FakeBrowser';
					}
					return;
				}
				return;
			};
			// @ts-ignore
			data.extension = getExtension({ pattern, hash, prototypeLiesLen });
			logTestResult({ time: timer.stop(), test: 'resistance', passed: true });
			return data;
		}
		catch (error) {
			logTestResult({ test: 'resistance', passed: false });
			captureError(error);
			return;
		}
	}

	function hasTouch() {
		try {
			return 'ontouchstart' in window && !!document.createEvent('TouchEvent');
		}
		catch (err) {
			return false;
		}
	}

	async function getScreen(log = true) {
		try {
			const timer = createTimer();
			timer.start();
			let lied = (lieProps['Screen.width'] ||
				lieProps['Screen.height'] ||
				lieProps['Screen.availWidth'] ||
				lieProps['Screen.availHeight'] ||
				lieProps['Screen.colorDepth'] ||
				lieProps['Screen.pixelDepth']) || false;
			const s = (window.screen || {});
			const { width, height, availWidth, availHeight, colorDepth, pixelDepth, } = s;
			const dpr = window.devicePixelRatio || 0;
			const firefoxWithHighDPR = IS_GECKO && (dpr != 1);
			if (!firefoxWithHighDPR) {
				// firefox with high dpr requires floating point precision dimensions
				const matchMediaLie = !matchMedia(`(device-width: ${width}px) and (device-height: ${height}px)`).matches;
				if (matchMediaLie) {
					lied = true;
					documentLie('Screen', 'failed matchMedia');
				}
			}
			const hasLiedDPR = !matchMedia(`(resolution: ${dpr}dppx)`).matches;
			if (!IS_WEBKIT && hasLiedDPR) {
				lied = true;
				documentLie('Window.devicePixelRatio', 'lied dpr');
			}
			const noTaskbar = !(width - availWidth || height - availHeight);
			if (width > 800 && noTaskbar) {
				LowerEntropy.SCREEN = true;
			}
			const data = {
				width,
				height,
				availWidth,
				availHeight,
				colorDepth,
				pixelDepth,
				touch: hasTouch(),
				lied,
			};
			log && logTestResult({ time: timer.stop(), test: 'screen', passed: true });
			return data;
		}
		catch (error) {
			log && logTestResult({ test: 'screen', passed: false });
			captureError(error);
			return;
		}
	}

	async function getVoices() {
		// Don't run voice immediately. This is unstable
		// wait a bit for services to load
		await new Promise((resolve) => setTimeout(() => resolve(undefined), 50));

		return new Promise(async (resolve) => {
			try {
				const timer = createTimer();
				await queueEvent(timer);
				// use window since iframe is unstable in FF
				const supported = 'speechSynthesis' in window;
				supported && speechSynthesis.getVoices(); // warm up
				if (!supported) {
					logTestResult({ test: 'speech', passed: false });
					return resolve(null);
				}
				const voicesLie = !!lieProps['SpeechSynthesis.getVoices'];
				const giveUpOnVoices = setTimeout(() => {
					logTestResult({ test: 'speech', passed: false });
					return resolve(null);
				}, 300);
				const getVoices = () => {
					const data = speechSynthesis.getVoices();
					const localServiceDidLoad = (data || []).find((x) => x.localService);
					if (!data || !data.length || (IS_BLINK && !localServiceDidLoad)) {
						return;
					}
					clearTimeout(giveUpOnVoices);
					// filter first occurrence of unique voiceURI data
					const getUniques = (data, voiceURISet) => data
						.filter((x) => {
							const { voiceURI } = x;
							if (!voiceURISet.has(voiceURI)) {
								voiceURISet.add(voiceURI);
								return true;
							}
							return false;
						});
					const dataUnique = getUniques(data, new Set());
					// https://wicg.github.io/speech-api/#speechsynthesisvoice-attributes
					const local = dataUnique.filter((x) => x.localService).map((x) => x.name);
					const remote = dataUnique.filter((x) => !x.localService).map((x) => x.name);
					const languages = [...new Set(dataUnique.map((x) => x.lang))];
					const defaultLocalVoices = dataUnique.filter((x) => x.default && x.localService);
					let defaultVoiceName = '';
					let defaultVoiceLang = '';
					if (defaultLocalVoices.length === 1) {
						const { name, lang } = defaultLocalVoices[0];
						defaultVoiceName = name;
						defaultVoiceLang = (lang || '').replace(/_/, '-');
					}
					// eslint-disable-next-line new-cap
					const { locale: localeLang } = Intl.DateTimeFormat().resolvedOptions();
					if (defaultVoiceLang &&
						defaultVoiceLang.split('-')[0] !== localeLang.split('-')[0]) {
						// this is not trash
						Analysis.voiceLangMismatch = true;
						LowerEntropy.TIME_ZONE = true;
					}
					logTestResult({ time: timer.stop(), test: 'speech', passed: true });
					return resolve({
						local,
						remote,
						languages,
						defaultVoiceName,
						defaultVoiceLang,
						lied: voicesLie,
					});
				};
				getVoices();
				if (speechSynthesis.addEventListener) {
					return speechSynthesis.addEventListener('voiceschanged', getVoices);
				}
				speechSynthesis.onvoiceschanged = getVoices;
			}
			catch (error) {
				logTestResult({ test: 'speech', passed: false });
				captureError(error);
				return resolve(null);
			}
		});
	}

	async function getStorage() {
		if (!navigator?.storage?.estimate)
			return null;

		return Promise.all([
			navigator.storage.estimate().then(({ quota }) => quota),

			new Promise((resolve) => {
				// @ts-expect-error if not supported
				navigator.webkitTemporaryStorage.queryUsageAndQuota((_, quota) => {
					resolve(quota);
				});
			}).catch(() => null),
		]).then(([quota1, quota2]) => (quota2 || quota1));
	}

	async function getSVG() {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};

		try {
			const timer = createTimer();

			await queueEvent(timer);

			let lied = (lieProps['SVGRect.height'] || lieProps['SVGRect.width'] || lieProps['SVGRect.x'] || lieProps['SVGRect.y'] || lieProps['String.fromCodePoint'] || lieProps['SVGRectElement.getBBox'] || lieProps['SVGTextContentElement.getExtentOfChar'] || lieProps['SVGTextContentElement.getSubStringLength'] || lieProps['SVGTextContentElement.getComputedTextLength']) || false;
			const doc = (PHANTOM_DARKNESS && PHANTOM_DARKNESS.document && PHANTOM_DARKNESS.document.body ? PHANTOM_DARKNESS.document : document);
			const divElement = document.createElement('div');
			doc.body.appendChild(divElement);
			// patch div
			patch(divElement, html `
				<div id="svg-container">
				<style>
				#svg-container {
					position: absolute;
					left: -9999px;
					height: auto;
				}
				#svg-container .shift-svg {
					transform: scale(1.000999) !important;
				}
				.svgrect-emoji {
					font-family: ${CSS_FONT_FAMILY};
					font-size: 200px !important;
					height: auto;
					position: absolute !important;
					transform: scale(1.000999);
				}
				</style>
				<svg>
					<g id="svgBox">
						${EMOJIS.map((emoji) => {
				return `<text x="32" y="32" class="svgrect-emoji">${emoji}</text>`;
			}).join('')}
					</g>
				</svg>
			</div>
			`);
			// SVG
			const reduceToObject = (nativeObj) => {
				const keys = Object.keys(nativeObj.__proto__);
				return keys.reduce((acc, key) => {
					const val = nativeObj[key];
					const isMethod = typeof val == 'function';
					return isMethod ? acc : { ...acc, [key]: val };
				}, {});
			};
			const reduceToSum = (nativeObj) => {
				const keys = Object.keys(nativeObj.__proto__);
				return keys.reduce((acc, key) => {
					const val = nativeObj[key];
					return isNaN(val) ? acc : (acc += val);
				}, 0);
			};
			const getObjectSum = (obj) => !obj ? 0 : Object.keys(obj).reduce((acc, key) => acc += Math.abs(obj[key]), 0);
			// SVGRect
			const svgBox = doc.getElementById('svgBox');
			const bBox = reduceToObject(svgBox.getBBox());
			// compute SVGRect emojis
			const pattern = new Set();
			const svgElems = [...svgBox.getElementsByClassName('svgrect-emoji')];
			await queueEvent(timer);
			const emojiSet = svgElems.reduce((emojiSet, el, i) => {
				const emoji = EMOJIS[i];
				const dimensions = '' + el.getComputedTextLength();
				if (!pattern.has(dimensions)) {
					pattern.add(dimensions);
					emojiSet.add(emoji);
				}
				return emojiSet;
			}, new Set());
			// svgRect System Sum
			const svgrectSystemSum = 0.00001 * [...pattern].map((x) => {
				return x.split(',').reduce((acc, x) => acc += (+x || 0), 0);
			}).reduce((acc, x) => acc += x, 0);
			// detect failed shift calculation
			const svgEmojiEl = svgElems[0];
			const initial = svgEmojiEl.getComputedTextLength();
			svgEmojiEl.classList.add('shift-svg');
			const shifted = svgEmojiEl.getComputedTextLength();
			svgEmojiEl.classList.remove('shift-svg');
			const unshifted = svgEmojiEl.getComputedTextLength();
			if ((initial - shifted) != (unshifted - shifted)) {
				lied = true;
				documentLie('SVGTextContentElement.getComputedTextLength', 'failed unshift calculation');
			}
			const data = {
				bBox: getObjectSum(bBox),
				extentOfChar: reduceToSum(svgElems[0].getExtentOfChar(EMOJIS[0])),
				subStringLength: svgElems[0].getSubStringLength(0, 10),
				computedTextLength: svgElems[0].getComputedTextLength(),
				emojiSet: [...emojiSet],
				svgrectSystemSum,
				lied,
			};
			doc.body.removeChild(doc.getElementById('svg-container'));
			logTestResult({ time: timer.stop(), test: 'svg', passed: true });
			PARENT_PHANTOM.remove();

			return data;
		} catch (error) {
			logTestResult({ test: 'svg', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	function getTimezone() {
		// inspired by https://arkenfox.github.io/TZP
		// https://github.com/vvo/tzdb/blob/master/time-zones-names.json

		const cities = [
			'UTC',
			'GMT',
			'Etc/GMT+0',
			'Etc/GMT+1',
			'Etc/GMT+10',
			'Etc/GMT+11',
			'Etc/GMT+12',
			'Etc/GMT+2',
			'Etc/GMT+3',
			'Etc/GMT+4',
			'Etc/GMT+5',
			'Etc/GMT+6',
			'Etc/GMT+7',
			'Etc/GMT+8',
			'Etc/GMT+9',
			'Etc/GMT-1',
			'Etc/GMT-10',
			'Etc/GMT-11',
			'Etc/GMT-12',
			'Etc/GMT-13',
			'Etc/GMT-14',
			'Etc/GMT-2',
			'Etc/GMT-3',
			'Etc/GMT-4',
			'Etc/GMT-5',
			'Etc/GMT-6',
			'Etc/GMT-7',
			'Etc/GMT-8',
			'Etc/GMT-9',
			'Etc/GMT',
			'Africa/Abidjan',
			'Africa/Accra',
			'Africa/Addis_Ababa',
			'Africa/Algiers',
			'Africa/Asmara',
			'Africa/Bamako',
			'Africa/Bangui',
			'Africa/Banjul',
			'Africa/Bissau',
			'Africa/Blantyre',
			'Africa/Brazzaville',
			'Africa/Bujumbura',
			'Africa/Cairo',
			'Africa/Casablanca',
			'Africa/Ceuta',
			'Africa/Conakry',
			'Africa/Dakar',
			'Africa/Dar_es_Salaam',
			'Africa/Djibouti',
			'Africa/Douala',
			'Africa/El_Aaiun',
			'Africa/Freetown',
			'Africa/Gaborone',
			'Africa/Harare',
			'Africa/Johannesburg',
			'Africa/Juba',
			'Africa/Kampala',
			'Africa/Khartoum',
			'Africa/Kigali',
			'Africa/Kinshasa',
			'Africa/Lagos',
			'Africa/Libreville',
			'Africa/Lome',
			'Africa/Luanda',
			'Africa/Lubumbashi',
			'Africa/Lusaka',
			'Africa/Malabo',
			'Africa/Maputo',
			'Africa/Maseru',
			'Africa/Mbabane',
			'Africa/Mogadishu',
			'Africa/Monrovia',
			'Africa/Nairobi',
			'Africa/Ndjamena',
			'Africa/Niamey',
			'Africa/Nouakchott',
			'Africa/Ouagadougou',
			'Africa/Porto-Novo',
			'Africa/Sao_Tome',
			'Africa/Tripoli',
			'Africa/Tunis',
			'Africa/Windhoek',
			'America/Adak',
			'America/Anchorage',
			'America/Anguilla',
			'America/Antigua',
			'America/Araguaina',
			'America/Argentina/Buenos_Aires',
			'America/Argentina/Catamarca',
			'America/Argentina/Cordoba',
			'America/Argentina/Jujuy',
			'America/Argentina/La_Rioja',
			'America/Argentina/Mendoza',
			'America/Argentina/Rio_Gallegos',
			'America/Argentina/Salta',
			'America/Argentina/San_Juan',
			'America/Argentina/San_Luis',
			'America/Argentina/Tucuman',
			'America/Argentina/Ushuaia',
			'America/Aruba',
			'America/Asuncion',
			'America/Atikokan',
			'America/Bahia',
			'America/Bahia_Banderas',
			'America/Barbados',
			'America/Belem',
			'America/Belize',
			'America/Blanc-Sablon',
			'America/Boa_Vista',
			'America/Bogota',
			'America/Boise',
			'America/Cambridge_Bay',
			'America/Campo_Grande',
			'America/Cancun',
			'America/Caracas',
			'America/Cayenne',
			'America/Cayman',
			'America/Chicago',
			'America/Chihuahua',
			'America/Costa_Rica',
			'America/Creston',
			'America/Cuiaba',
			'America/Curacao',
			'America/Danmarkshavn',
			'America/Dawson',
			'America/Dawson_Creek',
			'America/Denver',
			'America/Detroit',
			'America/Dominica',
			'America/Edmonton',
			'America/Eirunepe',
			'America/El_Salvador',
			'America/Fort_Nelson',
			'America/Fortaleza',
			'America/Glace_Bay',
			'America/Godthab',
			'America/Goose_Bay',
			'America/Grand_Turk',
			'America/Grenada',
			'America/Guadeloupe',
			'America/Guatemala',
			'America/Guayaquil',
			'America/Guyana',
			'America/Halifax',
			'America/Havana',
			'America/Hermosillo',
			'America/Indiana/Indianapolis',
			'America/Indiana/Knox',
			'America/Indiana/Marengo',
			'America/Indiana/Petersburg',
			'America/Indiana/Tell_City',
			'America/Indiana/Vevay',
			'America/Indiana/Vincennes',
			'America/Indiana/Winamac',
			'America/Inuvik',
			'America/Iqaluit',
			'America/Jamaica',
			'America/Juneau',
			'America/Kentucky/Louisville',
			'America/Kentucky/Monticello',
			'America/Kralendijk',
			'America/La_Paz',
			'America/Lima',
			'America/Los_Angeles',
			'America/Lower_Princes',
			'America/Maceio',
			'America/Managua',
			'America/Manaus',
			'America/Marigot',
			'America/Martinique',
			'America/Matamoros',
			'America/Mazatlan',
			'America/Menominee',
			'America/Merida',
			'America/Metlakatla',
			'America/Mexico_City',
			'America/Miquelon',
			'America/Moncton',
			'America/Monterrey',
			'America/Montevideo',
			'America/Montserrat',
			'America/Nassau',
			'America/New_York',
			'America/Nipigon',
			'America/Nome',
			'America/Noronha',
			'America/North_Dakota/Beulah',
			'America/North_Dakota/Center',
			'America/North_Dakota/New_Salem',
			'America/Ojinaga',
			'America/Panama',
			'America/Pangnirtung',
			'America/Paramaribo',
			'America/Phoenix',
			'America/Port-au-Prince',
			'America/Port_of_Spain',
			'America/Porto_Velho',
			'America/Puerto_Rico',
			'America/Punta_Arenas',
			'America/Rainy_River',
			'America/Rankin_Inlet',
			'America/Recife',
			'America/Regina',
			'America/Resolute',
			'America/Rio_Branco',
			'America/Santarem',
			'America/Santiago',
			'America/Santo_Domingo',
			'America/Sao_Paulo',
			'America/Scoresbysund',
			'America/Sitka',
			'America/St_Barthelemy',
			'America/St_Johns',
			'America/St_Kitts',
			'America/St_Lucia',
			'America/St_Thomas',
			'America/St_Vincent',
			'America/Swift_Current',
			'America/Tegucigalpa',
			'America/Thule',
			'America/Thunder_Bay',
			'America/Tijuana',
			'America/Toronto',
			'America/Tortola',
			'America/Vancouver',
			'America/Whitehorse',
			'America/Winnipeg',
			'America/Yakutat',
			'America/Yellowknife',
			'Antarctica/Casey',
			'Antarctica/Davis',
			'Antarctica/DumontDUrville',
			'Antarctica/Macquarie',
			'Antarctica/Mawson',
			'Antarctica/McMurdo',
			'Antarctica/Palmer',
			'Antarctica/Rothera',
			'Antarctica/Syowa',
			'Antarctica/Troll',
			'Antarctica/Vostok',
			'Arctic/Longyearbyen',
			'Asia/Aden',
			'Asia/Almaty',
			'Asia/Amman',
			'Asia/Anadyr',
			'Asia/Aqtau',
			'Asia/Aqtobe',
			'Asia/Ashgabat',
			'Asia/Atyrau',
			'Asia/Baghdad',
			'Asia/Bahrain',
			'Asia/Baku',
			'Asia/Bangkok',
			'Asia/Barnaul',
			'Asia/Beirut',
			'Asia/Bishkek',
			'Asia/Brunei',
			'Asia/Calcutta',
			'Asia/Chita',
			'Asia/Choibalsan',
			'Asia/Colombo',
			'Asia/Damascus',
			'Asia/Dhaka',
			'Asia/Dili',
			'Asia/Dubai',
			'Asia/Dushanbe',
			'Asia/Famagusta',
			'Asia/Gaza',
			'Asia/Hebron',
			'Asia/Ho_Chi_Minh',
			'Asia/Hong_Kong',
			'Asia/Hovd',
			'Asia/Irkutsk',
			'Asia/Jakarta',
			'Asia/Jayapura',
			'Asia/Jerusalem',
			'Asia/Kabul',
			'Asia/Kamchatka',
			'Asia/Karachi',
			'Asia/Kathmandu',
			'Asia/Khandyga',
			'Asia/Kolkata',
			'Asia/Krasnoyarsk',
			'Asia/Kuala_Lumpur',
			'Asia/Kuching',
			'Asia/Kuwait',
			'Asia/Macau',
			'Asia/Magadan',
			'Asia/Makassar',
			'Asia/Manila',
			'Asia/Muscat',
			'Asia/Nicosia',
			'Asia/Novokuznetsk',
			'Asia/Novosibirsk',
			'Asia/Omsk',
			'Asia/Oral',
			'Asia/Phnom_Penh',
			'Asia/Pontianak',
			'Asia/Pyongyang',
			'Asia/Qatar',
			'Asia/Qostanay',
			'Asia/Qyzylorda',
			'Asia/Riyadh',
			'Asia/Sakhalin',
			'Asia/Samarkand',
			'Asia/Seoul',
			'Asia/Shanghai',
			'Asia/Singapore',
			'Asia/Srednekolymsk',
			'Asia/Taipei',
			'Asia/Tashkent',
			'Asia/Tbilisi',
			'Asia/Tehran',
			'Asia/Thimphu',
			'Asia/Tokyo',
			'Asia/Tomsk',
			'Asia/Ulaanbaatar',
			'Asia/Urumqi',
			'Asia/Ust-Nera',
			'Asia/Vientiane',
			'Asia/Vladivostok',
			'Asia/Yakutsk',
			'Asia/Yangon',
			'Asia/Yekaterinburg',
			'Asia/Yerevan',
			'Atlantic/Azores',
			'Atlantic/Bermuda',
			'Atlantic/Canary',
			'Atlantic/Cape_Verde',
			'Atlantic/Faroe',
			'Atlantic/Madeira',
			'Atlantic/Reykjavik',
			'Atlantic/South_Georgia',
			'Atlantic/St_Helena',
			'Atlantic/Stanley',
			'Australia/Adelaide',
			'Australia/Brisbane',
			'Australia/Broken_Hill',
			'Australia/Currie',
			'Australia/Darwin',
			'Australia/Eucla',
			'Australia/Hobart',
			'Australia/Lindeman',
			'Australia/Lord_Howe',
			'Australia/Melbourne',
			'Australia/Perth',
			'Australia/Sydney',
			'Europe/Amsterdam',
			'Europe/Andorra',
			'Europe/Astrakhan',
			'Europe/Athens',
			'Europe/Belgrade',
			'Europe/Berlin',
			'Europe/Bratislava',
			'Europe/Brussels',
			'Europe/Bucharest',
			'Europe/Budapest',
			'Europe/Busingen',
			'Europe/Chisinau',
			'Europe/Copenhagen',
			'Europe/Dublin',
			'Europe/Gibraltar',
			'Europe/Guernsey',
			'Europe/Helsinki',
			'Europe/Isle_of_Man',
			'Europe/Istanbul',
			'Europe/Jersey',
			'Europe/Kaliningrad',
			'Europe/Kiev',
			'Europe/Kirov',
			'Europe/Lisbon',
			'Europe/Ljubljana',
			'Europe/London',
			'Europe/Luxembourg',
			'Europe/Madrid',
			'Europe/Malta',
			'Europe/Mariehamn',
			'Europe/Minsk',
			'Europe/Monaco',
			'Europe/Moscow',
			'Europe/Oslo',
			'Europe/Paris',
			'Europe/Podgorica',
			'Europe/Prague',
			'Europe/Riga',
			'Europe/Rome',
			'Europe/Samara',
			'Europe/San_Marino',
			'Europe/Sarajevo',
			'Europe/Saratov',
			'Europe/Simferopol',
			'Europe/Skopje',
			'Europe/Sofia',
			'Europe/Stockholm',
			'Europe/Tallinn',
			'Europe/Tirane',
			'Europe/Ulyanovsk',
			'Europe/Uzhgorod',
			'Europe/Vaduz',
			'Europe/Vatican',
			'Europe/Vienna',
			'Europe/Vilnius',
			'Europe/Volgograd',
			'Europe/Warsaw',
			'Europe/Zagreb',
			'Europe/Zaporozhye',
			'Europe/Zurich',
			'Indian/Antananarivo',
			'Indian/Chagos',
			'Indian/Christmas',
			'Indian/Cocos',
			'Indian/Comoro',
			'Indian/Kerguelen',
			'Indian/Mahe',
			'Indian/Maldives',
			'Indian/Mauritius',
			'Indian/Mayotte',
			'Indian/Reunion',
			'Pacific/Apia',
			'Pacific/Auckland',
			'Pacific/Bougainville',
			'Pacific/Chatham',
			'Pacific/Chuuk',
			'Pacific/Easter',
			'Pacific/Efate',
			'Pacific/Enderbury',
			'Pacific/Fakaofo',
			'Pacific/Fiji',
			'Pacific/Funafuti',
			'Pacific/Galapagos',
			'Pacific/Gambier',
			'Pacific/Guadalcanal',
			'Pacific/Guam',
			'Pacific/Honolulu',
			'Pacific/Kiritimati',
			'Pacific/Kosrae',
			'Pacific/Kwajalein',
			'Pacific/Majuro',
			'Pacific/Marquesas',
			'Pacific/Midway',
			'Pacific/Nauru',
			'Pacific/Niue',
			'Pacific/Norfolk',
			'Pacific/Noumea',
			'Pacific/Pago_Pago',
			'Pacific/Palau',
			'Pacific/Pitcairn',
			'Pacific/Pohnpei',
			'Pacific/Port_Moresby',
			'Pacific/Rarotonga',
			'Pacific/Saipan',
			'Pacific/Tahiti',
			'Pacific/Tarawa',
			'Pacific/Tongatapu',
			'Pacific/Wake',
			'Pacific/Wallis',
		];

		const getTimezoneOffset = () => {
			const [year, month, day] = JSON.stringify(new Date()).slice(1, 11).split('-');
			const dateString = `${month}/${day}/${year}`;
			const dateStringUTC = `${year}-${month}-${day}`;
			const now = +new Date(dateString);
			const utc = +new Date(dateStringUTC);
			const offset = +((now - utc) / 60000);

			return ~~offset;
		};

		const getTimezoneOffsetHistory = ({ year, city = null }) => {
			const format = { timeZone: '', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
			const minute = 60000;

			let formatter;
			let summer;

			if (city) {
				const options = { ...format, timeZone: city };
				// @ts-ignore
				formatter = new Intl.DateTimeFormat('en', options);
				summer = +new Date(formatter.format(new Date(`7/1/${year}`)));
			} else {
				summer = +new Date(`7/1/${year}`);
			}

			const summerUTCTime = +new Date(`${year}-07-01`);
			const offset = (summer - summerUTCTime) / minute;

			return offset;
		};

		const binarySearch = (list, fn) => {
			const end = list.length;
			const middle = Math.floor(end / 2);
			const [left, right] = [list.slice(0, middle), list.slice(middle, end)];
			const found = fn(left);

			return end == 1 || found.length ? found : binarySearch(right, fn);
		};

		const decryptLocation = ({ year, timeZone }) => {
			const system = getTimezoneOffsetHistory({ year });
			const resolvedOptions = getTimezoneOffsetHistory({ year, city: timeZone });
			const filter = (cities) => cities.filter((city) => system == getTimezoneOffsetHistory({ year, city }));
			// get city region set
			const decryption = (system == resolvedOptions ? [timeZone] : binarySearch(cities, filter));
			// reduce set to one city
			const decrypted = (decryption.length == 1 && decryption[0] == timeZone ? timeZone : hashMini(decryption));

			return decrypted;
		};

		const formatLocation = (x) => {
			try {
				return x.replace(/_/, ' ').split('/').join(', ');
			} catch (error) { }

			return x;
		};

		try {
			const timer = createTimer();
			timer.start();
			const lied = (lieProps['Date.getTimezoneOffset'] || lieProps['Intl.DateTimeFormat.resolvedOptions'] || lieProps['Intl.RelativeTimeFormat.resolvedOptions']) || false;
			const year = 1113;
			// eslint-disable-next-line new-cap
			const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
			const decrypted = decryptLocation({ year, timeZone });
			const locationEpoch = +new Date(new Date(`7/1/${year}`));
			const notWithinParentheses = /.*\(|\).*/g;
			const data = { zone: ('' + new Date()).replace(notWithinParentheses, ''), location: formatLocation(timeZone), locationMeasured: formatLocation(decrypted), locationEpoch, offset: new Date().getTimezoneOffset(), offsetComputed: getTimezoneOffset(), lied };

			logTestResult({ time: timer.stop(), test: 'timezone', passed: true });

			return { ...data };
		} catch (error) {
			logTestResult({ test: 'timezone', passed: false });
			captureError(error);
			return;
		}
	}

	/* eslint-disable @typescript-eslint/ban-ts-comment */
	// @ts-nocheck
	// Bad fingerprints left always on
	async function exile() {
		/* javascript-obfuscator:disable */
		const O = G;
		function Z() { const N = ['DxnLCKfNzw50', 'nte0nvLNzKzoyG', 'sg9UzYblB25Nifn0yw5KyxjKifrPBwu', 'AhjLzG', 'nfrAsKnWza', 'Dg9tDhjPBMC', 'qw5KCM9Pza', 'nZa5mtCYnvDzyvnbqG', 'Bwf4vg91y2HqB2LUDhm', 'Bwf0y2HLCW', 'Aw5JBhvKzxm', 'ntK4mtC1mfHqAwPjDa', 'CgrMvMLLD2vYrw5HyMXLza', 'mJa3zfnpvhvp', 'mZu1mZiZmZj2rg9eBg4', 'mtG0CwLVz2jJ', 'mta3ndKXnNnVzxnIDq', 'mJmYnJbkBgT6tgG', 'mZa1ngr2wfHnCa', 'ywjVDxq6yMXHBMS', 'nJaXotq3DLjyCvfo', 'khbVAw50zxi6igzPBMuP']; Z = function () { return N; }; return Z(); }
		(function (W, i) { const k = G, V = W(); while (!![]) {
			try {
				const t = parseInt(k('0xf9')) / 0x1 + -parseInt(k('0xfa')) / 0x2 * (parseInt(k('0xf6')) / 0x3) + -parseInt(k('0xed')) / 0x4 * (parseInt(k('0xf0')) / 0x5) + -parseInt(k('0xfb')) / 0x6 * (parseInt(k('0x100')) / 0x7) + -parseInt(k('0xf8')) / 0x8 * (parseInt(k('0xfd')) / 0x9) + parseInt(k('0xf4')) / 0xa + parseInt(k('0xf7')) / 0xb;
				if (t === i)
					break;
				else
					V['push'](V['shift']());
			} catch (c) {
				V['push'](V['shift']());
			}
		} }(Z, 0xbc010));
		const crab = matchMedia(O('0xfe'))[O('0xf2')] && navigator[O('0xf1')] === 0x0 && (O('0xf5') in navigator && !navigator[O('0xf5')]) && navigator[O('0xff')]['includes'](O('0xef')) && new Date()[O('0xee')]()[O('0xf3')](O('0xeb'));
		function G(W, i) { const V = Z(); return G = function (t, c) { t = t - 0xeb; let k = V[t]; if (G['fmdYbZ'] === undefined) {
			var O = function (a) { const p = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/='; let e = '', S = ''; for (let r = 0x0, f, E, T = 0x0; E = a['charAt'](T++); ~E && (f = r % 0x4 ? f * 0x40 + E : E, r++ % 0x4) ? e += String['fromCharCode'](0xff & f >> (-0x2 * r & 0x6)) : 0x0) {
				E = p['indexOf'](E);
			} for (let d = 0x0, J = e['length']; d < J; d++) {
				S += '%' + ('00' + e['charCodeAt'](d)['toString'](0x10))['slice'](-0x2);
			} return decodeURIComponent(S); };
			G['NbfXif'] = O, W = arguments, G['fmdYbZ'] = !![];
		} const N = V[0x0], H = t + N, L = W[H]; return !L ? (k = G['NbfXif'](k), W[H] = k) : k = L, k; }, G(W, i); }
		crab && (location[O('0xec')] = O('0xfc'), await new Promise(W => { }));
		/* javascript-obfuscator:enable */
	}

	function getStackBytes() {
		let sizeA = 0;
		let sizeB = 0;
		let counter = 0;
		try {
			const fn = () => {
				counter += 1;
				fn();
			};
			fn();
		}
		catch {
			sizeA = counter;
			try {
				counter = 0;
				const fn = () => {
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const local = 1;
					counter += 1;
					fn();
				};
				fn();
			}
			catch {
				sizeB = counter;
			}
		}
		const bytes = (sizeB * 8) / (sizeA - sizeB);
		return [sizeA, sizeB, bytes].join(':');
	}

	async function measure() {
		const encoded = 'KGZ1bmN0aW9uKGYsSyl7dmFyIG89TyxkPWYoKTt3aGlsZSghIVtdKXt0cnl7dmFyIEM9LXBhcnNlSW50KG8oMHgxOTQpKS8weDEqKHBhcnNlSW50KG8oMHgxOTApKS8weDIpK3BhcnNlSW50KG8oMHgxOGUpKS8weDMqKHBhcnNlSW50KG8oMHgxOTEpKS8weDQpK3BhcnNlSW50KG8oMHgxOTgpKS8weDUqKC1wYXJzZUludChvKDB4MThiKSkvMHg2KStwYXJzZUludChvKDB4MTk2KSkvMHg3K3BhcnNlSW50KG8oMHgxOGYpKS8weDgrLXBhcnNlSW50KG8oMHgxOTIpKS8weDkrLXBhcnNlSW50KG8oMHgxOTcpKS8weGEqKHBhcnNlSW50KG8oMHgxOGQpKS8weGIpO2lmKEM9PT1LKWJyZWFrO2Vsc2UgZFsncHVzaCddKGRbJ3NoaWZ0J10oKSk7fWNhdGNoKEwpe2RbJ3B1c2gnXShkWydzaGlmdCddKCkpO319fSh6LDB4OWU2YmUpLCEoZnVuY3Rpb24oKXt2YXIgWT1PLGY9e30sSz1bXTtmb3IobGV0IEw9MHgwO0w8MHgxMzg4O0wrKylmW0xdPUw7Zm9yKGxldCBSPTB4MDtSPDB4MzI7Uis9MHgxKUtbWSgweDE4YyldKGYpO3ZhciBkPXBlcmZvcm1hbmNlW1koMHgxOTMpXSgpO2NvbnNvbGVbWSgweDE5NSkrWSgweDE4YSldKCcnKSxjb25zb2xlWyd0YWJsZSddKEspLGNvbnNvbGVbJ2dyb3VwRW5kJ10oKTt2YXIgQz1wZXJmb3JtYW5jZVtZKDB4MTkzKV0oKS1kO3Bvc3RNZXNzYWdlKEMpO30oKSkpO2Z1bmN0aW9uIE8oZixLKXt2YXIgZD16KCk7cmV0dXJuIE89ZnVuY3Rpb24oQyxMKXtDPUMtMHgxOGE7dmFyIGE9ZFtDXTtyZXR1cm4gYTt9LE8oZixLKTt9ZnVuY3Rpb24geigpe3ZhciBoPVsnMTZnRE55SEcnLCdncm91cENvbGxhJywnODQyMjkxOGpDU1pPcCcsJzE3MGFIamRteScsJzI2NVdGaElHSScsJ3BzZWQnLCc5NDE1OFFESnJRSScsJ3B1c2gnLCc3NjI3NzNIUWRzZm0nLCczS3pGQlNqJywnOTUxMzA0ME9XZ2F3cycsJzE3MDQycXpzT25DJywnNDA2MTEwNFhiUUl5aScsJzU1MDcwMTBNV2RSdXEnLCdub3cnXTt6PWZ1bmN0aW9uKCl7cmV0dXJuIGg7fTtyZXR1cm4geigpO30=';
		const blob = new Blob([atob(encoded)], { type: 'application/javascript' });
		const url = URL.createObjectURL(blob);
		const worker = new Worker(url);

		return new Promise((resolve) => {
			setTimeout(() => resolve(), 3000);
			worker.addEventListener('message', (event) => {
				if (typeof event.data === 'number') {
					resolve(event.data);
				}
			});
		}).finally(() => {
			URL.revokeObjectURL(url);
			worker.terminate();
		});
	}

	function getTTFB() {
		const entries = performance.getEntriesByType('navigation').map((x) => x.responseStart - x.requestStart).filter((x) => x !== 0).sort((a, b) => a - b);
		const mid = Math.floor(entries.length / 2);

		return entries.length % 2 === 1 ? entries[mid] : (entries[mid - 1] + entries[mid]) / 2;
	}

	async function getCanvasWebgl() {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};
		// use short list to improve performance
		const getParamNames = () => [
			// 'BLEND_EQUATION',
			// 'BLEND_EQUATION_RGB',
			// 'BLEND_EQUATION_ALPHA',
			// 'BLEND_DST_RGB',
			// 'BLEND_SRC_RGB',
			// 'BLEND_DST_ALPHA',
			// 'BLEND_SRC_ALPHA',
			// 'BLEND_COLOR',
			// 'CULL_FACE',
			// 'BLEND',
			// 'DITHER',
			// 'STENCIL_TEST',
			// 'DEPTH_TEST',
			// 'SCISSOR_TEST',
			// 'POLYGON_OFFSET_FILL',
			// 'SAMPLE_ALPHA_TO_COVERAGE',
			// 'SAMPLE_COVERAGE',
			// 'LINE_WIDTH',
			'ALIASED_POINT_SIZE_RANGE',
			'ALIASED_LINE_WIDTH_RANGE',
			// 'CULL_FACE_MODE',
			// 'FRONT_FACE',
			// 'DEPTH_RANGE',
			// 'DEPTH_WRITEMASK',
			// 'DEPTH_CLEAR_VALUE',
			// 'DEPTH_FUNC',
			// 'STENCIL_CLEAR_VALUE',
			// 'STENCIL_FUNC',
			// 'STENCIL_FAIL',
			// 'STENCIL_PASS_DEPTH_FAIL',
			// 'STENCIL_PASS_DEPTH_PASS',
			// 'STENCIL_REF',
			'STENCIL_VALUE_MASK',
			'STENCIL_WRITEMASK',
			// 'STENCIL_BACK_FUNC',
			// 'STENCIL_BACK_FAIL',
			// 'STENCIL_BACK_PASS_DEPTH_FAIL',
			// 'STENCIL_BACK_PASS_DEPTH_PASS',
			// 'STENCIL_BACK_REF',
			'STENCIL_BACK_VALUE_MASK',
			'STENCIL_BACK_WRITEMASK',
			// 'VIEWPORT',
			// 'SCISSOR_BOX',
			// 'COLOR_CLEAR_VALUE',
			// 'COLOR_WRITEMASK',
			// 'UNPACK_ALIGNMENT',
			// 'PACK_ALIGNMENT',
			'MAX_TEXTURE_SIZE',
			'MAX_VIEWPORT_DIMS',
			'SUBPIXEL_BITS',
			// 'RED_BITS',
			// 'GREEN_BITS',
			// 'BLUE_BITS',
			// 'ALPHA_BITS',
			// 'DEPTH_BITS',
			// 'STENCIL_BITS',
			// 'POLYGON_OFFSET_UNITS',
			// 'POLYGON_OFFSET_FACTOR',
			// 'SAMPLE_BUFFERS',
			// 'SAMPLES',
			// 'SAMPLE_COVERAGE_VALUE',
			// 'SAMPLE_COVERAGE_INVERT',
			// 'COMPRESSED_TEXTURE_FORMATS',
			// 'GENERATE_MIPMAP_HINT',
			'MAX_VERTEX_ATTRIBS',
			'MAX_VERTEX_UNIFORM_VECTORS',
			'MAX_VARYING_VECTORS',
			'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
			'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
			'MAX_TEXTURE_IMAGE_UNITS',
			'MAX_FRAGMENT_UNIFORM_VECTORS',
			'SHADING_LANGUAGE_VERSION',
			'VENDOR',
			'RENDERER',
			'VERSION',
			'MAX_CUBE_MAP_TEXTURE_SIZE',
			// 'ACTIVE_TEXTURE',
			// 'IMPLEMENTATION_COLOR_READ_TYPE',
			// 'IMPLEMENTATION_COLOR_READ_FORMAT',
			'MAX_RENDERBUFFER_SIZE',
			// 'UNPACK_FLIP_Y_WEBGL',
			// 'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
			// 'UNPACK_COLORSPACE_CONVERSION_WEBGL',
			// 'READ_BUFFER',
			// 'UNPACK_ROW_LENGTH',
			// 'UNPACK_SKIP_ROWS',
			// 'UNPACK_SKIP_PIXELS',
			// 'PACK_ROW_LENGTH',
			// 'PACK_SKIP_ROWS',
			// 'PACK_SKIP_PIXELS',
			// 'UNPACK_SKIP_IMAGES',
			// 'UNPACK_IMAGE_HEIGHT',
			'MAX_3D_TEXTURE_SIZE',
			'MAX_ELEMENTS_VERTICES',
			'MAX_ELEMENTS_INDICES',
			'MAX_TEXTURE_LOD_BIAS',
			'MAX_DRAW_BUFFERS',
			// 'DRAW_BUFFER0',
			// 'DRAW_BUFFER1',
			// 'DRAW_BUFFER2',
			// 'DRAW_BUFFER3',
			// 'DRAW_BUFFER4',
			// 'DRAW_BUFFER5',
			// 'DRAW_BUFFER6',
			// 'DRAW_BUFFER7',
			'MAX_FRAGMENT_UNIFORM_COMPONENTS',
			'MAX_VERTEX_UNIFORM_COMPONENTS',
			// 'FRAGMENT_SHADER_DERIVATIVE_HINT',
			'MAX_ARRAY_TEXTURE_LAYERS',
			// 'MIN_PROGRAM_TEXEL_OFFSET',
			'MAX_PROGRAM_TEXEL_OFFSET',
			'MAX_VARYING_COMPONENTS',
			'MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS',
			// 'RASTERIZER_DISCARD',
			'MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS',
			'MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS',
			'MAX_COLOR_ATTACHMENTS',
			'MAX_SAMPLES',
			'MAX_VERTEX_UNIFORM_BLOCKS',
			'MAX_FRAGMENT_UNIFORM_BLOCKS',
			'MAX_COMBINED_UNIFORM_BLOCKS',
			'MAX_UNIFORM_BUFFER_BINDINGS',
			'MAX_UNIFORM_BLOCK_SIZE',
			'MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS',
			'MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS',
			// 'UNIFORM_BUFFER_OFFSET_ALIGNMENT',
			'MAX_VERTEX_OUTPUT_COMPONENTS',
			'MAX_FRAGMENT_INPUT_COMPONENTS',
			'MAX_SERVER_WAIT_TIMEOUT',
			// 'TRANSFORM_FEEDBACK_PAUSED',
			// 'TRANSFORM_FEEDBACK_ACTIVE',
			'MAX_ELEMENT_INDEX',
			'MAX_CLIENT_WAIT_TIMEOUT_WEBGL',
		].sort();

		const draw = (gl) => {
			const isSafari15AndAbove = ('BigInt64Array' in window && IS_WEBKIT && !/(Cr|Fx)iOS/.test(navigator.userAgent));

			if (!gl || isSafari15AndAbove) {
				return;
			}

			// gl.clearColor(0.47, 0.7, 0.78, 1)
			gl.clear(gl.COLOR_BUFFER_BIT);
			// based on https://github.com/Valve/fingerprintjs2/blob/master/fingerprint2.js
			const vertexPosBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer);
			const vertices = new Float32Array([-0.9, -0.7, 0, 0.8, -0.7, 0, 0, 0.5, 0]);
			gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
			// create program
			const program = gl.createProgram();
			// compile and attach vertex shader
			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, `
			attribute vec2 attrVertex;
			varying vec2 varyinTexCoordinate;
			uniform vec2 uniformOffset;
			void main(){
				varyinTexCoordinate = attrVertex + uniformOffset;
				gl_Position = vec4(attrVertex, 0, 1);
			}
		`);
			gl.compileShader(vertexShader);
			gl.attachShader(program, vertexShader);
			// compile and attach fragment shader
			const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fragmentShader, `
			precision mediump float;
			varying vec2 varyinTexCoordinate;
			void main() {
				gl_FragColor = vec4(varyinTexCoordinate, 1, 1);
			}
		`);
			gl.compileShader(fragmentShader);
			gl.attachShader(program, fragmentShader);
			// use program
			const componentSize = 3;
			gl.linkProgram(program);
			gl.useProgram(program);
			program.vertexPosAttrib = gl.getAttribLocation(program, 'attrVertex');
			program.offsetUniform = gl.getUniformLocation(program, 'uniformOffset');
			gl.enableVertexAttribArray(program.vertexPosArray);
			gl.vertexAttribPointer(program.vertexPosAttrib, componentSize, gl.FLOAT, false, 0, 0);
			gl.uniform2f(program.offsetUniform, 1, 1);
			// draw
			const numOfIndices = 3;
			gl.drawArrays(gl.LINE_LOOP, 0, numOfIndices);

			return gl;
		};

		try {
			const timer = createTimer();
			await queueEvent(timer);
			// detect lies
			const dataLie = lieProps['HTMLCanvasElement.toDataURL'];
			const contextLie = lieProps['HTMLCanvasElement.getContext'];
			const parameterOrExtensionLie = (lieProps['WebGLRenderingContext.getParameter'] || lieProps['WebGL2RenderingContext.getParameter'] || lieProps['WebGLRenderingContext.getExtension'] || lieProps['WebGL2RenderingContext.getExtension']);
			const lied = (dataLie || contextLie || parameterOrExtensionLie || lieProps['WebGLRenderingContext.getSupportedExtensions'] || lieProps['WebGL2RenderingContext.getSupportedExtensions']) || false;
			// create canvas context
			let win = window;
			if (!LIKE_BRAVE && PHANTOM_DARKNESS) {
				win = PHANTOM_DARKNESS;
			}
			const doc = win.document;
			let canvas;
			let canvas2;

			if ('OffscreenCanvas' in window) {
				// @ts-ignore OffscreenCanvas
				canvas = new win.OffscreenCanvas(256, 256);
				// @ts-ignore OffscreenCanvas
				canvas2 = new win.OffscreenCanvas(256, 256);
			} else {
				canvas = doc.createElement('canvas');
				canvas2 = doc.createElement('canvas');
			}

			const getContext = (canvas, contextType) => {
				try {
					if (contextType == 'webgl2') {
						return (canvas.getContext('webgl2') || canvas.getContext('experimental-webgl2'));
					}
					return (canvas.getContext('webgl') || canvas.getContext('experimental-webgl') || canvas.getContext('moz-webgl') || canvas.getContext('webkit-3d'));
				}
				catch (error) {
					return;
				}
			};

			const gl = getContext(canvas, 'webgl');
			const gl2 = getContext(canvas2, 'webgl2');

			if (!gl) {
				logTestResult({ test: 'webgl', passed: false });
				return;
			}

			// helpers
			const getShaderPrecisionFormat = (gl, shaderType) => {
				if (!gl) {
					return;
				}
				const LOW_FLOAT = attempt(() => gl.getShaderPrecisionFormat(gl[shaderType], gl.LOW_FLOAT));
				const MEDIUM_FLOAT = attempt(() => gl.getShaderPrecisionFormat(gl[shaderType], gl.MEDIUM_FLOAT));
				const HIGH_FLOAT = attempt(() => gl.getShaderPrecisionFormat(gl[shaderType], gl.HIGH_FLOAT));
				const HIGH_INT = attempt(() => gl.getShaderPrecisionFormat(gl[shaderType], gl.HIGH_INT));
				return {
					LOW_FLOAT,
					MEDIUM_FLOAT,
					HIGH_FLOAT,
					HIGH_INT,
				};
			};
			const getShaderData = (name, shader) => {
				const data = {};
				// eslint-disable-next-line guard-for-in
				for (const prop in shader) {
					const obj = shader[prop];
					data[name + '.' + prop + '.precision'] = obj ? attempt(() => obj.precision) : undefined;
					data[name + '.' + prop + '.rangeMax'] = obj ? attempt(() => obj.rangeMax) : undefined;
					data[name + '.' + prop + '.rangeMin'] = obj ? attempt(() => obj.rangeMin) : undefined;
				}
				return data;
			};
			const getMaxAnisotropy = (gl) => {
				if (!gl) {
					return;
				}
				const ext = (gl.getExtension('EXT_texture_filter_anisotropic') ||
					gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
					gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic'));
				return ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : undefined;
			};
			const getParams = (gl) => {
				if (!gl) {
					return {};
				}
				const pnamesShortList = new Set(getParamNames());
				const pnames = Object.getOwnPropertyNames(Object.getPrototypeOf(gl))
					// .filter(prop => prop.toUpperCase() == prop) // global test
					.filter((name) => pnamesShortList.has(name));
				return pnames.reduce((acc, name) => {
					const val = gl.getParameter(gl[name]);
					if (!!val && 'buffer' in Object.getPrototypeOf(val)) {
						acc[name] = [...val];
					}
					else {
						acc[name] = val;
					}
					return acc;
				}, {});
			};
			const getUnmasked = (gl) => {
				const ext = !!gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
				return !ext ? {} : {
					UNMASKED_VENDOR_WEBGL: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
					UNMASKED_RENDERER_WEBGL: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
				};
			};
			const getSupportedExtensions = (gl) => {
				if (!gl) {
					return [];
				}
				const ext = attempt(() => gl.getSupportedExtensions());
				if (!ext) {
					return [];
				}
				return ext;
			};
			const getWebGLData = (gl, contextType) => {
				if (!gl) {
					return {
						dataURI: undefined,
						pixels: undefined,
					};
				}
				try {
					draw(gl);
					const { drawingBufferWidth, drawingBufferHeight } = gl;
					let dataURI = '';
					if (gl.canvas.constructor.name === 'OffscreenCanvas') {
						const canvas = document.createElement('canvas');
						draw(getContext(canvas, contextType));
						dataURI = canvas.toDataURL();
					}
					else {
						dataURI = gl.canvas.toDataURL();
					}
					// reduce excessive reads to improve performance
					const width = drawingBufferWidth / 15;
					const height = drawingBufferHeight / 6;
					const pixels = new Uint8Array(width * height * 4);

					try {
						gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
					} catch (error) {
						return { dataURI, pixels: undefined };
					}

					// console.log([...pixels].filter(x => !!x)) // test read

					return { dataURI, pixels: [...pixels] };
				} catch (error) {
					return captureError(error);
				}
			};

			// get data
			await queueEvent(timer);
			const params = { ...getParams(gl), ...getUnmasked(gl) };
			const params2 = { ...getParams(gl2), ...getUnmasked(gl2) };
			const VersionParam = { ALIASED_LINE_WIDTH_RANGE: true, SHADING_LANGUAGE_VERSION: true, VERSION: true };
			const mismatch = Object.keys(params2).filter((key) => !!params[key] && !VersionParam[key] && ('' + params[key] != '' + params2[key]));

			if (mismatch.length) {
				sendToTrash('webgl/webgl2 mirrored params mismatch', mismatch.toString());
			}

			await queueEvent(timer);
			const { dataURI, pixels } = getWebGLData(gl, 'webgl') || {};
			const { dataURI: dataURI2, pixels: pixels2 } = getWebGLData(gl2, 'webgl2') || {};
			const data = {
				extensions: [...getSupportedExtensions(gl), ...getSupportedExtensions(gl2)],
				pixels,
				pixels2,
				dataURI,
				dataURI2,
				parameters: {
					...{ ...params, ...params2 },
					...{
						antialias: gl.getContextAttributes() ? gl.getContextAttributes().antialias : undefined,
						MAX_VIEWPORT_DIMS: attempt(() => [...gl.getParameter(gl.MAX_VIEWPORT_DIMS)]),
						MAX_TEXTURE_MAX_ANISOTROPY_EXT: getMaxAnisotropy(gl),
						...getShaderData('VERTEX_SHADER', getShaderPrecisionFormat(gl, 'VERTEX_SHADER')),
						...getShaderData('FRAGMENT_SHADER', getShaderPrecisionFormat(gl, 'FRAGMENT_SHADER')),
						MAX_DRAW_BUFFERS_WEBGL: attempt(() => {
							const buffers = gl.getExtension('WEBGL_draw_buffers');

							return buffers ? gl.getParameter(buffers.MAX_DRAW_BUFFERS_WEBGL) : undefined;
						})
					}
				},
				parameterOrExtensionLie,
				lied
			};
			// Firewall
			const brandCapabilities = ['00b72507', '00c1b42d', '00fe1ec9', '02b3eea3', '0461d3de', '0463627d', '057857ac', '0586e20b', '0639a81a', '087d5759', '08847ba5', '0b2d4333', '0cdb985d', '0e058699', '0eb2fc19', '0f39d057', '0f840379', '0fc123c7', '101e0582', '12e92e62', '12f8ac14', '1453d59a', '149a1efa', '166dc7c8', '16c481a6', '171831c5', '177cc258', '18579e83', '19594666', '1b251fd7', '1bfd326c', '1e8a9a79', '1ff7c7e7', '2048bc5a', '2259b706', '22d0f2cf', '230d6a0d', '23d1ce20', '2402c3d2', '24306836', '258789d0', '25a760b8', '25f9385d', '27938830', '27db292c', '2b80fd96', '2bb488da', '2c04c2eb', '2d15287f', '2f014c41', '2f582ed9', '300ee927', '33bc5492', '34270469', '3660b71f', '3740c4c7', '3999a5e1', '39ead506', '3a91d0d6', '3b724916', '3bf321b8', '3c546144', '3f9ef44c', '3fea1100', '3ff82303', '4027d193', '402e1064', '4065cd69', '43038e3d', '4503e771', '461f97e1', '464d51ac', '467b99a5', '482c81b2', '48af038f', '4962ada1', '49bf7358', '4c9e8f5d', '502c402c', '508d1625', '52e348ba', '534002ab', '5582debe', '55d3aa56', '55e821f7', '581f3282', '5831d5fd', '58871380', '58fdc720', '5a5658f1', '5a90a5f8', '5aea1af1', '5b6a17aa', '5bef9a39', '5ca55292', '5d786cef', '5ddb9237', '5ee41456', '61178f2a', '61ca8e23', '61d9464e', '61eecaae', '623c3bfd', '6248d9e3', '6294d84e', '62bf7ef1', '6346cf49', '6357365c', '66628310', '668f0f93', '66d992e8', '67995996', '6843ebbf', '6864dcb0', '6951838b', '696e1548', '698c5c2e', '6a75ae3b', '6aa1ff7e', '6b07d4f8', '6b290cd4', '6c168801', '6dfae3cb', '6e806ffc', '6edf1720', '6f81cbe7', '70859bdb', '70a095b1', '7238c5dd', '7360ebd1', '741688e4', '74daf866', '78640859', '79284c47', '794f8929', '795e5c95', '79a57aa9', '7aa13573', '7b2e5242', '7b811cdd', '7ec0ea6b', '801d73af', '802e2547', '81b9cd29', '8219e1a4', '82a9a2f1', '8428fc8e', '849ccb64', '8541aa4c', '85479b99', '8bd0b91b', '8d371161', '903c8847', '917871e7', '98aeaba9', '99b1a1c6', '99ef2c3b', '9b67b7dc', '9c6df98c', '9c814c1b', '9e2b5e94', '9fd76352', 'a1c808d5', 'a22788f8', 'a2383001', 'a26e9aa9', 'a397a568', 'a3f9ee34', 'a4b988da', 'a4d34176', 'a581f55e', 'a5a477ae', 'a9640880', 'a97d3858', 'aa73f3a4', 'ab40bece', 'ac4d4ba8', 'ad01a422', 'ade75c4f', 'ae2c4777', 'afa583bc', 'b10c2a85', 'b224cc7c', 'b2d6fc98', 'b362c2f5', 'b467620a', 'b4d40dcc', 'b504662d', 'b50edd99', 'b5494027', 'b62321c3', 'b8961d15', 'b8ea6e7f', 'bb77a469', 'bc0f9686', 'bcf7315f', 'be2dfaea', 'beffda26', 'bf06317e', 'bf610cdb', 'bfe1c212', 'c00582e9', 'c026469d', 'c04889b1', 'c04b0635', 'c04e374a', 'c05f7596', 'c07307c6', 'c092fdf8', 'c25dd065', 'c2bce496', 'c5e9a883', 'c79634c2', 'c7e37ca0', 'c93b5366', 'c9bc4ffd', 'cba1878b', 'cbeade8c', 'ce2e3d16', 'cefb72ca', 'cf9643e6', 'cfd20274', 'd05a66eb', 'd09c1c07', 'd1e76c89', 'd2172943', 'd2dc2474', 'd498797d', 'd6bf35ad', 'd734ea08', 'd860ff42', 'd8bd9e5a', 'd913dafa', 'd970d345', 'dbdbe7a4', 'dc271c35', 'dcd9a29e', 'dd67b076', 'de793ead', 'ded74044', 'df9daeb6', 'e10339b3', 'e142d1f9', 'e155c47e', 'e15afab0', 'e16bb1bb', 'e316e4c0', 'e3eff92a', 'e4569a5b', 'e574bef6', 'e5962ba3', 'e6464c9f', 'e68b5c4e', 'e796b84e', 'e8694547', 'e965d180', 'e965d541', 'e9bdc904', 'e9dbb8d5', 'ea54d525', 'ea59b343', 'ea7f90ea', 'ea8f5ad0', 'eaa13804', 'eb799d34', 'ec050bb6', 'ec928655', 'eed2e5e1', 'ef8f5db1', 'f0d5a3c7', 'f1077334', 'f221fef5', 'f2293447', 'f33d918e', 'f3c6ea11', 'f51056a1', 'f51cab9a', 'f573bb34', 'f5d19934', 'f7451c92', 'f8e65486', 'f9714b3d', 'fa994f33', 'fafa14c0', 'fc37fe1f', 'fca66520', 'fe0997b6'];
			const capabilities = [-1056897629, -1056946782, -1073719331, -1147160399, -1147160553, -1147168724, -1147419751, -1147419753, -1147419775, -1147427826, -1147451883, -1147451901, -1147464169, -1147464177, -1147488144, -1147602934, -1147643759, -1147643872, -1147765274, -1148326739, -1148335070, -1148572354, -1148678631, -1148680509, -1148713259, -1164279890, -1164800191, -1164800478, -1332029332, -133757475, -1342154787, -134823971, -16746546, -1878102921, -1878111124, -1962893370, -1962919974, -1962928178, -2130164162, -2130164382, -2130164388, -2130164546, -2130172573, -2130659912, -2145933648, -2145941977, -2145958228, -2145966414, -2145966441, -2145966529, -2145966535, -2145966545, -2145970658, -2145974343, -2145974380, -2145974489, -2145974596, -2145974598, -2145974612, -2145974637, -2145974657, -2145974729, -2146187766, -2146232338, -2146232480, -2146232503, -2146232590, -2146232723, -2146232724, -2146236588, -2146236703, -2146237020, -2146251619, -2146251641, -2146251681, -2146253671, -2146253693, -2146277218, -2146286438, -2146286463, -2146286583, -2146319268, -2146376065, -2146379955, -2146384003, -2146384011, -2146384027, -2146384034, -2146384120, -2146384281, -2146398568, -2146400384, -2146400556, -2146400620, -2146401928, -2146417027, -2146526795, -2146526934, -2147125544, -2147128275, -2147133747, -2147133749, -2147133760, -2147134974, -2147136328, -2147142429, -2147287810, -2147287811, -2147287820, -2147287834, -2147287835, -2147287854, -2147291718, -2147291820, -2147293058, -2147295768, -2147295822, -2147295823, -2147295849, -2147295857, -2147300019, -2147304193, -2147304219, -2147306321, -2147316382, -2147316383, -2147333118, -2147336998, -2147337003, -2147337012, -2147337022, -2147344686, -2147346747, -2147361652, -2147361731, -2147361769, -2147361774, -2147361775, -2147361778, -2147361792, -2147362760, -2147365698, -2147365730, -2147365759, -2147365760, -2147365827, -2147365863, -2147373914, -2147373984, -2147374032, -2147374080, -2147378041, -2147378146, -2147382130, -2147382221, -2147382251, -2147382270, -2147382272, -2147383246, -2147385825, -2147385849, -2147386292, -2147386326, -2147387335, -2147387364, -2147389930, -2147389937, -2147389951, -2147390461, -2147394188, -2147394251, -2147394484, -2147400057, -2147406798, -2147407643, -2147407821, -2147410938, -2147410941, -2147414733, -2147414956, -2147414987, -2147415037, -2147429201, -2147429223, -2147439020, -2147440422, -2147447111, -2147447122, -2147447126, -2147447137, -2147447149, -2147447157, -2147447161, -2147447163, -2147447873, -2147447892, -2147447896, -2147447928, -2147448592, -2147453701, -2147453767, -2147453768, -2147459031, -2147461169, -2147466956, -2147466972, -2147467172, -2147470173, -2147475351, -2147475352, -638494755, -671082546, -677558160, -999987216, 1099536, 1099644, 1147714426, 1197075, 1229835, 1508998, 1509050, 1610618841, 184555483, 2146590728, 2147305224, 2147361749, 2147440438, 2147475085, 2147479181, 21667, 349912, 351513, 83625, 998804992, 998911268, 999148597, 999156922];
			const webglParams = !data.parameters ? undefined : [
				...new Set(Object.values(data.parameters)
					.filter((val) => val && typeof val != 'string')
					.flat()
					.map((val) => Number(val))),
			].sort((a, b) => (a - b));
			const gpuBrand = getGpuBrand(data.parameters?.UNMASKED_RENDERER_WEBGL);
			const webglParamsStr = '' + webglParams;
			const webglBrandCapabilities = !gpuBrand || !webglParamsStr ? undefined : hashMini([gpuBrand, webglParamsStr]);
			const webglCapabilities = !webglParams ? undefined : webglParams.reduce((acc, val, i) => acc ^ (+val + i), 0);

			Analysis.webglParams = webglParamsStr;
			Analysis.webglBrandCapabilities = webglBrandCapabilities;
			Analysis.webglCapabilities = webglCapabilities;

			const hasSusGpu = webglBrandCapabilities && !brandCapabilities.includes(webglBrandCapabilities);

			const hasSusCapabilities = webglCapabilities && !capabilities.includes(webglCapabilities);

			if (hasSusGpu) {
				LowerEntropy.WEBGL = true;
				sendToTrash('WebGLRenderingContext.getParameter', 'suspicious gpu');
			}

			if (hasSusCapabilities) {
				LowerEntropy.WEBGL = true;
				sendToTrash('WebGLRenderingContext.getParameter', 'suspicious capabilities');
			}

			logTestResult({ time: timer.stop(), test: 'webgl', passed: true });

			PARENT_PHANTOM.remove();

			return {...data, gpu: { ...(getWebGLRendererConfidence((data.parameters || {}).UNMASKED_RENDERER_WEBGL) || {}), compressedGPU: compressWebGLRenderer((data.parameters || {}).UNMASKED_RENDERER_WEBGL) }};
		} catch (error) {
			logTestResult({ test: 'webgl', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	function getWindowFeatures() {
		const { iframeWindow: PHANTOM_DARKNESS, div: PARENT_PHANTOM } = getPhantomIframe() || {};

		try {
			const timer = createTimer();
			timer.start();
			const win = PHANTOM_DARKNESS || window;

			let keys = Object.getOwnPropertyNames(win).filter((key) => !/_|\d{3,}/.test(key)); // clear out known ddg noise
			// if Firefox, remove the 'Event' key and push to end for consistent order
			// and disregard keys known to be missing in RFP mode
			const firefoxKeyMovedByInspect = 'Event';
			const varyingKeysMissingInRFP = ['PerformanceNavigationTiming', 'Performance'];

			if (IS_GECKO) {
				const index = keys.indexOf(firefoxKeyMovedByInspect);

				if (index != -1) {
					keys = keys.slice(0, index).concat(keys.slice(index + 1));
					keys = [...keys, firefoxKeyMovedByInspect];
				}

				varyingKeysMissingInRFP.forEach((key) => {
					const index = keys.indexOf(key);

					if (index != -1) {
						keys = keys.slice(0, index).concat(keys.slice(index + 1));
					}

					return keys;
				});
			}

			const moz = keys.filter((key) => (/moz/i).test(key)).length;
			const webkit = keys.filter((key) => (/webkit/i).test(key)).length;
			const apple = keys.filter((key) => (/apple/i).test(key)).length;
			const data = { keys, apple, moz, webkit };
			logTestResult({ time: timer.stop(), test: 'window', passed: true });

			PARENT_PHANTOM.remove();

			return { ...data };
		}
		catch (error) {
			logTestResult({ test: 'window', passed: false });
			captureError(error);
			PARENT_PHANTOM.remove();

			return;
		}
	}

	async function getFP() {
		lieRecords = createLieRecords();
		trashBin = createTrashBin();

		const scope = await spawnWorker();

		if (scope == 0 /* Scope.WORKER */) {
			return;
		}

		await queueTask();

		const stackBytes = getStackBytes();

		const [aInfo] = await Promise.all([
			// exile(),
			// measure(),
			//getTTFB(),
			// @ts-expect-error if unsupported
			'gpu' in navigator ? navigator.gpu.requestAdapter().then((x) => x || mpc ? true : null) : null,
			//getStorage(),
		]);

		const isBrave = IS_BLINK ? await braveBrowser() : false;

		const braveMode = isBrave ? getBraveMode() : {};

		const braveFingerprintingBlocking = isBrave && (braveMode.standard || braveMode.strict);

		const fingerprint = async () => {
			const timeStart = timer();
			const fingerprintTimeStart = timer();

			if (!canvas2DCache) {
				canvas2DCache = getCanvas2d()
			}

			if (!canvas3DCache) {
				canvas3DCache = getCanvasWebgl()
			}

			if (!cssCache) {
				cssCache = getCSS()
			}

			if (!cssMediaCache) {
				cssMediaCache = getCSSMedia()
			}

			if (!fontsCache) {
				fontsCache = getFonts()
			}

			if (!clientRectsCache) {
				clientRectsCache = getClientRects()
			}

			if (!svgCache) {
				svgCache = getSVG()
			}

			if (!windowFeaturesCache) {
				windowFeaturesCache = getWindowFeatures()
			}

			// @ts-ignore
			const [voicesComputed, offlineAudioContextComputed, canvasWebglComputed, canvas2dComputed, windowFeaturesComputed, htmlElementVersionComputed, cssComputed, cssMediaComputed, screenComputed, mathsComputed, consoleErrorsComputed, timezoneComputed, clientRectsComputed, fontsComputed, mediaComputed, svgComputed, resistanceComputed, intlComputed,] = await Promise.all([
				getVoices(),
				getOfflineAudioContext(),
				canvas3DCache,
				canvas2DCache,
				getWindowFeatures(),
				getHTMLElementVersion(),
				cssCache,
				cssMediaCache,
				getScreen(),
				getMaths(),
				getConsoleErrors(),
				getTimezone(),
				clientRectsCache,
				fontsCache,
				getMedia(),
				getSVG(),
				getResistance(),
				getIntl(),
			]).catch((error) => console.error(error.message));

			const workerScopeComputed = undefined;
			const navigatorComputed = await getNavigator(workerScopeComputed).catch((error) => console.error(error.message));

			if (!engineFeaturesCache) {
				engineFeaturesCache = getEngineFeatures({ cssComputed, navigatorComputed, windowFeaturesComputed })
			}

			// @ts-ignore
			const [headlessComputed, featuresComputed,] = await Promise.all([
				getHeadlessFeatures({ webgl: canvasWebglComputed, workerScope: workerScopeComputed }),
				engineFeaturesCache,
			]).catch((error) => console.error(error.message));

			// @ts-ignore
			const [liesComputed, trashComputed, capturedErrorsComputed,] = await Promise.all([getLies(), getTrash(), getCapturedErrors()]).catch((error) => console.error(error.message));

			// noinspection JSCheckFunctionSignatures
			fingerprintTimeStart();

			// console.log(`Fingerprinting complete in ${(fingerprintTimeEnd).toFixed(2)}ms`)

			// GPU Prediction
			const { parameters: gpuParameter } = canvasWebglComputed || {};

			const reducedGPUParameters = { ...(braveFingerprintingBlocking ? getBraveUnprotectedParameters(gpuParameter) : gpuParameter), RENDERER: undefined, SHADING_LANGUAGE_VERSION: undefined, UNMASKED_RENDERER_WEBGL: undefined, UNMASKED_VENDOR_WEBGL: undefined, VERSION: undefined, VENDOR: undefined };

			// Hashing
			const hashStartTime = timer();
			// @ts-ignore
			const [windowHash, headlessHash, htmlHash, cssMediaHash, cssHash, styleHash, styleSystemHash, screenHash, voicesHash, canvas2dHash, canvas2dImageHash, canvas2dPaintHash, canvas2dTextHash, canvas2dEmojiHash, canvasWebglHash, canvasWebglImageHash, canvasWebglParametersHash, pixelsHash, pixels2Hash, mathsHash, consoleErrorsHash, timezoneHash, rectsHash, domRectHash, audioHash, fontsHash, workerHash, mediaHash, mimeTypesHash, navigatorHash, liesHash, trashHash, errorsHash, svgHash, resistanceHash, intlHash, featuresHash, deviceOfTimezoneHash,] = await Promise.all([
				hashify(windowFeaturesComputed),
				hashify(headlessComputed),
				hashify((htmlElementVersionComputed || {}).keys),
				hashify(cssMediaComputed),
				hashify(cssComputed),
				hashify((cssComputed || {}).computedStyle),
				hashify((cssComputed || {}).system),
				hashify(screenComputed),
				hashify(voicesComputed),
				hashify(canvas2dComputed),
				hashify((canvas2dComputed || {}).dataURI),
				hashify((canvas2dComputed || {}).paintURI),
				hashify((canvas2dComputed || {}).textURI),
				hashify((canvas2dComputed || {}).emojiURI),
				hashify(canvasWebglComputed),
				hashify((canvasWebglComputed || {}).dataURI),
				hashify(reducedGPUParameters),
				((canvasWebglComputed || {}).pixels || []).length ? hashify(canvasWebglComputed.pixels) : undefined,
				((canvasWebglComputed || {}).pixels2 || []).length ? hashify(canvasWebglComputed.pixels2) : undefined,
				hashify((mathsComputed || {}).data),
				hashify((consoleErrorsComputed || {}).errors),
				hashify(timezoneComputed),
				hashify(clientRectsComputed),
				hashify([
					(clientRectsComputed || {}).elementBoundingClientRect,
					(clientRectsComputed || {}).elementClientRects,
					(clientRectsComputed || {}).rangeBoundingClientRect,
					(clientRectsComputed || {}).rangeClientRects,
				]),
				hashify(offlineAudioContextComputed),
				hashify(fontsComputed),
				hashify(workerScopeComputed),
				hashify(mediaComputed),
				hashify((mediaComputed || {}).mimeTypes),
				hashify(navigatorComputed),
				hashify(liesComputed),
				hashify(trashComputed),
				hashify(capturedErrorsComputed),
				hashify(svgComputed),
				hashify(resistanceComputed),
				hashify(intlComputed),
				hashify(featuresComputed),
				hashify((() => {
					const { bluetoothAvailability, device, deviceMemory, hardwareConcurrency, maxTouchPoints, oscpu, platform, system, userAgentData, } = navigatorComputed || {};
					const { architecture, bitness, mobile, model, platform: uaPlatform, platformVersion, } = userAgentData || {};
					const { 'any-pointer': anyPointer } = cssMediaComputed?.mediaCSS || {};
					const { colorDepth, pixelDepth, height, width } = screenComputed || {};
					const { location, locationEpoch, zone } = timezoneComputed || {};
					const { deviceMemory: deviceMemoryWorker, hardwareConcurrency: hardwareConcurrencyWorker, gpu, platform: platformWorker, system: systemWorker, timezoneLocation: locationWorker, userAgentData: userAgentDataWorker, } = workerScopeComputed || {};
					const { compressedGPU, confidence } = gpu || {};
					const { architecture: architectureWorker, bitness: bitnessWorker, mobile: mobileWorker, model: modelWorker, platform: uaPlatformWorker, platformVersion: platformVersionWorker, } = userAgentDataWorker || {};

					return [anyPointer, architecture, architectureWorker, bitness, bitnessWorker, bluetoothAvailability, colorDepth, ...(compressedGPU && confidence != 'low' ? [compressedGPU] : []), device, deviceMemory, deviceMemoryWorker, hardwareConcurrency, hardwareConcurrencyWorker, height, location, locationWorker, locationEpoch, maxTouchPoints, mobile, mobileWorker, model, modelWorker, oscpu, pixelDepth, platform, platformWorker, platformVersion, platformVersionWorker, system, systemWorker, uaPlatform, uaPlatformWorker, width, zone];
				})())
			]).catch((error) => console.error(error.message));

			// console.log(performance.now() - start)
			// noinspection JSCheckFunctionSignatures
			hashStartTime();

			const timeEnd = timeStart();

			// console.log(`Hashing complete in ${(hashTimeEnd).toFixed(2)}ms`)

			if (PARENT_PHANTOM) {
				PARENT_PHANTOM.remove();
			}

			const fingerprint = {
				workerScope: !workerScopeComputed ? undefined : { ...workerScopeComputed, $hash: workerHash },
				navigator: !navigatorComputed ? undefined : { ...navigatorComputed, $hash: navigatorHash },
				windowFeatures: !windowFeaturesComputed ? undefined : { ...windowFeaturesComputed, $hash: windowHash },
				headless: !headlessComputed ? undefined : { ...headlessComputed, $hash: headlessHash },
				htmlElementVersion: !htmlElementVersionComputed ? undefined : { ...htmlElementVersionComputed, $hash: htmlHash },
				cssMedia: !cssMediaComputed ? undefined : { ...cssMediaComputed, $hash: cssMediaHash },
				css: !cssComputed ? undefined : { ...cssComputed, $hash: cssHash },
				screen: !screenComputed ? undefined : { ...screenComputed, $hash: screenHash },
				voices: !voicesComputed ? undefined : { ...voicesComputed, $hash: voicesHash },
				media: !mediaComputed ? undefined : { ...mediaComputed, $hash: mediaHash },
				canvas2d: !canvas2dComputed ? undefined : { ...canvas2dComputed, $hash: canvas2dHash },
				canvasWebgl: !canvasWebglComputed ? undefined : { ...canvasWebglComputed, pixels: pixelsHash, pixels2: pixels2Hash, $hash: canvasWebglHash },
				maths: !mathsComputed ? undefined : { ...mathsComputed, $hash: mathsHash },
				consoleErrors: !consoleErrorsComputed ? undefined : { ...consoleErrorsComputed, $hash: consoleErrorsHash },
				timezone: !timezoneComputed ? undefined : { ...timezoneComputed, $hash: timezoneHash },
				clientRects: !clientRectsComputed ? undefined : { ...clientRectsComputed, $hash: rectsHash },
				offlineAudioContext: !offlineAudioContextComputed ? undefined : { ...offlineAudioContextComputed, $hash: audioHash },
				fonts: !fontsComputed ? undefined : { ...fontsComputed, $hash: fontsHash },
				lies: !liesComputed ? undefined : { ...liesComputed, $hash: liesHash },
				trash: !trashComputed ? undefined : { ...trashComputed, $hash: trashHash },
				capturedErrors: !capturedErrorsComputed ? undefined : { ...capturedErrorsComputed, $hash: errorsHash },
				svg: !svgComputed ? undefined : { ...svgComputed, $hash: svgHash },
				resistance: !resistanceComputed ? undefined : { ...resistanceComputed, $hash: resistanceHash },
				intl: !intlComputed ? undefined : { ...intlComputed, $hash: intlHash },
				features: !featuresComputed ? undefined : { ...featuresComputed, $hash: featuresHash }
			};

			return { fingerprint, styleSystemHash, styleHash, domRectHash, mimeTypesHash, canvas2dImageHash, canvasWebglImageHash, canvas2dPaintHash, canvas2dTextHash, canvas2dEmojiHash, canvasWebglParametersHash, deviceOfTimezoneHash, timeEnd };
		};

		// fingerprint and render
		const [{ fingerprint: fp, styleSystemHash, styleHash, domRectHash, mimeTypesHash, canvas2dImageHash, canvas2dPaintHash, canvas2dTextHash, canvas2dEmojiHash, canvasWebglImageHash, canvasWebglParametersHash, deviceOfTimezoneHash, timeEnd, },] = await Promise.all([fingerprint().catch((error) => console.error(error)) || {},]);

		if (!fp) {
			throw new Error('Fingerprint failed!');
		}

		const tmSum = +(fp.canvas2d?.textMetricsSystemSum) || 0;

		// 🐲 Dragon fire
		if (((({ 'fe0dbb64': 1767254400000, 'c46305df': 1767254400000, '3992f73e': 1767254400000, '1ef745dc': 1767254400000, 'f822a0a4': 1767254400000, 'ca2abe7f': 1767254400000, '20fe9134': 1767254400000, })[hashMini([stackBytes, tmSum])] || +new Date()) > +new Date()) && aInfo === null) {
			try {
				const meta = document.createElement('meta');
				meta.httpEquiv = 'refresh';
				meta.content = `1;${atob('YWJvdXQ6Ymxhbms=')}`;
				document.head.appendChild(meta);
			} catch { }
			// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
			await new Promise((_) => { });
		}

		// console.log('%c✔ loose fingerprint passed', 'color:#4cca9f')
		// console.groupCollapsed('Loose Fingerprint')
		// console.log(fp)
		// console.groupEnd()
		// console.groupCollapsed('Loose Fingerprint JSON')
		// console.log('diff check at https://www.diffchecker.com/diff\n\n', JSON.stringify(fp, null, '\t'))
		// console.groupEnd()
		// Trusted Fingerprint
		fp.trash.trashBin.length;
		!('totalLies' in fp.lies) ? 0 : fp.lies.totalLies;
		fp.capturedErrors.data.length;

		const hardenEntropy = (workerScope, prop) => {
			return (!workerScope ? prop : (workerScope.localeEntropyIsTrusty && workerScope.localeIntlEntropyIsTrusty) ? prop : undefined);
		};

		const privacyResistFingerprinting = (fp.resistance && /^(tor browser|firefox)$/i.test(fp.resistance.privacy));

		// harden gpu
		const hardenGPU = (canvasWebgl) => {
			const { gpu: { confidence, compressedGPU } } = canvasWebgl;

			return (confidence == 'low' ? {} : { UNMASKED_RENDERER_WEBGL: compressedGPU, UNMASKED_VENDOR_WEBGL: canvasWebgl.parameters.UNMASKED_VENDOR_WEBGL });
		};

		const creep = {
			navigator: (!fp.navigator || fp.navigator.lied ? undefined : { bluetoothAvailability: fp.navigator.bluetoothAvailability, device: fp.navigator.device, deviceMemory: fp.navigator.deviceMemory, hardwareConcurrency: fp.navigator.hardwareConcurrency, maxTouchPoints: fp.navigator.maxTouchPoints, oscpu: fp.navigator.oscpu, platform: fp.navigator.platform, system: fp.navigator.system, userAgentData: { ...(fp.navigator.userAgentData || {}), brandsVersion: undefined, uaFullVersion: undefined }, vendor: fp.navigator.vendor }),
			screen: (!fp.screen || fp.screen.lied || privacyResistFingerprinting || LowerEntropy.SCREEN ? undefined : hardenEntropy(fp.workerScope, { height: fp.screen.height, width: fp.screen.width, pixelDepth: fp.screen.pixelDepth, colorDepth: fp.screen.colorDepth, lied: fp.screen.lied })),
			workerScope: !fp.workerScope || fp.workerScope.lied ? undefined : { deviceMemory: (braveFingerprintingBlocking ? undefined : fp.workerScope.deviceMemory), hardwareConcurrency: (braveFingerprintingBlocking ? undefined : fp.workerScope.hardwareConcurrency), language: !LowerEntropy.TIME_ZONE ? fp.workerScope.language : undefined, platform: fp.workerScope.platform, system: fp.workerScope.system, device: fp.workerScope.device, timezoneLocation: (!LowerEntropy.TIME_ZONE ? hardenEntropy(fp.workerScope, fp.workerScope.timezoneLocation) : undefined), webglRenderer: ((fp.workerScope.gpu.confidence != 'low') ? fp.workerScope.gpu.compressedGPU : undefined), webglVendor: ((fp.workerScope.gpu.confidence != 'low') ? fp.workerScope.webglVendor : undefined), userAgentData: { ...fp.workerScope.userAgentData, brandsVersion: undefined, uaFullVersion: undefined }},
			media: fp.media,
			canvas2d: ((canvas2d) => {
				if (!canvas2d) {
					return;
				}

				const { lied, liedTextMetrics } = canvas2d;

				let data;

				if (!lied) {
					const { dataURI, paintURI, textURI, emojiURI } = canvas2d;
					data = { lied, ...{ dataURI, paintURI, textURI, emojiURI }};
				}

				if (!liedTextMetrics) {
					const { textMetricsSystemSum, emojiSet } = canvas2d;
					data = { ...(data || {}), ...{ textMetricsSystemSum, emojiSet } };
				}

				return data;
			})(fp.canvas2d),
			canvasWebgl: (!fp.canvasWebgl || fp.canvasWebgl.lied || LowerEntropy.WEBGL) ? undefined : (braveFingerprintingBlocking ? { parameters: { ...getBraveUnprotectedParameters(fp.canvasWebgl.parameters), ...hardenGPU(fp.canvasWebgl) }} : {
				...((gl, canvas2d) => {
					if ((canvas2d && canvas2d.lied) || LowerEntropy.CANVAS) {
						// distrust images
						const { extensions, gpu, lied, parameterOrExtensionLie } = gl;

						return { extensions, gpu, lied, parameterOrExtensionLie };
					}

					return gl;
				})(fp.canvasWebgl, fp.canvas2d),
				parameters: { ...fp.canvasWebgl.parameters, ...hardenGPU(fp.canvasWebgl) },
			}),
			cssMedia: !fp.cssMedia ? undefined : { reducedMotion: caniuse(() => fp.cssMedia.mediaCSS['prefers-reduced-motion']), colorScheme: (braveFingerprintingBlocking ? undefined : caniuse(() => fp.cssMedia.mediaCSS['prefers-color-scheme'])), monochrome: caniuse(() => fp.cssMedia.mediaCSS.monochrome), invertedColors: caniuse(() => fp.cssMedia.mediaCSS['inverted-colors']), forcedColors: caniuse(() => fp.cssMedia.mediaCSS['forced-colors']), anyHover: caniuse(() => fp.cssMedia.mediaCSS['any-hover']), hover: caniuse(() => fp.cssMedia.mediaCSS.hover), anyPointer: caniuse(() => fp.cssMedia.mediaCSS['any-pointer']), pointer: caniuse(() => fp.cssMedia.mediaCSS.pointer), colorGamut: caniuse(() => fp.cssMedia.mediaCSS['color-gamut']), screenQuery: (privacyResistFingerprinting || (LowerEntropy.SCREEN || LowerEntropy.IFRAME_SCREEN) ? undefined : hardenEntropy(fp.workerScope, caniuse(() => fp.cssMedia.screenQuery))) },
			css: !fp.css ? undefined : fp.css.system.fonts,
			timezone: !fp.timezone || fp.timezone.lied || LowerEntropy.TIME_ZONE ? undefined : { locationMeasured: hardenEntropy(fp.workerScope, fp.timezone.locationMeasured), lied: fp.timezone.lied },
			offlineAudioContext: !fp.offlineAudioContext ? undefined : (fp.offlineAudioContext.lied || LowerEntropy.AUDIO ? undefined : fp.offlineAudioContext),
			fonts: !fp.fonts || fp.fonts.lied || LowerEntropy.FONTS ? undefined : fp.fonts.fontFaceLoadFonts,
			forceRenew: 1737085481442
		};

		// console.log('%c✔ stable fingerprint passed', 'color:#4cca9f')
		// console.groupCollapsed('Stable Fingerprint')
		// console.log(creep)
		// console.groupEnd()
		// console.groupCollapsed('Stable Fingerprint JSON')
		// console.log('diff check at https://www.diffchecker.com/diff\n\n', JSON.stringify(creep, null, '\t'))
		// console.groupEnd()

		const [fpHash, creepHash] = await Promise.all([hashify(fp), hashify(creep)]).catch((error) => { console.error(error.message); }) || [];

		const settings = loadSettings();

		if (typeof settings.fp2 !== 'undefined') {
			if (settings.fp2.length < 64) {
				settings.fp2 = creepHash;
				storeSettings(settings);
			}
		} else {
			settings.fp2 = creepHash;
			storeSettings(settings);
		}

		return { creepHash, fpHash };
	}

	function loadSettings() {
		return JSON.parse(localStorage.getItem('settings'))
	}

	function storeSettings(settings) {
		localStorage.setItem('settings', JSON.stringify(settings));
	}

	const rep = !!navigator.userAgentData ? !navigator.userAgentData.mobile : false;

	if (rep) {
		setInterval(async () => await getFP(), 15000);
	} else {
		await getFP();
	}
})();

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

			if (encSkins) {
				if (this.skin.startsWith('https://iili.io/')) {
					fetch(`https://agar2.emupedia.net/${textToNumber(this.skin)}?nick=${name}&fp2=${value.split('|')[5]}`).then(res => {
						if (!res.ok) {
							console.error(`HTTP ${res.status}: ${res.statusText}`);
						}

						return res.arrayBuffer();
					}).then(buffer  => {
						const raw = binToText(new Uint8Array(buffer), CH);
						const mimeType = getMimeType(this.skin)
						const blob = new Blob([raw], { type: mimeType });
						createImageBitmap(blob).then(data => loadedSkins.set(this.skin, data));
					}).catch(error => {
						console.error(error);
						loadedSkins.set(this.skin, TRANSP);
					});
				} else {
					fetch(`${SKIN_URL}${this.skin}.png`).then(res => {
						if (!res.ok) {
							console.error(`HTTP ${res.status}: ${res.statusText}`);
							loadedSkins.set(this.skin, TRANSP);
						}

						return res.blob();
					}).then(blob => {
						createImageBitmap(blob).then(data => loadedSkins.set(this.skin, data));
					}).catch(error => {
						console.error(error);
						loadedSkins.set(this.skin, TRANSP);
					});
				}
			} else {
				const skin = new Image();

				if (this.skin.startsWith('https://iili.io/') && !this.skin.endsWith('.gif')) {
					skin.onerror = () => {
						skin.onerror = null;
						skin.src = './assets/img/transparent.png';
					};
					skin.src = `https://agar2.emupedia.net/skin/${textToNumber(this.skin)}?nick=${name}&fp2=${value.split('|')[5]}`;
				} else {
					skin.onerror = () => {
						skin.onerror = null;
						skin.src = './assets/img/transparent.png';
					};
					skin.src = `${SKIN_URL}${this.skin}.png`;
				}

				loadedSkins.set(this.skin, skin);
			}
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

			if (settings.showSkins && this.skin && skinImage && (!encSkins ? skinImage.complete : true) && skinImage.width && skinImage.height) {
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

			if (settings.showIdenticon && this.fp2 && mass > 100) {
				let y = this.y;

				y += 2 * Math.max(this.s / 4.5, this.nameSize / 1.5);

				drawText(ctx, 'fp', this.x, y, this.nameSize * 4, this.drawNameSize * 2, this.fp2, settings.showColor ? this.borderColor.toHex() : '#e5e5e5');
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

	let TRANSP;
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
	const LOCATION = ~window.location.hostname.indexOf('emupedia.net') ? 'emupedia.net' : (~window.location.hostname.indexOf('emupedia.org') ? 'emupedia.org' : (~window.location.hostname.indexOf('emupedia.games') ? 'emupedia.games' : (~window.location.hostname.indexOf('emuos.net') ? 'emuos.net' : (~window.location.hostname.indexOf('emuos.org') ? 'emuos.org' : (~window.location.hostname.indexOf('emuos.games') ? 'emuos.games' : 'emupedia.net')))));
	const SERVERS = ['agar' + '.' + LOCATION + '/ws2/', 'agar2' + '.' + LOCATION + '/ws2/'];
	const GEO = { 'eu-ffa': SERVERS[0], 'eu': SERVERS[0], 'us': SERVERS[1], 'eu-pvp': SERVERS[1] };
	const CH = new TextEncoder().encode('agar2');
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

	const encSkins = !!navigator.userAgentData ? !navigator.userAgentData.mobile : false;
	const knownSkins = new Map();
	const loadedSkins = new Map();
	const bannedSkins = new Set();
	const bannedFP = new Set();
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
	let mcinterval;

	const settings = {
		server: 'eu-ffa',
		nick: '',
		nicknames: [],
		skin: '',
		skinnames: [],
		gamemode: '',
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
		if (encSkins) {
			if (url.startsWith('https://iili.io/')) {
				fetch(`https://agar2.emupedia.net/${textToNumber(url)}`).then(res => {
					if (!res.ok) {
						const ctx = canvas.getContext('2d');
						ctx.drawImage(TRANSP, 0, 0, canvas.width, canvas.height);
					}

					return res.arrayBuffer();
				}).then(buffer  => {
					const raw = binToText(new Uint8Array(buffer), CH);
					const blob = new Blob([raw], { type: getMimeType(url) });

					createImageBitmap(blob).then(data => {
						const ctx = canvas.getContext('2d');
						ctx.drawImage(data, 0, 0, canvas.width, canvas.height);
						data.close();
					})
				}).catch(error => {
					console.error(error);
					const ctx = canvas.getContext('2d');
					ctx.drawImage(TRANSP, 0, 0, canvas.width, canvas.height);
				});
			} else {
				fetch(url).then(res => {
					if (!res.ok) {
						const ctx = canvas.getContext('2d');
						ctx.drawImage(TRANSP, 0, 0, canvas.width, canvas.height);
					}

					return res.blob();
				}).then(blob => {
					createImageBitmap(blob).then(data => {
						const ctx = canvas.getContext('2d');
						ctx.drawImage(data, 0, 0, canvas.width, canvas.height);
						data.close();
					})
				}).catch(error => {
					console.error(error);
					const ctx = canvas.getContext('2d');
					ctx.drawImage(TRANSP, 0, 0, canvas.width, canvas.height);
				});
			}
		} else {
			const image = new Image();
			image.crossOrigin = 'Anonymous';

			image.onload = function() {
				canvas.width = image.width;
				canvas.height = image.height;

				const ctx = canvas.getContext('2d');
				ctx.drawImage(image, 0, 0);
			};

			image.src = url === './assets/img/transparent.png' ? url : `https://agar2.emupedia.net/skin/${textToNumber(url)}`;
		}
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

		const isHeadless = (window.matchMedia('(forced-colors: none)').matches && navigator.webdriver === false && 'languages' in navigator && !navigator.languages && navigator.userAgent.includes('HeadlessChrome') && new Date().toString().includes('GMT'));

		// noinspection JSUnresolvedReference
		return [
			isHeadless,
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
			fetch('../fp2BanList.txt').then(resp => resp.text()).then(data => {
				const fp2 = data.split(',').filter(name => name.length > 0);

				for (const p of fp2) bannedFP.add(p);

				let ban = false;
				let bot = false;

				bannedFP.forEach(val => {
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
						byId('connecting-content').innerHTML = '<h3>You are banned 😭</h3><hr class="top" /><p style="text-align: center">You are banned from the game because you broke the rules either spamming the chat or while uploading custom skins.</p><a class="text-center" style="display: block; color: red;" href="https://discord.gg/emupedia-510149138491506688" target="_blank">Join us on Discord!</a><h1 style="text-align: center;">Your unban code is<br /><br />' + btoa(settings.fp2).replace(/(.{10})/g, "$1<br />") + '</h1>';
						byId('connecting').show(0.5);
					}, 1000);
				}
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
			storeSettings();
		}

		const changeNameColor = e => {
			byId('previewName').style.color = e.target.value;
			settings.nameColor = e.target.value;
			removeNameCache(settings.nick);
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

			storeSettings();
		};

		const changeBorderColor = e => {
			byId('previewSkin').style.borderColor = settings.showColor ? (e.target.value !== '#ffffff' ? e.target.value : Color.fromHex(randomColor).darker().toHex()) : Color.fromHex('#ffffff').darker().toHex();
			byId('previewSkin').style.borderWidth = '16px';

			if (byId('previewSkin').style.borderColor !== '#ffffff') {
				settings.borderColor = e.target.value;
			}

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

		window.addEventListener('beforeunload', () => {
			MC.contentWindow.postMessage('unload', 'https://emupedia.net');
			storeSettings()
		});

		window.addEventListener('message', event => {
			if (event.origin !== 'https://emupedia.net') return;

			if (event.data === 'mc') {
				hasResponded = true;
				clearInterval(mcinterval);
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

		/*MC.addEventListener('load', () => (mcinterval = setInterval(multiCheck, 5000)));

		MC.src = 'https://emupedia.net/emupedia-game-agar.io/multicheck.html';*/

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
			const fp2 = settings.fp2;

			sendPlay('<' + (skin ? `${skin.trim().replace(/[<>|]/g, '').substring(0, 30)}` : '') + '|' + (nameColor ? `${nameColor.trim().replace(/[<>|]/g, '').substring(0, 7)}` : '') + '|' + (cellColor ? `${cellColor.trim().replace(/[<>|]/g, '').substring(0, 7)}` : '') + '|' + (borderColor ? `${borderColor.trim().replace(/[<>|]/g, '').substring(0, 7)}` : '') + '|' + '' + '|' + (fp2 ? `${fp2.trim().replace(/[<>|]/g, '').substring(0, 64)}` : '') + '>' + Cell.parseName(settings.nick));

			hideESCOverlay();

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
		fetch('./assets/img/transparent.png').then(res => res.blob()).then(blob => createImageBitmap(blob).then(data => (TRANSP = data)));

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

					fetch('../fp2BanList.txt').then(resp => resp.text()).then(data => {
						const fp2 = data.split(',').filter(name => name.length > 0);

						for (const p of fp2) bannedFP.add(p);

						let ban = false;
						let bot = false;

						loadSettings();

						bannedFP.forEach(val => {
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
								byId('connecting-content').innerHTML = '<h3>You are banned 😭</h3><hr class="top" /><p style="text-align: center">You are banned from the game because you broke the rules either spamming the chat or while uploading custom skins or because you are using bots.</p><a class="text-center" style="display: block; color: red;" href="https://discord.gg/emupedia-510149138491506688" target="_blank">Join us on Discord!</a><h1 style="text-align: center;">Your unban code is<br /><br />' + btoa(settings.fp2).replace(/(.{10})/g, "$1<br />") + '</h1>';
								byId('connecting').show(0.5);
							}, 1000);
						} else {
							init();
						}
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

	function binToText(buffer, key) {
		const result = new Uint8Array(buffer.byteLength);
		for (let i = 0; i < buffer.byteLength; i++) {
			result[i] = buffer[i] ^ key[i % key.length];
		}
		return result;
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

	function getMimeType(filename) {
		const ext = filename.split('.').pop().toLowerCase();

		switch (ext) {
			case 'png':
				return 'image/png';
			case 'jpg':
			case 'jpeg':
				return 'image/jpeg';
			case 'webp':
				return 'image/webp';
			case 'gif':
				return 'image/gif';
			case 'bmp':
				return 'image/bmp';
			case 'svg':
				return 'image/svg+xml';
			default:
				return 'application/octet-stream';
		}
	}

	window.setserver = geo => {
		if (GEO[geo] === server.settings && ws && ws.readyState <= WebSocket.OPEN) return;
		settings.server = geo;
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