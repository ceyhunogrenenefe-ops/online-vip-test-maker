"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seçilen görselin üzerinde silgi. Liste öğesi sürüklenebilir olduğu için
 * silgi açıkken sürükleme kapatılır; yoksa boyama yerine kart taşınır.
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
  const gecmis = useRef<ImageData[]>([]);
  const yazilan = useRef<string | null>(null);
  const [acik, setAcik] = useState(true);
  const [firca, setFirca] = useState(22);
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    if (!acik) return;
    if (dataUrl === yazilan.current) return;
    const c = tuval.current;
    if (!c) return;
    let iptal = false;
    const img = new Image();
    img.onload = () => {
      if (iptal) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")?.drawImage(img, 0, 0);
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
    ctx.lineWidth = Math.max(1, firca * (c.width / Math.max(1, r.width)));
    return ctx;
  };

  const basla = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!hazir) return;
    e.preventDefault();
    e.stopPropagation();
    const c = tuval.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    try {
      c.setPointerCapture(e.pointerId);
    } catch {
      /* yakalama şart değil */
    }
    if (c.width * c.height <= 2_000_000) {
      if (gecmis.current.length >= 8) gecmis.current.shift();
      gecmis.current.push(ctx.getImageData(0, 0, c.width, c.height));
    }
    ciziyor.current = true;
    const p = yer(e);
    son.current = p;
    const boya = kalem();
    if (!boya) return;
    boya.beginPath();
    boya.arc(p.x, p.y, boya.lineWidth / 2, 0, Math.PI * 2);
    boya.fill();
  };

  const surukle = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ciziyor.current || !son.current) return;
    e.preventDefault();
    const ctx = kalem();
    if (!ctx) return;
    const p = yer(e);
    ctx.beginPath();
    ctx.moveTo(son.current.x, son.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    son.current = p;
  };

  const kaydet = () => {
    const c = tuval.current;
    if (!c || !ciziyor.current) return;
    ciziyor.current = false;
    son.current = null;
    const url = c.toDataURL("image/png");
    yazilan.current = url;
    onUygula(url);
  };

  const geriAl = () => {
    const once = gecmis.current.pop();
    const c = tuval.current;
    const ctx = c?.getContext("2d");
    if (!once || !c || !ctx) return;
    ctx.putImageData(once, 0, 0);
    const url = c.toDataURL("image/png");
    yazilan.current = url;
    onUygula(url);
  };

  if (!acik) {
    return (
      <div className="space-y-1">
        <img src={dataUrl} alt="" className="max-h-40 w-full object-contain" />
        <button
          type="button"
          onClick={() => setAcik(true)}
          className="rounded border border-slate-300 px-2 py-1 text-xs"
          data-test="foy-silgi-ac"
        >
          Görselin üzerini sil
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-silgi="">
      <p className="text-[11px] text-slate-600">İstemediğiniz yerin üzerinde basılı tutup sürükleyin. Bırakınca föye yazılır.</p>
      <canvas
        ref={tuval}
        data-test="foy-silgi-tuval"
        role="img"
        aria-label="Silgi tuvali"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={basla}
        onPointerMove={surukle}
        onPointerUp={kaydet}
        onPointerCancel={kaydet}
        className="block w-full max-h-[70vh] cursor-cell touch-none rounded border border-slate-300 bg-white"
      />
      <label className="block text-[11px] text-slate-500">
        Silgi kalınlığı ({firca})
        <input
          type="range"
          min={8}
          max={64}
          value={firca}
          onChange={(e) => setFirca(Number(e.target.value))}
          className="w-full"
        />
      </label>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={geriAl} className="rounded border px-2 py-1 text-xs" data-test="foy-silgi-geri">
          Geri al
        </button>
        <button type="button" onClick={() => setAcik(false)} className="rounded border px-2 py-1 text-xs">
          Bitti
        </button>
      </div>
    </div>
  );
}
