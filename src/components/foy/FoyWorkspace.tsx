"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Loader2,
  Plus,
  Sigma,
  Trash2,
} from "lucide-react";
import type { DocBlock } from "@/lib/pdf-blocks";
import type { PasteBlock } from "@/lib/paste-clean";
import { blokEtiketi, soruNumaralariniYenile, yapistirmayiBelgeye } from "@/lib/foy-icerik";
import { foyPdfOlustur, foyTeshisMesaji, type FoyTeshis } from "@/lib/foy-pdf";
import { FormulaEditor } from "@/components/editor/FormulaEditor";
import { FoyYapistir } from "./FoyYapistir";
import { FoyFotograf } from "./FoyFotograf";
import { FoyYzSoru } from "./FoyYzSoru";
import { getFoyTaslak, saveFoyTaslak } from "@/lib/storage";
import type { PaperSettings } from "@/types";

type Sekme = "yapistir" | "fotograf" | "bilesen" | "yz";

/**
 * Kurumsal föy oluşturma çalışma alanı (Aşama 4).
 *
 * Dört içerik kaynağı (yapıştırma, fotoğraf+OCR, bileşenler, YZ soru)
 * tek blok listesinde birleşir; liste iki sütunlu kurumsal şablona
 * foy-pdf ile akıtılır. Yerleşim mantığı demo sayfasıyla ortak kaynaktan
 * geldiği için ekranda onaylanan föy ile basılan föy ayrışmaz.
 *
 * Öğretmen son söz sahibidir: hiçbir kaynak doğrudan föye yazmaz,
 * her blok silinebilir ve sırası değiştirilebilir, PDF üretiminde
 * sığmayan blok varsa uyarı gösterilir.
 */
export function FoyWorkspace() {
  const [bloklar, setBloklar] = useState<DocBlock[]>([]);
  const [sekme, setSekme] = useState<Sekme>("yapistir");
  const [formulAcik, setFormulAcik] = useState(false);
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [teshis, setTeshis] = useState<FoyTeshis | null>(null);
  const [uretiliyor, setUretiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // Föy künyesi — kurumsal şablonun üst şeridi ve alt bilgisi bunu kullanır
  const [sinif, setSinif] = useState("9. SINIF");
  const [brans, setBrans] = useState("FİZİK");
  const [konu, setKonu] = useState("");
  const [tur, setTur] = useState("Yazılıya Hazırlık Föyü");

  // Taslak otomatik kaydı: sekme yenilenince kurulan föy kaybolmasın.
  // Formül görselleri data URL olduğu için localStorage yetmez (IndexedDB).
  const yuklendi = useRef(false);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const t = await getFoyTaslak();
        if (iptal || !t) return;
        if (Array.isArray(t.bloklar) && t.bloklar.length) {
          setBloklar(t.bloklar as DocBlock[]);
        }
        if (t.kunye) {
          setSinif(t.kunye.sinif || "9. SINIF");
          setBrans(t.kunye.brans || "FİZİK");
          setKonu(t.kunye.konu || "");
          setTur(t.kunye.tur || "Yazılıya Hazırlık Föyü");
        }
      } catch {
        /* taslak okunamadıysa boş föy ile devam edilir */
      } finally {
        if (!iptal) yuklendi.current = true;
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  useEffect(() => {
    // İlk yükleme bitmeden yazmak, kayıtlı taslağı boş liste ile ezerdi
    if (!yuklendi.current) return;
    const z = setTimeout(() => {
      void saveFoyTaslak({
        bloklar,
        kunye: { sinif, brans, konu, tur },
        guncelleme: Date.now(),
      }).catch(() => undefined);
    }, 600);
    return () => clearTimeout(z);
  }, [bloklar, sinif, brans, konu, tur]);

  const settings = useMemo(
    () =>
      ({
        corporateTemplate: true,
        documentKind: tur,
        classSection: sinif,
        subjectBranch: brans,
        topicTitle: konu,
      }) as unknown as PaperSettings,
    [tur, sinif, brans, konu]
  );

  /**
   * Her içerik kaynağı PasteBlock üretir; dönüşüm ve soru numaralandırma
   * tek yerde yapılır, böylece kaynaklar arasında numara çakışmaz.
   */
  const pasteEkle = useCallback(
    async (gelen: PasteBlock[]) => {
      setHata(null);
      try {
        const mevcutSoru = bloklar.filter((b) => b.kind === "question").length;
        const r = await yapistirmayiBelgeye(gelen, { ilkSoruNo: mevcutSoru + 1 });
        setBloklar((p) => soruNumaralariniYenile([...p, ...r.bloklar]));
        if (r.uyarilar.length) setUyarilar((p) => [...p, ...r.uyarilar]);
      } catch (e) {
        setHata(e instanceof Error ? e.message : String(e));
      }
    },
    [bloklar]
  );

  const blokEkle = (b: DocBlock) => setBloklar((p) => soruNumaralariniYenile([...p, b]));

  const tasi = (i: number, yon: -1 | 1) =>
    setBloklar((p) => {
      const j = i + yon;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j], n[i]];
      return soruNumaralariniYenile(n);
    });

  const sil = (i: number) =>
    setBloklar((p) => soruNumaralariniYenile(p.filter((_, j) => j !== i)));

  const pdfUret = async () => {
    setUretiliyor(true);
    setHata(null);
    setTeshis(null);
    try {
      const { doc, teshis: t } = await foyPdfOlustur(bloklar, settings);
      setTeshis(t);
      const blob = doc.output("blob");
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setUretiliyor(false);
    }
  };

  const teshisMesaji = teshis ? foyTeshisMesaji(teshis) : null;
  const dosyaAdi = `foy-${(konu || brans || "ders").replace(/\s+/g, "-").toLowerCase()}.pdf`;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row">
      {/* --- Sol: föy künyesi ve içerik kaynakları --- */}
      <section className="w-full shrink-0 space-y-3 lg:w-[380px]">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <FileText size={16} /> Föy künyesi
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="col-span-2">
              Doküman türü
              <input
                value={tur}
                onChange={(e) => setTur(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label>
              Sınıf
              <input
                value={sinif}
                onChange={(e) => setSinif(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label>
              Branş
              <input
                value={brans}
                onChange={(e) => setBrans(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="col-span-2">
              Konu (boş bırakılırsa konu bandı çizilmez)
              <input
                value={konu}
                onChange={(e) => setKonu(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                data-test="foy-konu"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap gap-1">
            {(
              [
                ["yapistir", "Yapıştır"],
                ["fotograf", "Fotoğraftan"],
                ["bilesen", "Bileşen"],
                ["yz", "YZ soru"],
              ] as [Sekme, string][]
            ).map(([id, ad]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSekme(id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  sekme === id
                    ? "bg-dershanem-navy text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {ad}
              </button>
            ))}
          </div>

          {sekme === "yapistir" ? <FoyYapistir onEkle={(b) => void pasteEkle(b)} /> : null}
          {sekme === "fotograf" ? <FoyFotograf onEkle={(b) => void pasteEkle(b)} /> : null}
          {sekme === "yz" ? (
            <FoyYzSoru sinif={sinif} brans={brans} konu={konu} onEkle={(b) => void pasteEkle(b)} />
          ) : null}
          {sekme === "bilesen" ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const t = window.prompt("Bölüm başlığı");
                  if (t && t.trim()) blokEkle({ kind: "sectionTitle", text: t.trim() });
                }}
                className="rounded-lg border border-slate-300 px-2 py-2 hover:bg-slate-50"
              >
                <Plus size={12} className="inline" /> Bölüm başlığı
              </button>
              <button
                type="button"
                onClick={() => setFormulAcik(true)}
                className="rounded-lg border border-slate-300 px-2 py-2 hover:bg-slate-50"
                data-test="foy-formul-ac"
              >
                <Sigma size={12} className="inline" /> Formül ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = window.prompt("Bilgi kutusu metni");
                  if (t && t.trim())
                    blokEkle({ kind: "infoBox", tone: "bilgi", title: "BİLGİ", text: t.trim() });
                }}
                className="rounded-lg border border-slate-300 px-2 py-2 hover:bg-slate-50"
              >
                <Plus size={12} className="inline" /> Bilgi kutusu
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = window.prompt("Dikkat kutusu metni");
                  if (t && t.trim())
                    blokEkle({ kind: "infoBox", tone: "dikkat", title: "DİKKAT!", text: t.trim() });
                }}
                className="rounded-lg border border-slate-300 px-2 py-2 hover:bg-slate-50"
              >
                <Plus size={12} className="inline" /> Dikkat kutusu
              </button>
              <button
                type="button"
                onClick={() => {
                  const n = Number(window.prompt("Kaç cevap satırı?", "4"));
                  if (Number.isFinite(n) && n > 0)
                    blokEkle({ kind: "answerLines", count: Math.min(30, Math.round(n)) });
                }}
                className="rounded-lg border border-slate-300 px-2 py-2 hover:bg-slate-50"
              >
                <Plus size={12} className="inline" /> Cevap satırı
              </button>
              <button
                type="button"
                onClick={() => blokEkle({ kind: "spacer", heightMm: 6 })}
                className="rounded-lg border border-slate-300 px-2 py-2 hover:bg-slate-50"
              >
                <Plus size={12} className="inline" /> Boşluk
              </button>
            </div>
          ) : null}
        </div>

        {uyarilar.length > 0 ? (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <div className="mb-1 flex items-center justify-between">
              <strong>Uyarılar</strong>
              <button
                type="button"
                onClick={() => setUyarilar([])}
                className="text-[11px] underline"
              >
                Temizle
              </button>
            </div>
            <ul className="space-y-0.5">
              {uyarilar.map((u, i) => (
                <li key={i}>• {u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* --- Orta: blok listesi, teşhis ve PDF --- */}
      <section className="flex min-w-0 flex-1 flex-col rounded-xl bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Föy içeriği{" "}
            <span className="text-xs font-normal text-slate-500">({bloklar.length} blok)</span>
          </h2>
          <div className="flex items-center gap-2">
            {bloklar.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Tüm bloklar silinsin mi?")) setBloklar([]);
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Tümünü temizle
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void pdfUret()}
              disabled={uretiliyor}
              className="flex items-center gap-1.5 rounded-lg bg-dershanem-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              data-test="foy-pdf-uret"
            >
              {uretiliyor ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              PDF oluştur
            </button>
          </div>
        </div>

        {hata ? <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{hata}</p> : null}

        {teshis ? (
          <div
            className={`mb-2 rounded p-2 text-xs ${
              teshisMesaji ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"
            }`}
            data-test="foy-teshis"
          >
            {teshisMesaji ?? `${teshis.sayfa} sayfa · ${teshis.cizilen} blok yerleşti, hepsi sığdı.`}
          </div>
        ) : null}

        {bloklar.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Soldaki araçlarla içerik ekleyin. Eklenen her blok burada listelenir.
          </p>
        ) : (
          <ul className="space-y-1 overflow-y-auto" data-test="foy-blok-listesi">
            {bloklar.map((b, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
              >
                <span className="w-6 shrink-0 text-center text-[10px] text-slate-400">{i + 1}</span>
                <span className="shrink-0 rounded bg-slate-200 px-1 font-mono text-[10px] text-slate-600">
                  {b.kind}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                  {blokEtiketi(b)}
                </span>
                <button
                  type="button"
                  onClick={() => tasi(i, -1)}
                  disabled={i === 0}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  aria-label="Yukarı taşı"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => tasi(i, 1)}
                  disabled={i === bloklar.length - 1}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  aria-label="Aşağı taşı"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => sil(i)}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {pdfUrl ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Önizleme</span>
              <a
                href={pdfUrl}
                download={dosyaAdi}
                className="text-xs font-semibold text-dershanem-navy hover:underline"
              >
                PDF indir
              </a>
            </div>
            <iframe src={pdfUrl} className="h-[520px] w-full rounded border" title="Föy önizleme" />
          </div>
        ) : null}
      </section>

      {formulAcik ? (
        <FormulaEditor
          onKapat={() => setFormulAcik(false)}
          onKaydet={({ latex, gorsel }) => {
            blokEkle({ kind: "formula", render: gorsel, latex });
            setFormulAcik(false);
          }}
        />
      ) : null}
    </div>
  );
}
