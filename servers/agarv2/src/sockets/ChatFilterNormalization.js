'use strict';
/*
 * Data-driven chat-text normalization and filter matching.
 *
 * ALL character maps and tuning live in data/normalize.json (a single reusable dataset shared
 * with test/mangle.js) — there are no hardcoded confusable/font/leet tables here. The dataset's
 * `mapping` holds one category per obfuscation family (fonts, diacritics, fullwidth, small-caps,
 * cross-script homoglyphs, leetspeak, …), each mapping a decorated character to its ASCII base;
 * `options` carries the tuning (which categories are aggressive-only, combining ranges to strip,
 * and the length thresholds).
 */

const DATA = require('../../data/normalize.json');
const OPTIONS = DATA.options || {};
const AGGRESSIVE_ONLY = new Set(OPTIONS.aggressiveOnlyCategories || []);

// Merge the dataset categories into char->ascii fold maps. BASE excludes aggressive-only
// categories (e.g. leetspeak, so ordinary digits in chat aren't rewritten); FULL includes them
// and is used only for the aggressive obfuscation-proof signature.
function buildFold(includeAggressive) {
	const map = new Map();
	const mapping = DATA.mapping || {};

	for (const category in mapping) {
		if (!includeAggressive && AGGRESSIVE_ONLY.has(category)) continue;

		const table = mapping[category];

		for (const ch in table) {
			if (!map.has(ch)) map.set(ch, table[ch]);
		}
	}

	return map;
}

const BASE_FOLD = buildFold(false);
const AGGRESSIVE_FOLD = buildFold(true);

/**
 * @param {string} text
 * @param {Map<string, string>} foldMap
 */
function fold(text, foldMap) {
	let out = '';
	for (const ch of text) out += (foldMap.get(ch) || ch);
	return out;
}

function buildRangeRegex(ranges) {
	if (!ranges || !ranges.length) return null;
	const cls = ranges.map(function (r) { return '\\u' + r[0] + '-\\u' + r[1]; }).join('');
	return new RegExp('[' + cls + ']', 'g');
}

// Combining-mark / variation-selector strip (used inside normalization), from options.stripCodepointRanges.
const STRIP_RE = buildRangeRegex(OPTIONS.stripCodepointRanges);

// Control / bidi / zero-width / format characters, from options.stripInvisibleRanges. These
// corrupt logs and break name/skin/color rendering on clients (binary-name injection), so they
// are removed from ingested names/messages. Visible text and skin punctuation are untouched.
const INVISIBLE_RE = buildRangeRegex(OPTIONS.stripInvisibleRanges);

const SIGNATURE_MIN_LENGTH = OPTIONS.signatureMinLength || 3;
const MIN_NORMALIZED_PATTERN_LENGTH = OPTIONS.minPatternLength || 4;

// Fold -> Unicode NFKC/lowercase/NFD/strip-combining -> fold again (catches confusables that only
// surface after Unicode normalization). Both passes use the same data-driven map.
function canonicalize(text, foldMap) {
	let s = fold(String(text == null ? '' : text), foldMap)
		.normalize('NFKC')
		.toLowerCase()
		.normalize('NFD');

	if (STRIP_RE) s = s.replace(STRIP_RE, '');

	return fold(s, foldMap);
}

/**
 * Canonical space-separated form for token matching.
 * @param {string} text
 */
function normalizeChatFilterText(text) {
	return canonicalize(text, BASE_FOLD)
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/  +/g, ' ')
		.replace(/(.)\1{3,}/g, '$1')
		.trim();
}

/**
 * Aggressive compact signature: also folds leetspeak and strips ALL separators, so any decorated
 * variant of a phrase collapses to one string. Used for obfuscation-proof phrase matching.
 * @param {string} text
 */
function promoSignature(text) {
	return canonicalize(text, AGGRESSIVE_FOLD)
		.replace(/[^a-z0-9]+/g, '')
		.replace(/(.)\1{2,}/g, '$1$1');
}

/**
 * @param {string} pattern
 * @param {string} normalizedPattern
 */
function isUsableFilterPattern(pattern, normalizedPattern) {
	if (!normalizedPattern || normalizedPattern.length < MIN_NORMALIZED_PATTERN_LENGTH) {
		return false;
	}

	// Long homoglyph phrases that collapse to almost nothing cause false positives (e.g. -> "d").
	if (pattern.length >= 8 && normalizedPattern.length < Math.max(MIN_NORMALIZED_PATTERN_LENGTH, Math.ceil(pattern.length / 4))) {
		return false;
	}

	return true;
}

/**
 * Whole-token (word-boundary) match. Prevents a short pattern like "aren" matching inside "arent"
 * while still catching it as a standalone token or a consecutive token run.
 * @param {string} normalizedText
 * @param {string} normalizedPattern
 */
function containsTokenSequence(normalizedText, normalizedPattern) {
	if (!normalizedText || !normalizedPattern) {
		return false;
	}

	return (' ' + normalizedText + ' ').indexOf(' ' + normalizedPattern + ' ') !== -1;
}

/**
 * @param {string} text     chat message or player name
 * @param {string} pattern  a chatFilteredPhrases / chatForbiddenNames entry
 * @param {boolean} [aggressive]  when true (chatFilteredPhrases) also match the compact
 *   obfuscation-proof signature so any decorated variant of the pattern is caught.
 */
function containsChatFilterMatch(text, pattern, aggressive) {
	const normalizedPattern = normalizeChatFilterText(pattern);

	if (!isUsableFilterPattern(pattern, normalizedPattern)) {
		return false;
	}

	const normalizedText = normalizeChatFilterText(text);

	if (containsTokenSequence(normalizedText, normalizedPattern)) {
		return true;
	}

	if (aggressive) {
		const patternSignature = promoSignature(pattern);

		if (patternSignature.length >= SIGNATURE_MIN_LENGTH && promoSignature(text).indexOf(patternSignature) !== -1) {
			return true;
		}
	}

	return false;
}

/**
 * Longest run of consecutive non-whitespace code points. A "wall of text" (a long line with no
 * spaces) has a very large run; normal chat is broken up by spaces.
 * @param {string} text
 */
function longestUnbrokenRun(text) {
	const s = String(text == null ? '' : text);
	let max = 0, run = 0;

	for (const ch of s) {
		if (/\s/.test(ch)) { run = 0; }
		else { run++; if (run > max) max = run; }
	}

	return max;
}

/**
 * Structural chat-spam check (independent of content): flags overly long messages and spaceless
 * "wall of text" flooding. Returns a short reason string to reject, or null to allow. A threshold
 * of 0 disables that check.
 * @param {string} message
 * @param {number} maxUnbrokenRun  reject if the longest no-whitespace run exceeds this
 * @param {number} maxLength       reject if the whole message is longer than this
 * @returns {string|null}
 */
function chatStructureRejectReason(message, maxUnbrokenRun, maxLength) {
	const text = String(message == null ? '' : message);

	if (maxLength > 0 && text.length > maxLength) {
		return 'message too long';
	}

	if (maxUnbrokenRun > 0 && longestUnbrokenRun(text) > maxUnbrokenRun) {
		return 'too many characters without a space';
	}

	return null;
}

/**
 * Return the FIRST pattern in `patterns` that matches `text` (or null). Used so callers log the
 * pattern that actually matched, instead of guessing.
 * @param {string} text
 * @param {string[]} patterns
 * @param {boolean} [aggressive]
 * @returns {string|null}
 */
function firstFilterMatch(text, patterns, aggressive) {
	if (!patterns) return null;
	for (let i = 0, l = patterns.length; i < l; i++) {
		if (containsChatFilterMatch(text, patterns[i], aggressive)) return patterns[i];
	}
	return null;
}

/**
 * Remove control / bidi / zero-width / format characters from ingested text (names and chat).
 * These corrupt logs and break name/skin/color rendering on clients; visible characters and the
 * skin-encoding punctuation (< > | #) are preserved.
 * @param {string} text
 */
function stripInvisible(text) {
	const s = String(text == null ? '' : text);
	return INVISIBLE_RE ? s.replace(INVISIBLE_RE, '') : s;
}

/**
 * Bounded Damerau-Levenshtein distance (insert / delete / substitute / adjacent-transpose).
 * Returns the distance, or max+1 once it provably exceeds `max` (row-min early exit). Strings are
 * short (single words), so the full DP is cheap.
 * @param {string} a
 * @param {string} b
 * @param {number} max
 * @returns {number}
 */
function boundedEditDistance(a, b, max) {
	const la = a.length, lb = b.length;
	if (Math.abs(la - lb) > max) return max + 1;
	if (la === 0) return lb;
	if (lb === 0) return la;

	const d = [];
	for (let i = 0; i <= la; i++) { d[i] = []; d[i][0] = i; }
	for (let j = 0; j <= lb; j++) d[0][j] = j;

	for (let i = 1; i <= la; i++) {
		let rowMin = Infinity;
		for (let j = 1; j <= lb; j++) {
			const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
			let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
				v = Math.min(v, d[i - 2][j - 2] + 1);
			}
			d[i][j] = v;
			if (v < rowMin) rowMin = v;
		}
		if (rowMin > max) return max + 1;
	}
	return d[la][lb];
}

/**
 * Fuzzy phrase match: catches misspellings, transpositions and doubled letters (e.g. "arearcade",
 * "aranarcode", "atenarcade", "arennarccade") that are a small edit distance from a listed phrase.
 * Only long phrase signatures (>= options.fuzzyMinLength) are matched.
 *
 * Candidates are built strictly on whole-word boundaries: a run of N consecutive message tokens
 * (joined with no separator, but never a mid-word substring) is only compared against a pattern
 * whose OWN normalized word count is also N. This prevents a bare single word (e.g. "players")
 * from ever being fuzzy-compared against a multi-word phrase's flattened signature (e.g. "no
 * players" -> "noplayers") just because a short prefix/suffix happens to fall within the edit-
 * distance budget — that comparison used to run for any N vs. any candidate length, which is what
 * let common single words collide with short decorated multi-word phrases.
 * @param {string} text
 * @param {string[]} patterns
 * @returns {string|null}
 */
function fuzzyFilterMatch(text, patterns) {
	const minLen = OPTIONS.fuzzyMinLength || 8;
	const maxCap = OPTIONS.fuzzyMaxDistance || 0;
	if (!patterns || maxCap <= 0) return null;

	const norm = normalizeChatFilterText(text);
	if (!norm) return null;
	const tokens = norm.split(' ').filter(Boolean);
	if (!tokens.length) return null;

	// Word-count-keyed cache of joined N-consecutive-token windows (only whole tokens are ever
	// concatenated, so a candidate never straddles part of one word and part of another out of
	// the pattern's intended shape).
	const windowCache = {};
	function windowsOfLength(n) {
		if (windowCache[n]) return windowCache[n];
		const out = [];
		for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(''));
		windowCache[n] = out;
		return out;
	}

	const seenSig = {};
	for (let i = 0, l = patterns.length; i < l; i++) {
		const psig = promoSignature(patterns[i]);
		if (psig.length < minLen || seenSig[psig]) continue;
		seenSig[psig] = 1;

		const patternWordCount = normalizeChatFilterText(patterns[i]).split(' ').filter(Boolean).length || 1;
		const cands = windowsOfLength(patternWordCount);
		if (!cands.length) continue;

		const dist = Math.min(maxCap, psig.length >= 9 ? 2 : 1); // stricter for shorter phrases
		for (let c = 0; c < cands.length; c++) {
			const cand = cands[c];
			if (cand === psig) continue; // exact is handled by containsChatFilterMatch
			if (Math.abs(cand.length - psig.length) > dist) continue;
			if (boundedEditDistance(cand, psig, dist) <= dist) return patterns[i];
		}
	}
	return null;
}

/**
 * Detect "letter-as-separator" spam ("A x R x E x N ...") where single letters are interleaved
 * with a repeated junk letter. Returns the message with the separator removed and compacted (so a
 * caller can re-run the phrase filter on it), or null when the message doesn't look like this.
 * @param {string} text
 * @returns {string|null}
 */
function letterSeparatorSignature(text) {
	const minSingles = OPTIONS.letterSepMinSingles || 0;
	if (minSingles <= 0) return null;

	const tokens = normalizeChatFilterText(text).split(' ').filter(Boolean);
	if (tokens.length < minSingles) return null;

	const singles = tokens.filter(function (t) { return t.length === 1; });
	if (singles.length < minSingles || singles.length < tokens.length * 0.5) return null;

	const freq = {};
	let sep = null, sepCount = 0;
	for (let i = 0; i < singles.length; i++) {
		const c = singles[i];
		freq[c] = (freq[c] || 0) + 1;
		if (freq[c] > sepCount) { sepCount = freq[c]; sep = c; }
	}
	if (sepCount < 3) return null; // the separator must actually repeat

	const kept = tokens.filter(function (t) { return t !== sep; }).join('');
	return kept.length >= 3 ? kept : null;
}

module.exports = {
	normalizeChatFilterText,
	containsChatFilterMatch,
	firstFilterMatch,
	fuzzyFilterMatch,
	letterSeparatorSignature,
	boundedEditDistance,
	longestUnbrokenRun,
	chatStructureRejectReason,
	stripInvisible
};
