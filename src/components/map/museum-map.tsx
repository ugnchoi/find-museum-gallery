"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AlertCircle, Locate, MapPinOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type GeoCoordinate } from "@/lib/geo";
import { type Museum } from "@/types/museum";

import { useNaverMapScript } from "./use-naver-map-script";

type MuseumWithCoords = Museum & {
  coordinates: NonNullable<Museum["coordinates"]>;
};

type MuseumMapProps = {
  museums: Museum[];
  userLocation?: GeoCoordinate | null;
  radiusKm?: number;
  className?: string;
};

const DEFAULT_CENTER = { lat: 36.5, lng: 127.8 };
const DEFAULT_ZOOM = 7;

const MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.05 0 13.52C0 23.65 14 36 14 36S28 23.65 28 13.52C28 6.05 21.73 0 14 0Z" fill="hsl(38, 65%, 52%)" stroke="hsl(200, 30%, 18%)" stroke-width="1.5"/><circle cx="14" cy="13.5" r="5" fill="white"/></svg>`;

const USER_MARKER_HTML = `<div style="width:14px;height:14px;border-radius:50%;background:hsl(200,80%,50%);border:3px solid white;box-shadow:0 0 0 6px hsla(200,80%,50%,0.25);"></div>`;

export function MuseumMap({ museums, userLocation, radiusKm, className }: MuseumMapProps) {
  const { status, error } = useNaverMapScript();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const markerListenersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);

  const plottedMuseums = useMemo<MuseumWithCoords[]>(
    () =>
      museums.filter(
        (museum): museum is MuseumWithCoords => museum.coordinates !== null
      ),
    [museums]
  );

  useEffect(() => {
    if (status !== "ready" || !containerRef.current || mapRef.current) {
      return;
    }

    const naver = window.naver?.maps;
    if (!naver) return;

    const map = new naver.Map(containerRef.current, {
      center: new naver.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      scaleControl: false,
      logoControlOptions: { position: naver.Position.BOTTOM_LEFT },
      zoomControl: true,
      zoomControlOptions: {
        position: naver.Position.TOP_RIGHT,
        style: naver.ZoomControlStyle.SMALL
      }
    });

    mapRef.current = map;
    infoWindowRef.current = new naver.InfoWindow({
      borderWidth: 0,
      backgroundColor: "transparent",
      disableAnchor: true,
      pixelOffset: new naver.Point(0, -10)
    });
  }, [status]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) {
      return;
    }

    const naver = window.naver?.maps;
    if (!naver) return;

    markerListenersRef.current.forEach((listener) => naver.Event.removeListener(listener));
    markerListenersRef.current = [];
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    infoWindowRef.current?.close();

    const icon = {
      content: MARKER_SVG,
      size: new naver.Size(28, 36),
      anchor: new naver.Point(14, 36)
    };

    plottedMuseums.forEach((museum) => {
      const marker = new naver.Marker({
        position: new naver.LatLng(museum.coordinates.lat, museum.coordinates.lon),
        map: mapRef.current,
        title: museum.name,
        icon
      });

      const listener = naver.Event.addListener(marker, "click", () => {
        if (!infoWindowRef.current) return;
        infoWindowRef.current.setContent(buildInfoWindowContent(museum));
        infoWindowRef.current.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
      markerListenersRef.current.push(listener);
    });

    if (plottedMuseums.length > 0) {
      const bounds = new naver.LatLngBounds();
      plottedMuseums.forEach((museum) => {
        bounds.extend(new naver.LatLng(museum.coordinates.lat, museum.coordinates.lon));
      });
      if (userLocation) {
        bounds.extend(new naver.LatLng(userLocation.latitude, userLocation.longitude));
      }
      mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    } else if (userLocation) {
      mapRef.current.setCenter(new naver.LatLng(userLocation.latitude, userLocation.longitude));
      mapRef.current.setZoom(12);
    }
  }, [plottedMuseums, userLocation, status]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) {
      return;
    }

    const naver = window.naver?.maps;
    if (!naver) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    if (!userLocation) {
      return;
    }

    userMarkerRef.current = new naver.Marker({
      position: new naver.LatLng(userLocation.latitude, userLocation.longitude),
      map: mapRef.current,
      zIndex: 1000,
      icon: {
        content: USER_MARKER_HTML,
        anchor: new naver.Point(10, 10)
      }
    });

    if (radiusKm && radiusKm > 0) {
      circleRef.current = new naver.Circle({
        map: mapRef.current,
        center: new naver.LatLng(userLocation.latitude, userLocation.longitude),
        radius: radiusKm * 1000,
        fillColor: "hsl(38, 65%, 52%)",
        fillOpacity: 0.08,
        strokeColor: "hsl(38, 65%, 40%)",
        strokeOpacity: 0.5,
        strokeWeight: 1
      });
    }
  }, [userLocation, radiusKm, status]);

  useEffect(() => {
    return () => {
      const naver = typeof window !== "undefined" ? window.naver?.maps : undefined;
      if (naver) {
        markerListenersRef.current.forEach((listener) => naver.Event.removeListener(listener));
      }
      markerListenersRef.current = [];
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      circleRef.current?.setMap(null);
      circleRef.current = null;
      infoWindowRef.current?.close();
    };
  }, []);

  const handleRecenter = useCallback(() => {
    if (!userLocation || !mapRef.current) return;
    const naver = window.naver?.maps;
    if (!naver) return;
    mapRef.current.panTo(new naver.LatLng(userLocation.latitude, userLocation.longitude));
    if (mapRef.current.getZoom() < 13) {
      mapRef.current.setZoom(13);
    }
  }, [userLocation]);

  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error?.message ?? "지도를 불러오지 못했습니다."}</AlertDescription>
      </Alert>
    );
  }

  const emptyOverlay = (() => {
    if (status !== "ready" || userLocation) return null;

    if (museums.length === 0) {
      return {
        title: "검색 결과가 없습니다",
        subtitle: "조건을 바꾸어 다시 찾아보세요."
      };
    }

    if (plottedMuseums.length === 0) {
      return {
        title: "표시할 위치 정보가 없습니다",
        subtitle: "선택한 기관들의 좌표가 등록되지 않았습니다."
      };
    }

    return null;
  })();

  const showLegend =
    status === "ready" && (Boolean(userLocation) || plottedMuseums.length > 0);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/60 bg-card/40 shadow-sm",
        className
      )}
    >
      {status !== "ready" ? (
        <div className="absolute inset-0 z-10">
          <Skeleton className="h-full w-full" />
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="h-[420px] w-full sm:h-[560px] lg:h-[640px]"
        aria-label="박물관 지도"
      />

      {showLegend ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
          {userLocation ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-[hsl(200,80%,50%)] ring-2 ring-white"
                aria-hidden
              />
              <span className="text-foreground">내 위치</span>
            </div>
          ) : null}
          {plottedMuseums.length > 0 ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-2.5 rounded-sm bg-accent"
                aria-hidden
              />
              <span className="text-foreground">박물관 · 갤러리</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {userLocation && status === "ready" ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRecenter}
          className="absolute bottom-3 right-3 z-10 h-9 gap-1.5 shadow-md"
          aria-label="내 위치로 이동"
        >
          <Locate className="h-4 w-4" aria-hidden />
          내 위치로
        </Button>
      ) : null}

      {emptyOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/75 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-center">
            <MapPinOff className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">{emptyOverlay.title}</p>
            <p className="text-xs text-muted-foreground">{emptyOverlay.subtitle}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildInfoWindowContent(museum: Museum): string {
  const homepage = museum.homepageUrl?.trim() ?? "";
  const formattedHomepage = homepage
    ? homepage.startsWith("http://") || homepage.startsWith("https://")
      ? homepage
      : `https://${homepage}`
    : "";

  const mapAddress = (
    museum["address_street"]?.trim() ||
    museum["address_jb"]?.trim() ||
    museum.address?.trim() ||
    ""
  ).trim();
  const mapUrl = mapAddress
    ? `https://map.naver.com/p/search/${encodeURIComponent(mapAddress)}`
    : "";

  const subtitle = museum.region?.trim() || "지역 정보 없음";
  const type = museum.facilityType?.trim() || "";
  const distance = museum.distanceKm ? `${Number(museum.distanceKm).toFixed(1)}km` : "";

  const metaParts = [subtitle];
  if (type) metaParts.push(type);
  if (distance) metaParts.push(distance);
  const meta = metaParts.join(" · ");

  return `
    <div style="min-width:220px;max-width:280px;padding:14px;background:hsl(40,30%,99%);border:1px solid hsl(40,15%,88%);border-radius:10px;box-shadow:0 8px 20px hsla(200,30%,18%,0.12);font-family:inherit;">
      <div style="font-family:var(--font-display),'Noto Serif KR',serif;font-size:15px;font-weight:700;color:hsl(200,25%,12%);line-height:1.3;margin-bottom:6px;">${escapeHtml(museum.name)}</div>
      <div style="font-size:12px;color:hsl(215,12%,42%);margin-bottom:10px;line-height:1.4;">${escapeHtml(meta)}</div>
      <div style="display:flex;gap:6px;">
        ${formattedHomepage ? `<a href="${escapeHtml(formattedHomepage)}" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;padding:6px 10px;background:hsl(200,30%,18%);color:hsl(40,30%,97%);border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;">웹사이트</a>` : ""}
        ${mapUrl ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;padding:6px 10px;background:hsl(38,65%,52%);color:hsl(200,30%,14%);border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;">지도에서 보기</a>` : ""}
      </div>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
