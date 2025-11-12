import { type Museum } from "@/types/museum";

const deriveRegion = (address: string) => {
  if (!address) {
    return "";
  }

  const [province] = address.split(" ");
  return province ?? address;
};

const REGION_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toDistanceString = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(1);
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed.toFixed(1);
    }
  }

  return undefined;
};

export const isRegionUuid = (value: string | null | undefined): value is string =>
  Boolean(value && REGION_UUID_REGEX.test(value));

export const normalizeMuseum = (row: Record<string, any>): Museum => {
  const name = row.facil_name ?? row.name ?? "";
  const addressRoad = row.address_road ?? row.address ?? "";
  const addressLot = row.address_jb ?? row.lotAddress ?? "";
  const facilityType = row.type ?? row.facilityType ?? "";
  const regionRecord = row.regions ?? null;
  const parentRecord = regionRecord?.parent ?? null;

  const derivedId = `${row.provider_code ?? "custom"}-${name}`.replace(/\s+/g, "-");

  const distanceValue = row.distance_km ?? row.distanceKm ?? null;

  return {
    id: String(row.id ?? derivedId),
    name,
    region: regionRecord?.name ?? row.region ?? deriveRegion(addressRoad || addressLot),
    regionId: regionRecord?.id ?? row.region_id ?? undefined,
    regionSlug: regionRecord?.slug ?? undefined,
    provinceName: parentRecord?.name ?? regionRecord?.name ?? undefined,
    provinceSlug: parentRecord?.slug ?? regionRecord?.slug ?? undefined,
    "address_street": addressRoad,
    "address_jb": addressLot,
    address: addressRoad,
    lotAddress: addressLot,
    facilityType,
    phoneNumber: row.phoneNumber ?? row.phone ?? row.admin_org_phone ?? "",
    organizationName: row.organizationName ?? row.org_name ?? row.admin_org ?? "",
    homepageUrl: row.homepageUrl ?? row.org_site ?? "",
    description: row.description ?? row.facil_intro ?? "",
    transportInfo: row.transportInfo ?? row.transportation ?? "",
    referenceDate: row.referenceDate ?? row.data_update_date ?? "",
    latitude: row.latitude ? String(row.latitude) : "",
    longitude: row.longitude ? String(row.longitude) : "",
    distanceKm: toDistanceString(distanceValue)
  };
};

