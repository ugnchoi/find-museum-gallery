import { describe, expect, it } from "vitest";

import { calculateHaversineDistanceKm, computeBoundingBox } from "@/lib/geo";

describe("calculateHaversineDistanceKm", () => {
  it("returns zero for identical coordinates", () => {
    const seoulCityHall = { latitude: 37.5665, longitude: 126.978 };
    const distance = calculateHaversineDistanceKm({
      origin: seoulCityHall,
      destination: seoulCityHall
    });

    expect(distance).toBe(0);
  });

  it("computes realistic distance across hemispheres", () => {
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const newYork = { latitude: 40.7128, longitude: -74.006 };

    const distance = calculateHaversineDistanceKm({
      origin: london,
      destination: newYork
    });

    expect(distance).toBeGreaterThan(5500);
    expect(distance).toBeLessThan(5600);
    expect(distance).toBeCloseTo(5570, 0);
  });

  it("returns NaN when coordinates are outside valid ranges", () => {
    const invalidOrigin = { latitude: 120, longitude: 0 };
    const destination = { latitude: 0, longitude: 0 };

    const distance = calculateHaversineDistanceKm({
      origin: invalidOrigin,
      destination
    });

    expect(Number.isNaN(distance)).toBe(true);
  });
});

describe("computeBoundingBox", () => {
  it("creates a bounding box constrained within valid latitude/longitude ranges", () => {
    const center = { latitude: 37.5665, longitude: 126.978 };
    const boundingBox = computeBoundingBox({ center, radiusKm: 25 });

    expect(boundingBox.minLatitude).toBeLessThan(center.latitude);
    expect(boundingBox.maxLatitude).toBeGreaterThan(center.latitude);
    expect(boundingBox.minLongitude).toBeLessThan(center.longitude);
    expect(boundingBox.maxLongitude).toBeGreaterThan(center.longitude);

    [boundingBox.minLatitude, boundingBox.maxLatitude].forEach((lat) => {
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    });

    [boundingBox.minLongitude, boundingBox.maxLongitude].forEach((lon) => {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    });
  });

  it("matches expected angular deltas close to the equator", () => {
    const center = { latitude: 0, longitude: 0 };
    const radiusKm = 50;
    const boundingBox = computeBoundingBox({ center, radiusKm });

    const expectedLatDeltaDeg = (radiusKm / 6371) * (180 / Math.PI);

    expect(boundingBox.maxLatitude - center.latitude).toBeCloseTo(expectedLatDeltaDeg, 3);
    expect(center.latitude - boundingBox.minLatitude).toBeCloseTo(expectedLatDeltaDeg, 3);
  });

  it("falls back to full longitudinal span near the poles", () => {
    const center = { latitude: 89.5, longitude: 45 };
    const boundingBox = computeBoundingBox({ center, radiusKm: 100 });

    expect(boundingBox.minLatitude).toBeGreaterThan(0);
    expect(boundingBox.maxLatitude).toBeLessThanOrEqual(90);
    expect(boundingBox.minLongitude).toBe(-180);
    expect(boundingBox.maxLongitude).toBe(180);
  });
});

