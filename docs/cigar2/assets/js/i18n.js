/* global window, document, navigator, fetch */
(function () {
	'use strict';

	const LOCALES_PATH = 'assets/locales/';
	const FALLBACK = 'en';

	const SUPPORTED_LOCALES = [
		{ code: 'en', name: 'English' },
		{ code: 'es', name: 'Español' },
		{ code: 'tr', name: 'Türkçe' },
		{ code: 'cs', name: 'Čeština' },
		{ code: 'bs', name: 'Bosanski' },
		{ code: 'sr', name: 'Српски (ћирилица)' },
		{ code: 'sr-Latn', name: 'Srpski (latinica)' },
		{ code: 'hr', name: 'Hrvatski' },
		{ code: 'mk', name: 'Македонски (кирилица)' },
		{ code: 'mk-Latn', name: 'Makedonski (Latin)' },
		{ code: 'sl', name: 'Slovenščina' },
		{ code: 'ro', name: 'Română' },
		{ code: 'it', name: 'Italiano' },
		{ code: 'fr', name: 'Français' },
		{ code: 'pt-BR', name: 'Português (Brasil)' },
		{ code: 'pt-PT', name: 'Português (Portugal)' },
		{ code: 'nl', name: 'Nederlands' },
		{ code: 'de', name: 'Deutsch' },
		{ code: 'sv', name: 'Svenska' },
		{ code: 'da', name: 'Dansk' },
		{ code: 'nb', name: 'Norsk bokmål' },
		{ code: 'nn', name: 'Norsk nynorsk' },
		{ code: 'hu', name: 'Magyar' },
		{ code: 'fi', name: 'Suomi' },
		{ code: 'et', name: 'Eesti' },
		{ code: 'pl', name: 'Polski' },
		{ code: 'lv', name: 'Latviešu' },
		{ code: 'lt', name: 'Lietuvių' },
		{ code: 'mt', name: 'Malti' },
		{ code: 'sk', name: 'Slovenčina' },
		{ code: 'bg', name: 'Български (кирилица)' },
		{ code: 'bg-Latn', name: 'Bulgarski (Latin)' },
		{ code: 'el', name: 'Ελληνικά' },
		{ code: 'ka', name: 'ქართული (მხედრული)' },
		{ code: 'ka-Latn', name: 'Kartuli (Latin)' },
		{ code: 'ru', name: 'Русский (кирилица)' },
		{ code: 'ru-Latn', name: 'Russkiy (Latin)' },
		{ code: 'uk', name: 'Українська' }
	];

	const cache = {};
	let strings = {};
	let fallbackStrings = {};
	let locale = FALLBACK;
	let ready = false;

	function getByPath(obj, path) {
		const parts = path.split('.');
		let cur = obj;
		for (let i = 0; i < parts.length; i++) {
			if (cur == null || typeof cur !== 'object') return undefined;
			cur = cur[parts[i]];
		}
		return cur;
	}

	function interpolate(text, params) {
		if (!params || typeof text !== 'string') return text;
		return text.replace(/\{(\w+)\}/g, (_, key) => (params[key] != null ? String(params[key]) : `{${key}}`));
	}

	function findLocaleCode(code) {
		return SUPPORTED_LOCALES.some(l => l.code === code) ? code : null;
	}

	function matchBrowserLanguage(tag) {
		const raw = (tag || '').toLowerCase().trim();
		if (!raw) return null;

		const parts = raw.split('-');
		const base = parts[0];
		const hasScript = parts.includes('latn') || parts.includes('cyrl');
		const region = parts.length > 1 ? parts[parts.length - 1] : '';

		// Exact BCP 47 match (ka-latn, pt-br, sr-latn)
		const exact = SUPPORTED_LOCALES.find(l => l.code.toLowerCase() === raw);
		if (exact) return exact.code;

		if (base === 'ka') {
			if (hasScript && parts.includes('latn')) return findLocaleCode('ka-Latn');
			return findLocaleCode('ka');
		}

		if (base === 'sr') {
			if (hasScript && parts.includes('latn')) return findLocaleCode('sr-Latn');
			return findLocaleCode('sr');
		}

		if (base === 'mk') {
			if (hasScript && parts.includes('latn')) return findLocaleCode('mk-Latn');
			return findLocaleCode('mk');
		}

		if (base === 'bg') {
			if (hasScript && parts.includes('latn')) return findLocaleCode('bg-Latn');
			return findLocaleCode('bg');
		}

		if (base === 'ru') {
			if (hasScript && parts.includes('latn')) return findLocaleCode('ru-Latn');
			return findLocaleCode('ru');
		}

		if (base === 'uk') return findLocaleCode('uk');

		if (base === 'pt') {
			if (region === 'pt' || raw === 'pt-pt') return findLocaleCode('pt-PT');
			return findLocaleCode('pt-BR');
		}

		if (base === 'no' || base === 'nb') return findLocaleCode('nb');
		if (base === 'nn') return findLocaleCode('nn');

		const hit = SUPPORTED_LOCALES.find(l => l.code === base);
		return hit ? hit.code : null;
	}

	function detectDefaultLocale() {
		const langs = navigator.languages && navigator.languages.length
			? navigator.languages
			: [navigator.language || FALLBACK];

		for (let i = 0; i < langs.length; i++) {
			const code = matchBrowserLanguage(langs[i]);
			if (code) return code;
		}

		return FALLBACK;
	}

	async function fetchLocale(code) {
		if (cache[code]) return cache[code];
		const fileCode = code === 'pt' ? 'pt-BR' : code;
		const res = await fetch(`${LOCALES_PATH}${fileCode}.json`, { cache: 'default' });
		if (!res.ok) throw new Error(`Locale ${code} not found`);
		const data = await res.json();
		cache[code] = data;
		return data;
	}

	async function loadLocale(code, force) {
		const next = SUPPORTED_LOCALES.some(l => l.code === code) ? code : FALLBACK;
		if (!force && ready && locale === next && Object.keys(strings).length) return next;

		locale = next;
		strings = await fetchLocale(next);

		if (next !== FALLBACK) {
			try {
				fallbackStrings = await fetchLocale(FALLBACK);
			} catch (_) {
				fallbackStrings = {};
			}
		} else {
			fallbackStrings = strings;
		}

		ready = true;
		return next;
	}

	function t(key, params) {
		let val = getByPath(strings, key);
		if (val == null) val = getByPath(fallbackStrings, key);
		if (typeof val !== 'string') return key;
		return interpolate(val, params);
	}

	function applyDataAttributes(root) {
		const scope = root || document;

		scope.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.getAttribute('data-i18n');
			if (!key) return;
			el.textContent = t(key);
		});

		scope.querySelectorAll('[data-i18n-html]').forEach(el => {
			const key = el.getAttribute('data-i18n-html');
			if (!key) return;
			el.innerHTML = t(key);
		});

		scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
			const key = el.getAttribute('data-i18n-placeholder');
			if (!key) return;
			el.placeholder = t(key);
		});

		scope.querySelectorAll('[data-i18n-title]').forEach(el => {
			const key = el.getAttribute('data-i18n-title');
			if (!key) return;
			el.title = t(key);
		});

		scope.querySelectorAll('option[data-i18n]').forEach(el => {
			const key = el.getAttribute('data-i18n');
			if (!key) return;
			el.textContent = t(key);
		});
	}

	function applyMeta() {
		document.title = t('meta.title');
		const desc = document.querySelector('meta[name="description"]');
		if (desc) desc.setAttribute('content', t('meta.description'));
		const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
		if (appTitle) appTitle.setAttribute('content', t('meta.title'));
		const ogTitle = document.querySelector('meta[property="og:title"]');
		if (ogTitle) ogTitle.setAttribute('content', t('meta.title'));
		const ogDesc = document.querySelector('meta[property="og:description"]');
		if (ogDesc) ogDesc.setAttribute('content', t('meta.description'));
	}

	function updateMouseActionSelects() {
		['mouseLeftAction', 'mouseMiddleAction', 'mouseRightAction'].forEach(id => {
			const sel = document.getElementById(id);
			if (!sel) return;
			sel.querySelectorAll('option').forEach(opt => {
				const v = opt.value;
				if (v === 'none') opt.textContent = t('mouseActions.none');
				else if (v === 'feed') opt.textContent = t('mouseActions.feed');
				else if (v === 'split') opt.textContent = t('mouseActions.split');
				else if (v === 'doubleSplit') opt.textContent = t('mouseActions.doubleSplit');
				else if (v === 'multiSplit') opt.textContent = t('mouseActions.multiSplit');
			});
		});
	}

	function renderGameplay() {
		const container = document.querySelector('#gameplay .text');
		if (!container) return;
		const g = strings.gameplay;
		if (!g) return;

		let html = '';
		if (g.controlsIntro) {
			html += `<p class="text-center">${g.controlsIntro}</p><hr />`;
		}
		const sections = ['objective', 'startingOut', 'movement', 'consumeSmaller', 'avoidLarger', 'splitting', 'ejectingMass', 'teamPlay', 'growDominate', 'viruses', 'beStrategic'];
		sections.forEach(key => {
			if (g[key]) html += g[key] + '<br /><br />';
		});
		if (g.closing) html += `<hr /><p class="text-center">${g.closing}</p><hr />`;
		if (g.goodLuck) html += `<h5 class="text-center">${g.goodLuck}</h5>`;
		container.innerHTML = html;
	}

	/** Locales that use DD.MM.YYYY in news (most of continental Europe). */
	const NEWS_DATE_DOT_LOCALES = new Set([
		'ro', 'de', 'pl', 'cs', 'sk', 'sl', 'hu', 'fi', 'et', 'lv', 'lt',
		'bg', 'bg-Latn', 'mk', 'mk-Latn', 'ru', 'ru-Latn', 'uk', 'ka', 'ka-Latn',
		'nb', 'nn', 'da', 'sv', 'tr', 'bs', 'hr', 'sr', 'sr-Latn'
	]);

	/** Locales that use M/D/Y in news (en.json stores dates in this order). */
	const NEWS_DATE_MDY_LOCALES = new Set(['en']);

	function parseNewsDateString(str, localeCode) {
		const m = (str || '').trim().match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
		if (!m) return null;

		const a = parseInt(m[1], 10);
		const b = parseInt(m[2], 10);
		const year = parseInt(m[3], 10);

		if (NEWS_DATE_MDY_LOCALES.has(localeCode)) {
			// M/D/Y (e.g. 05/21/2026, 06/13/2023)
			if (a > 12) {
				return { day: a, month: b, year };
			}
			return { month: a, day: b, year };
		}

		// US-style M/D/Y in source when day > 12 (e.g. 6/13/2023)
		if (a <= 12 && b > 12) {
			return { day: b, month: a, year };
		}

		// Default: European D/M/Y (e.g. 21/05/2026)
		return { day: a, month: b, year };
	}

	function formatNewsDate(dateStr, localeCode) {
		const parsed = parseNewsDateString(dateStr, localeCode);
		if (!parsed) return dateStr;

		const pad = n => (n < 10 ? '0' : '') + n;
		const sep = NEWS_DATE_DOT_LOCALES.has(localeCode) ? '.' : '/';
		if (NEWS_DATE_MDY_LOCALES.has(localeCode)) {
			return `${pad(parsed.month)}${sep}${pad(parsed.day)}${sep}${parsed.year}`;
		}
		return `${pad(parsed.day)}${sep}${pad(parsed.month)}${sep}${parsed.year}`;
	}

	function renderNews() {
		const container = document.querySelector('#news .text');
		if (!container || !strings.news || !strings.news.entries) return;

		let html = '';
		const entries = strings.news.entries;
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (i > 0) html += '<hr />';
			html += `<b>${formatNewsDate(entry.date, locale)}</b><ul>`;
			for (let j = 0; j < entry.items.length; j++) {
				html += `<li>${entry.items[j]}</li>`;
			}
			html += '</ul>';
		}
		container.innerHTML = html;
	}

	function populateLocaleSelect(selected) {
		const sel = document.getElementById('locale');
		if (!sel || sel.options.length > 1) return;
		sel.innerHTML = '';
		SUPPORTED_LOCALES.slice()
			.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
			.forEach(l => {
				const opt = document.createElement('option');
				opt.value = l.code;
				opt.textContent = l.name;
				if (l.code === selected) opt.selected = true;
				sel.appendChild(opt);
			});
	}

	function applyLocale() {
		document.documentElement.lang = locale;
		applyMeta();
		applyDataAttributes();
		updateMouseActionSelects();
		renderGameplay();
		renderNews();

		const rulesTitle = document.querySelector('#gameplay h2.title');
		if (rulesTitle && strings.gameplay) {
			const titles = document.querySelectorAll('#gameplay h2.title');
			if (titles[0] && strings.gameplay.rulesTitle) titles[0].textContent = strings.gameplay.rulesTitle;
			if (titles[1] && strings.gameplay.gameplayTitle) titles[1].textContent = strings.gameplay.gameplayTitle;
		}
		const newsTitle = document.querySelector('#news h2.title');
		if (newsTitle && strings.news && strings.news.title) newsTitle.textContent = strings.news.title;

		const rulePs = document.querySelectorAll('#gameplay > div > p');
		if (rulePs.length >= 2 && strings.gameplay) {
			if (strings.gameplay.rule1) rulePs[0].textContent = strings.gameplay.rule1;
			if (strings.gameplay.rule2) rulePs[1].textContent = strings.gameplay.rule2;
		}
	}

	function getSupportedLocales() {
		return SUPPORTED_LOCALES.slice();
	}

	function getLocale() {
		return locale;
	}

	function isReady() {
		return ready;
	}

	function connectingHtml(type, extra) {
		const discord = t('connecting.discord');
		const discordLink = 'https://discord.gg/emupedia-510149138491506688';
		switch (type) {
			case 'connecting':
				return `<h3>${t('connecting.trying')}</h3><hr class="top" /><a class="text-center" style="display: block; color: red;" href="${discordLink}" target="_blank">${discord}</a><p>${t('connecting.firewall')}</p>`;
			case 'multisession':
				return `<h3>${t('connecting.multisessionTitle')}</h3><hr class="top" /><p style="text-align: center">${t('connecting.multisessionBody')}</p>`;
			case 'oldBrowser':
				return `<h3>${t('connecting.oldBrowserTitle')}</h3><hr class="top" /><p style="text-align: center"><a href="https://www.whatismybrowser.com/" target="_blank">${t('connecting.oldBrowserLink')}</a></p>`;
			case 'banned':
				return `<h3>${t('connecting.bannedTitle')}</h3><hr class="top" /><p style="text-align: center">${t('connecting.bannedBody')}</p><a class="text-center" style="display: block; color: red;" href="${discordLink}" target="_blank">${discord}</a><h1 style="text-align: center;">${t('connecting.unbanCode')}<br /><br />${extra || ''}</h1>`;
			case 'bannedBots':
				return `<h3>${t('connecting.bannedTitle')}</h3><hr class="top" /><p style="text-align: center">${t('connecting.bannedBodyBots')}</p><a class="text-center" style="display: block; color: red;" href="${discordLink}" target="_blank">${discord}</a><h1 style="text-align: center;">${t('connecting.unbanCode')}<br /><br />${extra || ''}</h1>`;
			default:
				return '';
		}
	}

	window.I18n = {
		FALLBACK,
		SUPPORTED_LOCALES,
		loadLocale,
		t,
		applyLocale,
		applyMeta,
		renderGameplay,
		renderNews,
		populateLocaleSelect,
		detectDefaultLocale,
		getSupportedLocales,
		getLocale,
		isReady,
		connectingHtml
	};
})();
