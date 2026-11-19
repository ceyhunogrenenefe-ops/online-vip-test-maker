"use client";

import { useMemo, useState } from "react";
import type { HavuzVeri } from "@/components/deneme/DenemeStudyo";
import { HavuzGorsel } from "@/components/deneme/HavuzGorsel";
import { FORMATLAR, formatBul } from "@/lib/deneme/format";
import { denemeleriYaz, gorselOku, gorselleriYaz, gorselSil, sinavLinki, type DenemeTaslak, type HavuzSoru } from "@/lib/deneme/havuz";
import { cevapAnahtariPdf, kitapcikOlustur, type Kitap } from "@/lib/deneme/kitapcik";
import { otomatikTamamla, secimDegistir } from "@/lib/deneme/secim";
import { BRANS_ADETLERI, bransAdi, bransOturumu, bransSecenekleri } from "@/lib/deneme/brans";

const anahtar = (test: string, ders: string) => `${test}|${ders}`;

function varsayilanSinavAdi(formatId: string) {
  if (formatId === "LGS") return "Liselere Geçiş Sistemi";
  if (["TYT", "AYT", "9", "10", "11"].includes(formatId)) return "Yükseköğretim Kurumları Sınavı";
  return "Ortaokul Deneme Sınavı";
}

function kitapAyar(t: DenemeTaslak): NonNullable<DenemeTaslak["kitap"]> {
  return t.kitap ?? { kurum: "Online VIP Dershane", denemeNo: "1", sinavAdi: varsayilanSinavAdi(t.formatId), kitapcikTuru: "A", kapak: false };
}

function yeniTaslak(formatId: string): DenemeTaslak {
  const f = formatBul(formatId);
  return {
    id: crypto.randomUUID(),
    ad: `${f.ad} Deneme`,
    formatId,
    ceza: f.ceza,
    sikSayisi: f.sikSayisi,
    oturumlar: f.oturumlar.map((o) => ({
      ad: o.ad,
      sureDakika: o.sureDakika,
      testler: o.testler.map((t) => ({ ad: t.ad, dersler: t.dersler.map((d) => ({ ...d })) })),
    })),
    secim: {},
    olusturma: Date.now(),
    yayin: null,
  };
}

function yeniBransTaslak(formatId: string, test: string, ders: string | null, adet: number): DenemeTaslak {
  const f = formatBul(formatId);
  const brans = { test, ders };
  const oturum = bransOturumu(f, brans, adet);
  const toplam = oturum.testler[0].dersler.reduce((a, d) => a + d.adet, 0);
  return {
    id: crypto.randomUUID(),
    ad: `${f.ad.replace(/\s*\(.*\)\s*/, "")} ${bransAdi(brans)} Branş Denemesi (${toplam} soru)`,
    formatId,
    ceza: f.ceza,
    sikSayisi: f.sikSayisi,
    oturumlar: [oturum],
    brans,
    secim: {},
    olusturma: Date.now(),
    yayin: null,
  };
}

/** Kitapçıkta ve listede görünen format adı; branşta "LGS (8. Sınıf) · Türkçe". */
function gorunenFormat(t: DenemeTaslak) {
  const f = formatBul(t.formatId).ad;
  return t.brans ? `${f} · ${bransAdi(t.brans)}` : f;
}

function indir(b: Blob, ad: string) {
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = ad;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}

function blobDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Görsel okunamadı."));
    r.readAsDataURL(b);
  });
}

async function api<T>(body: unknown): Promise<T> {
  const r = await fetch("/api/deneme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({}))) as T & { hata?: string };
  if (!r.ok) throw new Error(j.hata || "İşlem tamamlanamadı.");
  return j;
}

export function DenemeKur({ veri, yenile }: { veri: HavuzVeri; yenile: () => Promise<void> }) {
  const [taslak, setTaslak] = useState<DenemeTaslak | null>(null);
  const [secici, setSecici] = useState<{ test: string; ders: string; adet: number } | null>(null);
  const [pdfFiltre, setPdfFiltre] = useState("");
  const [is, setIs] = useState("");
  const [hata, setHata] = useState("");
  const [bransFormat, setBransFormat] = useState("LGS");
  const [bransNo, setBransNo] = useState(0);
  const [bransAdet, setBransAdet] = useState(20);

  const soruHarita = useMemo(() => new Map(veri.sorular.map((s) => [s.id, s])), [veri.sorular]);

  const kaydet = async (t: DenemeTaslak) => {
    setTaslak(t);
    const liste = veri.denemeler.filter((d) => d.id !== t.id);
    await denemeleriYaz([t, ...liste]);
    await yenile();
  };

  /** Diğer denemelerde kaç kez kullanıldı. */
  const kullanim = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of veri.denemeler) {
      if (d.id === taslak?.id) continue;
      for (const ids of Object.values(d.secim)) for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [veri.denemeler, taslak?.id]);

  if (!taslak) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="text-lg font-bold text-dershanem-navy">Yeni deneme</h2>
          <p className="mt-1 text-sm text-slate-600">Formatı seç; ders ve soru sayıları hazır gelir, istersen değiştirirsin.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {FORMATLAR.map((f) => {
              const adet = veri.sorular.filter((s) => s.formatId === f.id).length;
              const toplam = f.oturumlar.flatMap((o) => o.testler).flatMap((t) => t.dersler).reduce((a, d) => a + d.adet, 0);
              return (
                <button
                  key={f.id}
                  type="button"
                  className="rounded-lg border p-3 text-left hover:border-dershanem-blue hover:bg-dershanem-sky"
                  onClick={() => void kaydet(yeniTaslak(f.id))}
                >
                  <div className="font-bold text-dershanem-navy">{f.ad}</div>
                  <div className="text-xs text-slate-500">{toplam} soru · {f.sikSayisi} şık</div>
                  <div className={`text-xs ${adet ? "text-green-700" : "text-slate-400"}`}>Havuzda {adet} soru</div>
                </button>
              );
            })}
          </div>
        </section>
        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="text-lg font-bold text-dershanem-navy">Branş denemesi</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tek dersten deneme: formatı ve dersi seç, soru sayısını belirle. Sorular o formatın havuzundan gelir.
          </p>
          {(() => {
            const f = formatBul(bransFormat);
            const secenekler = bransSecenekleri(f);
            const s = secenekler[Math.min(bransNo, secenekler.length - 1)];
            const havuz = (x: (typeof secenekler)[number]) =>
              veri.sorular.filter((q) => q.formatId === f.id && q.test === x.test && (!x.ders || q.ders === x.ders)).length;
            const mevcut = havuz(s);
            return (
              <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
                <label>
                  Format
                  <select
                    className="mt-1 block rounded border px-2 py-1.5"
                    value={bransFormat}
                    onChange={(e) => {
                      setBransFormat(e.target.value);
                      setBransNo(0);
                    }}
                  >
                    {FORMATLAR.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.ad}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ders
                  <select className="mt-1 block rounded border px-2 py-1.5" value={bransNo} onChange={(e) => setBransNo(Number(e.target.value))}>
                    {secenekler.map((x, i) => (
                      <option key={x.ad} value={i}>
                        {x.ad} · havuzda {havuz(x)}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  Soru sayısı
                  <div className="mt-1 flex items-center gap-1">
                    {BRANS_ADETLERI.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`rounded border px-3 py-1.5 font-semibold ${bransAdet === n ? "border-dershanem-blue bg-dershanem-sky text-dershanem-navy" : ""}`}
                        onClick={() => setBransAdet(n)}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={200}
                      className="w-20 rounded border px-2 py-1.5"
                      value={bransAdet}
                      onChange={(e) => setBransAdet(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded bg-dershanem-navy px-4 py-2 font-semibold text-white"
                  onClick={() => void kaydet(yeniBransTaslak(f.id, s.test, s.ders, bransAdet))}
                >
                  Branş denemesi oluştur
                </button>
                {mevcut < bransAdet ? (
                  <p className="w-full text-xs text-amber-700">
                    Havuzda bu dersten {mevcut} soru var; {bransAdet} soru için önce bu dersin PDF’lerini yükleyin.
                  </p>
                ) : null}
              </div>
            );
          })()}
        </section>
        {veri.denemeler.length ? (
          <section className="rounded-xl bg-white p-4 shadow">
            <h2 className="text-lg font-bold text-dershanem-navy">Kayıtlı denemeler</h2>
            <ul className="mt-2 divide-y text-sm">
              {veri.denemeler.map((d) => {
                const secilen = Object.values(d.secim).reduce((a, x) => a + x.length, 0);
                return (
                  <li key={d.id} className="flex items-center gap-2 py-2">
                    <span className="font-medium">{d.ad}</span>
                    <span className="text-slate-500">
                      {gorunenFormat(d)} {d.brans ? "branş" : ""} · {secilen} soru {d.yayin ? `· online: ${d.yayin.kod}` : ""}
                    </span>
                    <button type="button" className="ml-auto rounded bg-dershanem-navy px-3 py-1 text-white" onClick={() => setTaslak(d)}>
                      Aç
                    </button>
                    <button
                      type="button"
                      className="rounded border px-3 py-1 text-red-700"
                      onClick={async () => {
                        if (!confirm(`"${d.ad}" silinsin mi? (Havuzdaki sorular silinmez.)`)) return;
                        await denemeleriYaz(veri.denemeler.filter((x) => x.id !== d.id));
                        await yenile();
                      }}
                    >
                      Sil
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  const adaylar = (test: string, ders: string) =>
    veri.sorular.filter((s) => s.formatId === taslak.formatId && s.test === test && s.ders === ders);
  const tumSecili = new Set(Object.values(taslak.secim).flat());
  const kalemler = taslak.oturumlar.flatMap((o, oi) =>
    o.testler.flatMap((t, ti) => t.dersler.map((d, di) => ({ oi, ti, di, o, t, d, k: anahtar(t.ad, d.ad) })))
  );
  const toplamGereken = kalemler.reduce((a, x) => a + x.d.adet, 0);
  const toplamSecili = kalemler.reduce((a, x) => a + (taslak.secim[x.k]?.length ?? 0), 0);
  const cevapsiz = [...tumSecili].filter((id) => !soruHarita.get(id)?.dogru).length;
  const kilitli = Boolean(taslak.yayin);

  const doldur = (k: string, test: string, ders: string, adet: number, t: DenemeTaslak) => {
    const diger = new Set(Object.entries(t.secim).filter(([x]) => x !== k).flatMap(([, v]) => v));
    const liste = adaylar(test, ders).map((s) => ({ id: s.id, grupId: s.grupId, kullanim: kullanim.get(s.id) ?? 0, dogru: s.dogru }));
    const mevcut = (t.secim[k] ?? []).filter((id) => soruHarita.has(id)).slice(0, adet);
    return otomatikTamamla(liste, adet, mevcut, diger);
  };

  const hepsiniDoldur = () => {
    const t = { ...taslak, secim: { ...taslak.secim } };
    for (const x of kalemler) t.secim[x.k] = doldur(x.k, x.t.ad, x.d.ad, x.d.adet, t);
    void kaydet(t);
  };

  const adetDegistir = (oi: number, ti: number, di: number, adet: number) => {
    const t = structuredClone(taslak);
    t.oturumlar[oi].testler[ti].dersler[di].adet = Math.max(0, Math.min(200, adet || 0));
    void kaydet(t);
  };

  /** Kitapçık/yayın için testlerin sıralı soruları. Grup üyeleri yan yana tutulur. */
  const testSorulari = (t: DenemeTaslak["oturumlar"][number]["testler"][number]) => {
    const liste: HavuzSoru[] = [];
    for (const d of t.dersler) {
      const ids = taslak.secim[anahtar(t.ad, d.ad)] ?? [];
      const sorular = ids.map((id) => soruHarita.get(id)).filter((s): s is HavuzSoru => !!s);
      const gorulen = new Set<string>();
      for (const s of sorular) {
        if (!s.grupId) liste.push(s);
        else if (!gorulen.has(s.grupId)) {
          gorulen.add(s.grupId);
          liste.push(...sorular.filter((x) => x.grupId === s.grupId).sort((a, b) => (a.numara ?? 0) - (b.numara ?? 0)));
        }
      }
    }
    return liste;
  };

  const kitapHazirla = async (): Promise<Kitap> => {
    const oturumlar = [];
    for (const o of taslak.oturumlar) {
      const testler = [];
      for (const t of o.testler) {
        const liste = testSorulari(t);
        const sorular = [];
        for (const s of liste) {
          const gorsel = await gorselOku(s.id);
          if (!gorsel) throw new Error(`${t.ad} ${s.numara}. soru görseli bulunamadı.`);
          const grupGorsel = s.grupId ? await gorselOku(s.grupId) : undefined;
          sorular.push({
            gorsel,
            dogru: s.dogru,
            grup:
              s.grupId && grupGorsel
                ? { id: s.grupId, gorsel: grupGorsel, adet: liste.filter((x) => x.grupId === s.grupId).length }
                : null,
          });
        }
        if (sorular.length) testler.push({ ad: t.baslik ?? t.ad, sorular });
      }
      if (testler.length) oturumlar.push({ ad: o.ad, sureDakika: o.sureDakika, testler });
    }
    const ayar = kitapAyar(taslak);
    return {
      ad: taslak.ad,
      formatAd: gorunenFormat(taslak),
      kapakYazi: taslak.brans ? "BRANŞ DENEMESİ" : undefined,
      sinavAdi: ayar.sinavAdi,
      kurum: ayar.kurum,
      denemeNo: ayar.denemeNo,
      kitapcikTuru: ayar.kitapcikTuru,
      kod: taslak.yayin?.kod ?? taslak.id.replace(/[^0-9]/g, "").slice(0, 8),
      sikSayisi: taslak.sikSayisi,
      ceza: taslak.ceza,
      oturumlar,
      kapakGorsel: ayar.kapak ? await gorselOku(`kapak:${taslak.id}`) : null,
      logo: await gorselOku("logo"),
    };
  };

  const calistir = async (ad: string, fn: () => Promise<void>) => {
    setHata("");
    setIs(ad);
    try {
      await fn();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setIs("");
    }
  };

  const yayinla = () =>
    calistir("Online yayınlanıyor", async () => {
      if (cevapsiz) throw new Error(`${cevapsiz} sorunun doğru cevabı eksik. Önce PDF kontrol ekranından girin.`);
      if (!toplamSecili) throw new Error("Denemede soru yok.");
      const yollar = new Map<string, string>();
      const yukle = async (id: string) => {
        if (yollar.has(id)) return yollar.get(id)!;
        const b = await gorselOku(id);
        if (!b) throw new Error("Soru görseli bulunamadı.");
        const r = await api<{ yol: string }>({ op: "gorsel", veri: await blobDataUrl(b) });
        yollar.set(id, r.yol);
        return r.yol;
      };
      const bolumler = taslak.oturumlar.map((o) => ({
        id: crypto.randomUUID(),
        ad: o.ad,
        sureDakika: o.sureDakika,
        dersler: o.testler.map((t) => ({ ders: t.baslik ?? t.ad, adet: testSorulari(t).length })).filter((d) => d.adet > 0),
      }));
      const sorular = [];
      let n = 0;
      for (let oi = 0; oi < taslak.oturumlar.length; oi++) {
        for (const t of taslak.oturumlar[oi].testler) {
          for (const s of testSorulari(t)) {
            setIs(`Görseller yükleniyor ${++n}/${toplamSecili}`);
            sorular.push({
              ders: t.baslik ?? t.ad,
              bolumId: bolumler[oi].id,
              dogru: s.dogru,
              gorsel: await yukle(s.id),
              ortakGorsel: s.grupId ? await yukle(s.grupId).catch(() => null) : null,
              grupId: s.grupId,
            });
          }
        }
      }
      const r = await api<{ id: string; kod: string }>({
        op: "hazir",
        ad: taslak.ad,
        yanlisCezasi: taslak.ceza,
        sikSayisi: taslak.sikSayisi,
        smsAlici: "veli",
        bolumler: bolumler.filter((b) => b.dersler.length),
        sorular,
      });
      await kaydet({ ...taslak, yayin: r });
    });

  const secimListesi = secici ? taslak.secim[anahtar(secici.test, secici.ders)] ?? [] : [];
  const seciciAdaylar = secici
    ? adaylar(secici.test, secici.ders).filter((s) => !pdfFiltre || s.pdfId === pdfFiltre)
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded border bg-white px-3 py-1 text-sm" onClick={() => setTaslak(null)}>
          ← Denemeler
        </button>
        <input
          className="min-w-64 flex-1 rounded border px-3 py-1.5 text-lg font-bold text-dershanem-navy"
          value={taslak.ad}
          disabled={kilitli}
          onChange={(e) => void kaydet({ ...taslak, ad: e.target.value })}
        />
        <span className="rounded bg-dershanem-sky px-2 py-1 text-sm font-semibold text-dershanem-navy">{gorunenFormat(taslak)}</span>
        <label className="text-sm">
          Yanlış cezası{" "}
          <select
            className="rounded border px-1 py-1"
            value={String(taslak.ceza)}
            disabled={kilitli}
            onChange={(e) => void kaydet({ ...taslak, ceza: Number(e.target.value) })}
          >
            <option value={String(1 / 3)}>3 yanlış 1 doğru</option>
            <option value={String(1 / 4)}>4 yanlış 1 doğru</option>
            <option value="0">Yok</option>
          </select>
        </label>
      </div>

      <section className="rounded-xl bg-white p-4 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-dershanem-navy">
            Sorular {toplamSecili}/{toplamGereken}
          </h3>
          {cevapsiz ? <span className="text-sm font-semibold text-amber-700">{cevapsiz} sorunun cevabı eksik</span> : null}
          {!kilitli ? (
            <>
              <button type="button" className="ml-auto rounded bg-dershanem-blue px-3 py-1.5 text-sm font-semibold text-white" onClick={hepsiniDoldur}>
                Tümünü otomatik doldur
              </button>
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void kaydet({ ...taslak, secim: {} })}>
                Temizle
              </button>
            </>
          ) : (
            <span className="ml-auto text-sm text-slate-500">Yayımlandı; sorular kilitli.</span>
          )}
        </div>
        {taslak.oturumlar.map((o, oi) => (
          <div key={oi} className="mt-3">
            <div className="flex items-center gap-2 border-b pb-1 text-sm font-bold text-slate-700">
              {o.ad}
              <label className="font-normal">
                ·{" "}
                <input
                  type="number"
                  className="w-16 rounded border px-1"
                  value={o.sureDakika}
                  disabled={kilitli}
                  onChange={(e) => {
                    const t = structuredClone(taslak);
                    t.oturumlar[oi].sureDakika = Math.max(1, Number(e.target.value) || 1);
                    void kaydet(t);
                  }}
                />{" "}
                dk
              </label>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {o.testler.flatMap((t, ti) =>
                  t.dersler.map((d, di) => {
                    const k = anahtar(t.ad, d.ad);
                    const secili = (taslak.secim[k] ?? []).filter((id) => soruHarita.has(id));
                    const havuz = adaylar(t.ad, d.ad).length;
                    const tamam = secili.length === d.adet;
                    return (
                      <tr key={k} className="border-b align-middle">
                        <td className="py-1.5 pr-2 font-medium">{t.ad === d.ad ? d.ad : `${t.ad} › ${d.ad}`}</td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            className="w-14 rounded border px-1"
                            value={d.adet}
                            disabled={kilitli}
                            onChange={(e) => adetDegistir(oi, ti, di, Number(e.target.value))}
                          />{" "}
                          soru
                        </td>
                        <td className={`py-1.5 pr-2 font-semibold ${tamam ? "text-green-700" : "text-amber-700"}`}>
                          {secili.length}/{d.adet} seçili
                        </td>
                        <td className={`py-1.5 pr-2 text-xs ${havuz < d.adet ? "text-red-700" : "text-slate-500"}`}>Havuzda {havuz}</td>
                        <td className="py-1.5 text-right">
                          {!kilitli ? (
                            <>
                              <button
                                type="button"
                                className="rounded border px-2 py-1"
                                onClick={() => void kaydet({ ...taslak, secim: { ...taslak.secim, [k]: doldur(k, t.ad, d.ad, d.adet, taslak) } })}
                              >
                                Otomatik
                              </button>
                              <button
                                type="button"
                                className="ml-1 rounded bg-dershanem-navy px-2 py-1 text-white"
                                onClick={() => {
                                  setPdfFiltre("");
                                  setSecici({ test: t.ad, ders: d.ad, adet: d.adet });
                                }}
                              >
                                Elle seç
                              </button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-bold text-dershanem-navy">Kitapçık ayarları</h3>
        <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["kurum", "Kurum adı"],
              ["sinavAdi", "Kapaktaki sınav adı"],
              ["denemeNo", "Deneme no"],
              ["kitapcikTuru", "Kitapçık türü"],
            ] as const
          ).map(([alan, etiket]) => (
            <label key={alan}>
              {etiket}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={kitapAyar(taslak)[alan]}
                onChange={(e) => void kaydet({ ...taslak, kitap: { ...kitapAyar(taslak), [alan]: e.target.value } })}
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="cursor-pointer rounded border px-3 py-1.5 font-semibold hover:bg-slate-50">
            {kitapAyar(taslak).kapak ? "Kapak görselini değiştir" : "Kendi kapak görselini yükle"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                await gorselleriYaz([[`kapak:${taslak.id}`, f]]);
                await kaydet({ ...taslak, kitap: { ...kitapAyar(taslak), kapak: true } });
              }}
            />
          </label>
          {kitapAyar(taslak).kapak ? (
            <button
              type="button"
              className="text-red-700"
              onClick={async () => {
                await gorselSil(`kapak:${taslak.id}`);
                await kaydet({ ...taslak, kitap: { ...kitapAyar(taslak), kapak: false } });
              }}
            >
              Hazır kapağa dön
            </button>
          ) : (
            <span className="text-slate-500">Yüklenmezse yayınevi tarzı kapak otomatik hazırlanır.</span>
          )}
          <label className="cursor-pointer rounded border px-3 py-1.5 font-semibold hover:bg-slate-50">
            Kurum logosu yükle
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) await gorselleriYaz([["logo", f]]);
                setHata("");
                setIs("");
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-bold text-dershanem-navy">Çıktılar</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!is || !toplamSecili}
            className="rounded bg-dershanem-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
            onClick={() =>
              void calistir("Kitapçık hazırlanıyor", async () => {
                const k = await kitapHazirla();
                indir(await kitapcikOlustur(k, (m) => setIs(`Kitapçık: ${m}`)), `${taslak.ad}.pdf`);
              })
            }
          >
            Basılı kitapçık (PDF)
          </button>
          <button
            type="button"
            disabled={!!is || !toplamSecili}
            className="rounded border px-4 py-2 font-semibold disabled:opacity-50"
            onClick={() =>
              void calistir("Cevap anahtarı hazırlanıyor", async () => {
                indir(await cevapAnahtariPdf(await kitapHazirla()), `${taslak.ad} - Cevap Anahtarı.pdf`);
              })
            }
          >
            Cevap anahtarı (PDF)
          </button>
          {taslak.yayin ? (
            <div className="flex flex-wrap items-center gap-2 rounded bg-green-50 px-3 py-2 text-sm">
              <span className="font-semibold text-green-800">Online sınav linki:</span>
              <code>{sinavLinki(taslak.yayin.kod)}</code>
              <button
                type="button"
                className="rounded border bg-white px-2 py-0.5"
                onClick={() => void navigator.clipboard.writeText(sinavLinki(taslak.yayin!.kod))}
              >
                Kopyala
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!!is || !toplamSecili}
              className="rounded bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
              onClick={() => void yayinla()}
            >
              Online sınav olarak yayınla
            </button>
          )}
        </div>
        {is ? <p className="mt-2 text-sm text-slate-600">{is}…</p> : null}
        {hata ? <p className="mt-2 text-sm font-medium text-red-700">{hata}</p> : null}
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-bold text-dershanem-navy">Önizleme</h3>
        {taslak.oturumlar.map((o) =>
          o.testler.map((t) => {
            const liste = testSorulari(t);
            if (!liste.length) return null;
            return (
              <div key={`${o.ad}-${t.ad}`} className="mt-3">
                <h4 className="text-sm font-bold text-slate-700">
                  {t.baslik ?? t.ad} ({liste.length})
                </h4>
                <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                  {liste.map((s, i) => (
                    <div key={s.id} className="rounded border p-1 text-xs">
                      <div className="flex justify-between">
                        <b>{i + 1}.</b>
                        <span className={s.dogru ? "text-green-700" : "font-bold text-red-700"}>{s.dogru ?? "?"}</span>
                      </div>
                      <HavuzGorsel id={s.id} surum={s.surum} className="h-20 w-full object-contain object-top" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {secici ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={() => setSecici(null)}>
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              <h3 className="font-bold text-dershanem-navy">
                {secici.test === secici.ders ? secici.ders : `${secici.test} › ${secici.ders}`} · {secimListesi.length}/{secici.adet} seçili
              </h3>
              <select className="rounded border px-2 py-1 text-sm" value={pdfFiltre} onChange={(e) => setPdfFiltre(e.target.value)}>
                <option value="">Tüm PDF’ler</option>
                {veri.pdfler
                  .filter((p) => adaylar(secici.test, secici.ders).some((s) => s.pdfId === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ad}
                    </option>
                  ))}
              </select>
              <button type="button" className="ml-auto rounded bg-dershanem-navy px-4 py-1.5 font-semibold text-white" onClick={() => setSecici(null)}>
                Tamam
              </button>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-auto p-3 sm:grid-cols-3 lg:grid-cols-5">
              {seciciAdaylar.map((s) => {
                const k = anahtar(secici.test, secici.ders);
                const sirada = secimListesi.indexOf(s.id);
                const baskasinda = sirada < 0 && tumSecili.has(s.id);
                const pdf = veri.pdfler.find((p) => p.id === s.pdfId);
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={baskasinda}
                    className={`rounded-lg border-2 p-2 text-left ${sirada >= 0 ? "border-green-600 bg-green-50" : "border-slate-200 hover:border-dershanem-blue"} disabled:opacity-40`}
                    onClick={() => {
                      const uyeler = s.grupId ? adaylar(secici.test, secici.ders).filter((x) => x.grupId === s.grupId).map((x) => x.id) : [s.id];
                      void kaydet({ ...taslak, secim: { ...taslak.secim, [k]: secimDegistir(secimListesi, s, uyeler) } });
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-slate-500">
                        {pdf?.ad} · {s.numara}
                      </span>
                      {sirada >= 0 ? <span className="rounded bg-green-600 px-1.5 font-bold text-white">{sirada + 1}</span> : null}
                    </div>
                    <HavuzGorsel id={s.id} surum={s.surum} className="h-32 w-full object-contain object-top" />
                    <div className="mt-1 flex justify-between text-xs">
                      <span className={s.dogru ? "text-green-700" : "text-red-700"}>{s.dogru ? `Cevap ${s.dogru}` : "Cevap yok"}</span>
                      <span className="text-slate-400">
                        {s.grupId ? "ortak metin · " : ""}
                        {kullanim.get(s.id) ? `${kullanim.get(s.id)} denemede` : "kullanılmadı"}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!seciciAdaylar.length ? <p className="text-sm text-slate-500">Bu derste havuzda soru yok.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
