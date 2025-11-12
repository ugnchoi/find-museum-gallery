import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";
import { normalizeMuseum, isRegionUuid } from "@/lib/museums/normalize";
import { type Museum } from "@/types/museum";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const TABLE_NAME = "museum-gallery-db";

export async function GET(request: Request) {
  const supabase = supabaseServer();

  const resolveRegionId = async (value: string | null): Promise<string | null> => {
    if (!value) {
      return null;
    }

    if (isRegionUuid(value)) {
      return value;
    }

    const slugLookup = await supabase.from("regions").select("id").eq("slug", value).maybeSingle();

    if (slugLookup.error) {
      throw slugLookup.error;
    }

    if (slugLookup.data?.id) {
      return slugLookup.data.id;
    }

    const nameLookup = await supabase.from("regions").select("id").eq("name", value).maybeSingle();

    if (nameLookup.error) {
      throw nameLookup.error;
    }

    return nameLookup.data?.id ?? null;
  };

  const { searchParams } = new URL(request.url);
  const pageParam = Number(searchParams.get("page")) || DEFAULT_PAGE;
  const sizeParam = Number(searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  const keyword = searchParams.get("keyword")?.trim();
  const regionParam = searchParams.get("region")?.trim();
  const provinceParam = searchParams.get("province")?.trim();

  const from = (pageParam - 1) * sizeParam;
  const to = from + sizeParam - 1;

  try {
    let targetedRegionIds: string[] | null = null;

    if (regionParam) {
      const resolvedRegionId = await resolveRegionId(regionParam);

      if (!resolvedRegionId) {
        return NextResponse.json({
          page: pageParam,
          size: sizeParam,
          totalCount: 0,
          items: []
        });
      }

      targetedRegionIds = [resolvedRegionId];
    }

    if (provinceParam) {
      const parentRegionId = await resolveRegionId(provinceParam);

      if (!parentRegionId) {
        return NextResponse.json({
          page: pageParam,
          size: sizeParam,
          totalCount: 0,
          items: []
        });
      }

      const childLookup = await supabase
        .from("regions")
        .select("id")
        .or(`id.eq.${parentRegionId},parent_region_id.eq.${parentRegionId}`);

      if (childLookup.error) {
        throw childLookup.error;
      }

      const childIds = (childLookup.data ?? []).map((row) => row.id).filter(Boolean);

      if (childIds.length === 0) {
        return NextResponse.json({
          page: pageParam,
          size: sizeParam,
          totalCount: 0,
          items: []
        });
      }

      if (targetedRegionIds && targetedRegionIds.length > 0) {
        targetedRegionIds = targetedRegionIds.filter((id) => childIds.includes(id));

        if (targetedRegionIds.length === 0) {
          return NextResponse.json({
            page: pageParam,
            size: sizeParam,
            totalCount: 0,
            items: []
          });
        }
      } else {
        targetedRegionIds = childIds;
      }
    }

    const shouldInnerJoin = Boolean(targetedRegionIds && targetedRegionIds.length > 0);

    const joinClause = shouldInnerJoin
      ? "regions!inner(id, name, slug, parent_region_id, parent:parent_region_id(id, name, slug))"
      : "regions(id, name, slug, parent_region_id, parent:parent_region_id(id, name, slug))";

    const selectColumns = [
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
      "region_id",
      joinClause
    ].join(", ");

    let query = supabase
      .from(TABLE_NAME)
      .select(selectColumns, { count: "exact" });

    if (keyword) {
      query = query.ilike("facil_name", `%${keyword}%`);
    }

    if (targetedRegionIds && targetedRegionIds.length > 0) {
      query = query.in("region_id", targetedRegionIds);
    }

    const { data, error, count } = await query
      .order("facil_name", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const items = (data ?? []).map((row) => normalizeMuseum(row));

    return NextResponse.json({
      page: pageParam,
      size: sizeParam,
      totalCount: count ?? items.length,
      items
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase 쿼리 중 알 수 없는 오류가 발생했습니다.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
