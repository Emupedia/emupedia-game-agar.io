/**
 * Maps common unicode confusables to their latin ascii lookalikes.
 * @type {Map<string, string>}
 */
const CONFUSABLES = new Map([
	// Greek
	['\u03b1', 'a'], ['\u03b2', 'b'], ['\u03b3', 'g'], ['\u03b4', 'd'], ['\u03b5', 'e'],
	['\u03b6', 'z'], ['\u03b7', 'h'], ['\u03b8', 'th'], ['\u03b9', 'i'], ['\u03ba', 'k'],
	['\u03bb', 'l'], ['\u03bc', 'm'], ['\u03bd', 'n'], ['\u03be', 'x'], ['\u03bf', 'o'],
	['\u03c0', 'p'], ['\u03c1', 'r'], ['\u03c2', 'c'], ['\u03c3', 'o'], ['\u03c4', 't'],
	['\u03c5', 'u'], ['\u03c6', 'f'], ['\u03c7', 'x'], ['\u03c8', 'ps'], ['\u03c9', 'w'],
	// Cyrillic
	['\u0430', 'a'], ['\u0431', 'b'], ['\u0432', 'v'], ['\u0433', 'r'], ['\u0434', 'd'],
	['\u0435', 'e'], ['\u0436', 'zh'], ['\u0437', 'z'], ['\u0438', 'i'], ['\u0439', 'j'],
	['\u043a', 'k'], ['\u043b', 'l'], ['\u043c', 'm'], ['\u043d', 'n'], ['\u043e', 'o'],
	['\u043f', 'p'], ['\u0440', 'p'], ['\u0441', 'c'], ['\u0442', 't'], ['\u0443', 'y'],
	['\u0444', 'f'], ['\u0445', 'x'], ['\u0446', 'c'], ['\u0447', 'ch'], ['\u0448', 'sh'],
	['\u0449', 'sh'], ['\u044a', ''], ['\u044b', 'y'], ['\u044c', ''], ['\u044d', 'e'],
	['\u044e', 'yu'], ['\u044f', 'ya'], ['\u0454', 'e'], ['\u0456', 'i'], ['\u0457', 'i'],
	['\u04cf', 'l'],
	// Latin phonetic extensions / small caps
	['\u1d00', 'a'], ['\u1d01', 'ae'], ['\u1d02', 'b'], ['\u1d03', 'b'], ['\u1d04', 'c'],
	['\u1d05', 'd'], ['\u1d06', 'd'], ['\u1d07', 'e'], ['\u1d08', 'e'], ['\u1d09', 'i'],
	['\u1d0a', 'j'], ['\u1d0b', 'k'], ['\u1d0c', 'l'], ['\u1d0d', 'm'], ['\u1d0e', 'n'],
	['\u1d0f', 'o'], ['\u1d10', 'o'], ['\u1d11', 'o'], ['\u1d12', 'o'], ['\u1d13', 'o'],
	['\u1d14', 'oe'], ['\u1d15', 'ou'], ['\u1d16', 'o'], ['\u1d17', 'o'], ['\u1d18', 'p'],
	['\u1d19', 'r'], ['\u1d1a', 'z'], ['\u1d1b', 't'], ['\u1d1c', 'u'], ['\u1d1d', 'u'],
	['\u1d1e', 'u'], ['\u1d1f', 'm'], ['\u1d20', 'v'], ['\u1d21', 'w'], ['\u1d22', 'z'],
	['\u0280', 'r'], ['\u0274', 'n'], ['\u026a', 'i'], ['\u1d0b', 'k'],
	// Thai (common arenarcade homoglyphs)
	['\u0e04', 'a'], ['\u0e20', 'n'], ['\u0e4f', 'o'], ['\u0e53', 'm'],
])

/**
 * Mathematical Alphanumeric Symbols that NFKC may not fold on older Node/ICU builds.
 * @type {Map<string, string>}
 */
const MATHEMATICAL_ALPHANUMERICS = buildMathematicalAlphanumericMap()

/**
 * @returns {Map<string, string>}
 */
function buildMathematicalAlphanumericMap() {
	const map = new Map()
	const letterRanges = [
		[0x1D400, 0x1D433], // bold
		[0x1D434, 0x1D467], // italic
		[0x1D468, 0x1D49B], // bold italic
		[0x1D49C, 0x1D4CF], // script
		[0x1D4D0, 0x1D503], // bold script
		[0x1D504, 0x1D537], // fraktur
		[0x1D538, 0x1D56B], // double-struck
		[0x1D56C, 0x1D59F], // bold fraktur
		[0x1D5A0, 0x1D5D3], // sans-serif
		[0x1D5D4, 0x1D607], // sans-serif bold
		[0x1D608, 0x1D63B], // sans-serif italic
		[0x1D63C, 0x1D66F], // sans-serif bold italic
		[0x1D670, 0x1D6A3]  // monospace
	]
	const digitRanges = [
		[0x1D7CE, 0x1D7D7],
		[0x1D7D8, 0x1D7E1],
		[0x1D7E2, 0x1D7EB],
		[0x1D7EC, 0x1D7F5],
		[0x1D7F6, 0x1D7FF]
	]

	for (let i = 0, l = letterRanges.length; i < l; i++) {
		const start = letterRanges[i][0]
		const end = letterRanges[i][1]

		for (let cp = start; cp <= end; cp++) {
			const offset = cp - start

			if (offset < 26) {
				map.set(String.fromCodePoint(cp), String.fromCharCode(65 + offset))
			} else if (offset < 52) {
				map.set(String.fromCodePoint(cp), String.fromCharCode(97 + offset - 26))
			}
		}
	}

	for (let i = 0, l = digitRanges.length; i < l; i++) {
		const start = digitRanges[i][0]
		const end = digitRanges[i][1]

		for (let cp = start; cp <= end; cp++) {
			map.set(String.fromCodePoint(cp), String.fromCharCode(48 + (cp - start)))
		}
	}

	addEnclosedAlphanumericLetters(map)

	return map
}

/**
 * Enclosed / decorative latin letters (NFKC may not fold these on older Node builds).
 * @param {Map<string, string>} map
 */
function addEnclosedAlphanumericLetters(map) {
	const enclosedRanges = [
		[0x1F130, 0x1F149], // negative circled capitals A-Z
		[0x1F170, 0x1F189], // squared capitals A-Z
		[0x24B6, 0x24CF],   // circled capitals A-Z
		[0x24D0, 0x24E9]    // circled small a-z
	]

	for (let r = 0; r < enclosedRanges.length; r++) {
		const start = enclosedRanges[r][0]
		const end = enclosedRanges[r][1]
		const upper = start >= 0x24B6 && start <= 0x24CF

		for (let cp = start; cp <= end; cp++) {
			const offset = cp - start

			if (offset < 26) {
				map.set(
					String.fromCodePoint(cp),
					String.fromCharCode((upper ? 65 : 97) + offset)
				)
			}
		}
	}
}

/**
 * @param {string} text
 */
function foldMathematicalAlphanumerics(text) {
	let folded = ''

	for (const ch of text) {
		folded += MATHEMATICAL_ALPHANUMERICS.get(ch) || ch
	}

	return folded
}

/**
 * @param {string} text
 */
function foldConfusables(text) {
	let folded = ''

	for (const ch of text) {
		folded += CONFUSABLES.get(ch) || ch
	}

	return folded
}

/**
 * @param {string} text
 */
function normalizeChatFilterText(text) {
	let normalized = foldMathematicalAlphanumerics(text)
		.normalize('NFKC')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f\ufe00-\ufe0f]/g, '')

	normalized = foldConfusables(normalized)

	return normalized
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/  +/g, ' ')
		.replace(/(.)\1{3,}/g, '$1')
		.trim()
}

/**
 * Compact form used for domain-signature checks (no spaces).
 * @param {string} text
 */
function compactChatFilterText(text) {
	return normalizeChatFilterText(text).replace(/\s+/g, '')
}

/**
 * Catches arenarcade.com homoglyph + ornamental-wrapper spam even when the
 * exact decorated string is not listed in settings.
 * @param {string} text
 */
function containsArenarcadeDomainSignature(text) {
	const normalized = normalizeChatFilterText(text)

	if (!normalized) {
		return false
	}

	if (/\barenarcade\s*com\b/.test(normalized)) {
		return true
	}

	const compact = normalized.replace(/\s+/g, '')

	return /\barenarcade\b/.test(normalized) && compact.indexOf('arenarcadecom') !== -1
}

/**
 * @param {string} text
 */
function isBlockedPromotionText(text) {
	return containsArenarcadeDomainSignature(text)
}

const MIN_NORMALIZED_PATTERN_LENGTH = 4

/**
 * @param {string} pattern
 * @param {string} normalizedPattern
 */
function isUsableFilterPattern(pattern, normalizedPattern) {
	if (!normalizedPattern || normalizedPattern.length < MIN_NORMALIZED_PATTERN_LENGTH) {
		return false
	}

	// Long homoglyph phrases that collapse to almost nothing cause false positives (e.g. -> "d").
	if (pattern.length >= 8 && normalizedPattern.length < Math.max(MIN_NORMALIZED_PATTERN_LENGTH, Math.ceil(pattern.length / 4))) {
		return false
	}

	return true
}

/**
 * @param {string} text
 * @param {string} pattern
 */
function containsChatFilterMatch(text, pattern) {
	if (isBlockedPromotionText(text)) {
		return true
	}

	const normalizedText = normalizeChatFilterText(text)
	const normalizedPattern = normalizeChatFilterText(pattern)

	if (!isUsableFilterPattern(pattern, normalizedPattern)) {
		return false
	}

	return normalizedText.indexOf(normalizedPattern) !== -1
}

module.exports = {
	normalizeChatFilterText,
	compactChatFilterText,
	containsArenarcadeDomainSignature,
	isBlockedPromotionText,
	containsChatFilterMatch
}
