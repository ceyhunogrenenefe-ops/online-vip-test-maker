"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { prepareImage, type HazirlikSonucu } from "@/lib/image-prepare";
import { ocrTurkce, GUVEN_ESIGI, type OcrSonuc } from "@/lib/ocr-text";
import { matematikSupheliMi } from "@/lib/math-detect";
import type { PasteBlock } from "@/lib/paste-clean";

type Satir = {
  metin: string;
  guven: number;
  formulSupheli: boolean;
  secili: boolean;
};

/**
 * Fotoğraftan içerik aktarma — ONAY EKRANI.
 *
 * Görüntü dışarı gönderilmez; tanıma tamamen tarayıcıda çalışır.
 * Tanınan hiçbir satır öğretmen onaylamadan föye girmez: güveni düşük
 * satırlar kırmızı, matematik şüphelileri sarı işaretlidir ve her satır
 * düzenlenebilir. OCR matematiği bozar (P = h.d.g -> P-h.d.g), bu yüzden
 * formül şüphelisi satırlar işaretlenir ve öğretmenin formül editörüyle
 * yeniden yazması beklenir.
 */
export function FoyFotograf({ onEkle }: { onEkle: (bloklar: PasteBlock[]) => void }) {
  const dosyaRef = useRef<HTMLInputElement | null>(null);
  const [orijinal, setOrijinal] = useState<string | null>(null);
  const [hazirlik, setHazirlik] = useState<HazirlikSonucu | null>(null);
  const [sonuc, setSonuc] = useState<OcrSonuc | null>(null);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [yuzde, setYuzde] = useState(0);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const dosyaSecildi = async (f: File) => {
    setHata(null);
    setCalisiyor(true);
    setSonuc(null);
    setSatirlar([]);
    setYuzde(0);
    try {
      const dataUrl = await new Promise<string>((coz, red) => {
        const fr = new FileReader();
        fr.onload = () => coz(String(fr.result));
        fr.onerror = () => red(new Error("Dosya okunamadı"));
        fr.readAsDataURL(f);
      });
      setOrijinal(dataUrl);
      const h = await prepareImage(dataUrl);
      setHazirlik(h);
      const r = await ocrTurkce(h.dataUrl, setYuzde);
      setSonuc(r);
      setSatirlar(
        r.satirlar.map((s) => ({
          metin: s.text,
          guven: s.confidence,
          formulSupheli: matematikSupheliMi(s.text),
          // Güveni düşük ve formül şüphelisi satırlar varsayılan olarak
          // SEÇİLİ DEĞİL: öğretmen bakmadan föye girmesinler.
          secili: s.confidence >= GUVEN_ESIGI && !matematikSupheliMi(s.text),
        }))
      );
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setCalisiyor(false);
    }
  };

  const onayla = () => {
    const bloklar: PasteBlock[] = satirlar
      .filter((s) => s.secili && s.metin.trim())
      .map((s) => ({ kind: "paragraph", runs: [{ text: s.metin.trim() }] }));
    if (!bloklar.length) {
      setHata("Föye eklenecek satır seçilmedi.");
      return;
    }
    onEkle(bloklar);
    setSonuc(null);
    setSatirlar([]);
    setOrijinal(null);
    setHazirlik(null);
  };

  const seciliSayi = satirlar.filter((s) => s.secili).length;

  return (
    <div className="space-y-2">
      <input
        ref={dosyaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void dosyaSecildi(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => dosyaRef.current?.click()}
        disabled={calisiyor}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600 hover:border-dershanem-navy disabled:opacity-60"
        data-test="foy-fotograf-sec"
      >
        {calisiyor ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        {calisiyor ? `Tanınıyor… %${yuzde}` : "Fotoğraf veya ekran görüntüsü seç"}
      </button>

      <p className="text-[11px] text-slate-500">
        Görüntü sunucuya gönderilmez; tanıma tarayıcıda yapılır.
      </p>

      {hata ? <p className="rounded bg-red-50 p-2 text-xs text-red-700">{hata}</p> : null}

      {sonuc ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <span>Ortalama güven: %{Math.round(sonuc.ortalamaGuven)}</span>
            {hazirlik ? <span>· Eğiklik: {hazirlik.egiklikDerece.toFixed(1)}°</span> : null}
            <span>· {sonuc.satirlar.length} satır</span>
          </div>

          {orijinal && hazirlik ? (
            <div className="mb-2 grid grid-cols-2 gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={orijinal} alt="Orijinal" className="max-h-28 w-full object-contain" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hazirlik.dataUrl}
                alt="Düzeltilmiş"
                className="max-h-28 w-full object-contain"
              />
            </div>
          ) : null}

          <ul className="mb-2 max-h-56 space-y-1 overflow-y-auto">
            {satirlar.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={s.secili}
                  onChange={(e) =>
                    setSatirlar((p) =>
                      p.map((x, j) => (j === i ? { ...x, secili: e.target.checked } : x))
                    )
                  }
                  className="mt-1.5"
                />
                <input
                  value={s.metin}
                  onChange={(e) =>
                    setSatirlar((p) =>
                      p.map((x, j) => (j === i ? { ...x, metin: e.target.value } : x))
                    )
                  }
                  className={`w-full rounded border px-2 py-1 text-xs ${
                    s.guven < GUVEN_ESIGI
                      ? "border-red-300 bg-red-50"
                      : s.formulSupheli
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-white"
                  }`}
                />
                <span className="mt-1.5 w-8 shrink-0 text-right text-[10px] text-slate-400">
                  %{Math.round(s.guven)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mb-2 text-[11px] text-slate-500">
            Kırmızı: güven düşük · Sarı: matematik şüphelisi — OCR formülleri bozar, bunları
            Formül ekle ile yeniden yazın.
          </p>

          <button
            type="button"
            onClick={onayla}
            className="flex items-center gap-1 rounded-lg bg-dershanem-navy px-3 py-1.5 text-xs font-semibold text-white"
            data-test="foy-ocr-onayla"
          >
            <Check size={14} />
            Seçili {seciliSayi} satırı föye ekle
          </button>
        </div>
      ) : null}
    </div>
  );
}
