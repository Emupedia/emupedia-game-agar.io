/* global window, Translator, LanguageDetector */
/**
 * In-browser chat translation via Chrome Translator + Language Detector APIs.
 * @see https://developer.chrome.com/docs/ai/translator-api
 * @see https://developer.mozilla.org/en-US/docs/Web/API/LanguageDetector
 */
(function () {
	'use strict';

	/** Languages supported by Chrome's on-device Translator (BCP 47 base codes). */
	const CHROME_LANGS = new Set([
		'ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'hi', 'hr', 'hu', 'id', 'it',
		'iw', 'ja', 'kn', 'ko', 'lt', 'mr', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'ta',
		'te', 'th', 'tr', 'uk', 'vi', 'zh'
	]);

	const LOCALE_MAP = {
		'pt-BR': 'pt',
		'pt-PT': 'pt',
		'nn': 'no',
		'nb': 'no',
		'sr-Latn': 'hr',
		'mk-Latn': 'bg',
		'bg-Latn': 'bg',
		'ru-Latn': 'ru',
		'ka-Latn': 'en',
		'bs': 'hr',
		'mk': 'bg',
		'sr': 'hr',
		'ka': null,
		'mt': 'en',
		'et': 'en',
		'lv': 'en'
	};

	const DETECTOR_HINT_LANGS = [
		'en', 'es', 'de', 'fr', 'pt', 'ru', 'tr', 'pl', 'it', 'nl', 'uk', 'ar', 'zh', 'ja', 'ko',
		'hi', 'cs', 'sv', 'da', 'no', 'fi', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'el', 'th', 'vi', 'id'
	];

	const WARMUP_TRANSLATOR_SOURCES = ['en', 'es', 'de', 'fr', 'ru', 'tr', 'pl', 'uk', 'ar', 'pt'];

	const cache = new Map();
	const queue = [];
	let processing = false;
	let debugBootLogged = false;
	let translator = null;
	let activePair = null;
	let detector = null;
	let detectorReady = null;
	let detectorTargetLocale = null;
	let modelsPrimed = false;
	let needsUserGesture = false;
	let warmedLocale = null;
	let warmUpInProgress = null;
	let warmUpActive = false;

	function isLocalDebug() {
		const h = (location.hostname || '').toLowerCase();
		return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
	}

	function truncateForLog(text, max) {
		const s = String(text || '');
		const limit = max || 120;
		if (s.length <= limit) return s;
		return s.slice(0, limit) + '…';
	}

	function debugLog(label, detail) {
		if (!isLocalDebug()) return;
		if (detail !== undefined) {
			console.log(`[ChatTranslate] ${label}`, detail);
		} else {
			console.log(`[ChatTranslate] ${label}`);
		}
	}

	function debugSkip(reason, detail) {
		debugLog(`not started — ${reason}`, detail);
	}

	function logBootStatus() {
		if (!isLocalDebug() || debugBootLogged) return;
		debugBootLogged = true;
		debugLog('localhost debug enabled', {
			hostname: location.hostname,
			translatorApi: typeof Translator !== 'undefined',
			languageDetectorApi: typeof LanguageDetector !== 'undefined',
			ready: isSupported()
		});
	}

	function isGestureRequiredError(err) {
		if (!err) return false;
		if (err.name === 'NotAllowedError') return true;
		return /user gesture/i.test(String(err.message || ''));
	}

	function notifyState() {
		window.dispatchEvent(new CustomEvent('chattranslate:state', {
			detail: { needsUserGesture, modelsPrimed, warmedLocale }
		}));
	}

	function monitorDownloadProgress(label) {
		return function (m) {
			if (!m || typeof m.addEventListener !== 'function') return;
			m.addEventListener('downloadprogress', e => {
				debugLog(`${label} download progress`, { loaded: e.loaded });
			});
		};
	}

	function needsDownload(availability) {
		return availability === 'downloadable' || availability === 'downloading';
	}

	function isDetectorSupported() {
		return typeof LanguageDetector !== 'undefined';
	}

	function isSupported() {
		return typeof Translator !== 'undefined' && isDetectorSupported();
	}

	function isPrimed() {
		return modelsPrimed;
	}

	function needsGesture() {
		return needsUserGesture;
	}

	function toTranslatorLang(localeCode) {
		if (!localeCode || localeCode === 'en') return 'en';
		if (Object.hasOwnProperty.call(LOCALE_MAP, localeCode)) {
			const mapped = LOCALE_MAP[localeCode];
			return mapped && CHROME_LANGS.has(mapped) ? mapped : null;
		}
		const base = localeCode.split('-')[0];
		return CHROME_LANGS.has(base) ? base : null;
	}

	function isAvailableForLocale(localeCode) {
		return isSupported() && toTranslatorLang(localeCode) !== null;
	}

	function normalizeLangCode(tag) {
		if (!tag || typeof tag !== 'string') return null;
		const lower = tag.toLowerCase().replace(/_/g, '-');
		if (lower.startsWith('zh-hant') || lower.startsWith('zh-tw')) return 'zh';
		const base = lower.split('-')[0];
		if (base === 'he') return 'iw';
		if (CHROME_LANGS.has(base)) return base;
		return null;
	}

	function buildExpectedInputLanguages(targetLang) {
		const langs = new Set(DETECTOR_HINT_LANGS);
		if (targetLang) langs.add(targetLang);
		return [...langs];
	}

	function cacheKey(source, target, text) {
		return `${source}|${target}|${text}`;
	}

	function destroyDetector() {
		if (detector && typeof detector.destroy === 'function') {
			try {
				detector.destroy();
			} catch (_) { /* ignore */ }
		}
		detector = null;
		detectorReady = null;
		detectorTargetLocale = null;
	}

	function handleGestureBlock(context) {
		needsUserGesture = true;
		modelsPrimed = false;
		notifyState();
		debugSkip('on-device models must be downloaded during a click', {
			hint: 'Enable Translate chat, press Play, or click the download prompt',
			context
		});
	}

	async function createDetectorInstance(targetLocale) {
		const targetLang = toTranslatorLang(targetLocale) || 'en';
		const expectedInputLanguages = buildExpectedInputLanguages(targetLang);
		const availability = await LanguageDetector.availability({ expectedInputLanguages });
		debugLog('LanguageDetector.availability', { availability, targetLang, expectedInputLanguages });

		if (availability === 'unavailable') return null;
		if (needsDownload(availability) && !modelsPrimed && !warmUpActive) {
			handleGestureBlock('LanguageDetector.create');
			return null;
		}

		const det = await LanguageDetector.create({
			expectedInputLanguages,
			monitor: monitorDownloadProgress('LanguageDetector')
		});
		detector = det;
		detectorTargetLocale = targetLang;
		debugLog('LanguageDetector ready', { targetLang });
		return det;
	}

	async function ensureDetector(targetLocale) {
		logBootStatus();
		if (!isDetectorSupported()) {
			debugLog('LanguageDetector unavailable');
			return null;
		}

		const targetLang = toTranslatorLang(targetLocale) || 'en';
		if (detector && detectorTargetLocale === targetLang) return detector;

		destroyDetector();

		try {
			detectorReady = createDetectorInstance(targetLocale);
			return await detectorReady;
		} catch (err) {
			if (isGestureRequiredError(err)) {
				handleGestureBlock('LanguageDetector.create');
				return null;
			}
			debugLog('LanguageDetector.create failed', err);
			return null;
		}
	}

	async function createTranslatorInstance(source, target) {
		const availability = await Translator.availability({
			sourceLanguage: source,
			targetLanguage: target
		});
		debugLog('Translator.availability', { source, target, availability });

		if (availability === 'unavailable') return null;
		if (needsDownload(availability) && !modelsPrimed && !warmUpActive) {
			handleGestureBlock(`Translator.create ${source}->${target}`);
			return null;
		}

		return Translator.create({
			sourceLanguage: source,
			targetLanguage: target,
			monitor: monitorDownloadProgress(`Translator ${source}->${target}`)
		});
	}

	async function ensureTranslator(source, target) {
		const pair = `${source}:${target}`;
		if (translator && activePair === pair) return translator;
		if (source === target) return null;

		try {
			translator = await createTranslatorInstance(source, target);
			if (translator) activePair = pair;
			return translator;
		} catch (err) {
			if (isGestureRequiredError(err)) {
				handleGestureBlock(`Translator.create ${source}->${target}`);
				return null;
			}
			debugLog('Translator.create failed', { source, target, err });
			return null;
		}
	}

	/**
	 * Download on-device models. Must run inside a user gesture (click Play, toggle setting).
	 */
	async function warmUp(targetLocale) {
		if (!isSupported()) return false;
		if (modelsPrimed && warmedLocale === targetLocale && !needsUserGesture) {
			return true;
		}
		if (warmUpInProgress) return warmUpInProgress;

		warmUpInProgress = (async () => {
			const target = toTranslatorLang(targetLocale);
			if (!target) return false;

			debugLog('warmUp started (user gesture)', { uiLocale: targetLocale, targetLang: target });
			needsUserGesture = false;
			warmUpActive = true;
			notifyState();

			try {
				destroyDetector();
				translator = null;
				activePair = null;

				const det = await createDetectorInstance(targetLocale);
				if (!det) return false;

				for (let i = 0; i < WARMUP_TRANSLATOR_SOURCES.length; i++) {
					const source = WARMUP_TRANSLATOR_SOURCES[i];
					if (source === target) continue;

					try {
						const avail = await Translator.availability({
							sourceLanguage: source,
							targetLanguage: target
						});
						if (avail === 'unavailable' || avail === 'available') continue;

						debugLog('warmUp downloading translator pair', { source, target, availability: avail });
						const tr = await createTranslatorInstance(source, target);
						if (tr && source === 'en') {
							translator = tr;
							activePair = `${source}:${target}`;
						}
					} catch (err) {
						if (isGestureRequiredError(err)) {
							handleGestureBlock(`warmUp ${source}->${target}`);
							return false;
						}
						debugLog('warmUp pair failed', { source, target, err });
					}
				}

				modelsPrimed = true;
				warmedLocale = targetLocale;
				needsUserGesture = false;
				notifyState();
				debugLog('warmUp complete', { targetLocale, targetLang: target });
				return true;
			} catch (err) {
				if (isGestureRequiredError(err)) {
					handleGestureBlock('warmUp');
					return false;
				}
				debugLog('warmUp failed', err);
				return false;
			}
		})();

		try {
			return await warmUpInProgress;
		} finally {
			warmUpInProgress = null;
			warmUpActive = false;
		}
	}

	async function detectSourceLanguage(text, targetLocale) {
		const trimmed = (text || '').trim();
		const target = toTranslatorLang(targetLocale);
		if (!trimmed || !target) {
			debugLog('detect skipped', { reason: !trimmed ? 'empty text' : 'unsupported UI locale', targetLocale, target });
			return null;
		}

		if (needsUserGesture) return null;

		const det = await ensureDetector(targetLocale);
		if (!det) return null;

		let results;
		try {
			results = await det.detect(trimmed);
		} catch (err) {
			debugLog('detect() failed', { error: err, text: truncateForLog(trimmed) });
			return null;
		}

		if (!results || !results.length) {
			debugLog('detect() returned no languages', { text: truncateForLog(trimmed) });
			return null;
		}

		const ranked = [...results].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

		debugLog('detect() results', {
			text: truncateForLog(trimmed),
			uiLocale: targetLocale,
			targetLang: target,
			candidates: ranked.map(r => ({
				tag: r.detectedLanguage,
				normalized: normalizeLangCode(r.detectedLanguage),
				confidence: r.confidence
			}))
		});

		for (let i = 0; i < ranked.length; i++) {
			const source = normalizeLangCode(ranked[i].detectedLanguage);
			if (!source || source === target) continue;

			try {
				const pairAvail = await Translator.availability({
					sourceLanguage: source,
					targetLanguage: target
				});
				debugLog('Translator.availability', { source, target, availability: pairAvail });
				if (pairAvail === 'unavailable') continue;
			} catch (err) {
				debugLog('Translator.availability failed', { source, target, error: err });
				continue;
			}

			debugLog('detected source language', { source, target, pickedFrom: ranked[i].detectedLanguage, confidence: ranked[i].confidence });
			return source;
		}

		debugLog('no usable source language', { target, text: truncateForLog(trimmed) });
		return null;
	}

	async function translate(text, targetLocale) {
		const trimmed = (text || '').trim();
		if (!trimmed || !isSupported() || needsUserGesture) return null;

		const target = toTranslatorLang(targetLocale);
		if (!target) return null;

		const source = await detectSourceLanguage(trimmed, targetLocale);
		if (!source) return null;

		const key = cacheKey(source, target, trimmed);
		if (cache.has(key)) return cache.get(key);

		const tr = await ensureTranslator(source, target);
		if (!tr) return null;

		const out = await tr.translate(trimmed);
		if (out && out !== trimmed) cache.set(key, out);
		return out && out !== trimmed ? out : null;
	}

	function clearTranslationCache() {
		cache.clear();
		translator = null;
		activePair = null;
	}

	function clearCache() {
		clearTranslationCache();
		destroyDetector();
		modelsPrimed = false;
		needsUserGesture = false;
		warmedLocale = null;
		notifyState();
	}

	function resetForLocale(targetLocale) {
		clearTranslationCache();
		destroyDetector();
		if (warmedLocale !== targetLocale) {
			modelsPrimed = false;
		}
		notifyState();
	}

	function queueMessage(msg, targetLocale, onDone) {
		logBootStatus();
		if (!msg || !trimmedMessage(msg)) {
			if (onDone) onDone();
			return;
		}
		if (needsUserGesture) {
			debugSkip('models not downloaded yet — click Play or toggle Translate chat first');
			if (onDone) onDone();
			return;
		}
		debugLog('queued message', {
			uiLocale: targetLocale,
			targetLang: toTranslatorLang(targetLocale),
			from: msg.name,
			text: truncateForLog(msg.message),
			queueLength: queue.length + 1
		});
		queue.push({ msg, targetLocale, onDone });
		processQueue();
	}

	function trimmedMessage(msg) {
		return (msg.message || '').trim();
	}

	async function processQueue() {
		if (processing || !queue.length) return;
		if (needsUserGesture) return;
		processing = true;
		debugLog('processing queue started', { pending: queue.length });

		while (queue.length) {
			const { msg, targetLocale, onDone } = queue.shift();
			msg.translationPending = true;
			msg.detectedLanguage = null;
			msg.messageTranslated = null;

			const trimmed = trimmedMessage(msg);
			debugLog('translating message', {
				from: msg.name,
				text: truncateForLog(trimmed),
				uiLocale: targetLocale
			});

			try {
				const source = await detectSourceLanguage(trimmed, targetLocale);
				msg.detectedLanguage = source;

				if (source) {
					const target = toTranslatorLang(targetLocale);
					const key = cacheKey(source, target, trimmed);
					let translated = cache.get(key);

					if (translated !== undefined) {
						debugLog('cache hit', { source, target, text: truncateForLog(trimmed) });
					} else {
						debugLog('calling Translator.translate', { source, target, text: truncateForLog(trimmed) });
						const tr = await ensureTranslator(source, target);
						if (tr) {
							translated = await tr.translate(trimmed);
							if (translated && translated !== trimmed) {
								cache.set(key, translated);
							} else {
								translated = null;
							}
						} else {
							translated = null;
						}
					}

					msg.messageTranslated = translated && translated !== trimmed ? translated : null;

					if (msg.messageTranslated) {
						debugLog('translation done', {
							source,
							target,
							original: truncateForLog(trimmed),
							translated: truncateForLog(msg.messageTranslated)
						});
					} else {
						debugLog('translation produced no output', {
							source,
							target,
							text: truncateForLog(trimmed),
							reason: translated === trimmed ? 'same as original' : 'translator returned empty'
						});
					}
				} else {
					debugLog('translation skipped', {
						reason: 'could not detect a translatable source language',
						text: truncateForLog(trimmed),
						uiLocale: targetLocale
					});
				}
			} catch (err) {
				if (isGestureRequiredError(err)) {
					handleGestureBlock('processQueue');
				} else {
					console.warn('ChatTranslate:', err);
					debugLog('translation error', err);
				}
				msg.messageTranslated = null;
				msg.detectedLanguage = null;
			}

			msg.translationPending = false;
			if (onDone) onDone();
		}

		processing = false;
		debugLog('processing queue finished');
	}

	function retranslateAll(messages, targetLocale, onDone) {
		logBootStatus();
		if (!isSupported() || !messages || !messages.length) {
			debugSkip('API not ready or no messages', {
				supported: isSupported(),
				messageCount: messages ? messages.length : 0
			});
			if (onDone) onDone();
			return;
		}
		if (needsUserGesture) {
			debugSkip('models not downloaded yet — click Play or toggle Translate chat first');
			if (onDone) onDone();
			return;
		}
		debugLog('retranslate all', { count: messages.length, uiLocale: targetLocale });
		resetForLocale(targetLocale);
		let pending = 0;
		let done = false;

		const finish = () => {
			if (done) return;
			done = true;
			if (onDone) onDone();
		};

		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i];
			msg.messageTranslated = null;
			msg.detectedLanguage = null;
			msg.translationPending = false;
			if (!trimmedMessage(msg)) continue;
			pending++;
			queueMessage(msg, targetLocale, () => {
				pending--;
				if (pending <= 0) finish();
			});
		}

		if (pending === 0) finish();
	}

	window.ChatTranslate = {
		isSupported,
		isDetectorSupported,
		isAvailableForLocale,
		isPrimed,
		needsGesture,
		isLocalDebug,
		debugLog,
		debugSkip,
		warmUp,
		toTranslatorLang,
		detectSourceLanguage,
		translate,
		queueMessage,
		retranslateAll,
		clearCache,
		resetForLocale
	};

	logBootStatus();
})();
