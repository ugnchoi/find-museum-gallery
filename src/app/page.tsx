"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type GeoCoordinate } from "@/lib/geo";
import { type Museum } from "@/types/museum";

type RegionOption = {
  id: string;
  name: string;
  slug: string;
  count: number;
  parentId?: string | null;
  parentName?: string | null;
  parentSlug?: string | null;
};

type ProvinceOption = {
  id: string;
  name: string;
  slug: string;
  count: number;
};

const defaultColumns: ColumnDef<Museum>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 h-8 data-[state=open]:bg-accent"
        >
          박물관명
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const museum = row.original;

      return (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{row.getValue("name")}</p>
          {museum.facilityType ? (
            <p className="text-xs text-muted-foreground">{museum.facilityType}</p>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: "address",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 h-8 data-[state=open]:bg-accent"
        >
          주소
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const address = row.getValue<string>("address");
      const { lotAddress } = row.original;

      return (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">{address || "주소 정보 없음"}</p>
          {lotAddress ? (
            <p className="text-xs text-muted-foreground">{lotAddress}</p>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "coordinates",
    header: () => <span className="text-sm font-medium text-muted-foreground">위도 / 경도</span>,
    cell: ({ row }) => {
      const { latitude, longitude } = row.original;

      return (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">
            {latitude ? Number(latitude).toFixed(6) : "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            {longitude ? Number(longitude).toFixed(6) : "-"}
          </p>
        </div>
      );
    }
  }
];

const distanceColumn: ColumnDef<Museum> = {
  accessorKey: "distanceKm",
  header: ({ column }) => {
    return (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4 h-8 data-[state=open]:bg-accent"
      >
        거리 (km)
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    );
  },
  cell: ({ row }) => {
    const distance = row.getValue<string>("distanceKm");

    return (
      <p className="text-sm font-medium text-foreground">
        {distance ? `${Number(distance).toFixed(1)}km` : "-"}
      </p>
    );
  }
};

type NearbyState = "idle" | "locating" | "fetching" | "error";

const NEARBY_RADIUS_OPTIONS = [10, 25, 50];

export default function HomePage() {
  const [museums, setMuseums] = React.useState<Museum[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nearbyMuseums, setNearbyMuseums] = React.useState<Museum[] | null>(null);
  const [nearbyState, setNearbyState] = React.useState<NearbyState>("idle");
  const [nearbyRadius, setNearbyRadius] = React.useState<number>(NEARBY_RADIUS_OPTIONS[1]);
  const [nearbyError, setNearbyError] = React.useState<string | null>(null);
  const [userLocation, setUserLocation] = React.useState<GeoCoordinate | null>(null);
  const [usedFallback, setUsedFallback] = React.useState(false);
  const [regions, setRegions] = React.useState<RegionOption[]>([]);
  const [regionsError, setRegionsError] = React.useState<string | null>(null);
  const [regionsLoading, setRegionsLoading] = React.useState(false);
  const [provinces, setProvinces] = React.useState<ProvinceOption[]>([]);
  const [selectedProvince, setSelectedProvince] = React.useState<string>("");
  const [selectedRegion, setSelectedRegion] = React.useState<string>("");

  const fetchMuseums = React.useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        return;
      }

      if (!selectedProvince && !selectedRegion) {
        setMuseums([]);
        setTotalCount(0);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: "1",
          size: "100"
        });

        if (selectedProvince) {
          params.set("province", selectedProvince);
        }

        if (selectedRegion) {
          params.set("region", selectedRegion);
        }

        const response = await fetch(`/api/museums?${params.toString()}`, {
          signal
        });

        const payload = (await response
          .json()
          .catch(() => null)) as
          | {
              items?: Museum[];
              totalCount?: number;
              message?: string;
            }
          | null;

        if (signal?.aborted) {
          return;
        }

        if (!response.ok || !payload) {
          const message = payload?.message ?? "데이터를 불러오지 못했습니다.";
          throw new Error(message);
        }

        const items = Array.isArray(payload.items)
          ? payload.items
          : payload.items
            ? [payload.items]
            : [];

        setMuseums(items);
        setTotalCount(payload.totalCount ?? items.length);
      } catch (caughtError) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "데이터를 불러오지 못했습니다."
        );
      } finally {
        if (signal?.aborted) {
          return;
        }

        setIsLoading(false);
      }
    },
    [selectedProvince, selectedRegion]
  );

  React.useEffect(() => {
    const controller = new AbortController();

    void fetchMuseums(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchMuseums]);

  const fetchRegions = React.useCallback(async () => {
    setRegionsLoading(true);
    setRegionsError(null);

    try {
      const response = await fetch(`/api/regions`);
      const payload = await response.json();

      if (!response.ok) {
        const message = payload?.message ?? "지역 목록을 불러오지 못했습니다.";
        throw new Error(message);
      }

      setRegions(Array.isArray(payload.items) ? payload.items : []);
      setProvinces(Array.isArray(payload.parents) ? payload.parents : []);
    } catch (caughtError) {
      setRegionsError(
        caughtError instanceof Error
          ? caughtError.message
          : "지역 목록을 불러오지 못했습니다."
      );
    } finally {
      setRegionsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchRegions();
  }, [fetchRegions]);

  const activeRegion = React.useMemo(
    () => regions.find((region) => region.slug === selectedRegion),
    [regions, selectedRegion]
  );

  const activeProvince = React.useMemo(
    () => provinces.find((province) => province.slug === selectedProvince),
    [provinces, selectedProvince]
  );

  const formatRegionLabel = React.useCallback((region: RegionOption) => {
    if (region.parentName && region.name.startsWith(`${region.parentName} `)) {
      const childLabel = region.name.slice(region.parentName.length).trim();
      return `${region.parentName} · ${childLabel}`;
    }

    return region.name;
  }, []);

  const formatProvinceLabel = React.useCallback((province: ProvinceOption) => province.name, []);

  const filteredRegions = React.useMemo(() => {
    if (!selectedProvince) {
      return [];
    }

    return regions.filter((region) => region.parentSlug === selectedProvince);
  }, [regions, selectedProvince]);

  React.useEffect(() => {
    if (!selectedRegion) {
      return;
    }

    const isRegionAvailable = filteredRegions.some((region) => region.slug === selectedRegion);

    if (!isRegionAvailable) {
      setSelectedRegion("");
    }
  }, [filteredRegions, selectedRegion]);

  React.useEffect(() => {
    if (activeRegion?.parentSlug && !selectedProvince) {
      setSelectedProvince(activeRegion.parentSlug);
    }
  }, [activeRegion, selectedProvince]);

  const descriptionMessage = React.useMemo(() => {
    if (error) {
      return "데이터를 불러오지 못했습니다.";
    }

    if (isLoading) {
      return "데이터를 불러오는 중입니다...";
    }

    if (!selectedProvince && !selectedRegion) {
      return "광역시/도 또는 지역을 선택해 목록을 확인하세요.";
    }

    if (activeRegion) {
      const label = formatRegionLabel(activeRegion);
      return `${label} 지역에 ${totalCount.toLocaleString()}개 기관이 있습니다.`;
    }

    if (activeProvince) {
      const label = formatProvinceLabel(activeProvince);
      return `${label} 지역에 ${totalCount.toLocaleString()}개 기관이 있습니다.`;
    }

    return `${totalCount.toLocaleString()}개 기관이 등록되어 있습니다.`;
  }, [activeProvince, activeRegion, error, formatProvinceLabel, formatRegionLabel, isLoading, selectedProvince, selectedRegion, totalCount]);

  const handleProvinceChange = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextProvince = event.target.value;
      setSelectedProvince(nextProvince);
      setSelectedRegion("");
    },
    []
  );

  const handleRegionChange = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedRegion(event.target.value);
    },
    []
  );

  const handleClearRegion = React.useCallback(() => {
    setSelectedRegion("");
  }, []);

  const handleClearProvince = React.useCallback(() => {
    setSelectedProvince("");
    setSelectedRegion("");
  }, []);

  const handleRetry = React.useCallback(() => {
    void fetchMuseums();
  }, [fetchMuseums]);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/30">
      <section className="container grid gap-12 py-16">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>박물관 목록</CardTitle>
                <CardDescription>{descriptionMessage}</CardDescription>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label
                      htmlFor="province-filter"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      광역시/도 선택
                    </label>
                    <select
                      id="province-filter"
                      value={selectedProvince}
                      onChange={handleProvinceChange}
                      className="h-10 min-w-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      disabled={regionsLoading}
                    >
                      <option value="">전체</option>
                      {provinces.map((province) => (
                        <option key={province.id} value={province.slug}>
                          {formatProvinceLabel(province)} ({province.count})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label
                      htmlFor="region-filter"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      지역 선택
                    </label>
                    <select
                      id="region-filter"
                      value={selectedRegion}
                      onChange={handleRegionChange}
                      className="h-10 min-w-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      disabled={regionsLoading || !selectedProvince}
                    >
                      <option value="">{selectedProvince ? "전체" : "광역시/도를 먼저 선택하세요"}</option>
                      {filteredRegions.map((region) => (
                        <option key={region.id} value={region.slug}>
                          {formatRegionLabel(region)} ({region.count})
                        </option>
                      ))}
                    </select>
                  </div>
                  {regionsLoading ? (
                    <span className="text-xs text-muted-foreground">지역 정보를 불러오는 중...</span>
                  ) : null}
                  {regionsError ? (
                    <span className="text-xs text-destructive">{regionsError}</span>
                  ) : null}
                  <div className="flex gap-2">
                    {selectedProvince ? (
                      <Button variant="ghost" size="sm" onClick={handleClearProvince}>
                        광역시/도 해제
                      </Button>
                    ) : null}
                    {selectedRegion ? (
                      <Button variant="ghost" size="sm" onClick={handleClearRegion}>
                        지역 해제
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="space-y-3">
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleRetry}>
                      다시 시도
                    </Button>
                  </div>
                ) : isLoading ? (
                  <div className="space-y-3">
                    <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                    <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
                  </div>
                ) : (
                  <DataTable
                    columns={columns}
                    data={museums}
                    searchKey="name"
                    searchPlaceholder="박물관명으로 검색..."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-6">
            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Analytics Dashboard</CardTitle>
                  <CardDescription>View detailed analytics and metrics.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Analytics content will be displayed here.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Manage your application settings.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Settings content will be displayed here.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
