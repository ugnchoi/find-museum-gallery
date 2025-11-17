"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Globe, Map } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
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

const columns: ColumnDef<Museum>[] = [
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
      const regionLabel = museum.region?.trim() ?? "";
      const subtitle = regionLabel || "지역 정보 없음";

      return (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{row.getValue("name")}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      );
    },
  },
  {
    id: "website",
    header: () => <span className="text-sm font-medium text-muted-foreground">웹사이트</span>,
    cell: ({ row }) => {
      const museum = row.original;
      const rawHomepage = museum.homepageUrl?.trim() ?? "";

      if (!rawHomepage) {
        return null;
      }

      const formattedUrl =
        rawHomepage.startsWith("http://") || rawHomepage.startsWith("https://")
          ? rawHomepage
          : `https://${rawHomepage}`;

      const handleClick = () => {
        window.open(formattedUrl, "_blank", "noopener,noreferrer");
      };

      const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        window.open(formattedUrl, "_blank", "noopener,noreferrer");
      };

      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={`${museum.name} 웹사이트 열기`}
          tabIndex={0}
          type="button"
        >
          <Globe className="h-4 w-4" />
        </Button>
      );
    }
  },
  {
    id: "map",
    header: () => <span className="text-sm font-medium text-muted-foreground">지도에서 보기</span>,
    cell: ({ row }) => {
      const museum = row.original;
      const primaryAddress = museum["address_street"]?.trim() ?? "";
      const secondaryAddress = museum["address_jb"]?.trim() ?? "";
      const fallbackAddress = museum.address?.trim() ?? "";
      const searchAddress = primaryAddress || secondaryAddress || fallbackAddress;

      if (!searchAddress) {
        return (
          <Button
            variant="ghost"
            size="icon"
            disabled
            aria-label={`${museum.name} 지도 주소가 없습니다.`}
            tabIndex={0}
          >
            <Map className="h-4 w-4" />
          </Button>
        );
      }

      const searchUrl = `https://map.naver.com/p/search/${encodeURIComponent(searchAddress)}`;

      const handleClick = () => {
        window.open(searchUrl, "_blank", "noopener,noreferrer");
      };

      const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        window.open(searchUrl, "_blank", "noopener,noreferrer");
      };

      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={`${museum.name} 지도에서 보기`}
          tabIndex={0}
          type="button"
        >
          <Map className="h-4 w-4" />
        </Button>
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

const nearbyColumns: ColumnDef<Museum>[] = [columns[0], distanceColumn, ...columns.slice(1)];

type NearbyState = "idle" | "locating" | "fetching" | "error";

const NEARBY_RADIUS_OPTIONS = [10, 25, 50];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"regions" | "nearby" | "settings">("regions");
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [regionTotalCount, setRegionTotalCount] = useState(0);
  const [nearbyTotalCount, setNearbyTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearbyMuseums, setNearbyMuseums] = useState<Museum[] | null>(null);
  const [nearbyState, setNearbyState] = useState<NearbyState>("idle");
  const [nearbyRadius, setNearbyRadius] = useState<number>(NEARBY_RADIUS_OPTIONS[1]);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<GeoCoordinate | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const nearbyRequestIdRef = useRef(0);

  const isRegionView = activeTab === "regions";
  const isNearbyView = activeTab === "nearby";

  const isLocatingNearby = nearbyState === "locating";
  const isFetchingNearby = nearbyState === "fetching";
  const isNearbyError = nearbyState === "error";

  const hasNearbyAttempt =
    nearbyMuseums !== null || isLocatingNearby || isFetchingNearby || isNearbyError;
  const hasNearbyResults = (nearbyMuseums?.length ?? 0) > 0;

  const shouldShowRegionSkeleton = isRegionView && isLoading;
  const shouldShowNearbySkeleton =
    isNearbyView && !hasNearbyResults && (isLocatingNearby || isFetchingNearby);

  const regionTableBusy = isRegionView ? isLoading : false;
  const nearbyTableBusy = isNearbyView ? isFetchingNearby : false;

  const fetchMuseums = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        return;
      }

      if (!selectedProvince && !selectedRegion) {
        setMuseums([]);
        setRegionTotalCount(0);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: "1",
          size: "500"
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
        setRegionTotalCount(payload.totalCount ?? items.length);
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

  useEffect(() => {
    if (!isRegionView) {
      return;
    }

    const controller = new AbortController();

    void fetchMuseums(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchMuseums, isRegionView]);

  const fetchRegions = useCallback(async () => {
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

  useEffect(() => {
    void fetchRegions();
  }, [fetchRegions]);

  const activeRegion = useMemo(
    () => regions.find((region) => region.slug === selectedRegion),
    [regions, selectedRegion]
  );

  const activeProvince = useMemo(
    () => provinces.find((province) => province.slug === selectedProvince),
    [provinces, selectedProvince]
  );

  const formatRegionLabel = useCallback((region: RegionOption) => {
    if (region.parentName && region.name.startsWith(`${region.parentName} `)) {
      const childLabel = region.name.slice(region.parentName.length).trim();
      return `${region.parentName} · ${childLabel}`;
    }

    return region.name;
  }, []);

  const formatProvinceLabel = useCallback((province: ProvinceOption) => province.name, []);

  const filteredRegions = useMemo(() => {
    if (!selectedProvince) {
      return [];
    }

    return regions.filter((region) => region.parentSlug === selectedProvince);
  }, [regions, selectedProvince]);

  useEffect(() => {
    if (!selectedRegion) {
      return;
    }

    const isRegionAvailable = filteredRegions.some((region) => region.slug === selectedRegion);

    if (!isRegionAvailable) {
      setSelectedRegion("");
    }
  }, [filteredRegions, selectedRegion]);

  useEffect(() => {
    if (activeRegion?.parentSlug && !selectedProvince) {
      setSelectedProvince(activeRegion.parentSlug);
    }
  }, [activeRegion, selectedProvince]);

  const regionDescription = useMemo(() => {
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
      return `${label} 지역에 ${regionTotalCount.toLocaleString()}개 기관이 있습니다.`;
    }

    if (activeProvince) {
      const label = formatProvinceLabel(activeProvince);
      return `${label} 지역에 ${regionTotalCount.toLocaleString()}개 기관이 있습니다.`;
    }

    return `${regionTotalCount.toLocaleString()}개 기관이 등록되어 있습니다.`;
  }, [
    activeProvince,
    activeRegion,
    error,
    formatProvinceLabel,
    formatRegionLabel,
    isLoading,
    regionTotalCount,
    selectedProvince,
    selectedRegion
  ]);

  const handleProvinceChange = useCallback((value: string) => {
    const nextProvince = value === "all" ? "" : value;
    setSelectedProvince(nextProvince);
    setSelectedRegion("");
  }, []);

  const handleRegionChange = useCallback((value: string) => {
    const nextRegion = value === "all" ? "" : value;
    setSelectedRegion(nextRegion);
  }, []);

  const handleClearRegion = useCallback(() => {
    setSelectedRegion("");
  }, []);

  const handleClearProvince = useCallback(() => {
    setSelectedProvince("");
    setSelectedRegion("");
  }, []);

  const handleRetry = useCallback(() => {
    void fetchMuseums();
  }, [fetchMuseums]);

  const nearbyDescription = useMemo(() => {
    if (!hasNearbyAttempt) {
      return "위치 권한을 허용하면 내 주변 박물관을 바로 확인할 수 있습니다.";
    }

    if (isLocatingNearby) {
      return "현재 위치를 확인하는 중입니다...";
    }

    if (isFetchingNearby && !hasNearbyResults) {
      return `반경 ${nearbyRadius}km 내 박물관을 불러오는 중입니다...`;
    }

    if (isNearbyError && nearbyError) {
      return nearbyError;
    }

    if ((nearbyMuseums?.length ?? 0) === 0) {
      return "내 주변에서 박물관을 찾지 못했습니다.";
    }

    const formattedCount = nearbyTotalCount.toLocaleString();
    const fallbackSuffix = usedFallback ? " (대체 계산)" : "";
    return `내 위치 기준 반경 ${nearbyRadius}km 내에 ${formattedCount}개 기관이 있습니다${fallbackSuffix}.`;
  }, [
    hasNearbyAttempt,
    hasNearbyResults,
    isFetchingNearby,
    isLocatingNearby,
    isNearbyError,
    nearbyError,
    nearbyMuseums?.length,
    nearbyRadius,
    nearbyTotalCount,
    usedFallback
  ]);

  const nearMeStatusMessage = useMemo(() => {
    if (!hasNearbyAttempt) {
      return "";
    }

    if (isLocatingNearby) {
      return "현재 위치를 확인하는 중입니다.";
    }

    if (isFetchingNearby) {
      return "주변 박물관을 불러오는 중입니다.";
    }

    if (isNearbyError && nearbyError) {
      return nearbyError;
    }

    if ((nearbyMuseums?.length ?? 0) === 0) {
      return "내 주변에서 박물관을 찾지 못했습니다.";
    }

    return usedFallback
      ? "확장 기능 없이 대체 계산으로 결과를 제공합니다."
      : "내 주변 검색이 완료되었습니다.";
  }, [
    hasNearbyAttempt,
    isFetchingNearby,
    isLocatingNearby,
    isNearbyError,
    nearbyError,
    nearbyMuseums?.length,
    usedFallback
  ]);

  const handleTopLevelTabChange = useCallback((value: string) => {
    if (value === "regions" || value === "nearby" || value === "settings") {
      setActiveTab(value);
    }
  }, []);

  const beginNearbyRequest = useCallback(() => {
    const nextRequestId = nearbyRequestIdRef.current + 1;
    nearbyRequestIdRef.current = nextRequestId;
    return nextRequestId;
  }, []);

  const fetchNearbyMuseums = useCallback(
    async (location: GeoCoordinate, radius: number, requestId: number) => {
      setNearbyState("fetching");
      setNearbyError(null);

      try {
        const params = new URLSearchParams({
          lat: location.latitude.toString(),
          lon: location.longitude.toString(),
          distanceKm: radius.toString()
        });

        const response = await fetch(`/api/museums/nearby?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as
          | {
              items?: Museum[];
              totalCount?: number;
              message?: string;
              fallback?: boolean;
            }
          | null;

        if (!response.ok || !payload) {
          const message = payload?.message ?? "내 주변 기관을 불러오지 못했습니다.";
          throw new Error(message);
        }

        const items = Array.isArray(payload.items) ? payload.items : [];

        if (process.env.NODE_ENV !== "production") {
          const logLabel = payload.fallback
            ? "[nearby] Fallback distance calculation used"
            : "[nearby] RPC distance calculation used";
          console.info(logLabel, {
            count: items.length,
            radiusKm: radius
          });
        }

        if (nearbyRequestIdRef.current !== requestId) {
          return;
        }

        setUsedFallback(Boolean(payload.fallback));
        setNearbyMuseums(items);
        setNearbyTotalCount(payload.totalCount ?? items.length);
        setNearbyState("idle");
      } catch (caughtError) {
        if (nearbyRequestIdRef.current !== requestId) {
          return;
        }

        setNearbyState("error");
        setNearbyError(
          caughtError instanceof Error
            ? caughtError.message
            : "내 주변 기관을 불러오지 못했습니다."
        );
      }
    },
    []
  );

  const getLocationErrorMessage = useCallback((geoError: GeolocationPositionError) => {
    if (geoError.code === geoError.PERMISSION_DENIED) {
      return "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용한 뒤 다시 시도하세요.";
    }

    if (geoError.code === geoError.TIMEOUT) {
      return "위치 정보를 가져오는 데 시간이 초과되었습니다. 주변 환경을 확인하고 다시 시도하세요.";
    }

    return "위치 정보를 확인하지 못했습니다. 다시 시도해주세요.";
  }, []);

  const handleNearMeClick = useCallback(() => {
    if (nearbyState === "locating" || nearbyState === "fetching") {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNearbyState("error");
      setNearbyError("현재 기기에서는 위치 정보를 사용할 수 없습니다.");
      return;
    }

    const requestId = beginNearbyRequest();
    setNearbyState("locating");
    setNearbyError(null);
    setUsedFallback(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: GeoCoordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        setUserLocation(nextLocation);
        void fetchNearbyMuseums(nextLocation, nearbyRadius, requestId);
      },
      (geoError) => {
        if (nearbyRequestIdRef.current !== requestId) {
          return;
        }

        setNearbyState("error");
        setNearbyError(getLocationErrorMessage(geoError));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 10_000
      }
    );
  }, [beginNearbyRequest, fetchNearbyMuseums, getLocationErrorMessage, nearbyRadius, nearbyState]);

  const handleNearMeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNearMeClick();
      }
    },
    [handleNearMeClick]
  );

  const handleRadiusChange = useCallback(
    (value: string) => {
      const nextRadius = Number(value);

      if (!Number.isFinite(nextRadius)) {
        return;
      }

      setNearbyRadius(nextRadius);

      if (userLocation) {
        const requestId = beginNearbyRequest();
        void fetchNearbyMuseums(userLocation, nextRadius, requestId);
      }
    },
    [beginNearbyRequest, fetchNearbyMuseums, userLocation]
  );

  const handleNearbyRetry = useCallback(() => {
    if (userLocation) {
      const requestId = beginNearbyRequest();
      void fetchNearbyMuseums(userLocation, nearbyRadius, requestId);
      return;
    }

    handleNearMeClick();
  }, [beginNearbyRequest, fetchNearbyMuseums, handleNearMeClick, nearbyRadius, userLocation]);

  const nearMeButtonLabel = useMemo(() => {
    if (isLocatingNearby) {
      return "위치 확인 중...";
    }

    if (isFetchingNearby) {
      return "주변 검색 중...";
    }

    return hasNearbyAttempt ? "내 주변 다시 찾기" : "내 주변 박물관 찾기";
  }, [hasNearbyAttempt, isFetchingNearby, isLocatingNearby]);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/30">
      <section className="container grid gap-12 py-16">
        <Tabs value={activeTab} onValueChange={handleTopLevelTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="regions">지역별 목록</TabsTrigger>
            <TabsTrigger value="nearby">내 주변</TabsTrigger>
            <TabsTrigger value="settings">설정</TabsTrigger>
          </TabsList>
          
          <TabsContent value="regions" className="mt-6">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>지역별 박물관 목록</CardTitle>
                </div>
                <CardDescription aria-live="polite">{regionDescription}</CardDescription>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Label htmlFor="province-filter" className="text-sm font-medium text-muted-foreground">
                      광역시/도 선택
                    </Label>
                    <Select
                      value={selectedProvince || "all"}
                      onValueChange={handleProvinceChange}
                      disabled={regionsLoading}
                    >
                      <SelectTrigger id="province-filter" className="min-w-[12rem]">
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {provinces.map((province) => (
                          <SelectItem key={province.id} value={province.slug}>
                            <span className="flex items-center gap-2">
                              <span>{formatProvinceLabel(province)}</span>
                              <Badge variant="secondary" className="ml-auto">
                                {province.count}
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Label htmlFor="region-filter" className="text-sm font-medium text-muted-foreground">
                      지역 선택
                    </Label>
                    <Select
                      value={selectedRegion || "all"}
                      onValueChange={handleRegionChange}
                      disabled={regionsLoading || !selectedProvince}
                    >
                      <SelectTrigger id="region-filter" className="min-w-[12rem]">
                        <SelectValue
                          placeholder={selectedProvince ? "전체" : "광역시/도를 먼저 선택하세요"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {filteredRegions.map((region) => (
                          <SelectItem key={region.id} value={region.slug}>
                            <span className="flex items-center gap-2">
                              <span>{formatRegionLabel(region)}</span>
                              <Badge variant="secondary" className="ml-auto">
                                {region.count}
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
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
                </div>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="space-y-3">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button variant="outline" size="sm" onClick={handleRetry}>
                      다시 시도
                    </Button>
                  </div>
                ) : shouldShowRegionSkeleton ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : (
                  <div aria-busy={regionTableBusy} className="relative">
                    <DataTable
                      columns={columns}
                      data={museums}
                      searchKey="name"
                      searchPlaceholder="박물관명으로 검색..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="nearby" className="mt-6">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>내 주변 박물관 찾기</CardTitle>
                  {nearMeStatusMessage ? (
                    <p className="text-xs text-muted-foreground sm:text-sm" role="status" aria-live="polite">
                      {nearMeStatusMessage}
                    </p>
                  ) : null}
                </div>
                <CardDescription aria-live="polite">{nearbyDescription}</CardDescription>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant={hasNearbyResults ? "secondary" : "outline"}
                      tabIndex={0}
                      aria-pressed={hasNearbyAttempt}
                      aria-label="내 주변 박물관 찾기"
                      onClick={handleNearMeClick}
                      onKeyDown={handleNearMeKeyDown}
                      disabled={isLocatingNearby || isFetchingNearby}
                      className="min-w-[12rem]"
                    >
                      {nearMeButtonLabel}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="nearby-radius" className="text-sm font-medium text-muted-foreground">
                        검색 반경
                      </Label>
                      <Select
                        value={nearbyRadius.toString()}
                        onValueChange={handleRadiusChange}
                        disabled={isLocatingNearby || isFetchingNearby}
                      >
                        <SelectTrigger id="nearby-radius" className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NEARBY_RADIUS_OPTIONS.map((radiusOption) => (
                            <SelectItem key={radiusOption} value={radiusOption.toString()}>
                              {radiusOption}km
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {nearbyError ? (
                  <div className="space-y-3">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{nearbyError}</AlertDescription>
                    </Alert>
                    <Button variant="outline" size="sm" onClick={handleNearbyRetry}>
                      다시 시도
                    </Button>
                  </div>
                ) : shouldShowNearbySkeleton ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : (
                  <div aria-busy={nearbyTableBusy} className="relative">
                    <DataTable
                      columns={nearbyColumns}
                      data={nearbyMuseums ?? []}
                      searchKey="name"
                      searchPlaceholder="박물관명으로 검색..."
                    />
                  </div>
                )}
                {usedFallback ? (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      정확도를 높이기 위해 서버 확장 기능 없이 대체 계산을 사용했습니다.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>설정</CardTitle>
                  <CardDescription>애플리케이션 환경 설정을 관리하세요.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">설정 페이지는 추후에 구성될 예정입니다.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
