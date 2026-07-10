/**
 * Maps common unicode confusables to their latin ascii lookalikes.
 * @type {Map<string, string>}
 */
const CONFUSABLES = new Map([
	// Greek
	['\u03b1', 'a'], ['\u03b2', 'b'], ['\u03b3', 'g'], ['\u03b4', 'd'], ['\u03b5', 'e'],
	['\u03b6', 'z'], ['\u03b7', 'h'], ['\u03b8', 'th'], ['\u03b9', 'i'], ['\u03ba', 'k'],
	['\u03bb', 'l'], ['\u03bc', 'm'], ['\u03bd', 'n'], ['\u03be', 'x'], ['\u03bf', 'o'],
	['\u03c0', 'p'], ['\u03c1', 'r'], ['\u03c2', 's'], ['\u03c3', 'o'], ['\u03c4', 't'],
	['\u03c5', 'u'], ['\u03c6', 'f'], ['\u03c7', 'x'], ['\u03c8', 'ps'], ['\u03c9', 'w'],
	// Cyrillic
	['\u0430', 'a'], ['\u0431', 'b'], ['\u0432', 'v'], ['\u0433', 'g'], ['\u0434', 'd'],
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
])

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
	return foldConfusables(
		text
			.normalize('NFKC')
			.toLowerCase()
			.normalize('NFD')
			.replace(/\p{M}+/gu, '')
			.replace(/[^\p{L}\p{N}]+/gu, ' ')
			.replace(/  +/g, ' ')
			.replace(/(.)\1{3,}/gi, '$1')
			.trim()
	)
}

function normalizeChatFilterText(text) {
	return foldConfusables(
		text
			.normalize('NFKC')
			.toLowerCase()
			.normalize('NFD')
			.replace(/\p{M}+/gu, '')
			.replace(/[^\p{L}\p{N}]+/gu, ' ')
			.replace(/  +/g, ' ')
			.replace(/(.)\1{3,}/gi, '$1')
			.trim()
	)
}

/**
 * @param {string} text
 * @param {string} pattern
 */
function containsChatFilterMatch(text, pattern) {
	const normalizedText = normalizeChatFilterText(text)
	const normalizedPattern = normalizeChatFilterText(pattern)
	return normalizedPattern.length > 0 && normalizedText.indexOf(normalizedPattern) !== -1
}

module.exports = {
	normalizeChatFilterText,
	containsChatFilterMatch
}
