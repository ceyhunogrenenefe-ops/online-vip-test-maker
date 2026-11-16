"use client";

import { useEffect, useState } from "react";
import { gorselOku } from "@/lib/deneme/havuz";

/** IndexedDB'deki soru/ortak metin görselini gösterir. `surum` değişince yeniden okur. */
export function HavuzGorsel({ id, surum, className, alt = "" }: { id: string; surum: number; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let iptal = false;
    let u: string | null = null;
    void gorselOku(id).then((b) => {
      if (iptal || !b) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      iptal = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id, surum]);
  if (!url) return <div className={`animate-pulse bg-slate-100 ${className ?? ""}`} style={{ minHeight: 40 }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} draggable={false} />;
}
