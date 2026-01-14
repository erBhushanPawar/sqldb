/**
 * Location normalization for handling city name variations, aliases, and canonical forms
 */

import {
  LocationNormalization,
  GeoBucket,
  GeoPoint,
  MAJOR_CITY_BUCKETS,
} from '../types/geo-search';

export class LocationNormalizer {
  private normalizationMap: Map<string, LocationNormalization> = new Map();
  private aliasMap: Map<string, string> = new Map(); // alias -> canonical
  private buckets: GeoBucket[];

  constructor(
    buckets: GeoBucket[] = MAJOR_CITY_BUCKETS,
    customMappings: LocationNormalization[] = []
  ) {
    this.buckets = buckets;
    this.buildNormalizationMaps(customMappings);
  }

  /**
   * Build normalization maps from buckets and custom mappings
   */
  private buildNormalizationMaps(customMappings: LocationNormalization[]): void {
    // Add bucket-based normalizations
    for (const bucket of this.buckets) {
      const bucketName = bucket.name || bucket.locationName || bucket.id;
      const normalized: LocationNormalization = {
        original: bucketName,
        canonical: bucketName,
        coordinates: bucket.center,
        bucketId: bucket.id,
        aliases: bucket.aliases || [],
      };

      // Map canonical name
      this.normalizationMap.set(this.normalizeString(bucketName), normalized);

      // Map all aliases
      if (bucket.aliases) {
        for (const alias of bucket.aliases) {
          this.aliasMap.set(this.normalizeString(alias), bucketName);
        }
      }
    }
    // Add custom mappings (override bucket mappings if conflicts)
    for (const mapping of customMappings) {
      const key = this.normalizeString(mapping.original);
      this.normalizationMap.set(key, mapping);

      // Map canonical
      this.aliasMap.set(key, mapping.canonical);

      // Map aliases
      if (mapping.aliases) {
        for (const alias of mapping.aliases) {
          this.aliasMap.set(this.normalizeString(alias), mapping.canonical);
        }
      }
    }
  }

  /**
   * Normalize a location string to canonical form
   */
  normalize(location: string): LocationNormalization | null {
    if (!location || typeof location !== 'string') {
      return null;
    }

    const normalized = this.normalizeString(location);

    // Check direct match
    const direct = this.normalizationMap.get(normalized);
    if (direct) {
      return direct;
    }

    // Check alias match
    const canonical = this.aliasMap.get(normalized);
    if (canonical) {
      const canonicalNorm = this.normalizationMap.get(this.normalizeString(canonical));
      if (canonicalNorm) {
        return {
          ...canonicalNorm,
          original: location, // Preserve original input
        };
      }
    }

    // Try fuzzy matching for common misspellings
    const fuzzyMatch = this.fuzzyMatch(normalized);
    if (fuzzyMatch) {
      return {
        ...fuzzyMatch,
        original: location,
      };
    }

    // Return as-is if no normalization found
    return {
      original: location,
      canonical: location,
    };
  }

  /**
   * Normalize string for comparison (lowercase, trim, remove special chars)
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Fuzzy match for common misspellings and variations
   */
  private fuzzyMatch(normalized: string): LocationNormalization | null {
    const threshold = 0.8; // Similarity threshold

    for (const [key, value] of this.normalizationMap.entries()) {
      const similarity = this.stringSimilarity(normalized, key);
      if (similarity >= threshold) {
        return value;
      }

      // Also check aliases
      if (value.aliases) {
        for (const alias of value.aliases) {
          const aliasSim = this.stringSimilarity(normalized, this.normalizeString(alias));
          if (aliasSim >= threshold) {
            return value;
          }
        }
      }
    }

    return null;
  }

  /**
   * Calculate string similarity using Dice coefficient
   */
  private stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length < 2 || str2.length < 2) return 0;

    const bigrams1 = this.getBigrams(str1);
    const bigrams2 = this.getBigrams(str2);

    const intersection = bigrams1.filter((bigram) => bigrams2.includes(bigram)).length;
    const union = bigrams1.length + bigrams2.length;

    return (2 * intersection) / union;
  }

  /**
   * Get bigrams from string
   */
  private getBigrams(str: string): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  }

  /**
   * Get coordinates for a location name
   */
  getCoordinates(location: string): GeoPoint | null {
    const normalized = this.normalize(location);
    return normalized?.coordinates || null;
  }

  /**
   * Get bucket for a location name
   */
  getBucket(location: string): GeoBucket | null {
    const normalized = this.normalize(location);
    if (!normalized?.bucketId) return null;

    return this.buckets.find((b) => b.id === normalized.bucketId) || null;
  }

  /**
   * Find all variations of a canonical location name
   */
  getVariations(canonical: string): string[] {
    const normalized = this.normalizeString(canonical);
    const mapping = this.normalizationMap.get(normalized);

    if (!mapping) return [canonical];

    const variations = new Set<string>();
    variations.add(mapping.canonical);

    if (mapping.aliases) {
      mapping.aliases.forEach((alias) => variations.add(alias));
    }

    return Array.from(variations);
  }

  /**
   * Add a custom location mapping
   */
  addMapping(mapping: LocationNormalization): void {
    const key = this.normalizeString(mapping.original);
    this.normalizationMap.set(key, mapping);

    // Update alias map
    this.aliasMap.set(key, mapping.canonical);
    if (mapping.aliases) {
      for (const alias of mapping.aliases) {
        this.aliasMap.set(this.normalizeString(alias), mapping.canonical);
      }
    }
  }

  /**
   * Batch add multiple mappings
   */
  addMappings(mappings: LocationNormalization[]): void {
    for (const mapping of mappings) {
      this.addMapping(mapping);
    }
  }

  /**
   * Get all canonical locations
   */
  getAllCanonicalLocations(): string[] {
    const canonical = new Set<string>();
    for (const mapping of this.normalizationMap.values()) {
      canonical.add(mapping.canonical);
    }
    return Array.from(canonical).sort();
  }

  /**
   * Check if a location is recognized
   */
  isRecognized(location: string): boolean {
    const normalized = this.normalize(location);
    return normalized !== null && normalized.canonical !== location;
  }

  /**
   * Get statistics about normalization coverage
   */
  getStats(): {
    totalCanonical: number;
    totalAliases: number;
    totalBuckets: number;
  } {
    return {
      totalCanonical: this.normalizationMap.size,
      totalAliases: this.aliasMap.size,
      totalBuckets: this.buckets.length,
    };
  }
}

/**
 * Common location aliases for US cities
 */
export const US_CITY_ALIASES: LocationNormalization[] = [
  {
    original: 'The Big Apple',
    canonical: 'New York City',
    aliases: ['Big Apple', 'NYC'],
  },
  {
    original: 'Sin City',
    canonical: 'Las Vegas',
    aliases: ['Vegas', 'LV', 'Las Vegas'],
  },
  {
    original: 'Motor City',
    canonical: 'Detroit',
    aliases: ['The D', 'Detroit', 'DTW'],
  },
  {
    original: 'Music City',
    canonical: 'Nashville',
    aliases: ['Nash', 'Nashville', 'BNA'],
  },
  {
    original: 'The Mile High City',
    canonical: 'Denver',
    aliases: ['Denver', 'DEN'],
  },
  {
    original: 'The Emerald City',
    canonical: 'Seattle',
    aliases: ['Seattle', 'SEA'],
  },
  {
    original: 'The City of Angels',
    canonical: 'Los Angeles',
    aliases: ['LA', 'Los Angeles', 'LAX'],
  },
  {
    original: 'The Windy City',
    canonical: 'Chicago',
    aliases: ['Chicago', 'Chi-Town', 'ORD'],
  },
  {
    original: 'Philly',
    canonical: 'Philadelphia',
    aliases: ['Philadelphia', 'PHL'],
  },
  {
    original: 'ATX',
    canonical: 'Austin',
    aliases: ['Austin', 'ATX'],
  },
];

/**
 * Common location aliases for international cities
 */
export const INTERNATIONAL_CITY_ALIASES: LocationNormalization[] = [
  {
    original: 'The Big Smoke',
    canonical: 'London',
    aliases: ['London', 'LDN'],
  },
  {
    original: 'The City of Light',
    canonical: 'Paris',
    aliases: ['Paris', 'CDG'],
  },
  {
    original: 'The Big Mango',
    canonical: 'Bangkok',
    aliases: ['Bangkok', 'BKK'],
  },
  {
    original: 'The Big Durian',
    canonical: 'Jakarta',
    aliases: ['Jakarta', 'CGK'],
  },
];
