import { NextResponse } from "next/server";

import { computeBoundingBox, calculateHaversineDistanceKm } from "@/lib/geo";
import { normalizeMuseum } from "@/lib/museums/normalize";
import { supabaseServer } from "@/lib/supabase-server";
import { type Museum } from "@/types/museum";

export const dynamic = "force-dynamic";

const TABLE_NAME = "museum-gallery-db";
const DEFAULT_RADIUS_KM = 25;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_RADIUS_KM = 100;
const FALLBACK_LIMIT = 500;

type ParsedQuery = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  limit: number;
};

type NearbyResponse = {
  items: Museum[];
  totalCount: number;
  distanceKm: number;
  limit: number;
  fallback?: boolean;
};

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store"
};

const parseNumberParam = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const parseQueryParams = (
  searchParams: URLSearchParams
): { error: string } | { data: ParsedQuery } => {
  const latitudeParam = parseNumberParam(searchParams.get("lat"));
  const longitudeParam = parseNumberParam(searchParams.get("lon"));

  if (latitudeParam === null || longitudeParam === null) {
    return { error: "lat and lon query parameters are required and must be numeric." };
  }

  if (latitudeParam < -90 || latitudeParam > 90 || longitudeParam < -180 || longitudeParam > 180) {
    return { error: "lat must be between -90 and 90; lon must be between -180 and 180." };
  }

  const radiusParam = parseNumberParam(searchParams.get("distanceKm"));
  const limitParam = parseNumberParam(searchParams.get("limit"));

  const radiusKm = clamp(radiusParam ?? DEFAULT_RADIUS_KM, 0.1, MAX_RADIUS_KM);
  const limit = clamp(limitParam ?? DEFAULT_LIMIT, 1, MAX_LIMIT);

  return {
    data: {
      latitude: latitudeParam,
      longitude: longitudeParam,
      radiusKm,
      limit
    }
  };
};

const buildSuccessResponse = ({
  items,
  totalCount,
  distanceKm,
  limit,
  fallback
}: NearbyResponse) =>
  NextResponse.json(
    {
      items,
      totalCount,
      distanceKm,
      limit,
      fallback
    },
    { headers: RESPONSE_HEADERS }
  );

const buildErrorResponse = (message: string, status: number) =>
  NextResponse.json({ message }, { status, headers: RESPONSE_HEADERS });

const mapNormalizedMuseums = (rows: Record<string, any>[]): Museum[] =>
  rows.map((row) => normalizeMuseum(row));

const shouldFallback = (message: string) => {
  const lowered = message.toLowerCase();

  return (
    lowered.includes("find_nearby_museums") ||
    lowered.includes("earthdistance") ||
    lowered.includes("cube")
  );
};

const FALLBACK_SELECT_COLUMNS = [
  "id",
  "facil_name",
  "address_road",
  "address_jb",
  "latitude",
  "longitude",
  "type",
  "provider_code",
  "phone",
  "org_name",
  "org_site",
  "transportation",
  "facil_intro",
  "admin_org_phone",
  "admin_org",
  "data_update_date",
  "region_id"
].join(", ");

const sortByDistance = (museumA: Museum, museumB: Museum) => {
  const distanceA = museumA.distanceKm ? Number(museumA.distanceKm) : Number.POSITIVE_INFINITY;
  const distanceB = museumB.distanceKm ? Number(museumB.distanceKm) : Number.POSITIVE_INFINITY;

  return distanceA - distanceB;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams);

  if ("error" in parsed) {
    return buildErrorResponse(parsed.error, 400);
  }

  const { latitude, longitude, radiusKm, limit } = parsed.data;
  const supabase = supabaseServer();

  try {
    const { data, error } = await supabase.rpc("find_nearby_museums", {
      lat: latitude,
      lon: longitude,
      radius_km: radiusKm,
      limit_rows: limit
    });

    if (!error && Array.isArray(data)) {
      const items = mapNormalizedMuseums(data);

      if (process.env.NODE_ENV !== "production") {
        console.info("[museums.nearby] RPC distance query succeeded", {
          count: items.length,
          radiusKm
        });
      }

      return buildSuccessResponse({
        items,
        totalCount: items.length,
        distanceKm: radiusKm,
        limit
      });
    }

    if (!error) {
      throw new Error("Unexpected response without data or error.");
    }

    if (!shouldFallback(error.message)) {
      throw error;
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[museums.nearby] Falling back to application-side distance calculation", {
        radiusKm,
        limit,
        reason: error.message
      });
    }

    const boundingBox = computeBoundingBox({
      center: { latitude, longitude },
      radiusKm
    });

    const { data: fallbackData, error: fallbackError } = await supabase
      .from(TABLE_NAME)
      .select(FALLBACK_SELECT_COLUMNS)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("latitude", boundingBox.minLatitude)
      .lte("latitude", boundingBox.maxLatitude)
      .gte("longitude", boundingBox.minLongitude)
      .lte("longitude", boundingBox.maxLongitude)
      .limit(FALLBACK_LIMIT);

    if (fallbackError) {
      throw fallbackError;
    }

    const fallbackRows = Array.isArray(fallbackData) ? fallbackData : [];
    type FallbackRow = Record<string, any> & {
      latitude: number | string | null;
      longitude: number | string | null;
    };

    const items = (fallbackRows as FallbackRow[])
      .map((row) => {
        const museumLatitude = Number(row.latitude);
        const museumLongitude = Number(row.longitude);

        if (!Number.isFinite(museumLatitude) || !Number.isFinite(museumLongitude)) {
          return null;
        }

        const distanceKm = calculateHaversineDistanceKm({
          origin: { latitude, longitude },
          destination: { latitude: museumLatitude, longitude: museumLongitude }
        });

        if (!Number.isFinite(distanceKm)) {
          return null;
        }

        if (distanceKm > radiusKm) {
          return null;
        }

        return normalizeMuseum({
          ...row,
          distance_km: distanceKm
        });
      })
      .filter((value): value is Museum => Boolean(value))
      .sort(sortByDistance)
      .slice(0, limit);

    return buildSuccessResponse({
      items,
      totalCount: items.length,
      distanceKm: radiusKm,
      limit,
      fallback: true
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "인근 박물관을 조회하는 중 알 수 없는 오류가 발생했습니다.";

    return buildErrorResponse(message, 500);
  }
}

