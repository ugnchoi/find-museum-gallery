"use client";

import { useEffect, useState } from "react";

type ScriptStatus = "idle" | "loading" | "ready" | "error";

export type NaverMapScriptState = {
  status: ScriptStatus;
  error?: Error;
};

const SCRIPT_ID = "naver-maps-script";

declare global {
  interface Window {
    naver?: {
      maps?: any;
    };
  }
}

export function useNaverMapScript(): NaverMapScriptState {
  const [state, setState] = useState<NaverMapScriptState>({ status: "idle" });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.naver?.maps) {
      setState({ status: "ready" });
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

    if (!clientId) {
      setState({
        status: "error",
        error: new Error(
          "NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 환경 변수가 설정되지 않았습니다."
        )
      });
      return;
    }

    const handleLoad = () => {
      if (window.naver?.maps) {
        setState({ status: "ready" });
      } else {
        setState({
          status: "error",
          error: new Error("Naver Maps 스크립트가 올바르게 로드되지 않았습니다.")
        });
      }
    };

    const handleError = () => {
      setState({
        status: "error",
        error: new Error(
          "Naver Maps 스크립트를 불러오지 못했습니다. API 키 또는 도메인 설정을 확인해주세요."
        )
      });
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      setState({ status: "loading" });
      existing.addEventListener("load", handleLoad);
      existing.addEventListener("error", handleError);
      return () => {
        existing.removeEventListener("load", handleLoad);
        existing.removeEventListener("error", handleError);
      };
    }

    setState({ status: "loading" });

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(
      clientId
    )}`;
    script.async = true;
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  return state;
}
