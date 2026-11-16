"use client";

import { useEffect, useRef, useState } from "react";
import { getCroppedImage, type PixelCrop } from "@/lib/crop";
import { DERS_ADLARI, SIKLAR, type Sik } from "@/lib/deneme/model";
import { gorselSigdir } from "@/lib/deneme/pdf-ayikla";
import { secimiGenislet, secimiUygula, type SecimKenari } from "@/lib/kirp-secim";
import { isPdfFile, renderPdfPageToDataUrl } from "@/lib/pdf-document";

const TUTAMAKLAR: { kenar: Exclude<SecimKenari, "tasi">; sinif: string }[] = [
  { kenar: "nw", sinif: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
  { kenar: "n", sinif: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
  { kenar: "ne", sinif: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
  { kenar: "e", sinif: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  { kenar: "se", sinif: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
  { kenar: "s", sinif: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
  { kenar: "sw", sinif: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
  { kenar: "w", sinif: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
];

export type KesikSoru = {
  dosyaAd: string;
  sayfa: number;
  sayfaSayisi: number;
  gorsel: string;
  ders: string;
  dogru: Sik;
};

export function DenemeKirp({ onYerles }: { onYerles: (soru: KesikSoru) => Promise<void> }) {
  const [dosya, setDosya] = useState<File | null>(null);
  const [sayfaSayisi, setSayfaSayisi] = useState(0);
  const [sayfa, setSayfa] = useState(1);
  const [sayfaUrl, setSayfaUrl] = useState<string | null>(null);
  const [aktif, setAktif] = useState<PixelCrop | null>(null);
  const [ders, setDers] = useState<string>(DERS_ADLARI[0]);
  const [dogru, setDogru] = useState<Sik>("A");
  const [mesaj, setMesaj] = useState("");
  const [hata, setHata] = useState("");
  const [kaydediyor, setKaydediyor] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const baslangic = useRef<{ x: number; y: number } | null>(null);
  const ayar = useRef<{ kenar: SecimKenari; bas: PixelCrop; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!dosya) return;
    let iptal = false;
    void (async () => {
      try {
        const { getPdfPageCount } = await import("@/lib/pdf-document");
        const n = await getPdfPageCount(dosya);
        if (!iptal) {
          setSayfaSayisi(n);
          setSayfa(1);
        }
      } catch (e) {
        if (!iptal) setHata(e instanceof Error ? e.message : "PDF açılamadı.");
      }
    })();
    return () => {
      iptal = true;
    };
  }, [dosya]);

  useEffect(() => {
    if (!dosya || sayfa < 1) return;
    let iptal = false;
    setSayfaUrl(null);
    setAktif(null);
    void renderPdfPageToDataUrl(dosya, sayfa, 2)
      .then((url) => {
        if (!iptal) setSayfaUrl(url);
      })
      .catch((e: Error) => {
        if (!iptal) setHata(e.message || "Sayfa açılamadı.");
      });
    return () => {
      iptal = true;
    };
  }, [dosya, sayfa]);

  const piksel = (e: React.PointerEvent) => {
    const img = imgRef.current;
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * img.naturalWidth,
      y: ((e.clientY - r.top) / r.height) * img.naturalHeight,
    };
  };

  const olcu = () => {
    const img = imgRef.current;
    if (!img?.naturalWidth) return null;
    return { w: img.naturalWidth, h: img.naturalHeight };
  };

  const yerlestir = async () => {
    if (!dosya || !sayfaUrl || !aktif || aktif.width < 12 || aktif.height < 12) {
      setHata("Önce sorunun çevresini çizin.");
      return;
    }
    setHata("");
    setKaydediyor(true);
    try {
      const png = await getCroppedImage(sayfaUrl, aktif);
      const gorsel = await gorselSigdir(png);
      await onYerles({ dosyaAd: dosya.name, sayfa, sayfaSayisi, gorsel, ders, dogru });
      setMesaj(`${ders} sorusu yerleştirildi. Doğru cevap ${dogru}. Sıradaki sorunun çevresini çizin.`);
      setAktif(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Kesit yerleştirilemedi.");
    } finally {
      setKaydediyor(false);
    }
  };

  const kutu = (c: PixelCrop) => {
    const img = imgRef.current;
    if (!img?.naturalWidth) return { left: "0%", top: "0%", width: "0%", height: "0%" };
    return {
      left: `${(c.x / img.naturalWidth) * 100}%`,
      top: `${(c.y / img.naturalHeight) * 100}%`,
      width: `${(c.width / img.naturalWidth) * 100}%`,
      height: `${(c.height / img.naturalHeight) * 100}%`,
    };
  };

  return (
    <div className="space-y-3">
      <label className="inline-flex cursor-pointer rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-medium text-white">
        PDF seç
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            e.target.value = "";
            setHata("");
            setMesaj("");
            if (f && !isPdfFile(f)) {
              setHata("Yalnızca PDF seçin.");
              return;
            }
            setDosya(f);
          }}
        />
      </label>
      {dosya ? <p className="text-sm text-slate-600">{dosya.name}</p> : null}
      {sayfaSayisi > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" className="rounded border px-2 py-1" onClick={() => setSayfa((n) => Math.max(1, n - 1))}>
            Önceki sayfa
          </button>
          <span>
            Sayfa {sayfa} / {sayfaSayisi}
          </span>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => setSayfa((n) => Math.min(sayfaSayisi, n + 1))}
          >
            Sonraki sayfa
          </button>
          <label>
            Ders
            <select className="ml-2 rounded border px-2 py-1" value={ders} onChange={(e) => setDers(e.target.value)}>
              {DERS_ADLARI.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <span>Doğru cevap</span>
          {SIKLAR.map((h) => (
            <button
              key={h}
              type="button"
              className={`h-8 w-8 rounded-full border font-bold ${dogru === h ? "bg-dershanem-navy text-white" : "bg-white"}`}
              onClick={() => setDogru(h)}
            >
              {h}
            </button>
          ))}
          <button
            type="button"
            disabled={kaydediyor}
            className="rounded bg-dershanem-navy px-3 py-1 font-semibold text-white disabled:opacity-60"
            onClick={() => void yerlestir()}
          >
            {kaydediyor ? "Yerleştiriliyor" : "Kesiti yerleştir"}
          </button>
        </div>
      ) : null}
      {mesaj ? <p className="text-sm text-slate-700">{mesaj}</p> : null}
      {hata ? <p className="text-sm font-medium text-red-700">{hata}</p> : null}
      {dosya ? (
        <div className="max-h-[70vh] overflow-auto rounded border bg-slate-100">
          {sayfaUrl ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={sayfaUrl} alt="" className="block max-w-full select-none" draggable={false} />
              <div
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={(e) => {
                  const p = piksel(e);
                  if (!p) return;
                  baslangic.current = p;
                  try {
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  } catch {
                    /* sürükleme yine sürer */
                  }
                }}
                onPointerMove={(e) => {
                  const p = piksel(e);
                  const boyut = olcu();
                  const a = ayar.current;
                  if (a && p && boyut) {
                    setAktif(secimiUygula(a.bas, p.x - a.x, p.y - a.y, a.kenar, boyut.w, boyut.h));
                    return;
                  }
                  const b = baslangic.current;
                  if (!b || !p) return;
                  const x = Math.min(b.x, p.x);
                  const y = Math.min(b.y, p.y);
                  const width = Math.abs(p.x - b.x);
                  const height = Math.abs(p.y - b.y);
                  if (width < 4 || height < 4) return;
                  setAktif({ x, y, width, height });
                }}
                onPointerUp={() => {
                  baslangic.current = null;
                  ayar.current = null;
                }}
              >
                {aktif ? (
                  <div
                    className="absolute cursor-move border-2 border-[#d72d42] bg-red-500/10"
                    style={kutu(aktif)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const p = piksel(e);
                      if (!p) return;
                      ayar.current = { kenar: "tasi", bas: { ...aktif }, x: p.x, y: p.y };
                    }}
                  >
                    {TUTAMAKLAR.map((t) => (
                      <span
                        key={t.kenar}
                        className={`absolute z-10 h-5 w-5 touch-none rounded-sm border-2 border-[#d72d42] bg-white ${t.sinif}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const p = piksel(e);
                          if (!p) return;
                          ayar.current = { kenar: t.kenar, bas: { ...aktif }, x: p.x, y: p.y };
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="p-4 text-sm text-slate-500">Sayfa hazırlanıyor</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          PDF’i açın. Soru, şıklar ve şekil aynı karede kalsın. Çevresini çizin, dersi ve doğru şıkkı seçip kesiti yerleştirin.
        </p>
      )}
      {aktif ? (
        <button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => {
          const boyut = olcu();
          if (boyut && aktif) setAktif(secimiGenislet(aktif, 16, boyut.w, boyut.h));
        }}>
          Seçimi genişlet
        </button>
      ) : null}
    </div>
  );
}
