import fs from "fs";
import path from "path";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  }
});

const PAGE_SIZE = 500;

type MuseumRow = {
  facil_name: string;
  address_road: string | null;
  address_jb: string | null;
  region_id: string | null;
};

type RegionRow = {
  id: string;
  name: string;
  slug: string;
  parent_region_id: string | null;
};

type RegionDetails = {
  parent: {
    name: string;
    slug: string;
  } | null;
  child: {
    name: string;
    slug: string;
  } | null;
};

type UnmatchedEntry = { museum: string; address: string | null };

const slugCache = new Map<string, RegionRow>();
const unmatched: UnmatchedEntry[] = [];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const tokenize = (address: string | null) => {
  if (!address) {
    return [];
  }

  return address
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const extractRegionDetails = (addressRoad: string | null, addressLot: string | null): RegionDetails | null => {
  const rawAddress = (addressRoad ?? addressLot ?? "").trim();

  if (!rawAddress) {
    return null;
  }

  const tokens = tokenize(rawAddress);
  const parentName = tokens[0];

  if (!parentName) {
    return null;
  }

  const parentSlug = slugify(parentName);
  const cityToken = tokens[1];

  if (!cityToken) {
    return {
      parent: { name: parentName, slug: parentSlug },
      child: null
    };
  }

  const childName = `${parentName} ${cityToken}`.trim();
  const childSlug = slugify(childName);

  return {
    parent: { name: parentName, slug: parentSlug },
    child: {
      name: childName,
      slug: childSlug
    }
  };
};

const ensureRegion = async ({
  name,
  slug,
  parentId
}: {
  name: string;
  slug: string;
  parentId?: string | null;
}) => {
  if (!name || !slug) {
    return null;
  }

  if (slugCache.has(slug)) {
    const cached = slugCache.get(slug);

    if (cached && parentId && cached.parent_region_id !== parentId) {
      const updateResult = await supabase
        .from("regions")
        .update({ parent_region_id: parentId })
        .eq("id", cached.id);

      if (!updateResult.error) {
        cached.parent_region_id = parentId;
      }
    }

    return cached ?? null;
  }

  const existing = await supabase
    .from("regions")
    .select("id, name, slug, parent_region_id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing.error) {
    console.error("Failed to lookup region", name, existing.error.message);
    return null;
  }

  const existingRegion = existing.data as RegionRow | null;

  if (existingRegion) {
    if (parentId && existingRegion.parent_region_id !== parentId) {
      const updateResult = await supabase
        .from("regions")
        .update({ parent_region_id: parentId })
        .eq("id", existingRegion.id);

      if (!updateResult.error) {
        existingRegion.parent_region_id = parentId;
      }
    }

    slugCache.set(slug, existingRegion);
    return existingRegion;
  }

  const insertResult = await supabase
    .from("regions")
    .insert({ name, slug, parent_region_id: parentId ?? null })
    .select("id, name, slug, parent_region_id")
    .single();

  if (insertResult.error) {
    console.error("Failed to insert region", name, insertResult.error.message);
    return null;
  }

  const insertedRegion = insertResult.data as RegionRow;

  slugCache.set(slug, insertedRegion);
  return insertedRegion;
};

const processMuseumBatch = async (batch: MuseumRow[], processedCount: { value: number }) => {
  for (const museum of batch) {
    if (museum.region_id) {
      processedCount.value += 1;
      continue;
    }

    const details = extractRegionDetails(museum.address_road, museum.address_jb);

    if (!details?.parent) {
      unmatched.push({ museum: museum.facil_name, address: museum.address_road ?? museum.address_jb });
      processedCount.value += 1;
      continue;
    }

    const parentRegion = await ensureRegion(details.parent);

    if (!parentRegion) {
      unmatched.push({ museum: museum.facil_name, address: museum.address_road ?? museum.address_jb });
      processedCount.value += 1;
      continue;
    }

    let targetRegion = parentRegion;

    if (details.child) {
      const childRegion = await ensureRegion({
        name: details.child.name,
        slug: details.child.slug,
        parentId: parentRegion.id
      });

      if (childRegion) {
        targetRegion = childRegion;
      } else {
        unmatched.push({ museum: museum.facil_name, address: museum.address_road ?? museum.address_jb });
        processedCount.value += 1;
        continue;
      }
    }

    const updateResult = await supabase
      .from("museum-gallery-db")
      .update({ region_id: targetRegion.id })
      .eq("facil_name", museum.facil_name);

    if (updateResult.error) {
      console.error("Failed to update museum", museum.facil_name, updateResult.error.message);
    }

    processedCount.value += 1;
  }
};

const logUnmatched = () => {
  if (unmatched.length === 0) {
    return;
  }

  const outputPath = path.resolve(process.cwd(), "scripts/seed/region-unmatched.json");
  fs.writeFileSync(outputPath, JSON.stringify({ unmatched }, null, 2), "utf8");
  console.log(`Logged ${unmatched.length} unmatched museums to ${outputPath}`);
};

const backfillRegions = async () => {
  let offset = 0;
  const processedCount = { value: 0 };

  while (true) {
    const { data, error } = await supabase
      .from("museum-gallery-db")
      .select("facil_name, address_road, address_jb, region_id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch museums", error.message);
      break;
    }

    const batch = (data ?? []) as MuseumRow[];

    if (batch.length === 0) {
      break;
    }

    await processMuseumBatch(batch, processedCount);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  logUnmatched();
  console.log(`Processed ${processedCount.value} museums.`);
};

backfillRegions()
  .then(() => {
    console.log("Region backfill completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Region backfill failed", error instanceof Error ? error.message : error);
    process.exit(1);
  });
