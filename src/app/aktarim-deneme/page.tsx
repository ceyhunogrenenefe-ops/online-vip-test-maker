"use client";

/**
 * İçerik aktarımı ve onay ekranı (spec 8).
 * Solda yüklenen orijinal, sağda sistemin çıkardığı düzenlenebilir
 * içerik. Belirsiz algılanan bölümler açıkça işaretlenir; öğretmen
 * onaylamadan hiçbir şey föye girmez.
 */

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Loader2, Sigma, Upload } from "lucide-react";
import { prepareImage } from "@/lib/image-prepare";
import type { HazirlikSonucu } from "@/lib/image-prepare";
import { GUVEN_ESIGI, ocrTurkce } from "@/lib/ocr-text";
import { MATEMATIK_ORNEKLERI, matematikSupheliMi } from "@/lib/math-detect";
import type { OcrSonuc } from "@/lib/ocr-text";

type Durum = "bos" | "hazirlaniyor" | "taniniyor" | "hazir" | "hata";

function DedektorDenetimi() {
  const a = MATEMATIK_ORNEKLERI.isaretlenmeli.filter((s) => matematikSupheliMi(s)).length;
  const b = MATEMATIK_ORNEKLERI.isaretlenmemeli.filter((s) => !matematikSupheliMi(s)).length;
  const toplam =
    MATEMATIK_ORNEKLERI.isaretlenmeli.length + MATEMATIK_ORNEKLERI.isaretlenmemeli.length;
  const gecen = a + b;
  return (
    <p
      className={
        gecen === toplam ? "text-xs text-emerald-700" : "text-xs text-red-700"
      }
      data-test="dedektor-denetimi"
    >
      Formül sezgisi denetimi: {gecen}/{toplam} örnek doğru
    </p>
  );
}

export default function AktarimDenemePage() {
  const [orijinal, setOrijinal] = useState<string | null>(null);
  const [hazir, setHazir] = useState<HazirlikSonucu | null>(null);
  const [ocr, setOcr] = useState<OcrSonuc | null>(null);
  const [durum, setDurum] = useState<Durum>("bos");
  const [ilerleme, setIlerleme] = useState(0);
  const [hata, setHata] = useState<string | null>(null);
  const [duzeltilen, setDuzeltilen] = useState<Record<number, string>>({});
  const dosyaRef = useRef<HTMLInputElement | null>(null);

  const isle = useCallback(async (dataUrl: string) => {
    setHata(null);
    setOcr(null);
    setDuzeltilen({});
    setOrijinal(dataUrl);
    try {
      setDurum("hazirlaniyor");
      const h = await prepareImage(dataUrl);
      setHazir(h);
      setDurum("taniniyor");
      setIlerleme(0);
      const r = await ocrTurkce(h.dataUrl, setIlerleme);
      setOcr(r);
      setDurum("hazir");
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
      setDurum("hata");
    }
  }, []);

  const dosyaSec = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        setHata("Şimdilik yalnızca görsel yükleyebilirsiniz (PDF sırada).");
        setDurum("hata");
        return;
      }
      const fr = new FileReader();
      fr.onload = () => void isle(String(fr.result));
      fr.readAsDataURL(f);
    },
    [isle]
  );

  const satirSinifi = (guven: number, formul: boolean) => {
    if (formul) return "border-amber-300 bg-amber-50";
    if (guven < GUVEN_ESIGI) return "border-red-200 bg-red-50";
    return "border-slate-200 bg-white";
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            İçerik aktarımı ve onay
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ders kitabından çektiğiniz fotoğrafı yükleyin. Sistem görüntüyü
            düzeltip metni çıkarır; <b>onaylamadan hiçbir şey föye girmez.</b>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Görüntü dışarı gönderilmez; tanıma tarayıcınızda çalışır.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={dosyaRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => dosyaSec(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => dosyaRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#173b70] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f2a52]"
          >
            <Upload className="h-4 w-4" /> Fotoğraf yükle
          </button>
          {durum === "hazirlaniyor" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Görüntü düzeltiliyor…
            </span>
          )}
          {durum === "taniniyor" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Metin tanınıyor… %{ilerleme}
            </span>
          )}
        </div>

        <DedektorDenetimi />

        {hata && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" data-test="hata">
            {hata}
          </p>
        )}

        {hazir && (
          <p className="text-xs text-slate-500" data-test="hazirlik">
            Ölçü {hazir.genislik}×{hazir.yukseklik} · ölçülen eğiklik{" "}
            {hazir.egiklikDerece.toFixed(1)}°
            {Math.abs(hazir.egiklikDerece) >= 0.5 ? " (düzeltildi)" : ""}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* SOL — orijinal */}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Yüklenen görsel
            </p>
            {orijinal ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={orijinal} alt="Yüklenen" className="w-full rounded-lg" />
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">
                Henüz görsel yok
              </p>
            )}
            {hazir && (
              <>
                <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Düzeltilmiş (OCR&apos;a giren)
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hazir.dataUrl} alt="Düzeltilmiş" className="w-full rounded-lg" />
              </>
            )}
          </div>

          {/* SAĞ — çıkarılan içerik */}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Çıkarılan içerik
            </p>
            {!ocr && (
              <p className="py-12 text-center text-sm text-slate-400">
                Tanıma sonucu burada görünecek
              </p>
            )}
            {ocr && (
              <>
                <div className="mb-3 flex flex-wrap gap-3 text-xs">
                  <span className="text-slate-600" data-test="guven">
                    Ortalama güven: <b>%{ocr.ortalamaGuven}</b>
                  </span>
                  <span className="text-red-700" data-test="supheli">
                    Düşük güvenli satır: <b>{ocr.supheliSatirlar.length}</b>
                  </span>
                  <span className="text-amber-700" data-test="formul">
                    Formül şüphesi: <b>{ocr.formulSupheli.length}</b>
                  </span>
                </div>

                {(ocr.supheliSatirlar.length > 0 || ocr.formulSupheli.length > 0) && (
                  <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    İşaretli satırları kontrol edin. Matematik içerenler metin
                    olarak doğru çıkmaz; formül editöründe yeniden yazmanız
                    önerilir.
                  </p>
                )}

                <ul className="space-y-1.5" data-test="satirlar">
                  {ocr.satirlar.map((l, i) => {
                    const formul = matematikSupheliMi(l.text);
                    return (
                      <li
                        key={i}
                        className={`rounded-lg border px-2.5 py-1.5 ${satirSinifi(
                          l.confidence,
                          formul
                        )}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1 w-8 shrink-0 text-[10px] text-slate-400">
                            %{l.confidence}
                          </span>
                          <input
                            value={duzeltilen[i] ?? l.text}
                            onChange={(e) =>
                              setDuzeltilen((d) => ({ ...d, [i]: e.target.value }))
                            }
                            className="flex-1 bg-transparent text-sm text-slate-800 outline-none"
                          />
                          {formul && (
                            <span
                              title="Matematik içeriyor olabilir"
                              className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
                            >
                              <Sigma className="h-3 w-3" /> formül
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
