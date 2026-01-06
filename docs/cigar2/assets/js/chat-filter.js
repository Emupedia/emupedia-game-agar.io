/**
 * Chat Filter Library
 * A comprehensive word censorship and text filtering system
 * Extracted from main.js for reuse across multiple projects
 *
 * @class ChatFilter
 * @description A comprehensive word censorship and text filtering system that normalizes Unicode characters,
 * removes profanity, spam, and other unwanted content from text input.
 *
 * @example
 * const filter = new ChatFilter({
 *   normalizeJsonPath: './assets/data/normalize.json',
 *   blacklistJsonPath: './assets/data/blacklist.json'
 * });
 * await filter.initialize();
 * const filtered = filter.filter_text('some text', 'en');
 */
class ChatFilter {
	/**
	 * Creates an instance of ChatFilter.
	 * @param {Object} [options] - Configuration options for the filter
	 * @param {string} [options.normalizeJsonPath='./assets/data/normalize.json'] - Path to the normalization data JSON file
	 * @param {string} [options.blacklistJsonPath='./assets/data/blacklist.json'] - Path to the blacklist data JSON file
	 * @param {boolean} [options.useBlacklist=true] - Whether to use the blacklist for filtering
	 * @param {boolean} [options.removeNumbers=false] - Whether to remove numbers from text
	 * @param {number} [options.maxLength=10000] - Maximum length of input text to process
	 */
	constructor(options) {
		// Default options
		this.options = options || {}
		this.normalizeJsonPath = this.options.normalizeJsonPath || './assets/data/normalize.json'
		this.blacklistJsonPath = this.options.blacklistJsonPath || './assets/data/blacklist.json'
		this.useBlacklist = this.options.useBlacklist !== undefined ? this.options.useBlacklist : true
		this.removeNumbers = this.options.removeNumbers !== undefined ? this.options.removeNumbers : false
		this.maxLength = this.options.maxLength || 10000

		// Configuration constants
		this.NORMALIZE_TYPES = ['wide', 'wide-numbers-only', 'bold', 'bold-numbers-only', 'italic', 'sans-serif-bold', 'sans-serif-bold-numbers-only', 'sans-serif-italic', 'bold-italic-serif', 'bold-italic-sans', 'small-caps', 'fraktur', 'fraktur-bold', 'cursive', 'cursive-bold', 'cursive-numbers-only', 'double-struck', 'double-struck-numbers-only', 'circles', 'circles-numbers-only', 'circles-bold-numbers-only', 'inverted-circles', 'inverted-circles-numbers-only', 'squares', 'inverted-squares', 'dotted-numbers-only', 'parenthesis', 'parenthesis-numbers-only', 'subscript', 'subscript-numbers-only', 'superscript', 'superscript-numbers-only', 'monospace', 'monospace-numbers-only', 'emoji-numbers-only', 'uncategorized', 'uncategorized-numbers-only', 'diacritics']
		this.REPLACEMENT_STRING = '``'
		this.REPLACEMENT_PREFIX = '`'
		this.REPLACEMENT_SUFFIX = '`'

		// Common return objects (avoid creating new objects repeatedly)
		this._DISABLED_RESULT = { enabled: false }

		// Helper function for search regex replacements (avoid creating new functions repeatedly)
		this._searchReplacementFn = function(category) {
			return ' ' + category + ' '
		}

		// Initialize properties
		this.blacklist_search_regex = {}
		this.blacklist_replace_regex = {}
		this.blacklist_numbers_regex = null
		this.normalize_data = null
		this.blacklist_data = null
		this.initialized = false

		// Pre-computed normalization maps for O(1) lookups
		this.normalize_map_all = null
		this.normalize_map_no_diacritics = null

		// Pre-computed Set for regex special characters (O(1) lookup)
		this.REGEX_SPECIAL_CHARS = new Set(['*', '+', '?', '^', '$', '{', '}', '(', ')', '[', ']', '|', '\\'])

		// Pre-compute non-English normalize types (excludes diacritics)
		const normalizeTypesLen = this.NORMALIZE_TYPES.length
		this.NORMALIZE_TYPES_NO_DIACRITICS = this.NORMALIZE_TYPES.slice(0, normalizeTypesLen - 1)
	}

	/**
	 * Initializes the ChatFilter by loading normalization and blacklist data from JSON files.
	 * Must be called before using any filtering methods.
	 * @async
	 * @returns {Promise<void>} Promise that resolves when initialization is complete
	 * @throws {Error} Throws an error if JSON files fail to load
	 */
	async initialize() {
		if (this.initialized) {
			return
		}

		try {
			const [normalizeResponse, blacklistResponse] = await Promise.all([
				fetch(this.normalizeJsonPath),
				fetch(this.blacklistJsonPath)
			])

			if (!normalizeResponse.ok) {
				throw new Error('Failed to load normalize.json')
			}
			if (!blacklistResponse.ok) {
				throw new Error('Failed to load blacklist.json')
			}

			this.normalize_data = await normalizeResponse.json()
			this.blacklist_data = await blacklistResponse.json()

			// Pre-compute normalization maps for O(1) lookups
			this._buildNormalizeMaps()

			this.build_regex_objects()
			this.initialized = true
		} catch (error) {
			console.error('Failed to initialize ChatFilter:', error)
			throw error
		}
	}

	/**
	 * Checks if a value is empty (null, undefined, or empty string/array).
	 * @private
	 * @param {*} value - The value to check
	 * @returns {boolean} True if the value is empty, false otherwise
	 */
	_isEmpty(value) {
		if (value === null || value === undefined) {
			return true
		}
		if (typeof value === 'string' || this._isArray(value)) {
			return value.length === 0
		}
		return false
	}

	/**
	 * Checks if a value is a valid non-empty string.
	 * @private
	 * @param {*} value - The value to check
	 * @returns {boolean} True if the value is a non-empty string, false otherwise
	 */
	_isString(value) {
		return value && typeof value === 'string'
	}

	/**
	 * Checks if a value is a valid array.
	 * @private
	 * @param {*} value - The value to check
	 * @returns {boolean} True if the value is an array, false otherwise
	 */
	_isArray(value) {
		return value && Array.isArray(value)
	}

	/**
	 * Validates string input and returns the string if valid, or false if invalid.
	 * @private
	 * @param {*} str - The value to validate
	 * @returns {string|false} The validated string, or false if invalid
	 */
	_validateStringInput(str) {
		if (!str || !this._isString(str)) {
			return false
		}
		return str
	}

	/**
	 * Safely creates a RegExp object with error handling.
	 * @private
	 * @param {string} pattern - The regex pattern string
	 * @param {string} [flags='gi'] - The regex flags (default: 'gi' for global and case-insensitive)
	 * @returns {RegExp|null} The created RegExp object, or null if pattern is invalid or creation fails
	 */
	_createRegex(pattern, flags) {
		if (!this._isString(pattern) || pattern.length === 0) {
			return null
		}
		try {
			return new RegExp(pattern, flags || 'gi')
		} catch (e) {
			return null
		}
	}

	/**
	 * Tests if any regex in an object matches the given string.
	 * Uses search() instead of test() to avoid global flag state issues.
	 * @private
	 * @param {Object.<string, RegExp>} regexObj - Object mapping category names to RegExp objects
	 * @param {string} str - The string to test against
	 * @returns {boolean} True if any regex matches, false otherwise
	 */
	_testRegexObject(regexObj, str) {
		if (!regexObj || !this._isString(str)) {
			return false
		}
		for (let category in regexObj) {
			const regex = regexObj[category]
			if (regex instanceof RegExp) {
				// Use search() instead of test() to avoid global flag state issues
				// search() returns the index of the first match or -1 if no match
				// This avoids the lastIndex state problem with global regexes
				if (str.search(regex) !== -1) {
					return true
				}
			}
		}
		return false
	}

	/**
	 * Applies regex replacements from an object using a replacement function.
	 * @private
	 * @param {Object.<string, RegExp>} regexObj - Object mapping category names to RegExp objects
	 * @param {string} str - The string to apply replacements to
	 * @param {Function} replacementFn - Function that takes a category name (string) and returns the replacement string
	 * @returns {string} The string with all replacements applied
	 */
	_applyRegexReplacements(regexObj, str, replacementFn) {
		if (!regexObj || !this._isString(str)) {
			return str
		}
		for (let category in regexObj) {
			const regex = regexObj[category]
			if (regex instanceof RegExp) {
				str = str.replace(regex, replacementFn(category))
			}
		}
		return str
	}

	/**
	 * Sorts an array by element length in descending order.
	 * @private
	 * @param {Array<string>} arr - The array to sort (typically contains strings)
	 * @returns {Array<string>} A new sorted array (original array is not modified)
	 */
	_sortByLengthDesc(arr) {
		if (!this._isArray(arr)) {
			return []
		}
		const self = this
		return arr.slice().sort(function(a, b) {
			const aLen = self._isString(a) ? a.length : 0
			const bLen = self._isString(b) ? b.length : 0
			return bLen - aLen
		})
	}

	/**
	 * Builds a regex string from an array of patterns, optionally handling leading/trailing spaces.
	 * @private
	 * @param {Array<string>} patterns - Array of pattern strings to combine into a regex
	 * @param {boolean} handleSpaces - Whether to handle leading/trailing spaces in patterns
	 * @returns {string} A regex string combining all patterns with '|' (OR) operator, or empty string if no valid patterns
	 */
	_buildRegexString(patterns, handleSpaces) {
		if (!this._isArray(patterns)) {
			return ''
		}
		const regexParts = []
		const patternsLen = patterns.length
		for (let i = 0; i < patternsLen; i++) {
			const pattern = patterns[i]
			if (!this._isString(pattern) || this._isEmpty(pattern)) {
				continue
			}
			let regexPattern = this.patternToRegex(pattern)

			// Skip if patternToRegex returned empty (defensive check)
			if (!regexPattern) {
				continue
			}

			if (handleSpaces) {
				const patternLen = pattern.length
				const hasLeadingSpace = pattern[0] === ' '
				// patternLen > 0 is guaranteed because _isEmpty(pattern) check above
				const hasTrailingSpace = pattern[patternLen - 1] === ' '

				// Handle leading/trailing spaces in patterns
				if (hasLeadingSpace) {
					if (patternLen === 1) {
						regexPattern = '(?:^|\\s|\\b)(?:\\s|\\b|$)'
					} else if (regexPattern.length > 1) {
						regexPattern = '(?:^|\\s|\\b)' + regexPattern.slice(1)
						// After adding prefix, regexPattern.length will always be > 1
						if (hasTrailingSpace) {
							regexPattern = regexPattern.slice(0, -1) + '(?:\\s|\\b|$)'
						}
					}
				} else if (hasTrailingSpace) {
					// regexPattern.length > 0 is guaranteed because patternToRegex returns non-empty for valid patterns
					regexPattern = regexPattern.slice(0, -1) + '(?:\\s|\\b|$)'
				}
			}

			regexParts.push(regexPattern)
		}
		return regexParts.join('|')
	}

	/**
	 * Cleans up whitespace by collapsing multiple spaces into one and trimming.
	 * @private
	 * @param {string} str - The string to clean
	 * @returns {string} The cleaned string, or the original value if not a string
	 */
	_cleanWhitespace(str) {
		if (!this._isString(str)) {
			return str
		}
		return str.replace(/  +/g, ' ').trim()
	}

	/**
	 * Checks if blacklist filtering is enabled and data is available.
	 * @private
	 * @returns {boolean} True if blacklist is enabled and data exists, false otherwise
	 */
	_isBlacklistEnabled() {
		return this.blacklist_data && this.useBlacklist
	}

	/**
	 * Gets the language mapping from blacklist data for a specific language.
	 * @private
	 * @param {Object} blacklistData - The blacklist data object
	 * @param {string} language - The language code (e.g., 'en', 'es', 'fr')
	 * @returns {Object|null} The language mapping object, or null if not found
	 */
	_getLanguageMapping(blacklistData, language) {
		if (!blacklistData || !blacklistData.mapping) {
			return null
		}
		return blacklistData.mapping[language] || null
	}

	/**
	 * Processes swear words array, either checking for matches or replacing them.
	 * @private
	 * @param {string} str - The string to process
	 * @param {Array<string>} swearArray - Array of swear words to check/replace
	 * @param {boolean} escapeForRegex - If true, replaces swear words with replacement string. If false, returns true if any found.
	 * @returns {string|boolean} If escapeForRegex is true, returns the modified string. If false, returns true if found, false otherwise.
	 */
	_processSwearWords(str, swearArray, escapeForRegex) {
		if (!this._isString(str) || !this._isArray(swearArray)) {
			return escapeForRegex ? str : false
		}
		const swearArrayLen = swearArray.length
		// Cache replacement string to avoid repeated property access in loop
		const replacementStr = escapeForRegex ? this.REPLACEMENT_STRING : null
		for (let i = 0; i < swearArrayLen; i++) {
			const swear = swearArray[i]
			if (!this._isString(swear) || this._isEmpty(swear)) {
				continue
			}
			if (escapeForRegex) {
				// Use Set for O(1) character lookup instead of regex
				// Use array for better performance with longer strings
				const escapedParts = []
				const swearLen = swear.length
				for (let j = 0; j < swearLen; j++) {
					const char = swear[j]
					if (this.REGEX_SPECIAL_CHARS.has(char)) {
						escapedParts.push('\\', char)
					} else {
						escapedParts.push(char)
					}
				}
				const regex = this._createRegex(escapedParts.join(''), 'gi')
				if (regex) {
					str = str.replace(regex, replacementStr)
				}
			} else {
				if (str.includes(swear)) {
					return true
				}
			}
		}
		return escapeForRegex ? str : false
	}

	/**
	 * Pre-computes normalization maps combining all types for O(1) lookups.
	 * Creates two maps: one with all types (including diacritics) and one without diacritics.
	 * @private
	 * @returns {void}
	 */
	_buildNormalizeMaps() {
		const normalizeData = this.normalize_data
		if (!normalizeData) {
			return
		}

		const normalizeMapping = normalizeData.mapping
		if (!normalizeMapping) {
			return
		}

		// Build map with all normalization types (including diacritics)
		this.normalize_map_all = new Map()
		// Build map without diacritics (for non-English languages)
		this.normalize_map_no_diacritics = new Map()

		const normalizeTypes = Object.keys(normalizeMapping)
		const normalizeTypesLen = normalizeTypes.length

		// Process types in order - later mappings override earlier ones (matching original behavior)
		for (let i = 0; i < normalizeTypesLen; i++) {
			const type = normalizeTypes[i]
			const typeMap = normalizeMapping[type]

			if (!typeMap) {
				continue
			}

			const isDiacritics = type === 'diacritics'

			// Add to maps - allow later types to override earlier ones
			for (let char in typeMap) {
				const replacement = typeMap[char]

				// Add to all-types map (always, including diacritics)
				this.normalize_map_all.set(char, replacement)

				// Add to no-diacritics map only if not diacritics
				if (!isDiacritics) {
					this.normalize_map_no_diacritics.set(char, replacement)
				}
			}
		}
	}

	/**
	 * Converts a pattern string to a regex string, treating unescaped dots as wildcards.
	 * Escapes regex special characters except dots (which become wildcards).
	 * @param {string} pattern - The pattern string to convert
	 * @returns {string} The regex string, or empty string if pattern is invalid
	 */
	patternToRegex(pattern) {
		if (!this._isString(pattern)) {
			return ''
		}

		// Use array for better performance with longer strings
		const result = []
		let i = 0
		const patternLen = pattern.length

		while (i < patternLen) {
			if (pattern[i] === '\\') {
				// Escaped character - keep as is (including \.)
				if (i + 1 < patternLen) {
					result.push(pattern[i], pattern[i + 1])
					i += 2
				} else {
					result.push(pattern[i])
					i++
				}
			} else if (pattern[i] === '.') {
				// Unescaped dot - convert to regex wildcard (any character except newline)
				result.push('.')
				i++
			} else {
				// Regular character - escape if it's a regex special character
				const char = pattern[i]
				// Escape special regex characters: ^ $ * + ? ( ) [ ] { } | \
				// Note: . is NOT escaped here because we handle it above as a wildcard
				// Use Set for O(1) lookup instead of regex test
				if (this.REGEX_SPECIAL_CHARS.has(char)) {
					result.push('\\', char)
				} else {
					result.push(char)
				}
				i++
			}
		}

		return result.join('')
	}

	/**
	 * Builds a regex object for a category array.
	 * @private
	 * @param {Array<string>} categoryArray - Array of patterns for the category
	 * @param {boolean} handleSpaces - Whether to handle leading/trailing spaces
	 * @param {string} language - The language code (for logging purposes)
	 * @param {string} category - The category name (for logging purposes)
	 * @returns {RegExp|null} The created RegExp object, or null if no valid patterns
	 */
	_buildCategoryRegex(categoryArray, handleSpaces, language, category) {
		if (!this._isArray(categoryArray)) {
			return null
		}
		const sorted = this._sortByLengthDesc(categoryArray)
		const regexStr = this._buildRegexString(sorted, handleSpaces)
		if (!regexStr) {
			return null
		}
		const regex = this._createRegex(regexStr, 'gi')
		if (!regex) {
			console.warn('Invalid regex pattern for', language, category)
		}
		return regex
	}

	/**
	 * Initializes a language regex object if it doesn't exist.
	 * @private
	 * @param {string} language - The language code
	 * @param {Object} regexObj - The regex object to initialize
	 * @returns {void}
	 */
	_initLanguageRegex(language, regexObj) {
		if (!regexObj[language]) {
			regexObj[language] = {}
		}
	}

	/**
	 * Builds regexes for all categories in a language mapping.
	 * @private
	 * @param {Object} languageMapping - The language mapping object
	 * @param {string} language - The language code
	 * @param {Object} regexObj - The regex object to populate
	 * @param {boolean} handleSpaces - Whether to handle leading/trailing spaces
	 * @param {string} prefix - Prefix for category names (for logging)
	 * @returns {void}
	 */
	_buildLanguageRegexes(languageMapping, language, regexObj, handleSpaces, prefix) {
		for (let category in languageMapping) {
			if (category === 'numbers') {
				continue
			}
			const regex = this._buildCategoryRegex(languageMapping[category], handleSpaces, language, prefix + category)
			if (regex) {
				regexObj[category] = regex
			}
		}
	}

	/**
	 * Builds regex objects for a language mapping.
	 * @private
	 * @param {Object} languageMapping - The language mapping object
	 * @param {string} language - The language code
	 * @param {Object} regexObj - The regex object to populate
	 * @param {boolean} handleSpaces - Whether to handle leading/trailing spaces
	 * @param {string} prefix - Prefix for category names (for logging)
	 * @returns {void}
	 */
	_buildLanguageRegexObjects(languageMapping, language, regexObj, handleSpaces, prefix) {
		if (!languageMapping) {
			return
		}
		this._initLanguageRegex(language, regexObj)
		this._buildLanguageRegexes(languageMapping, language, regexObj[language], handleSpaces, prefix)
	}

	/**
	 * Builds regex objects for all languages from the blacklist data.
	 * Creates search regexes, replace regexes, and number regexes.
	 * @returns {void}
	 */
	build_regex_objects() {
		const blacklistData = this.blacklist_data
		if (!blacklistData) {
			return
		}

		const mapping = blacklistData.mapping
		if (!mapping) {
			return
		}

		// Build blacklist_numbers_regex
		const enMapping = this._getLanguageMapping(blacklistData, 'en')
		if (enMapping && this._isArray(enMapping.numbers)) {
			const numberssorted = this._sortByLengthDesc(enMapping.numbers)
			const regex0 = this._buildRegexString(numberssorted, false)

			if (regex0) {
				this.blacklist_numbers_regex = this._createRegex(regex0, 'gi')
				if (!this.blacklist_numbers_regex) {
					console.warn('Invalid regex pattern for numbers')
				}
			}
		}

		// Build regex objects dynamically for all languages found in JSON
		const languages = Object.keys(mapping)
		const languagesLen = languages.length

		for (let langIdx = 0; langIdx < languagesLen; langIdx++) {
			const language = languages[langIdx]
			const languageMapping = this._getLanguageMapping(blacklistData, language)
			this._buildLanguageRegexObjects(languageMapping, language, this.blacklist_search_regex, true, '')
		}

		// Build blacklist_replace_regex for all languages in replace data
		const replaceData = blacklistData.replace
		if (replaceData) {
			const replaceLanguages = Object.keys(replaceData)
			const replaceLanguagesLen = replaceLanguages.length
			for (let langIdx = 0; langIdx < replaceLanguagesLen; langIdx++) {
				const language = replaceLanguages[langIdx]
				const replaceMapping = replaceData[language]
				this._buildLanguageRegexObjects(replaceMapping, language, this.blacklist_replace_regex, false, 'replace ')
			}
		}
	}

	/**
	 * Normalizes Unicode characters in a string by converting special Unicode variants to standard characters.
	 * Uses pre-computed maps for O(1) lookups when available.
	 * @param {string} str - The string to normalize
	 * @param {string|Array<string>} [type] - Normalization type(s) to apply. If undefined, applies all types including diacritics.
	 *   Valid types: 'wide', 'bold-numbers-only', 'sans-serif-bold-numbers-only', 'cursive-numbers-only',
	 *   'double-struck-numbers-only', 'circles', 'circles-bold-numbers-only', 'inverted-circles', 'squares',
	 *   'inverted-squares', 'dotted-numbers-only', 'parenthesis-numbers-only', 'subscript', 'superscript',
	 *   'monospace-numbers-only', 'emoji-numbers-only', 'uncategorized', 'uncategorized-numbers-only', 'diacritics'
	 * @returns {string} The normalized string, or the original string if invalid input or no normalization data
	 */
	normalize(str, type) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated

		const normalizeData = this.normalize_data
		if (!normalizeData) {
			return str
		}

		// Use pre-computed map for O(1) lookups
		// Check if diacritics should be included
		const includeDiacritics = type === undefined || type === 'diacritics' || (this._isArray(type) && type.includes('diacritics'))
		const normalizeMap = includeDiacritics ? this.normalize_map_all : this.normalize_map_no_diacritics

		if (!normalizeMap) {
			// Fallback to old method if maps not built
			return this._normalizeLegacy(str, type)
		}

		// Single-pass normalization with O(1) lookups
		const arr = Array.from(str)
		const arrLen = arr.length
		for (let i = 0; i < arrLen; i++) {
			if (normalizeMap.has(arr[i])) {
				arr[i] = normalizeMap.get(arr[i])
			}
		}

		return arr.join('')
	}

	/**
	 * Legacy normalization method used as a fallback when pre-computed maps are not available.
	 * @private
	 * @param {string} str - The string to normalize
	 * @param {string|Array<string>} [type] - Normalization type(s) to apply
	 * @returns {string} The normalized string, or the original string if invalid input
	 */
	_normalizeLegacy(str, type) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated

		// normalize() already checked normalizeData exists, so we can skip that check here
		const normalizeMapping = this.normalize_data.mapping
		if (!normalizeMapping) {
			return str
		}

		const arr = Array.from(str)
		const arrLen = arr.length
		const normalize = Object.keys(normalizeMapping)
		const normalizeLen = normalize.length
		const typeArray = this._isArray(type) ? type : (type !== undefined ? [type] : null)

		for (let i = 0; i < arrLen; i++) {
			for (let j = 0; j < normalizeLen; j++) {
				const normalizeType = normalize[j]

				// Check if this type should be processed
				if (typeArray && !typeArray.includes(normalizeType)) {
					continue
				}

				const typeMap = normalizeMapping[normalizeType]
				// Apply normalization if mapping exists (later types override earlier ones)
				if (typeMap && typeMap[arr[i]] !== undefined) {
					arr[i] = typeMap[arr[i]]
				}
			}
		}

		return arr.join('')
	}

	/**
	 * Removes invisible Unicode characters from a string.
	 * Removes zero-width spaces, variation selectors, musical symbols, and HTML entities.
	 * @param {string} str - The string to process
	 * @returns {string} The string with invisible characters removed, or the original value if not a string
	 */
	remove_invisible_before(str) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated
		// Combine all invisible character patterns into a single regex for better performance
		// Main invisible characters (includes \u200d Zero Width Joiner and \ufe0f Variation Selector-16)
		str = str.replace(/[\u0009\u000a\u000c\u000d\u007f\u00a0\u00ad\u034f\u061a\u061c\u064b\u115f\u1160\u17b4\u17b5\u180e\u2000-\u200f\u202a-\u202f\u205f-\u206f\u20d0-\u20f0\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufff8\ufffd]/g, '')
		// Variation selectors (db40 range)
		str = str.replace(/\udb40[\udc20-\udc7f]/g, '')
		// Musical symbols (d834 range)
		str = str.replace(/\ud834[\udd73-\udd7a]/g, '')
		// HTML entities
		return str.replace(/&(?:lrm|rlm|ZeroWidthSpace|zwj|zwnj|nbsp);/gi, '')
	}

	/**
	 * Removes combining marks (diacritical marks that combine with base characters) from a string.
	 * @param {string} str - The string to process
	 * @returns {string} The string with combining marks removed, or the original value if not a string
	 */
	remove_combining(str) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated
		// \u064d\u0650 is already included in the character class, so only one pattern needed
		return str.replace(/[\u0336\u0337\u0489\u064d\u0650\u065c\u065e\u20d8\ufc5e]/g, '')
	}

	/**
	 * Removes invisible Unicode characters that appear after other characters (zero-width joiners and variation selectors).
	 * @param {string} str - The string to process
	 * @returns {string} The string with invisible characters removed, or the original value if not a string
	 */
	remove_invisible_after(str) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated
		// Remove zero-width joiner (\u200d) and variation selector-16 (\ufe0f)
		return str.replace(/[\u200d\ufe0f]/g, '')
	}

	/**
	 * Normalizes a string while tracking character position mappings between original and normalized versions.
	 * Used for surgical profanity replacement where we need to map profanity matches back to original positions.
	 * @private
	 * @param {string} str - The string to normalize
	 * @param {string|Array<string>} [type] - Normalization type(s) to apply
	 * @returns {{normalized: string, mapping: Array<number>}} Object with normalized string and position mapping array
	 */
	_normalizeWithMapping(str, type) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return { normalized: str, mapping: [] }
		}
		str = validated

		const normalizeData = this.normalize_data
		if (!normalizeData) {
			const mapping = []
			for (let i = 0; i < str.length; i++) {
				mapping.push(i)
			}
			return { normalized: str, mapping: mapping }
		}

		const includeDiacritics = type === undefined || type === 'diacritics' || (this._isArray(type) && type.includes('diacritics'))
		const normalizeMap = includeDiacritics ? this.normalize_map_all : this.normalize_map_no_diacritics

		if (!normalizeMap) {
			// Fallback: create simple 1:1 mapping
			const mapping = []
			for (let i = 0; i < str.length; i++) {
				mapping.push(i)
			}
			return { normalized: str, mapping: mapping }
		}

		// Normalize while tracking positions
		const arr = Array.from(str)
		const arrLen = arr.length
		const mapping = []
		let normalizedIndex = 0

		for (let i = 0; i < arrLen; i++) {
			if (normalizeMap.has(arr[i])) {
				arr[i] = normalizeMap.get(arr[i])
			}
			// Map original position to normalized position (1:1 since we're replacing in place)
			mapping.push(normalizedIndex)
			normalizedIndex++
		}

		return { normalized: arr.join(''), mapping: mapping }
	}

	/**
	 * Replaces profanity surgically in the original string while preserving Unicode characters.
	 * Uses normalized version for detection but replaces only profane parts in original.
	 * @private
	 * @param {Array<string>} originalArr - The original nickname as character array (will be modified)
	 * @param {string} normalizedStr - The normalized version for detection
	 * @param {Array<number>} positionMapping - Mapping from normalized positions to original positions
	 * @param {string} language - The language code for filtering
	 * @returns {string} The original string with only profane parts replaced
	 */
	_replaceProfanitySurgically(originalArr, normalizedStr, positionMapping, language) {
		if (!this._isBlacklistEnabled()) {
			return originalArr.join('')
		}

		const lang = language
		const languageMapping = this._getLanguageMapping(this.blacklist_data, lang)
		if (!languageMapping) {
			return originalArr.join('')
		}

		const prefix = this.REPLACEMENT_PREFIX
		const suffix = this.REPLACEMENT_SUFFIX
		const replacementStr = this.REPLACEMENT_STRING
		let modified = false

		// Check exact matches first
		const exactMatch = this._checkExactMatch(normalizedStr, lang, this.blacklist_data)
		if (exactMatch) {
			// If entire string matches exactly, replace whole thing
			const isEnglish = lang === 'en'
			if (exactMatch.replacement) {
				return prefix + (isEnglish ? exactMatch.replacement : '') + suffix
			}
			return isEnglish ? exactMatch.category : replacementStr
		}

		// Work with a copy of the array for modifications
		const workingArr = originalArr.slice()

		// Check regex matches and replace surgically
		const searchRegex = this.blacklist_search_regex[lang]
		let currentNormalizedStr = normalizedStr
		let currentPositionMapping = positionMapping
		if (searchRegex) {
			for (let category in searchRegex) {
				const regex = searchRegex[category]
				if (regex instanceof RegExp) {
					// Find all matches in current normalized string
					let match
					const matches = []
					// Reset regex lastIndex to avoid state issues
					regex.lastIndex = 0
					while ((match = regex.exec(currentNormalizedStr)) !== null) {
						matches.push({
							start: match.index,
							end: match.index + match[0].length,
							category: category
						})
						// Prevent infinite loop on zero-length matches
						if (match[0].length === 0) {
							break
						}
					}

					// Replace matches in working array (process from end to start to preserve indices)
					let categoryModified = false
					for (let i = matches.length - 1; i >= 0; i--) {
						const match = matches[i]
						// Find corresponding positions in working array
						const originalStart = this._findOriginalPosition(match.start, currentPositionMapping)
						const originalEnd = this._findOriginalPosition(match.end - 1, currentPositionMapping) + 1
						if (originalStart >= 0 && originalEnd > originalStart && originalEnd <= workingArr.length) {
							const replacement = ' ' + match.category + ' '
							// Replace in working array (not originalArr!)
							workingArr.splice(originalStart, originalEnd - originalStart, ...Array.from(replacement))
							modified = true
							categoryModified = true
						}
					}

					// Re-normalize after this category if it made changes
					if (categoryModified) {
						const renormalized = this._normalizeWithMapping(workingArr.join(''), this.NORMALIZE_TYPES)
						currentNormalizedStr = renormalized.normalized
						currentPositionMapping = []
						for (let i = 0; i < currentNormalizedStr.length; i++) {
							currentPositionMapping.push(i)
						}
					}
			}
		}
	}

	// Use current normalized string and position mapping from search regex (already updated after each category)
	let updatedNormalizedStr = currentNormalizedStr
	let updatedPositionMapping = currentPositionMapping

	// Apply replace regex
	const replaceRegex = this.blacklist_replace_regex[lang]
	let replaceRegexModified = false
	if (replaceRegex) {
		for (let category in replaceRegex) {
			const regex = replaceRegex[category]
			if (regex instanceof RegExp) {
				let match
				const matches = []
				regex.lastIndex = 0
				while ((match = regex.exec(updatedNormalizedStr)) !== null) {
						matches.push({
							start: match.index,
							end: match.index + match[0].length,
							category: category
						})
						if (match[0].length === 0) {
							break
						}
					}

				for (let i = matches.length - 1; i >= 0; i--) {
					const match = matches[i]
					const originalStart = this._findOriginalPosition(match.start, updatedPositionMapping)
					const originalEnd = this._findOriginalPosition(match.end - 1, updatedPositionMapping) + 1
					if (originalStart >= 0 && originalEnd > originalStart && originalEnd <= workingArr.length) {
						const replacement = ' ' + prefix + match.category + suffix + ' '
						workingArr.splice(originalStart, originalEnd - originalStart, ...Array.from(replacement))
						modified = true
						replaceRegexModified = true
					}
				}
				}
			}
		}

		// Re-normalize again if replace regex modified workingArr
		if (replaceRegexModified) {
			const renormalized = this._normalizeWithMapping(workingArr.join(''), this.NORMALIZE_TYPES)
			updatedNormalizedStr = renormalized.normalized
			updatedPositionMapping = []
			for (let i = 0; i < updatedNormalizedStr.length; i++) {
				updatedPositionMapping.push(i)
			}
		}

		// Check swear words
		if (languageMapping.swear) {
			const swearArray = languageMapping.swear
			const swearArrayLen = swearArray.length
			let currentNormalizedStr = updatedNormalizedStr
			for (let i = 0; i < swearArrayLen; i++) {
				const swear = swearArray[i]
				if (!this._isString(swear) || this._isEmpty(swear)) {
					continue
				}
				// Find swear word in normalized string (case-insensitive)
				let normalizedLower = currentNormalizedStr.toLowerCase()
				const swearLower = swear.toLowerCase()
				let swearIndex = normalizedLower.indexOf(swearLower)
				while (swearIndex !== -1) {
					const originalStart = this._findOriginalPosition(swearIndex, updatedPositionMapping)
					const originalEnd = this._findOriginalPosition(swearIndex + swear.length - 1, updatedPositionMapping) + 1

					if (originalStart >= 0 && originalEnd > originalStart && originalEnd <= workingArr.length) {
						workingArr.splice(originalStart, originalEnd - originalStart, ...Array.from(replacementStr))
						modified = true
						// Update normalized string to reflect replacement (for finding next occurrence)
						currentNormalizedStr = currentNormalizedStr.substring(0, swearIndex) + replacementStr + currentNormalizedStr.substring(swearIndex + swear.length)
						normalizedLower = currentNormalizedStr.toLowerCase()
					}
					// Find next occurrence
					swearIndex = normalizedLower.indexOf(swearLower, swearIndex + replacementStr.length)
				}
			}
		}

		// Copy results back to original array
		if (modified) {
			originalArr.length = 0
			originalArr.push.apply(originalArr, workingArr)
		}
		const result = originalArr.join('')
		return result
	}

	/**
	 * Finds the original string position corresponding to a normalized position.
	 * The positionMapping array maps: normalized position -> original position
	 * @private
	 * @param {number} normalizedPos - Position in normalized string
	 * @param {Array<number>} positionMapping - Mapping array (positionMapping[i] = original position for normalized position i)
	 * @returns {number} Position in original string, or -1 if invalid
	 */
	_findOriginalPosition(normalizedPos, positionMapping) {
		// positionMapping[i] = original position for normalized position i
		if (normalizedPos >= 0 && normalizedPos < positionMapping.length) {
			const originalPos = positionMapping[normalizedPos]
			// Return -1 if mapping is invalid (marked as -1)
			return originalPos >= 0 ? originalPos : -1
		}
		// Fallback: return closest valid position
		if (normalizedPos < 0) {
			return 0
		}
		// Find last valid mapping
		for (let i = positionMapping.length - 1; i >= 0; i--) {
			if (positionMapping[i] >= 0) {
				return positionMapping[i]
			}
		}
		return 0
	}

	/**
	 * Validates and normalizes input string and language code.
	 * @private
	 * @param {*} str - The input string (will be converted to string if not already)
	 * @param {string} [language] - The language code (optional, will be validated)
	 * @returns {{valid: boolean, str: string, language: string}} An object with validation result, normalized string, and language code
	 */
	_validateInput(str, language) {
		// Validate string
		if (str === null || str === undefined) {
			return { valid: false, str: str, language: language }
		}

		// Convert to string if not already
		if (typeof str !== 'string') {
			str = String(str)
		}

		// Check max length
		if (str.length > this.maxLength) {
			str = str.substring(0, this.maxLength)
		}

		// Validate and normalize language
		language = this._validateLanguage(language)

		return { valid: true, str: str, language: language }
	}

	/**
	 * Validates and normalizes a language code, dynamically checking available languages.
	 * Normalizes 'br' to 'pt' and falls back to 'en' if language is not found.
	 * @private
	 * @param {string} language - The language code to validate
	 * @returns {string} The validated language code (defaults to 'en' if invalid)
	 */
	_validateLanguage(language) {
		if (!language) {
			return 'en'
		}

		// Normalize 'br' to 'pt'
		if (language === 'br') {
			language = 'pt'
		}

		// Check if language exists in blacklist_data, fallback to 'en'
		if (this._getLanguageMapping(this.blacklist_data, language)) {
			return language
		}

		return 'en'
	}

	/**
	 * Applies the common normalization pipeline to text.
	 * Removes zalgo, normalizes Unicode, removes combining marks and invisible characters,
	 * normalizes spaces, and cleans whitespace.
	 * @private
	 * @param {string} str - The string to normalize
	 * @param {string} language - The language code (affects which normalization types are used)
	 * @returns {string} The normalized string, or the original value if not a string
	 */
	_normalizeText(str, language= 'en') {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated

		// 1. Remove zalgo
		str = this.remove_zalgo(str)

		// 2. Normalize Unicode characters
		const normalize_types = language !== 'en' ? this.NORMALIZE_TYPES_NO_DIACRITICS : this.NORMALIZE_TYPES
		str = this.normalize(str, normalize_types)

		// 3. Remove combining marks and invisible characters
		str = this.remove_combining(this.remove_invisible_before(str))

		// 4. Normalize spaces around dots and other separators for better pattern matching
		str = str.replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ')

		// 5. Clean up whitespace
		return this._cleanWhitespace(str)
	}

	/**
	 * Checks if a profanity word is in the replace list for a given language.
	 * @private
	 * @param {string} profanity1Lower - The lowercase profanity word to check
	 * @param {Object} replaceData - The replace data object from blacklist
	 * @param {string} language - The language code
	 * @returns {string|null} The replacement category name if found, null otherwise
	 */
	_checkReplaceList(profanity1Lower, replaceData, language) {
		if (!replaceData) {
			return null
		}
		const replaceMapping = replaceData[language]
		if (!replaceMapping) {
			return null
		}
		for (let profanity2 in replaceMapping) {
			const replaceArray = replaceMapping[profanity2]
			if (!this._isArray(replaceArray)) {
				continue
			}
			// Use includes for modern JS and better readability
			if (replaceArray.includes(profanity1Lower)) {
				return profanity2
			}
		}
		return null
	}

	/**
	 * Checks for exact matches of profanity patterns in the blacklist.
	 * Normalizes input by removing ? and !, and compares against normalized patterns.
	 * @private
	 * @param {string} str - The string to check
	 * @param {string} language - The language code
	 * @param {Object} [blacklistData] - The blacklist data object (defaults to this.blacklist_data)
	 * @returns {{category: string, replacement: string|null}|null} An object with category and replacement if match found, null otherwise
	 */
	_checkExactMatch(str, language, blacklistData) {
		// Validate input string
		if (!this._isString(str)) {
			return null
		}
		// Use provided blacklistData or fallback to this.blacklist_data
		const data = blacklistData || this.blacklist_data
		const languageMapping = this._getLanguageMapping(data, language)
		if (!languageMapping) {
			return null
		}

		// Normalize input for exact matching - single pass replacement
		// Remove ? and ! for matching, but keep dots as-is (they're wildcards in regex, but for exact match we compare literally)
		const normalizedInput = str.toLowerCase().replace(/[?!]/g, '')

		// Check exact matches
		for (let profanity1 in languageMapping) {
			const profanityArray = languageMapping[profanity1]
			if (!this._isArray(profanityArray)) {
				continue
			}

			const profanity1sorted = this._sortByLengthDesc(profanityArray)
			const profanity1sortedLen = profanity1sorted.length
			const profanity1Lower = profanity1.toLowerCase()

			for (let p1 = 0; p1 < profanity1sortedLen; p1++) {
				// For exact match, normalize pattern: remove escaped $, trim, but keep dots as-is
				// Dots in patterns are treated as literal characters for exact match (not wildcards)
				// This is different from regex matching where dots are wildcards
				const pattern = profanity1sorted[p1]
				if (!this._isString(pattern)) {
					continue
				}
				const normalizedPattern = pattern.replace(/\\\$/g, '$').trim().toLowerCase()

				if (normalizedInput === normalizedPattern) {
					// Check if it's in replace list
					const replacement = this._checkReplaceList(profanity1Lower, data.replace, language)
					return { category: profanity1, replacement: replacement }
				}
			}
		}

		return null
	}

	/**
	 * Removes numbers (0-9) and number emoji from a string, replacing them with the replacement string.
	 * @param {string} str - The string to process
	 * @returns {string} The string with numbers removed, or the original value if not a string
	 */
	remove_numbers(str) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated
		// Combine number patterns into single regex
		return str.replace(/[0-9]|\ud83d\udd1f/g, this.REPLACEMENT_STRING)
	}

	/**
	 * Removes zalgo text (excessive combining diacritical marks) from a string.
	 * @param {string} str - The string to process
	 * @returns {string} The string with zalgo characters removed, or the original value if not a string
	 */
	remove_zalgo(str) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated
		return str.replace(/[\u030B\u0300-\u036F\u0483-\u0486\u064E\u064F]/g, '').replace(/[\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F\u05C7\u0610-\u061A\u0656-\u065F\u0670\u06D6-\u06ED\u0711\u0730-\u073F\u0743-\u074A\u0F18-\u0F19\u0F35\u0F37\u0F72-\u0F73\u0F7A-\u0F81\u0F84\u0e00-\u0eff\uFC5E-\uFC62]{2,}/gi, '')
	}

	/**
	 * Removes spam patterns from a string, including emails, websites, and other spam content.
	 * Uses patterns from the English blacklist mapping.
	 * @param {string} str - The string to process
	 * @returns {string} The string with spam patterns removed, or the original value if not a string
	 */
	remove_spam(str) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated

		const blacklistData = this.blacklist_data
		if (!blacklistData) {
			return str
		}

		// Remove emails, websites, and spam patterns
		const enMapping = this._getLanguageMapping(blacklistData, 'en')
		if (!enMapping) {
			return this._cleanWhitespace(str)
		}

		// Cache replacement string to avoid repeated property access
		const replacementStr = this.REPLACEMENT_STRING
		const spamCategories = ['emailshidden', 'websitesbanned', 'spam']
		const spamCategoriesLen = spamCategories.length

		for (let catIdx = 0; catIdx < spamCategoriesLen; catIdx++) {
			const categoryArray = enMapping[spamCategories[catIdx]]
			if (!this._isArray(categoryArray)) {
				continue
			}
			const categoryArrayLen = categoryArray.length
			for (let item = 0; item < categoryArrayLen; item++) {
				const spamPattern = categoryArray[item]
				if (!this._isString(spamPattern) || this._isEmpty(spamPattern)) {
					continue
				}
				const regex = this._createRegex(spamPattern, 'gi')
				if (regex) {
					str = str.replace(regex, replacementStr)
				}
			}
		}

		return this._cleanWhitespace(str)
	}

	/**
	 * Removes duplicate characters from a string.
	 * Limits consecutive non-replacement characters to 2, and other characters to 4.
	 * @param {string} str - The string to process
	 * @returns {string} The string with duplicates removed, or the original value if not a string
	 */
	remove_duplicates(str) {
		const validated = this._validateStringInput(str)
		if (!validated) {
			return str
		}
		str = validated
		return str.replace(/([^`])\1{2,}/gi, '$1').replace(/(.)\1{3,}/gi, '$1$1$1$1')
	}

	/**
	 * Common profanity check logic shared by has_profanity and remove_profanity.
	 * Validates input, normalizes text, and returns common data structure.
	 * @private
	 * @param {*} str - The text to check
	 * @param {string} [language] - The language code (optional, will be validated)
	 * @returns {{enabled: boolean, str: string, language: string, blacklistData: Object}} An object with enabled status, normalized string, language code, and blacklist data
	 */
	_checkProfanityCommon(str, language) {
		if (!this._isBlacklistEnabled()) {
			return this._DISABLED_RESULT
		}

		// Input validation
		const validation = this._validateInput(str, language)
		if (!validation.valid) {
			return this._DISABLED_RESULT
		}

		// Apply normalization pipeline
		const normalizedStr = this._normalizeText(validation.str, validation.language)

		return {
			enabled: true,
			str: normalizedStr,
			language: validation.language,
			blacklistData: this.blacklist_data
		}
	}

	/**
	 * Checks if a string contains profanity.
	 * Checks exact matches, regex matches, and swear words.
	 * @param {*} str - The text to check (will be converted to string if needed)
	 * @param {string} [language='en'] - The language code for checking (defaults to 'en')
	 * @returns {boolean} True if profanity is found, false otherwise
	 */
	has_profanity(str, language) {
		const common = this._checkProfanityCommon(str, language)
		if (!common.enabled) {
			return false
		}

		const lang = common.language

		// Check exact matches first
		const exactMatch = this._checkExactMatch(common.str, lang, common.blacklistData)
		if (exactMatch) {
			return true
		}

		// Check regex matches (dynamic language support)
		if (this._testRegexObject(this.blacklist_search_regex[lang], common.str)) {
			return true
		}

		// Check swear words (generic for any language)
		const languageMapping = this._getLanguageMapping(common.blacklistData, lang)
		if (languageMapping && languageMapping.swear) {
			return this._processSwearWords(common.str, languageMapping.swear, false)
		}

		return false
	}

	/**
	 * Removes profanity from a string by replacing it with replacement strings or category names.
	 * Checks exact matches first, then applies regex replacements, then checks swear words.
	 * @param {*} str - The text to process (will be converted to string if needed)
	 * @param {string} [language='en'] - The language code for filtering (defaults to 'en')
	 * @returns {string} The text with profanity removed/replaced, or the original string if blacklist is disabled
	 */
	remove_profanity(str, language) {
		const common = this._checkProfanityCommon(str, language)
		if (!common.enabled) {
			return str
		}

		const lang = common.language
		const languageMapping = this._getLanguageMapping(common.blacklistData, lang)
		if (!languageMapping) {
			return common.str
		}

		// Cache constants to avoid repeated property access
		const prefix = this.REPLACEMENT_PREFIX
		const suffix = this.REPLACEMENT_SUFFIX
		const replacementStr = this.REPLACEMENT_STRING

		// Check exact matches first
		const exactMatch = this._checkExactMatch(common.str, lang, common.blacklistData)
		if (exactMatch) {
			const isEnglish = lang === 'en'
			if (exactMatch.replacement) {
				return prefix + (isEnglish ? exactMatch.replacement : '') + suffix
			}
			return isEnglish ? exactMatch.category : replacementStr
		}

		// Cache regex objects to avoid repeated property access
		const searchRegex = this.blacklist_search_regex[lang]
		const replaceRegex = this.blacklist_replace_regex[lang]

		// Apply regex replacements (dynamic language support)
		let result = this._applyRegexReplacements(searchRegex, common.str, this._searchReplacementFn)

		// Apply replace regex (dynamic language support)
		result = this._applyRegexReplacements(replaceRegex, result, function(category) {
			return ' ' + prefix + category + suffix + ' '
		})

		// Check swear words (generic for any language)
		if (languageMapping.swear) {
			result = this._processSwearWords(result, languageMapping.swear, true)
		}

		return this._cleanWhitespace(result)
	}

	/**
	 * Main text filtering method that applies the complete filtering pipeline.
	 * Normalizes text, removes numbers (if enabled), spam, duplicates, and profanity.
	 * @param {*} str - The text to filter (will be converted to string if needed)
	 * @param {string} [language='en'] - The language code for filtering (defaults to 'en')
	 * @returns {string} The filtered text
	 */
	filter_text(str, language) {
		// Input validation
		const validation = this._validateInput(str, language)
		if (!validation.valid) {
			return validation.str
		}
		str = validation.str
		language = validation.language

		// Apply filtering pipeline
		// 1-2. Remove zalgo and normalize (using _normalizeText which handles both)
		str = this._normalizeText(str, language)

		// 3. Remove numbers (only if option is enabled)
		if (this.removeNumbers) {
			str = this.remove_numbers(str)
		}

		// 4. Remove spam
		str = this.remove_spam(str)

		// 5. Remove duplicates
		str = this.remove_duplicates(str)

		// 6. Remove profanity
		str = this.remove_profanity(str, language)

		return str
	}

	/**
	 * Checks if a nickname contains profanity without modifying it.
	 * @param {*} str - The nickname to check (will be converted to string if needed)
	 * @param {string} [language='en'] - The language code for filtering (defaults to 'en')
	 * @returns {boolean} True if profanity is detected, false otherwise
	 */
	hasProfanity(str, language) {
		// Input validation
		const validation = this._validateInput(str, language)
		if (!validation.valid) {
			return false
		}
		const originalStr = validation.str
		language = validation.language

		// Early return if blacklist is disabled
		if (!this._isBlacklistEnabled()) {
			return false
		}

		// Prepare normalized version for detection
		const zalgoRemovedStr = this.remove_zalgo(originalStr)
		const normalized = this._normalizeWithMapping(zalgoRemovedStr, this.NORMALIZE_TYPES)
		const normalizedStr = normalized.normalized

		// Check if profanity exists using normalized version
		let hasProfanity = false

		// Check exact matches
		const exactMatch = this._checkExactMatch(normalizedStr, language, this.blacklist_data)
		if (exactMatch) {
			hasProfanity = true
		}

		// Check regex matches
		if (!hasProfanity && this.blacklist_search_regex[language]) {
			hasProfanity = this._testRegexObject(this.blacklist_search_regex[language], normalizedStr)
		}

		// Check swear words
		if (!hasProfanity) {
			const languageMapping = this._getLanguageMapping(this.blacklist_data, language)
			if (languageMapping && languageMapping.swear) {
				hasProfanity = this._processSwearWords(normalizedStr, languageMapping.swear, false)
			}
		}

		return hasProfanity
	}

	/**
	 * Filters a nickname by surgically replacing only profane parts while preserving Unicode characters.
	 * Returns the original nickname unchanged if no profanity is detected.
	 * If profanity is detected, only the profane portions are replaced, preserving fancy Unicode styling.
	 * @param {*} str - The nickname to filter (will be converted to string if needed)
	 * @param {string} [language='en'] - The language code for filtering (defaults to 'en')
	 * @returns {string} The filtered nickname (unchanged if no profanity, or with only profane parts replaced)
	 */
	filter_nickname(str, language) {
		// Input validation
		const validation = this._validateInput(str, language)
		if (!validation.valid) {
			return validation.str
		}
		const originalStr = validation.str
		language = validation.language

		// Early return if blacklist is disabled
		if (!this._isBlacklistEnabled()) {
			// Still apply minimal cleanup
			let result = originalStr
			if (result.charAt(0) === '/') {
				result = result.substring(1)
			}
			return this._cleanWhitespace(result)
		}

		// Prepare normalized version for detection (with position mapping)
		// We need to track positions through zalgo removal and normalization
		// Use remove_zalgo to get zalgo-removed version, then build mapping
		const zalgoRemovedStr = this.remove_zalgo(originalStr)

		// Build mapping from zalgo-removed positions to original positions
		// by comparing characters between original and zalgo-removed strings
		const originalArr = Array.from(originalStr)
		const zalgoRemovedArr = Array.from(zalgoRemovedStr)
		const zalgoMapping = [] // Maps from zalgo-removed position to original position

		let origIdx = 0
		for (let zalgoIdx = 0; zalgoIdx < zalgoRemovedArr.length; zalgoIdx++) {
			// Find matching character in original string
			while (origIdx < originalArr.length) {
				if (originalArr[origIdx] === zalgoRemovedArr[zalgoIdx]) {
					zalgoMapping.push(origIdx)
					origIdx++
					break
				}
				origIdx++
			}
			// If we couldn't find a match, skip this character (shouldn't happen normally)
			if (origIdx >= originalArr.length && zalgoIdx < zalgoRemovedArr.length - 1) {
				// Use last known position as fallback
				zalgoMapping.push(zalgoMapping.length > 0 ? zalgoMapping[zalgoMapping.length - 1] : 0)
			}
		}

		const strForDetection = zalgoRemovedStr

		// Normalize with position mapping (exclude diacritics for non-English)
		const normalize_types = language !== 'en' ? this.NORMALIZE_TYPES_NO_DIACRITICS : this.NORMALIZE_TYPES
		const normalized = this._normalizeWithMapping(strForDetection, normalize_types)
		const normalizedStr = normalized.normalized
		const normalizeMapping = normalized.mapping

		// Combine mappings: normalized position -> zalgo-removed position -> original position
		const positionMapping = []
		for (let i = 0; i < normalizeMapping.length; i++) {
			const zalgoPos = normalizeMapping[i]
			if (zalgoPos >= 0 && zalgoPos < zalgoMapping.length) {
				positionMapping.push(zalgoMapping[zalgoPos])
			} else {
				positionMapping.push(-1) // Invalid mapping
			}
		}

		// Check if profanity exists using normalized version
		// Use a simplified check that doesn't require full normalization pipeline
		let hasProfanity = false

		// Check exact matches
		const exactMatch = this._checkExactMatch(normalizedStr, language, this.blacklist_data)
		if (exactMatch) {
			hasProfanity = true
		}

		// Check regex matches
		if (!hasProfanity && this.blacklist_search_regex[language]) {
			hasProfanity = this._testRegexObject(this.blacklist_search_regex[language], normalizedStr)
		}

		// Check swear words
		if (!hasProfanity) {
			const languageMapping = this._getLanguageMapping(this.blacklist_data, language)
			if (languageMapping && languageMapping.swear) {
				hasProfanity = this._processSwearWords(normalizedStr, languageMapping.swear, false)
			}
		}

		// Early return: if no profanity found, return original unchanged
		if (!hasProfanity) {
			return originalStr
		}

		// Profanity detected: surgically replace only profane parts
		// Create a copy of original array for modification
		const resultArr = Array.from(originalStr)
		let result = this._replaceProfanitySurgically(resultArr, normalizedStr, positionMapping, language)

		// Apply minimal cleanup
		// Remove leading '/' character
		if (result.charAt(0) === '/') {
			result = result.substring(1)
		}

		// Clean up whitespace
		result = this._cleanWhitespace(result)

		return result
	}
}

// Export for both CommonJS and ES6 modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = ChatFilter
}

// Also make available globally for script tag usage
if (typeof window !== 'undefined') {
	window.ChatFilter = ChatFilter
}