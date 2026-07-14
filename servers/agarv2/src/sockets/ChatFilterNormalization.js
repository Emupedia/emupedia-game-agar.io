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

const SIGNATURE_MIN_LENGTH = OPTIONS.signatureMinLength || 6;
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
 * Remove control / bidi / zero-width / format characters from ingested text (names and chat).
 * These corrupt logs and break name/skin/color rendering on clients; visible characters and the
 * skin-encoding punctuation (< > | #) are preserved.
 * @param {string} text
 */
function stripInvisible(text) {
	const s = String(text == null ? '' : text);
	return INVISIBLE_RE ? s.replace(INVISIBLE_RE, '') : s;
}

module.exports = {
	normalizeChatFilterText,
	containsChatFilterMatch,
	longestUnbrokenRun,
	chatStructureRejectReason,
	stripInvisible
};
