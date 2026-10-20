"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Eklenen soru görselinin istenmeyen yerlerini beyaz silgiyle kapatır.
 * Çizim tarayıcıda kalır; Uygula deyince föydeki görsel değişir.
 */
export function FoyGorselSilgi({
  dataUrl,
  onUygula,
}: {
  dataUrl: string;
  onUygula: (dataUrl: string) => void;
}) {
  const tuval = useRef<HTMLCanvasElement | null>(null);
  const ciziyor = useRef(false);
  const son = useRef<{ x: number; y: number } | null>(null);
  const gecmis = useRef<string[]>([]);
  const [acik, setAcik] = useState(false);
  const [firca, setFirca] = useState(18);
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    if (!acik) return;
    const c = tuval.current;
    if (!c) return;
    let iptal = false;
    const img = new Image();
    img.onload = () => {
      if (iptal) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      gecmis.current = [];
      setHazir(true);
    };
    img.src = dataUrl;
    return () => {
      iptal = true;
    };
  }, [acik, dataUrl]);

  const yer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = tuval.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / Math.max(1, r.width)) * c.width,
      y: ((e.clientY - r.top) / Math.max(1, r.height)) * c.height,
    };
  };

  const kalem = () => {
    const c = tuval.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return null;
    const r = c.getBoundingClientRect();
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = firca * (c.width / Math.max(1, r.width));
    return ctx;
  };

  const basla = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = tuval.current;
    if (!c) return;
    try {
      c.setPointerCapture(e.pointerId);
    } catch {
      /* bazı tarayıcılar yakalamayı reddeder */
    }
    if (gecmis.current.length >= 8) gecmis.current.shift();
    gecmis.current.push(c.toDataURL("image/png"));
    ciziyor.current = true;
    const p = yer(e);
    son.current = p;
    const ctx = kalem();
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const surukle = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ciziyor.current || !son.current) return;
    const ctx = kalem();
    if (!ctx) return;
    const p = yer(e);
    ctx.beginPath();
    ctx.moveTo(son.current.x, son.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    son.current = p;
  };

  const bitir = () => {
    ciziyor.current = false;
    son.current = null;
  };

  const geriAl = () => {
    const once = gecmis.current.pop();
    const c = tuval.current;
    if (!once || !c) return;
    const img = new Image();
    img.onload = () => {
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")?.drawImage(img, 0, 0);
    };
    img.src = once;
  };

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="rounded border border-slate-300 px-2 py-1 text-xs"
        data-test="foy-silgi-ac"
      >
        Silgiyle düzelt
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-slate-500">İstemediğiniz yerin üzerinde sürükleyin. Silgi beyaza boyar.</p>
      <canvas
        ref={tuval}
        data-test="foy-silgi-tuval"
        onPointerDown={basla}
        onPointerMove={surukle}
        onPointerUp={bitir}
        onPointerCancel={bitir}
        className="max-h-[50vh] w-full cursor-cell touch-none rounded border border-slate-300 bg-white"
      />
      <label className="block text-[11px] text-slate-500">
        Silgi kalınlığı ({firca})
        <input
          type="range"
          min={6}
          max={48}
          value={firca}
          onChange={(e) => setFirca(Number(e.target.value))}
          className="w-full"
        />
      </label>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={geriAl} className="rounded border px-2 py-1 text-xs" data-test="foy-silgi-geri">
          Geri al
        </button>
        <button
          type="button"
          disabled={!hazir}
          onClick={() => {
            const c = tuval.current;
            if (!c) return;
            onUygula(c.toDataURL("image/png"));
            setAcik(false);
            setHazir(false);
          }}
          className="rounded bg-[#173b70] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          data-test="foy-silgi-uygula"
        >
          Föye yaz
        </button>
        <button
          type="button"
          onClick={() => {
            setAcik(false);
            setHazir(false);
          }}
          className="rounded border px-2 py-1 text-xs"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
