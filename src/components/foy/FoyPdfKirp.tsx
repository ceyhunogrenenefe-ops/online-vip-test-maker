"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getCroppedImage } from "@/lib/crop";
import type { PixelCrop } from "@/lib/crop";
import { isPdfFile, renderPdfPageToDataUrl } from "@/lib/pdf-document";
import { DEFAULT_ENHANCE } from "@/lib/image-enhance";
import { kirpmaCakisiyor, kirpmaParmakizi, type KirpmaAlani } from "@/lib/foy-baski";
import { ocrTurkce } from "@/lib/ocr-text";
import { yeniId } from "@/lib/foy-kunye";

const MAX_BAYT = 40 * 1024 * 1024;

export type KirpilmisParca = {
  dataUrl: string;
  aspect: number;
  kaynak: KirpmaAlani;
};

export type FoyKirpHandle = {
  odak: (alan: KirpmaAlani) => void;
};

type Kuyruk = KirpilmisParca & { id: string };

export const FoyPdfKirp = forwardRef<
  FoyKirpHandle,
  {
    dosya: File | null;
    onDosya: (f: File | null) => void;
    mevcut: KirpmaAlani[];
    onEkle: (parcalar: KirpilmisParca[]) => void;
    onMetin: (metin: string) => void;
  }
>(function FoyPdfKirp({ dosya, onDosya, mevcut, onEkle, onMetin }, ref) {
  const [sayfaSayisi, setSayfaSayisi] = useState(0);
  const [sayfa, setSayfa] = useState(1);
  const [olcek, setOlcek] = useState(3);
  const [yakin, setYakin] = useState(100);
  const [sayfaUrl, setSayfaUrl] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [uyari, setUyari] = useState<string | null>(null);
  const [fotokopi, setFotokopi] = useState(false);
  const [kuyruk, setKuyruk] = useState<Kuyruk[]>([]);
  const [aktif, setAktif] = useState<PixelCrop | null>(null);
  const [kucuk, setKucuk] = useState<Record<number, string>>({});
  const [ocr, setOcr] = useState<{ gorsel: string; metin: string; guven: number; suphe: boolean } | null>(null);
  const [ocrCalisiyor, setOcrCalisiyor] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const baslangic = useRef<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    odak(alan) {
      if (!dosya || dosya.name !== alan.pdfAd) {
        setUyari(`Bu kırpma "${alan.pdfAd}" dosyasından. Aynı PDF'yi yeniden seçin; görsel föyde duruyor.`);
        return;
      }
      setSayfa(alan.sayfa);
      setAktif({ x: alan.x, y: alan.y, width: alan.width, height: alan.height });
      setUyari(null);
    },
  }));

  useEffect(() => {
    if (!dosya) {
      setSayfaSayisi(0);
      setSayfaUrl(null);
      setKucuk({});
      return;
    }
    let iptal = false;
    void (async () => {
      try {
        const { getPdfPageCount } = await import("@/lib/pdf-document");
        const n = await getPdfPageCount(dosya);
        if (iptal) return;
        setSayfaSayisi(n);
        setSayfa(1);
      } catch (e) {
        if (!iptal) setHata(e instanceof Error ? e.message : "PDF açılamadı");
      }
    })();
    return () => {
      iptal = true;
    };
  }, [dosya]);

  useEffect(() => {
    if (!dosya || sayfa < 1) return;
    let iptal = false;
    setYukleniyor(true);
    void renderPdfPageToDataUrl(dosya, sayfa, olcek)
      .then((url) => {
        if (!iptal) setSayfaUrl(url);
      })
      .catch((e) => {
        if (!iptal) setHata(e instanceof Error ? e.message : "Sayfa çizilemedi");
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [dosya, sayfa, olcek]);

  useEffect(() => {
    if (!dosya || sayfaSayisi < 1) return;
    let iptal = false;
    void (async () => {
      for (let p = 1; p <= sayfaSayisi; p++) {
        if (iptal) return;
        if (kucuk[p]) continue;
        try {
          const url = await renderPdfPageToDataUrl(dosya, p, 0.22);
          if (iptal) return;
          setKucuk((onceki) => ({ ...onceki, [p]: url }));
        } catch {
          return;
        }
      }
    })();
    return () => {
      iptal = true;
    };
    // kucuk bilinçli olarak bağımlılıkta yok: sayfa küçük resimleri bir kez üretilir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dosya, sayfaSayisi]);

  const piksel = (e: React.PointerEvent) => {
    const img = imgRef.current;
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * img.naturalWidth,
      y: ((e.clientY - r.top) / r.height) * img.naturalHeight,
    };
  };

  const sec = (e: React.PointerEvent) => {
    const p = piksel(e);
    if (!p) return;
    baslangic.current = p;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const surukle = (e: React.PointerEvent) => {
    const b = baslangic.current;
    const p = piksel(e);
    if (!b || !p) return;
    const x = Math.min(b.x, p.x);
    const y = Math.min(b.y, p.y);
    const width = Math.abs(p.x - b.x);
    const height = Math.abs(p.y - b.y);
    if (width < 4 || height < 4) return;
    setAktif({ x, y, width, height });
  };

  const bitir = () => {
    baslangic.current = null;
  };

  const dosyaSec = (f: File | null) => {
    setHata(null);
    setUyari(null);
    if (!f) return;
    if (!isPdfFile(f)) {
      setHata("Yalnızca PDF seçin.");
      return;
    }
    if (f.size > MAX_BAYT) {
      setHata("PDF 40 MB sınırını aşıyor.");
      return;
    }
    onDosya(f);
    setKuyruk([]);
    setAktif(null);
  };

  const gelistir = fotokopi ? { ...DEFAULT_ENHANCE, photocopy: true, contrast: 1.35 } : DEFAULT_ENHANCE;

  const listeyeAl = async () => {
    if (!dosya || !sayfaUrl || !aktif) return;
    setHata(null);
    const kaynak: KirpmaAlani = {
      pdfAd: dosya.name,
      sayfa,
      x: aktif.x,
      y: aktif.y,
      width: aktif.width,
      height: aktif.height,
    };
    const cakisan = [...mevcut, ...kuyruk.map((k) => k.kaynak)].some((m) => kirpmaCakisiyor(m, kaynak));
    if (cakisan) {
      setUyari("Bu alan daha önce seçilmişe çok benziyor. Yine de listeye alındı; eklemeden önce bakın.");
    }
    const dataUrl = await getCroppedImage(sayfaUrl, aktif, gelistir);
    const img = await olc(dataUrl);
    setKuyruk((p) => [
      ...p,
      { id: yeniId(), dataUrl, aspect: img.width / img.height, kaynak },
    ]);
  };

  const foye = () => {
    if (!kuyruk.length) return;
    onEkle(kuyruk.map(({ dataUrl, aspect, kaynak }) => ({ dataUrl, aspect, kaynak })));
    setKuyruk([]);
    setOcr(null);
  };

  const donustur = async (gorsel: string) => {
    setOcrCalisiyor(true);
    setHata(null);
    try {
      const sonuc = await ocrTurkce(gorsel);
      const suphe = sonuc.ortalamaGuven < 75 || sonuc.formulSupheli.length > 0;
      setOcr({ gorsel, metin: sonuc.text, guven: sonuc.ortalamaGuven, suphe });
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Metin okunamadı");
    } finally {
      setOcrCalisiyor(false);
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
    <div className="space-y-2 text-xs">
      <p className="text-[11px] text-slate-500">
        PDF bu oturumda durur; her soru için yeniden yüklemeniz gerekmez. Bağımsız Kırpma Aracı sekmesi de çalışmaya devam eder.
      </p>
      <input
        type="file"
        accept="application/pdf,.pdf"
        data-test="foy-pdf-yukle"
        onChange={(e) => dosyaSec(e.target.files?.[0] ?? null)}
      />
      {dosya ? (
        <p className="text-[11px] text-slate-600">
          {dosya.name} · {sayfaSayisi || "…"} sayfa
        </p>
      ) : null}
      {hata ? <p className="rounded bg-red-50 p-2 text-red-700">{hata}</p> : null}
      {uyari ? <p className="rounded bg-amber-50 p-2 text-amber-900">{uyari}</p> : null}

      {sayfaSayisi > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" className="rounded border px-2 py-1" onClick={() => setSayfa((s) => Math.max(1, s - 1))}>
              Önceki
            </button>
            <label>
              Sayfa
              <input
                type="number"
                min={1}
                max={sayfaSayisi}
                value={sayfa}
                onChange={(e) => setSayfa(Math.min(sayfaSayisi, Math.max(1, Number(e.target.value) || 1)))}
                className="ml-1 w-14 rounded border px-1 py-0.5"
              />
            </label>
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={() => setSayfa((s) => Math.min(sayfaSayisi, s + 1))}
            >
              Sonraki
            </button>
            <label>
              Netlik
              <select value={olcek} onChange={(e) => setOlcek(Number(e.target.value))} className="ml-1 rounded border px-1 py-0.5">
                <option value={2}>Standart</option>
                <option value={3}>Yüksek</option>
                <option value={4}>En yüksek</option>
              </select>
            </label>
            <button type="button" className="rounded border px-2 py-1" onClick={() => setYakin((z) => Math.min(220, z + 20))}>
              Yakınlaş
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => setYakin((z) => Math.max(60, z - 20))}>
              Uzaklaş
            </button>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fotokopi} onChange={(e) => setFotokopi(e.target.checked)} />
            Siyah-beyaz fotokopi için zemin temizliği
          </label>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Array.from({ length: sayfaSayisi }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSayfa(p)}
                className={`h-16 w-12 shrink-0 overflow-hidden rounded border ${p === sayfa ? "border-[#173b70]" : "border-slate-200"}`}
              >
                {kucuk[p] ? <img src={kucuk[p]} alt="" className="h-full w-full object-cover" /> : <span>{p}</span>}
              </button>
            ))}
          </div>
          <div className="max-h-[68vh] overflow-auto rounded border bg-slate-100">
            {yukleniyor || !sayfaUrl ? (
              <p className="flex items-center gap-1 p-4 text-slate-500">
                <Loader2 size={14} className="animate-spin" /> Sayfa hazırlanıyor
              </p>
            ) : (
              <div className="relative inline-block" style={{ width: `${yakin}%` }}>
                <img ref={imgRef} src={sayfaUrl} alt="" className="block w-full select-none" draggable={false} />
                <div
                  className="absolute inset-0 cursor-crosshair"
                  onPointerDown={sec}
                  onPointerMove={surukle}
                  onPointerUp={bitir}
                >
                  {aktif ? (
                    <div className="absolute border-2 border-[#d72d42] bg-red-500/10" style={kutu(aktif)} />
                  ) : null}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => void listeyeAl()} disabled={!aktif} className="rounded bg-slate-800 px-2 py-1 text-white disabled:opacity-40">
              Seçimi listeye al
            </button>
            <button type="button" onClick={foye} disabled={!kuyruk.length} className="rounded bg-dershanem-navy px-2 py-1 font-semibold text-white disabled:opacity-40" data-test="foy-kirp-ekle">
              {kuyruk.length ? `${kuyruk.length} kırpmayı sırayla föye ekle` : "Föye ekle"}
            </button>
          </div>
          {kuyruk.length > 0 ? (
            <ul className="space-y-1">
              {kuyruk.map((k, i) => (
                <li key={k.id} className="flex items-center gap-2 rounded border p-1">
                  <img src={k.dataUrl} alt="" className="h-12 w-16 object-contain" />
                  <span className="flex-1">
                    {i + 1}. sayfa {k.kaynak.sayfa}
                    <span className="block text-[10px] text-slate-400">{kirpmaParmakizi(k.kaynak)}</span>
                  </span>
                  <button type="button" className="text-dershanem-navy" onClick={() => void donustur(k.dataUrl)}>
                    Metne dönüştür
                  </button>
                  <button type="button" className="text-red-600" onClick={() => setKuyruk((p) => p.filter((x) => x.id !== k.id))}>
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {ocrCalisiyor ? <p>Metin okunuyor… görüntü dışarı gönderilmez.</p> : null}
      {ocr ? (
        <div className="space-y-1 rounded border p-2">
          <p className="font-semibold">Karşılaştırma</p>
          {ocr.suphe ? (
            <p className="rounded bg-amber-50 p-1 text-amber-900">
              Dönüşüm güvenilir değil (güven %{Math.round(ocr.guven)}). Matematik ve şekiller bozulmuş olabilir.
              Orijinal görseli koruyun. Görüntü harici bir yapay zekâya gönderilmedi.
            </p>
          ) : (
            <p className="text-slate-500">Güven %{Math.round(ocr.guven)}. Yine de metni onaylamadan föye yazılmaz.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <img src={ocr.gorsel} alt="Kırpılan soru" className="max-h-40 w-full object-contain" />
            <textarea
              value={ocr.metin}
              onChange={(e) => setOcr({ ...ocr, metin: e.target.value })}
              rows={6}
              className="w-full rounded border p-1"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-dershanem-navy px-2 py-1 text-white"
              onClick={() => {
                const parca = kuyruk.find((k) => k.dataUrl === ocr.gorsel);
                if (parca) onEkle([parca]);
                setOcr(null);
              }}
            >
              Görseli koru
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1"
              disabled={ocr.suphe && !ocr.metin.trim()}
              onClick={() => {
                if (!ocr.metin.trim()) return;
                if (ocr.suphe && !window.confirm("Güven düşük. Metin föye yazılsın mı? Görsel ayrıca durmayacak.")) return;
                onMetin(ocr.metin);
                setOcr(null);
              }}
            >
              Metni onayla
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});

function olc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Kırpma önizlemesi açılamadı"));
    img.src = src;
  });
}
