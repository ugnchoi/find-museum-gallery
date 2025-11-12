export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

export type BoundingBox = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

type BoundingBoxParams = {
  center: GeoCoordinate;
  radiusKm: number;
};

type DistanceParams = {
  origin: GeoCoordinate;
  destination: GeoCoordinate;
};

const EARTH_RADIUS_KM = 6371;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

const clampLatitude = (value: number) => Math.min(Math.max(value, MIN_LATITUDE), MAX_LATITUDE);
const clampLongitude = (value: number) =>
  Math.min(Math.max(value, MIN_LONGITUDE), MAX_LONGITUDE);

const isLatitudeInRange = (value: number) =>
  Number.isFinite(value) && value >= MIN_LATITUDE && value <= MAX_LATITUDE;

const isLongitudeInRange = (value: number) =>
  Number.isFinite(value) && value >= MIN_LONGITUDE && value <= MAX_LONGITUDE;

export const calculateHaversineDistanceKm = ({ origin, destination }: DistanceParams): number => {
  if (
    !isLatitudeInRange(origin.latitude) ||
    !isLatitudeInRange(destination.latitude) ||
    !isLongitudeInRange(origin.longitude) ||
    !isLongitudeInRange(destination.longitude)
  ) {
    return Number.NaN;
  }

  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLon = toRadians(destination.longitude - origin.longitude);
  const originLat = toRadians(origin.latitude);
  const destinationLat = toRadians(destination.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(originLat) * Math.cos(destinationLat);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

export const computeBoundingBox = ({ center, radiusKm }: BoundingBoxParams): BoundingBox => {
  if (!isLatitudeInRange(center.latitude) || !isLongitudeInRange(center.longitude)) {
    return {
      minLatitude: MIN_LATITUDE,
      maxLatitude: MAX_LATITUDE,
      minLongitude: MIN_LONGITUDE,
      maxLongitude: MAX_LONGITUDE
    };
  }

  const safeRadiusKm = Math.max(radiusKm, 0.1);
  const angularDistance = safeRadiusKm / EARTH_RADIUS_KM;
  const latRad = toRadians(center.latitude);
  const lonRad = toRadians(center.longitude);

  const minLatitude = clampLatitude(toDegrees(latRad - angularDistance));
  const maxLatitude = clampLatitude(toDegrees(latRad + angularDistance));

  if (minLatitude <= MIN_LATITUDE || maxLatitude >= MAX_LATITUDE) {
    return {
      minLatitude,
      maxLatitude,
      minLongitude: MIN_LONGITUDE,
      maxLongitude: MAX_LONGITUDE
    };
  }

  const deltaLongitude = Math.asin(Math.sin(angularDistance) / Math.cos(latRad));
  const minLongitude = clampLongitude(toDegrees(lonRad - deltaLongitude));
  const maxLongitude = clampLongitude(toDegrees(lonRad + deltaLongitude));

  return {
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude
  };
};
