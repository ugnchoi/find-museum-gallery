import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";

const MUSEUM_TABLE = "museum-gallery-db";

type RegionRow = {
  id: string;
  name: string;
  slug: string;
  parent_region_id: string | null;
  parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type ParentRegionRow = {
  id: string;
  name: string;
  slug: string;
};

type RegionCountRow = {
  region_id: string | null;
  count: number;
};

export async function GET() {
  const supabase = supabaseServer();

  try {
    const [childResult, parentResult] = await Promise.all([
      supabase
        .from("regions")
        .select("id, name, slug, parent_region_id, parent:parent_region_id(id, name, slug)")
        .not("parent_region_id", "is", null)
        .order("name", { ascending: true }),
      supabase
        .from("regions")
        .select("id, name, slug")
        .is("parent_region_id", null)
        .order("name", { ascending: true })
    ]);

    if (childResult.error) {
      throw childResult.error;
    }

    if (parentResult.error) {
      throw parentResult.error;
    }

    const countMap = new Map<string, number>();
    let unassigned = 0;

    const PAGE_SIZE = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from(MUSEUM_TABLE)
        .select("region_id")
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      const batch = (data ?? []) as RegionCountRow[];

      if (batch.length === 0) {
        break;
      }

      batch.forEach(({ region_id }) => {
        if (!region_id) {
          unassigned += 1;
          return;
        }

        countMap.set(region_id, (countMap.get(region_id) ?? 0) + 1);
      });

      if (batch.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;
    }

    const childRegions = ((childResult.data ?? []) as unknown as RegionRow[]);
    const parentRegions = ((parentResult.data ?? []) as unknown as ParentRegionRow[]);

    const childItems = childRegions.map((region) => ({
      id: region.id,
      name: region.name,
      slug: region.slug,
      parentId: region.parent_region_id,
      parentName: region.parent?.name ?? null,
      parentSlug: region.parent?.slug ?? null,
      count: countMap.get(region.id) ?? 0
    }));

    const parentItems = parentRegions.map((region) => {
      const directCount = countMap.get(region.id) ?? 0;
      const descendantCount = childItems
        .filter((child) => child.parentId === region.id)
        .reduce((sum, child) => sum + child.count, 0);

      return {
        id: region.id,
        name: region.name,
        slug: region.slug,
        count: directCount + descendantCount
      };
    });

    const assignedMuseums = Array.from(countMap.entries()).reduce((sum, [regionId, value]) => {
      if (!regionId) {
        return sum;
      }

      return sum + value;
    }, 0);

    return NextResponse.json({
      items: childItems,
      parents: parentItems,
      summary: {
        totalRegions: childItems.length,
        totalParentRegions: parentItems.length,
        assignedMuseums,
        unassignedMuseums: unassigned
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase 쿼리 중 알 수 없는 오류가 발생했습니다.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
