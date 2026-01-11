/**
 * Search Ranker
 *
 * Implements ranking algorithms for search results:
 * - TF-IDF (Term Frequency - Inverse Document Frequency)
 * - Field boosting (title matches rank higher than description)
 * - Proximity scoring (words closer together rank higher)
 * - Freshness scoring (newer documents rank higher - optional)
 */

import {
  ScoringContext,
  RankingWeights,
  DEFAULT_RANKING_WEIGHTS,
  SearchResult,
  TokenMetadata,
} from '../types/search';
import { Tokenizer } from './tokenizer';

export class SearchRanker {
  private weights: RankingWeights;

  constructor(weights?: Partial<RankingWeights>) {
    this.weights = {
      ...DEFAULT_RANKING_WEIGHTS,
      ...weights,
    };
  }

  /**
   * Calculate TF-IDF score for a term in a document
   *
   * TF (Term Frequency): How often does the term appear in this document?
   * IDF (Inverse Document Frequency): How rare is this term across all documents?
   *
   * Formula: TF-IDF = TF * IDF
   * where:
   *   TF = (term frequency in document) / (total terms in document)
   *   IDF = log((total documents) / (documents containing term))
   */
  calculateTfIdf(context: ScoringContext): number {
    const { termFrequency, docFrequency, totalDocs } = context;

    // Term Frequency (TF)
    // Normalize by document length (not available here, so use raw frequency)
    const tf = termFrequency;

    // Inverse Document Frequency (IDF)
    // Add 1 to avoid division by zero
    const idf = Math.log((totalDocs + 1) / (docFrequency + 1));

    return tf * idf;
  }

  /**
   * Calculate field boost score
   * Fields with higher boost values rank better
   */
  calculateFieldBoost(fieldBoost: number): number {
    return fieldBoost;
  }

  /**
   * Calculate proximity score
   * Documents where query terms appear close together rank higher
   */
  calculateProximityScore(proximityScore?: number): number {
    return proximityScore || 0;
  }

  /**
   * Calculate freshness score (optional)
   * Newer documents rank higher
   */
  calculateFreshnessScore(createdAt?: number, decayDays: number = 30): number {
    if (!createdAt) return 0;

    const now = Date.now();
    const ageMs = now - createdAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Exponential decay: score decreases as document ages
    // After 30 days, score is ~0.5
    // After 60 days, score is ~0.25
    return Math.exp(-ageDays / decayDays);
  }

  /**
   * Calculate combined score for a document
   */
  calculateScore(context: ScoringContext): number {
    const tfIdf = this.calculateTfIdf(context);
    const fieldBoost = this.calculateFieldBoost(context.fieldBoost);
    const proximity = this.calculateProximityScore(context.proximityScore);

    // Combine scores with weights
    let score =
      tfIdf * this.weights.tfIdfWeight +
      fieldBoost * this.weights.fieldBoostWeight +
      proximity * this.weights.proximityWeight;

    // Normalize to 0-1 range
    score = Math.min(1, score / 10); // Divide by 10 as rough normalization

    return score;
  }

  /**
   * Rank search results by relevance
   */
  rankResults<T>(
    results: Array<{ docId: number; data: T }>,
    queryTerms: string[],
    termStats: Map<
      string,
      {
        docFrequency: number;
        termFrequenciesByDoc: Map<number, number>;
      }
    >,
    totalDocs: number,
    fieldBoosts?: Record<string, number>,
    proximityScores?: Map<number, number>
  ): SearchResult<T>[] {
    const scored: SearchResult<T>[] = [];

    for (const result of results) {
      let totalScore = 0;
      const matchedTerms: string[] = [];

      // Calculate score for each query term
      for (const term of queryTerms) {
        const stats = termStats.get(term);
        if (!stats) continue;

        const termFreq = stats.termFrequenciesByDoc.get(result.docId);
        if (!termFreq) continue;

        matchedTerms.push(term);

        // Calculate score for this term
        const context: ScoringContext = {
          term,
          docId: result.docId,
          termFrequency: termFreq,
          docFrequency: stats.docFrequency,
          totalDocs,
          fieldBoost: this.getAverageFieldBoost(fieldBoosts || {}),
          proximityScore: proximityScores?.get(result.docId),
        };

        totalScore += this.calculateScore(context);
      }

      // Average score across all matched terms
      const avgScore = matchedTerms.length > 0 ? totalScore / matchedTerms.length : 0;

      scored.push({
        score: avgScore,
        data: result.data,
        matchedTerms,
      });
    }

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  /**
   * Get average field boost value
   */
  private getAverageFieldBoost(fieldBoosts: Record<string, number>): number {
    const values = Object.values(fieldBoosts);
    if (values.length === 0) return 1.0;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Calculate BM25 score (more advanced than TF-IDF)
   *
   * BM25 is a ranking function used by search engines.
   * It's an improvement over TF-IDF with better handling of:
   * - Document length normalization
   * - Term saturation (diminishing returns for high TF)
   *
   * Formula: BM25 = IDF * (TF * (k1 + 1)) / (TF + k1 * (1 - b + b * (docLen / avgDocLen)))
   * where:
   *   k1 = term frequency saturation parameter (typical: 1.2-2.0)
   *   b = length normalization parameter (typical: 0.75)
   */
  calculateBM25(
    termFrequency: number,
    docFrequency: number,
    totalDocs: number,
    docLength: number,
    avgDocLength: number,
    k1: number = 1.5,
    b: number = 0.75
  ): number {
    // IDF component (same as TF-IDF)
    const idf = Math.log((totalDocs - docFrequency + 0.5) / (docFrequency + 0.5) + 1);

    // TF component with saturation and length normalization
    const numerator = termFrequency * (k1 + 1);
    const denominator = termFrequency + k1 * (1 - b + b * (docLength / avgDocLength));
    const tf = numerator / denominator;

    return idf * tf;
  }

  /**
   * Highlight search terms in text
   */
  highlightText(
    text: string,
    terms: string[],
    preTag: string = '<mark>',
    postTag: string = '</mark>',
    tokenizer?: Tokenizer
  ): string {
    if (!text || terms.length === 0) {
      return text;
    }

    // Create regex pattern for all terms (case-insensitive)
    // Escape special regex characters
    const escapedTerms = terms.map(term =>
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // Match whole words only
    const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');

    // Replace matches with highlighted version
    return text.replace(pattern, `${preTag}$1${postTag}`);
  }

  /**
   * Generate text snippet with highlighted terms
   */
  generateSnippet(
    text: string,
    terms: string[],
    maxLength: number = 150,
    preTag: string = '<mark>',
    postTag: string = '</mark>'
  ): string {
    if (!text) return '';

    // Find first occurrence of any search term
    const lowerText = text.toLowerCase();
    const lowerTerms = terms.map(t => t.toLowerCase());

    let firstIndex = -1;
    for (const term of lowerTerms) {
      const index = lowerText.indexOf(term);
      if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
        firstIndex = index;
      }
    }

    if (firstIndex === -1) {
      // No terms found, return start of text
      return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    // Calculate snippet boundaries
    const contextLength = Math.floor((maxLength - 20) / 2);
    let start = Math.max(0, firstIndex - contextLength);
    let end = Math.min(text.length, firstIndex + contextLength);

    // Adjust to word boundaries
    if (start > 0) {
      const spaceIndex = text.lastIndexOf(' ', start);
      if (spaceIndex !== -1) start = spaceIndex + 1;
    }

    if (end < text.length) {
      const spaceIndex = text.indexOf(' ', end);
      if (spaceIndex !== -1) end = spaceIndex;
    }

    // Extract snippet
    let snippet = text.substring(start, end);

    // Add ellipsis
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    // Highlight terms
    snippet = this.highlightText(snippet, terms, preTag, postTag);

    return snippet;
  }

  /**
   * Calculate proximity between multiple terms in a document
   */
  calculateMultiTermProximity(tokens: TokenMetadata[], queryTerms: string[]): number {
    if (queryTerms.length <= 1) return 0;

    const positions = new Map<string, number[]>();

    // Collect positions for each query term
    for (const token of tokens) {
      if (queryTerms.includes(token.term)) {
        if (!positions.has(token.term)) {
          positions.set(token.term, []);
        }
        positions.get(token.term)!.push(...token.positions);
      }
    }

    // If not all terms found, proximity is 0
    if (positions.size < queryTerms.length) {
      return 0;
    }

    // Calculate minimum span containing all terms
    const allPositions = Array.from(positions.values());
    let minSpan = Infinity;

    // For each position of the first term
    for (const pos1 of allPositions[0]) {
      // Find closest position of other terms
      let maxDistance = 0;

      for (let i = 1; i < allPositions.length; i++) {
        const positions = allPositions[i];

        // Find closest position to pos1
        let minDistance = Infinity;
        for (const pos of positions) {
          const distance = Math.abs(pos - pos1);
          minDistance = Math.min(minDistance, distance);
        }

        maxDistance = Math.max(maxDistance, minDistance);
      }

      minSpan = Math.min(minSpan, maxDistance);
    }

    // Convert span to score (closer = higher score)
    if (minSpan === 0) return 1.0;
    if (minSpan <= 2) return 0.9;
    if (minSpan <= 5) return 0.7;
    if (minSpan <= 10) return 0.5;
    if (minSpan <= 20) return 0.3;
    return 0.1;
  }
}

/**
 * Helper function to create ranker with custom weights
 */
export function createRanker(weights?: Partial<RankingWeights>): SearchRanker {
  return new SearchRanker(weights);
}
