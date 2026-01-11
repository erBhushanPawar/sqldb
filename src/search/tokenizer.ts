/**
 * Text Tokenizer
 *
 * Converts text into searchable tokens using various strategies:
 * - Simple: Split by whitespace, lowercase
 * - Stemming: Reduce words to root form (running → run)
 * - N-gram: Split into character sequences (plumb → pl, plu, lum, umb)
 */

import { TokenizerOptions, TokenMetadata, DEFAULT_STOP_WORDS } from '../types/search';

export class Tokenizer {
  private options: Required<TokenizerOptions>;

  constructor(options: Partial<TokenizerOptions>) {
    this.options = {
      type: options.type || 'simple',
      minWordLength: options.minWordLength || 3,
      stopWords: options.stopWords || DEFAULT_STOP_WORDS,
      caseSensitive: options.caseSensitive || false,
      ngramSize: options.ngramSize || 3,
    };
  }

  /**
   * Tokenize text into searchable terms
   */
  tokenize(text: string, field: string = 'default'): TokenMetadata[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    switch (this.options.type) {
      case 'simple':
        return this.tokenizeSimple(text, field);
      case 'stemming':
        return this.tokenizeStemming(text, field);
      case 'ngram':
        return this.tokenizeNgram(text, field);
      default:
        return this.tokenizeSimple(text, field);
    }
  }

  /**
   * Simple tokenization: split by whitespace, lowercase, remove punctuation
   */
  private tokenizeSimple(text: string, field: string): TokenMetadata[] {
    // Normalize case
    const normalized = this.options.caseSensitive ? text : text.toLowerCase();

    // Split by whitespace and punctuation
    const words = normalized.split(/[\s\p{P}]+/u).filter(Boolean);

    const tokens: TokenMetadata[] = [];
    let position = 0;

    for (const word of words) {
      // Skip if too short
      if (word.length < this.options.minWordLength) {
        position++;
        continue;
      }

      // Skip stop words
      if (this.options.stopWords.includes(word)) {
        position++;
        continue;
      }

      // Skip if not alphanumeric
      if (!/\p{L}|\p{N}/u.test(word)) {
        position++;
        continue;
      }

      tokens.push({
        term: word,
        positions: [position],
        field,
      });

      position++;
    }

    return this.mergePositions(tokens);
  }

  /**
   * Stemming tokenization: reduce words to root form
   * Uses Porter Stemmer algorithm (simplified)
   */
  private tokenizeStemming(text: string, field: string): TokenMetadata[] {
    // First do simple tokenization
    const simpleTokens = this.tokenizeSimple(text, field);

    // Apply stemming to each term
    return simpleTokens.map(token => ({
      ...token,
      term: this.stem(token.term),
    }));
  }

  /**
   * N-gram tokenization: split into character sequences
   * Example: "plumb" with n=3 → ["plu", "lum", "umb"]
   */
  private tokenizeNgram(text: string, field: string): TokenMetadata[] {
    const normalized = this.options.caseSensitive ? text : text.toLowerCase();
    const n = this.options.ngramSize;
    const tokens: TokenMetadata[] = [];

    // Remove punctuation and split into words
    const words = normalized.split(/[\s\p{P}]+/u).filter(Boolean);

    let position = 0;

    for (const word of words) {
      // Generate n-grams for this word
      if (word.length >= n) {
        for (let i = 0; i <= word.length - n; i++) {
          const ngram = word.substring(i, i + n);

          tokens.push({
            term: ngram,
            positions: [position],
            field,
          });
        }
      } else if (word.length >= this.options.minWordLength) {
        // Word is shorter than n-gram size, use the whole word
        tokens.push({
          term: word,
          positions: [position],
          field,
        });
      }

      position++;
    }

    return this.mergePositions(tokens);
  }

  /**
   * Porter Stemmer (simplified version)
   * Reduces words to their root form
   */
  private stem(word: string): string {
    // Step 1: Handle plurals and -ed, -ing
    word = this.step1(word);

    // Step 2: Handle -tion, -ation, etc.
    word = this.step2(word);

    // Step 3: Handle -ful, -ness, etc.
    word = this.step3(word);

    // Step 4: Handle -ant, -ence, etc.
    word = this.step4(word);

    // Step 5: Handle -e and -ll
    word = this.step5(word);

    return word;
  }

  private step1(word: string): string {
    // Handle plurals: cats → cat, ponies → poni
    if (word.endsWith('sses')) {
      return word.slice(0, -2);
    }
    if (word.endsWith('ies')) {
      return word.slice(0, -3) + 'i';
    }
    if (word.endsWith('ss')) {
      return word;
    }
    if (word.endsWith('s')) {
      return word.slice(0, -1);
    }

    // Handle -ed, -ing: walked → walk, walking → walk
    if (word.endsWith('eed')) {
      if (this.measureWord(word.slice(0, -3)) > 0) {
        return word.slice(0, -1);
      }
    }
    if (word.endsWith('ed')) {
      const stem = word.slice(0, -2);
      if (this.hasVowel(stem)) {
        return this.fixEnding(stem);
      }
    }
    if (word.endsWith('ing')) {
      const stem = word.slice(0, -3);
      if (this.hasVowel(stem)) {
        return this.fixEnding(stem);
      }
    }

    return word;
  }

  private step2(word: string): string {
    const suffixes = [
      ['ational', 'ate'],
      ['tional', 'tion'],
      ['enci', 'ence'],
      ['anci', 'ance'],
      ['izer', 'ize'],
      ['abli', 'able'],
      ['alli', 'al'],
      ['entli', 'ent'],
      ['eli', 'e'],
      ['ousli', 'ous'],
      ['ization', 'ize'],
      ['ation', 'ate'],
      ['ator', 'ate'],
      ['alism', 'al'],
      ['iveness', 'ive'],
      ['fulness', 'ful'],
      ['ousness', 'ous'],
      ['aliti', 'al'],
      ['iviti', 'ive'],
      ['biliti', 'ble'],
    ];

    for (const [suffix, replacement] of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.measureWord(stem) > 0) {
          return stem + replacement;
        }
      }
    }

    return word;
  }

  private step3(word: string): string {
    const suffixes = [
      ['icate', 'ic'],
      ['ative', ''],
      ['alize', 'al'],
      ['iciti', 'ic'],
      ['ical', 'ic'],
      ['ful', ''],
      ['ness', ''],
    ];

    for (const [suffix, replacement] of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.measureWord(stem) > 0) {
          return stem + replacement;
        }
      }
    }

    return word;
  }

  private step4(word: string): string {
    const suffixes = [
      'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant',
      'ement', 'ment', 'ent', 'ion', 'ou', 'ism', 'ate', 'iti',
      'ous', 'ive', 'ize',
    ];

    for (const suffix of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.measureWord(stem) > 1) {
          return stem;
        }
      }
    }

    return word;
  }

  private step5(word: string): string {
    // Remove final -e
    if (word.endsWith('e')) {
      const stem = word.slice(0, -1);
      const m = this.measureWord(stem);
      if (m > 1 || (m === 1 && !this.endsWithCVC(stem))) {
        return stem;
      }
    }

    // Change -ll to -l
    if (word.endsWith('ll') && this.measureWord(word) > 1) {
      return word.slice(0, -1);
    }

    return word;
  }

  /**
   * Measure the "size" of a word (number of consonant-vowel sequences)
   */
  private measureWord(word: string): number {
    let count = 0;
    let prevIsVowel = false;

    for (const char of word) {
      const isVowel = /[aeiou]/i.test(char);

      if (!isVowel && prevIsVowel) {
        count++;
      }

      prevIsVowel = isVowel;
    }

    return count;
  }

  /**
   * Check if word contains a vowel
   */
  private hasVowel(word: string): boolean {
    return /[aeiou]/i.test(word);
  }

  /**
   * Check if word ends with consonant-vowel-consonant pattern
   */
  private endsWithCVC(word: string): boolean {
    if (word.length < 3) return false;

    const last = word.charAt(word.length - 1);
    const secondLast = word.charAt(word.length - 2);
    const thirdLast = word.charAt(word.length - 3);

    const isConsonant = (c: string) => !/[aeiou]/i.test(c);
    const isVowel = (c: string) => /[aeiou]/i.test(c);

    return (
      isConsonant(thirdLast) &&
      isVowel(secondLast) &&
      isConsonant(last) &&
      !/[wxy]/.test(last)
    );
  }

  /**
   * Fix word ending after removing suffix
   * Example: "hopping" → "hopp" → "hop"
   */
  private fixEnding(word: string): string {
    if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) {
      return word + 'e';
    }

    // Remove double consonant
    if (word.length > 1) {
      const last = word.charAt(word.length - 1);
      const secondLast = word.charAt(word.length - 2);

      if (last === secondLast && !/[aeiou]/.test(last)) {
        return word.slice(0, -1);
      }
    }

    // Add 'e' if word ends with CVC and measure is 1
    if (this.measureWord(word) === 1 && this.endsWithCVC(word)) {
      return word + 'e';
    }

    return word;
  }

  /**
   * Merge duplicate terms and combine their positions
   */
  private mergePositions(tokens: TokenMetadata[]): TokenMetadata[] {
    const merged = new Map<string, TokenMetadata>();

    for (const token of tokens) {
      const key = `${token.field}:${token.term}`;

      if (merged.has(key)) {
        const existing = merged.get(key)!;
        existing.positions.push(...token.positions);
      } else {
        merged.set(key, { ...token });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Get all unique terms from tokens (useful for indexing)
   */
  getUniqueTerms(tokens: TokenMetadata[]): string[] {
    return [...new Set(tokens.map(t => t.term))];
  }

  /**
   * Calculate proximity score between terms
   * Terms closer together get higher scores
   */
  calculateProximity(tokens: TokenMetadata[], term1: string, term2: string): number {
    const positions1 = tokens.find(t => t.term === term1)?.positions || [];
    const positions2 = tokens.find(t => t.term === term2)?.positions || [];

    if (positions1.length === 0 || positions2.length === 0) {
      return 0;
    }

    // Find minimum distance between any two positions
    let minDistance = Infinity;

    for (const pos1 of positions1) {
      for (const pos2 of positions2) {
        const distance = Math.abs(pos1 - pos2);
        minDistance = Math.min(minDistance, distance);
      }
    }

    // Convert distance to score (closer = higher score)
    // Score ranges from 0 (very far) to 1 (adjacent)
    if (minDistance === 1) return 1.0;      // Adjacent
    if (minDistance <= 3) return 0.8;       // Very close
    if (minDistance <= 10) return 0.5;      // Close
    if (minDistance <= 50) return 0.2;      // Far
    return 0.1;                             // Very far
  }
}

/**
 * Helper function to create tokenizer from config
 */
export function createTokenizer(
  type: 'simple' | 'stemming' | 'ngram',
  options?: Partial<TokenizerOptions>
): Tokenizer {
  return new Tokenizer({
    type,
    ...options,
  });
}

/**
 * Helper function to tokenize multiple fields
 */
export function tokenizeFields(
  tokenizer: Tokenizer,
  data: Record<string, any>,
  fields: string[]
): TokenMetadata[] {
  const allTokens: TokenMetadata[] = [];

  for (const field of fields) {
    const value = data[field];
    if (value && typeof value === 'string') {
      const tokens = tokenizer.tokenize(value, field);
      allTokens.push(...tokens);
    }
  }

  return allTokens;
}
