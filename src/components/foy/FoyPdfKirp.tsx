"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getCroppedImage } from "@/lib/crop";
import type { PixelCrop } from "@/lib/crop";
import { secimiGenislet, secimiUygula, type SecimKenari } from "@/lib/kirp-secim";
import { isPdfFile, renderPdfPageToDataUrl } from "@/lib/pdf-document";
import { DEFAULT_ENHANCE } from "@/lib/image-enhance";
import { kirpmaCakisiyor, kirpmaParmakizi, type KirpmaAlani } from "@/lib/foy-baski";
import { ocrTurkce } from "@/lib/ocr-text";
import { yeniId } from "@/lib/foy-kunye";
import type { GorselRol } from "@/lib/pdf-blocks";

const MAX_BAYT = 40 * 1024 * 1024;

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

export type KirpilmisParca = {
  dataUrl: string;
  aspect: number;
  kaynak: KirpmaAlani;
  rol: GorselRol;
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
    sonrakiNo: number;
    onEkle: (parcalar: KirpilmisParca[]) => void;
    onMetin: (metin: string) => void;
  }
>(function FoyPdfKirp({ dosya, onDosya, mevcut, sonrakiNo, onEkle, onMetin }, ref) {
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
  const [ciziyor, setCiziyor] = useState(false);
  const [sonEklenen, setSonEklenen] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const katmanRef = useRef<HTMLDivElement>(null);
  const baslangic = useRef<{ x: number; y: number } | null>(null);
  const ayar = useRef<{ kenar: SecimKenari; bas: PixelCrop; x: number; y: number } | null>(null);

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
    setCiziyor(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* işaretçi yakalanamazsa sürükleme yine de sürer */
    }
  };

  const sayfaOlcusu = () => {
    const img = imgRef.current;
    if (!img?.naturalWidth || !img.naturalHeight) return null;
    return { w: img.naturalWidth, h: img.naturalHeight };
  };

  const surukle = (e: React.PointerEvent) => {
    const p = piksel(e);
    const olcu = sayfaOlcusu();
    const a = ayar.current;
    if (a && p && olcu) {
      setAktif(secimiUygula(a.bas, p.x - a.x, p.y - a.y, a.kenar, olcu.w, olcu.h));
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
  };

  const bitir = () => {
    baslangic.current = null;
    ayar.current = null;
    setCiziyor(false);
  };

  const tutamakBasla = (e: React.PointerEvent, kenar: SecimKenari) => {
    e.stopPropagation();
    e.preventDefault();
    const p = piksel(e);
    if (!p || !aktif) return;
    ayar.current = { kenar, bas: { ...aktif }, x: p.x, y: p.y };
    try {
      katmanRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* işaretçi yakalanamazsa sürükleme yine de sürer */
    }
  };

  const genislet = (yon: 1 | -1) => {
    const olcu = sayfaOlcusu();
    if (!olcu || !aktif) return;
    const adim = Math.max(16, Math.round(Math.min(olcu.w, olcu.h) * 0.012)) * yon;
    setAktif(secimiGenislet(aktif, adim, olcu.w, olcu.h));
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

  const parcaUret = async (rol: GorselRol): Promise<KirpilmisParca | null> => {
    if (!dosya || !sayfaUrl || !aktif) return null;
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
      setUyari("Bu alan daha önce seçilmişe çok benziyor. Yine de eklendi.");
    }
    const dataUrl = await getCroppedImage(sayfaUrl, aktif, gelistir);
    const img = await olc(dataUrl);
    return { dataUrl, aspect: img.width / img.height, kaynak, rol };
  };

  const dogrudanEkle = async (rol: GorselRol) => {
    const parca = await parcaUret(rol);
    if (!parca) return;
    onEkle([parca]);
    setSonEklenen(
      rol === "soru" ? `Soru ${sonrakiNo} föye eklendi.` : rol === "aciklama" ? "Açıklama föye eklendi." : "Çözüm föye eklendi."
    );
    setAktif(null);
  };

  const listeyeAl = async () => {
    const parca = await parcaUret("soru");
    if (!parca) return;
    setKuyruk((p) => [...p, { ...parca, id: yeniId() }]);
  };

  const foye = () => {
    if (!kuyruk.length) return;
    onEkle(kuyruk.map(({ dataUrl, aspect, kaynak, rol }) => ({ dataUrl, aspect, kaynak, rol })));
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
        Sorunun çevresini sürükleyerek seçin. Seçtikten sonra kenar tutamaçlarından ya da Genişlet / Daralt ile ayarlayın.
        PDF bu oturumda durur.
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
          {sonEklenen ? <p className="rounded bg-emerald-50 p-2 text-emerald-900">{sonEklenen}</p> : null}
          {aktif && !ciziyor ? (
            <div className="flex flex-wrap items-center gap-1 rounded border border-red-200 bg-red-50 p-1">
              <span className="px-1 font-semibold text-red-900">Seçimi ayarla</span>
              <button
                type="button"
                onClick={() => genislet(1)}
                className="rounded border bg-white px-2 py-1 font-semibold"
                data-test="foy-kirp-genislet"
              >
                Genişlet
              </button>
              <button
                type="button"
                onClick={() => genislet(-1)}
                className="rounded border bg-white px-2 py-1 font-semibold"
                data-test="foy-kirp-daralt"
              >
                Daralt
              </button>
              <button
                type="button"
                onClick={() => void dogrudanEkle("soru")}
                className="rounded bg-[#173b70] px-2 py-1 font-bold text-white"
                data-test="foy-kirp-secim-ekle"
              >
                Soru {sonrakiNo} · Föye ekle
              </button>
              <button type="button" onClick={() => void dogrudanEkle("aciklama")} className="rounded border bg-white px-2 py-1">
                Açıklama
              </button>
              <button type="button" onClick={() => void dogrudanEkle("cozum")} className="rounded border bg-white px-2 py-1">
                Çözüm
              </button>
              <button type="button" onClick={() => void listeyeAl()} className="rounded border bg-white px-2 py-1">
                Listeye al
              </button>
            </div>
          ) : null}
          <div className="max-h-[68vh] overflow-auto rounded border bg-slate-100">
            {yukleniyor || !sayfaUrl ? (
              <p className="flex items-center gap-1 p-4 text-slate-500">
                <Loader2 size={14} className="animate-spin" /> Sayfa hazırlanıyor
              </p>
            ) : (
              <div className="relative inline-block" style={{ width: `${yakin}%` }}>
                <img ref={imgRef} src={sayfaUrl} alt="" className="block w-full select-none" draggable={false} />
                <div
                  ref={katmanRef}
                  className="absolute inset-0 cursor-crosshair touch-none"
                  onPointerDown={sec}
                  onPointerMove={surukle}
                  onPointerUp={bitir}
                >
                  {aktif ? (
                    <div
                      className="absolute cursor-move border-2 border-[#d72d42] bg-red-500/10"
                      style={kutu(aktif)}
                      onPointerDown={(e) => tutamakBasla(e, "tasi")}
                    >
                      {TUTAMAKLAR.map((t) => (
                        <span
                          key={t.kenar}
                          role="presentation"
                          data-test={`foy-kirp-tutamak-${t.kenar}`}
                          className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-[#d72d42] bg-white ${t.sinif}`}
                          onPointerDown={(e) => tutamakBasla(e, t.kenar)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
          {kuyruk.length > 0 ? (
            <>
            <button type="button" onClick={foye} className="rounded bg-dershanem-navy px-2 py-1 font-semibold text-white" data-test="foy-kirp-ekle">
              {kuyruk.length} kırpmayı sırayla föye ekle
            </button>
            <ul className="space-y-1">
              {kuyruk.map((k, i) => (
                <li key={k.id} className="flex items-center gap-2 rounded border p-1">
                  <img src={k.dataUrl} alt="" className="h-12 w-16 object-contain" />
                  <span className="flex-1">
                    {i + 1}. sayfa {k.kaynak.sayfa}
                    <span className="block text-[10px] text-slate-400">{kirpmaParmakizi(k.kaynak)}</span>
                  </span>
                  <select
                    value={k.rol}
                    aria-label="Parça türü"
                    data-test="foy-kirp-rol"
                    onChange={(e) =>
                      setKuyruk((p) =>
                        p.map((x) => (x.id === k.id ? { ...x, rol: e.target.value as GorselRol } : x))
                      )
                    }
                    className="rounded border px-1 py-0.5 text-[11px]"
                  >
                    <option value="soru">Soru</option>
                    <option value="aciklama">Açıklama</option>
                    <option value="cozum">Çözüm</option>
                  </select>
                  <button type="button" className="text-dershanem-navy" onClick={() => void donustur(k.dataUrl)}>
                    Metne dönüştür
                  </button>
                  <button type="button" className="text-red-600" onClick={() => setKuyruk((p) => p.filter((x) => x.id !== k.id))}>
                    Sil
                  </button>
                </li>
              ))}
            </ul>
            </>
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
