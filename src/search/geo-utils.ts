/**
 * Geospatial utility functions for distance calculations and geographic operations
 */

import { GeoPoint, GeoDistance, GeoBounds, GeoBucket } from '../types/geo-search';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MI = 3959;
const EARTH_RADIUS_M = 6371000;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate distance between two geographic points using Haversine formula
 * This is accurate for most use cases and performs well
 */
export function calculateDistance(
  point1: GeoPoint,
  point2: GeoPoint,
  unit: 'km' | 'mi' | 'm' = 'km'
): number {
  const lat1 = toRadians(point1.lat);
  const lat2 = toRadians(point2.lat);
  const deltaLat = toRadians(point2.lat - point1.lat);
  const deltaLng = toRadians(point2.lng - point1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  let radius: number;
  switch (unit) {
    case 'mi':
      radius = EARTH_RADIUS_MI;
      break;
    case 'm':
      radius = EARTH_RADIUS_M;
      break;
    default:
      radius = EARTH_RADIUS_KM;
  }

  return radius * c;
}

/**
 * Check if a point is within a given radius from center
 */
export function isWithinRadius(
  point: GeoPoint,
  center: GeoPoint,
  radius: GeoDistance
): boolean {
  const distance = calculateDistance(point, center, radius.unit);
  return distance <= radius.value;
}

/**
 * Check if a point is within geographic bounds
 */
export function isWithinBounds(point: GeoPoint, bounds: GeoBounds): boolean {
  return (
    point.lat >= bounds.southWest.lat &&
    point.lat <= bounds.northEast.lat &&
    point.lng >= bounds.southWest.lng &&
    point.lng <= bounds.northEast.lng
  );
}

/**
 * Calculate bounding box from center point and radius
 * Returns GeoBounds that can be used for efficient filtering
 */
export function calculateBounds(center: GeoPoint, radius: GeoDistance): GeoBounds {
  // Convert radius to kilometers for calculation
  let radiusKm: number;
  switch (radius.unit) {
    case 'mi':
      radiusKm = radius.value * 1.60934;
      break;
    case 'm':
      radiusKm = radius.value / 1000;
      break;
    default:
      radiusKm = radius.value;
  }

  // Calculate latitude offset
  const latOffset = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);

  // Calculate longitude offset (varies by latitude)
  const lngOffset =
    ((radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI)) / Math.cos(toRadians(center.lat));

  return {
    northEast: {
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset,
    },
    southWest: {
      lat: center.lat - latOffset,
      lng: center.lng - lngOffset,
    },
  };
}

/**
 * Find which bucket a point belongs to
 */
export function findBucket(point: GeoPoint, buckets: GeoBucket[]): GeoBucket | null {
  for (const bucket of buckets) {
    if (isWithinRadius(point, bucket.center, bucket.radius)) {
      return bucket;
    }
    // Also check bounds if provided
    if (bucket.bounds && isWithinBounds(point, bucket.bounds)) {
      return bucket;
    }
  }
  return null;
}

/**
 * Find all buckets that intersect with a search area
 */
export function findIntersectingBuckets(
  center: GeoPoint,
  radius: GeoDistance,
  buckets: GeoBucket[]
): GeoBucket[] {
  const searchBounds = calculateBounds(center, radius);
  const intersecting: GeoBucket[] = [];

  for (const bucket of buckets) {
    // Check if bucket center is within search radius
    if (isWithinRadius(bucket.center, center, radius)) {
      intersecting.push(bucket);
      continue;
    }

    // Check if search center is within bucket
    if (isWithinRadius(center, bucket.center, bucket.radius)) {
      intersecting.push(bucket);
      continue;
    }

    // Check for bounds intersection if bucket has bounds
    if (bucket.bounds && boundsIntersect(searchBounds, bucket.bounds)) {
      intersecting.push(bucket);
    }
  }

  return intersecting;
}

/**
 * Check if two bounding boxes intersect
 */
function boundsIntersect(bounds1: GeoBounds, bounds2: GeoBounds): boolean {
  return !(
    bounds1.northEast.lat < bounds2.southWest.lat ||
    bounds1.southWest.lat > bounds2.northEast.lat ||
    bounds1.northEast.lng < bounds2.southWest.lng ||
    bounds1.southWest.lng > bounds2.northEast.lng
  );
}

/**
 * Convert distance between units
 */
export function convertDistance(
  distance: number,
  fromUnit: 'km' | 'mi' | 'm',
  toUnit: 'km' | 'mi' | 'm'
): number {
  if (fromUnit === toUnit) return distance;

  // Convert to km first
  let km: number;
  switch (fromUnit) {
    case 'mi':
      km = distance * 1.60934;
      break;
    case 'm':
      km = distance / 1000;
      break;
    default:
      km = distance;
  }

  // Convert from km to target unit
  switch (toUnit) {
    case 'mi':
      return km / 1.60934;
    case 'm':
      return km * 1000;
    default:
      return km;
  }
}

/**
 * Format distance for display
 */
export function formatDistance(distance: GeoDistance): string {
  const formatted = distance.value.toFixed(2);
  return `${formatted} ${distance.unit}`;
}

/**
 * Calculate the center point of multiple geographic points
 */
export function calculateCenterPoint(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) {
    throw new Error('Cannot calculate center of empty points array');
  }

  if (points.length === 1) {
    return points[0];
  }

  let x = 0;
  let y = 0;
  let z = 0;

  for (const point of points) {
    const lat = toRadians(point.lat);
    const lng = toRadians(point.lng);

    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }

  const total = points.length;
  x /= total;
  y /= total;
  z /= total;

  const centralLng = Math.atan2(y, x);
  const centralSquareRoot = Math.sqrt(x * x + y * y);
  const centralLat = Math.atan2(z, centralSquareRoot);

  return {
    lat: toDegrees(centralLat),
    lng: toDegrees(centralLng),
  };
}

/**
 * Calculate bounding box that contains all points
 */
export function calculateBoundingBox(points: GeoPoint[]): GeoBounds | null {
  if (points.length === 0) return null;

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  return {
    northEast: { lat: maxLat, lng: maxLng },
    southWest: { lat: minLat, lng: minLng },
  };
}

/**
 * Sort points by distance from a center point
 */
export function sortByDistance<T extends { location: GeoPoint }>(
  items: T[],
  center: GeoPoint,
  unit: 'km' | 'mi' | 'm' = 'km'
): Array<T & { distance: number }> {
  const itemsWithDistance = items.map((item) => ({
    ...item,
    distance: calculateDistance(item.location, center, unit),
  }));

  return itemsWithDistance.sort((a, b) => a.distance - b.distance);
}

/**
 * Validate geographic coordinates
 */
export function isValidCoordinates(point: GeoPoint): boolean {
  return (
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180 &&
    !isNaN(point.lat) &&
    !isNaN(point.lng)
  );
}
