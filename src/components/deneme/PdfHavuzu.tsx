"use client";

import { useMemo, useState } from "react";
import type { HavuzVeri } from "@/components/deneme/DenemeStudyo";
import { PdfInceleme } from "@/components/deneme/PdfInceleme";
import { FORMATLAR, formatBul, tumTestler } from "@/lib/deneme/format";
import { pdfSil, type HavuzPdf } from "@/lib/deneme/havuz";
import { pdfIceAktar } from "@/lib/deneme/ice-aktar";
import { ocrKapat } from "@/lib/deneme/sayfa-oku";

type Sira = { ad: string; durum: "bekliyor" | "isleniyor" | "bitti" | "hata"; mesaj: string };

export function PdfHavuzu({ veri, yenile }: { veri: HavuzVeri; yenile: () => Promise<void> }) {
  const [formatId, setFormatId] = useState("LGS");
  const [tur, setTur] = useState<string>("deneme");
  const [sira, setSira] = useState<Sira[]>([]);
  const [calisiyor, setCalisiyor] = useState(false);
  const [acik, setAcik] = useState<HavuzPdf | null>(null);
  const testler = tumTestler(formatBul(formatId));

  const ozet = useMemo(() => {
    const m = new Map<string, { soru: number; cevapli: number }>();
    for (const s of veri.sorular) {
      const o = m.get(s.pdfId) ?? { soru: 0, cevapli: 0 };
      o.soru++;
      if (s.dogru) o.cevapli++;
      m.set(s.pdfId, o);
    }
    return m;
  }, [veri.sorular]);

  const yukle = async (dosyalar: File[]) => {
    const pdfler = dosyalar.filter((f) => f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf");
    if (!pdfler.length) return;
    const tekTest = tur === "deneme" ? null : Number(tur);
    setSira(pdfler.map((f) => ({ ad: f.name, durum: "bekliyor", mesaj: "" })));
    setCalisiyor(true);
    for (let i = 0; i < pdfler.length; i++) {
      const guncelle = (p: Partial<Sira>) => setSira((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));
      guncelle({ durum: "isleniyor", mesaj: "Açılıyor" });
      try {
        const r = await pdfIceAktar(pdfler[i], formatId, tekTest, (mesaj) => guncelle({ mesaj }));
        guncelle({
          durum: "bitti",
          mesaj: `${r.soru} soru kesildi, ${r.cevapli} cevap anahtardan okundu${r.ocrSayfa ? ` · ${r.ocrSayfa} sayfa OCR` : ""}`,
        });
        await yenile();
      } catch (e) {
        guncelle({ durum: "hata", mesaj: e instanceof Error ? e.message : "PDF işlenemedi." });
      }
    }
    await ocrKapat().catch(() => undefined);
    setCalisiyor(false);
  };

  if (acik) {
    const guncel = veri.pdfler.find((p) => p.id === acik.id) ?? acik;
    return <PdfInceleme pdf={guncel} veri={veri} yenile={yenile} kapat={() => setAcik(null)} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-dershanem-navy">PDF yükle</h2>
        <p className="mt-1 text-sm text-slate-600">
          Birden çok PDF seçebilirsin. Sorular tek tek kesilir; taranmış ya da resimli sayfalar OCR ile okunur. Son
          sayfadaki cevap anahtarı otomatik eşlenir. Sonra her PDF’i açıp kesimleri kontrol edebilirsin.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="font-semibold">Sınıf / sınav</span>
            <select
              className="mt-1 w-full rounded border px-2 py-2"
              value={formatId}
              onChange={(e) => {
                setFormatId(e.target.value);
                setTur("deneme");
              }}
            >
              {FORMATLAR.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.ad}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-semibold">PDF’in içeriği</span>
            <select className="mt-1 w-full rounded border px-2 py-2" value={tur} onChange={(e) => setTur(e.target.value)}>
              <option value="deneme">Deneme (tüm dersler, başlıklara göre)</option>
              {testler.map((t, i) => (
                <option key={t.ad} value={i}>
                  Tek ders: {t.ad}
                </option>
              ))}
            </select>
          </label>
          <label
            className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-3 py-2 text-sm font-semibold ${
              calisiyor ? "border-slate-200 text-slate-400" : "border-dershanem-blue text-dershanem-blue hover:bg-dershanem-sky"
            }`}
          >
            {calisiyor ? "İşleniyor…" : "PDF seç (çoklu)"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={calisiyor}
              className="hidden"
              onChange={(e) => {
                const f = Array.from(e.target.files || []);
                e.target.value = "";
                void yukle(f);
              }}
            />
          </label>
        </div>
        {sira.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {sira.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span
                  className={`w-20 shrink-0 font-semibold ${
                    s.durum === "bitti" ? "text-green-700" : s.durum === "hata" ? "text-red-700" : "text-slate-500"
                  }`}
                >
                  {s.durum === "bitti" ? "Tamam" : s.durum === "hata" ? "Hata" : s.durum === "isleniyor" ? "İşleniyor" : "Sırada"}
                </span>
                <span className="truncate font-medium">{s.ad}</span>
                <span className="text-slate-500">{s.mesaj}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-dershanem-navy">Havuzdaki PDF’ler</h2>
        {veri.pdfler.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Henüz PDF yok.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-1">PDF</th>
                <th className="py-1">Tür</th>
                <th className="py-1">Soru</th>
                <th className="py-1">Cevaplı</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {veri.pdfler.map((p) => {
                const o = ozet.get(p.id) ?? { soru: 0, cevapli: 0 };
                const f = formatBul(p.formatId);
                return (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 font-medium">{p.ad}</td>
                    <td className="py-2 text-slate-600">
                      {f.ad} · {p.tekTest == null ? "Deneme" : tumTestler(f)[p.tekTest]?.ad}
                    </td>
                    <td className="py-2">{o.soru}</td>
                    <td className={`py-2 ${o.cevapli < o.soru ? "font-semibold text-amber-700" : "text-green-700"}`}>
                      {o.cevapli}/{o.soru}
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" className="rounded bg-dershanem-navy px-3 py-1 text-white" onClick={() => setAcik(p)}>
                        Kontrol et
                      </button>
                      <button
                        type="button"
                        className="ml-2 rounded border px-3 py-1 text-red-700"
                        onClick={async () => {
                          if (!confirm(`"${p.ad}" ve kesilen ${o.soru} soru havuzdan silinsin mi?`)) return;
                          await pdfSil(p);
                          await yenile();
                        }}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
