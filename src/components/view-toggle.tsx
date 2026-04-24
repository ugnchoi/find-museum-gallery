"use client";

import { List, Map as MapIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "map";

type ViewToggleProps = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
};

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="보기 전환"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1 shadow-sm",
        className
      )}
    >
      <Button
        type="button"
        size="sm"
        variant={value === "list" ? "default" : "ghost"}
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "h-8 gap-1.5 rounded-full px-3 text-xs font-medium",
          value === "list" ? "shadow-sm" : "text-muted-foreground hover:bg-transparent hover:text-foreground"
        )}
      >
        <List className="h-3.5 w-3.5" aria-hidden />
        목록
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "map" ? "default" : "ghost"}
        aria-pressed={value === "map"}
        onClick={() => onChange("map")}
        className={cn(
          "h-8 gap-1.5 rounded-full px-3 text-xs font-medium",
          value === "map" ? "shadow-sm" : "text-muted-foreground hover:bg-transparent hover:text-foreground"
        )}
      >
        <MapIcon className="h-3.5 w-3.5" aria-hidden />
        지도
      </Button>
    </div>
  );
}
