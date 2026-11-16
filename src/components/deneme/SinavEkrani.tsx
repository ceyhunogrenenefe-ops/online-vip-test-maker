"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Sik } from "@/lib/deneme/model";

type Bolum = { id: string; ad: string; sureDakika: number };
type Soru = {
  id: string;
  ders: string;
  bolumId: string;
  sira: number;
  metin: string;
  secenekler: Partial<Record<Sik, string>>;
  gorsel: string | null;
  ortakMetin: string | null;
  ortakGorsel: string | null;
  grupId: string | null;
};
type Sinav = { deneme: { id: string; kod: string; ad: string; bolumler: Bolum[]; sikSayisi?: 4 | 5 }; sorular: Soru[]; onizleme?: boolean };
type Sonuc = { dogru: number; yanlis: number; bos: number; net: number; dersler: { ders: string; dogru: number; yanlis: number; bos: number; net: number }[] };
type Karsilastirma = { soruId: string; verilen: Sik | null; dogru: Sik | null; sira: number };

const TUM_HARFLER: Sik[] = ["A", "B", "C", "D", "E"];

async function oku<T>(yol: string, body?: unknown): Promise<T> {
  const r = await fetch(yol, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await r.json()) as T & { hata?: string };
  if (!r.ok) throw new Error(json.hata || "Sınav açılamadı.");
  return json;
}

export function SinavEkrani({ kod, onizlemeId }: { kod?: string; onizlemeId?: string }) {
  const [sinav, setSinav] = useState<Sinav | null>(null);
  const [hata, setHata] = useState("");
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [telefonIstendi, setTelefonIstendi] = useState("");
  const [oturumId, setOturumId] = useState<string | null>(null);
  const [cevaplar, setCevaplar] = useState<Record<string, Sik>>({});
  const [baslama, setBaslama] = useState<number | null>(null);
  const [kalan, setKalan] = useState<number | null>(null);
  const [onay, setOnay] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [karsilastirma, setKarsilastirma] = useState<Karsilastirma[]>([]);
  const [ayni, setAyni] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const kayitHazir = useRef(false);
  const HARFLER = TUM_HARFLER.slice(0, sinav?.deneme.sikSayisi === 5 ? 5 : 4);
  const sureDoldu = useRef(false);

  useEffect(() => {
    const yol = onizlemeId ? `/api/deneme?op=onizleme&id=${encodeURIComponent(onizlemeId)}` : `/api/deneme/sinav?kod=${encodeURIComponent(kod || "")}`;
    void oku<Sinav>(yol)
      .then((veri) => {
        setSinav(veri);
        if (kod && !onizlemeId) {
          const saklanan = localStorage.getItem(`ovip-deneme:${kod}`);
          if (saklanan) {
            void oku<{
              oturumId: string;
              teslim: boolean;
              cevaplar: Record<string, Sik>;
              sonuc: Sonuc | null;
              baslama: number;
              ad: string;
              soyad: string;
              karsilastirma?: Karsilastirma[];
            }>(`/api/deneme/sinav?op=oturum&id=${encodeURIComponent(saklanan)}`).then((o) => {
              setOturumId(o.oturumId);
              setCevaplar(o.cevaplar || {});
              setBaslama(o.baslama);
              setAd(o.ad);
              setSoyad(o.soyad);
              if (o.teslim && o.sonuc) {
                setSonuc(o.sonuc);
                setKarsilastirma(o.karsilastirma || []);
              }
              kayitHazir.current = true;
            });
          } else kayitHazir.current = true;
        }
      })
      .catch((e: Error) => setHata(e.message));
  }, [kod, onizlemeId]);

  useEffect(() => {
    if (!oturumId || !sinav || onizlemeId || sonuc) return;
    if (!kayitHazir.current) return;
    const zaman = window.setTimeout(() => {
      void oku(`/api/deneme/sinav`, { op: "cevap", oturumId, cevaplar }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(zaman);
  }, [cevaplar, oturumId, sinav, onizlemeId, sonuc]);

  const sureSaniye = (sinav?.deneme.bolumler || []).reduce((t, b) => t + b.sureDakika, 0) * 60;
  useEffect(() => {
    if (!baslama || !sureSaniye) return;
    const tik = () => setKalan(Math.max(0, sureSaniye - Math.floor((Date.now() - baslama) / 1000)));
    tik();
    const id = window.setInterval(tik, 1000);
    return () => window.clearInterval(id);
  }, [baslama, sureSaniye]);

  const bos = useMemo(() => {
    if (!sinav) return 0;
    return sinav.sorular.filter((s) => !cevaplar[s.id]).length;
  }, [sinav, cevaplar]);

  const basla = async () => {
    if (!kod) return;
    setHata("");
    try {
      const yanit = await oku<
        | { telefonGerekli: true; mesaj: string }
        | { telefonGerekli: false; oturumId: string; telefonMaske: string; telefonKaynak: string }
      >("/api/deneme/sinav", { op: "basla", kod, ad, soyad, telefon });
      if (yanit.telefonGerekli) {
        setTelefonIstendi(yanit.mesaj);
        return;
      }
      localStorage.setItem(`ovip-deneme:${kod}`, yanit.oturumId);
      setOturumId(yanit.oturumId);
      setBaslama(Date.now());
      setMesaj(
        yanit.telefonKaynak === "giris"
          ? "Sonuç, yazdığınız numaraya SMS olarak gidecek."
          : `Sonuç, kayıtlı ${yanit.telefonKaynak === "veli" ? "veli" : "öğrenci"} numarasına (${yanit.telefonMaske}) gidecek.`
      );
      kayitHazir.current = true;
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Giriş yapılamadı.");
    }
  };

  const teslimEt = async (zorla = false) => {
    if (!oturumId || gonderiliyor) return;
    if (sonuc && !zorla) {
      setGonderiliyor(true);
      try {
        const yanit = await oku<{ ayni: boolean; sonuc: Sonuc; karsilastirma: Karsilastirma[] }>("/api/deneme/sinav", {
          op: "teslim",
          oturumId,
          cevaplar,
        });
        setAyni(yanit.ayni);
        setSonuc(yanit.sonuc);
        setKarsilastirma(yanit.karsilastirma);
        if (yanit.ayni) setMesaj("Bu teslim zaten kayıtlı. Yeni sonuç veya SMS oluşturulmadı.");
      } catch (e) {
        setHata(e instanceof Error ? e.message : "Teslim olunamadı.");
      } finally {
        setGonderiliyor(false);
        setOnay(false);
      }
      return;
    }
    setOnay(false);
    setGonderiliyor(true);
    try {
      const yanit = await oku<{ ayni: boolean; sonuc: Sonuc; karsilastirma: Karsilastirma[] }>("/api/deneme/sinav", {
        op: "teslim",
        oturumId,
        cevaplar,
      });
      setAyni(yanit.ayni);
      setSonuc(yanit.sonuc);
      setKarsilastirma(yanit.karsilastirma);
      setMesaj(yanit.ayni ? "Bu teslim zaten kayıtlı. Yeni sonuç veya SMS oluşturulmadı." : "Sınav teslim edildi. Sonuç SMS'i gönderiliyor.");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Teslim olunamadı.");
    } finally {
      setGonderiliyor(false);
    }
  };

  useEffect(() => {
    if (kalan !== 0 || !oturumId || sonuc || onizlemeId || sureDoldu.current) return;
    sureDoldu.current = true;
    void teslimEt(true);
    // süre bitince bir kez teslim
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalan]);

  if (hata && !sinav) {
    return <div className="p-8 text-center text-red-700">{hata}</div>;
  }
  if (!sinav) return <div className="p-8 text-center">Sınav yükleniyor…</div>;

  const isaretle = (soruId: string, harf: Sik) => {
    if (sonuc || onizlemeId) return;
    setCevaplar((v) => ({ ...v, [soruId]: harf }));
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-dershanem-navy px-4 py-4 text-white">
        <p className="text-xs uppercase tracking-wide text-slate-300">Online VIP Dershane</p>
        <h1 className="text-xl font-bold">{sinav.deneme.ad}</h1>
        <p className="mt-1 text-sm text-slate-200">
          {sinav.deneme.bolumler.map((b) => `${b.ad} ${b.sureDakika} dk`).join(" · ")}
          {kalan != null ? ` · Kalan ${Math.floor(kalan / 60)}:${String(kalan % 60).padStart(2, "0")}` : ""}
        </p>
        {onizlemeId ? <p className="mt-1 text-sm text-amber-200">Öğrenci ekranı ön izlemesi. Cevap kaydedilmez.</p> : null}
      </header>

      {!oturumId && !onizlemeId ? (
        <form
          className="mx-auto mt-8 max-w-md space-y-3 rounded-xl bg-white p-6 shadow"
          onSubmit={(e) => {
            e.preventDefault();
            void basla();
          }}
        >
          <label className="block text-sm">
            Ad
            <input className="mt-1 w-full rounded border px-3 py-2" value={ad} onChange={(e) => setAd(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Soyad
            <input className="mt-1 w-full rounded border px-3 py-2" value={soyad} onChange={(e) => setSoyad(e.target.value)} required />
          </label>
          {telefonIstendi ? (
            <label className="block text-sm">
              {telefonIstendi}
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                inputMode="tel"
                placeholder="05xx xxx xx xx"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                required
              />
            </label>
          ) : null}
          {hata ? <p className="text-sm text-red-700">{hata}</p> : null}
          <button type="submit" className="w-full rounded-lg bg-dershanem-blue py-2 font-semibold text-white">
            Sınava başla
          </button>
        </form>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)] gap-2 p-2 sm:gap-4 sm:p-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="col-start-2 row-start-1 space-y-4">
            {sinav.deneme.bolumler.map((bolum) => {
              const grup = sinav.sorular.filter((s) => s.bolumId === bolum.id);
              if (!grup.length) return null;
              const gorulen = new Set<string>();
              return (
                <section key={bolum.id}>
                  <h2 className="mb-2 text-lg font-bold text-dershanem-navy">
                    {bolum.ad} · {bolum.sureDakika} dakika
                  </h2>
                  <div className="space-y-4">
                    {grup.map((soru) => {
                      const ortak = Boolean(soru.grupId && !gorulen.has(soru.grupId));
                      if (soru.grupId) gorulen.add(soru.grupId);
                      const kars = karsilastirma.find((k) => k.soruId === soru.id);
                      return (
                        <article key={soru.id} id={`soru-${soru.sira}`} className="scroll-mt-2 rounded-xl bg-white p-2 shadow sm:p-4">
                          {ortak && (soru.ortakMetin || soru.ortakGorsel) ? (
                            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                              {soru.ortakGorsel ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={soru.ortakGorsel} alt="Ortak metin veya görsel" className="mb-2 max-w-full" />
                              ) : null}
                              {soru.ortakMetin}
                            </div>
                          ) : null}
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            {soru.ders} · Soru {soru.sira}
                          </p>
                          {soru.gorsel ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a href={soru.gorsel} target="_blank" rel="noreferrer" title="Büyütmek için dokun">
                              <img src={soru.gorsel} alt={`Soru ${soru.sira}`} className="mt-2 w-full max-w-2xl rounded border bg-white object-contain" />
                            </a>
                          ) : null}
                          {soru.metin ? <p className="mt-2 font-medium">{soru.metin}</p> : null}
                          {HARFLER.some((h) => soru.secenekler[h] && soru.secenekler[h] !== h) ? (
                            <ul className="mt-2 space-y-1 text-sm">
                              {HARFLER.map((h) =>
                                soru.secenekler[h] ? (
                                  <li key={h}>
                                    {h}) {soru.secenekler[h]}
                                  </li>
                                ) : null
                              )}
                            </ul>
                          ) : null}
                          {kars ? (
                            <p className={`mt-2 text-sm font-medium ${kars.verilen === kars.dogru ? "text-green-700" : "text-red-700"}`}>
                              Sizin cevabınız {kars.verilen || "boş"} · Doğru cevap {kars.dogru}
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Telefonda da solda sabit dursun: öğrenci soruyu okurken optiği kaydırmadan işaretler. */}
          <aside className="sticky top-2 col-start-1 row-start-1 flex max-h-[calc(100dvh-1rem)] flex-col rounded-xl bg-white p-1.5 shadow sm:top-4 sm:p-3">
            <h2 className="text-center text-[11px] font-bold text-dershanem-navy sm:text-left sm:text-sm">Optik form</h2>
            <p className="mb-2 hidden text-xs text-slate-500 sm:block">{ad} {soyad}</p>
            <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {sinav.sorular.map((soru) => (
                <li key={soru.id} className="flex items-center gap-0.5 sm:gap-2">
                  <a href={`#soru-${soru.sira}`} className="w-5 shrink-0 text-right text-[10px] font-semibold text-slate-600 sm:w-6 sm:text-xs">
                    {soru.sira}
                  </a>
                  {HARFLER.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-label={`Soru ${soru.sira} ${h}`}
                      aria-pressed={cevaplar[soru.id] === h}
                      disabled={Boolean(sonuc) || Boolean(onizlemeId)}
                      onClick={() => isaretle(soru.id, h)}
                      className={`h-6 w-6 shrink-0 rounded-full border text-[10px] font-bold sm:h-8 sm:w-8 sm:text-xs ${
                        cevaplar[soru.id] === h ? "border-dershanem-navy bg-dershanem-navy text-white" : "bg-white"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </li>
              ))}
            </ol>
            {mesaj ? <p className="mt-3 text-xs text-slate-600">{mesaj}</p> : null}
            {hata ? <p className="mt-2 text-xs text-red-700">{hata}</p> : null}
            {!onizlemeId && (
              <button
                type="button"
                disabled={gonderiliyor}
                onClick={() => (sonuc ? void teslimEt(false) : setOnay(true))}
                className="mt-2 w-full rounded-lg bg-dershanem-blue py-2 text-xs font-semibold text-white disabled:opacity-60 sm:mt-3 sm:text-sm"
              >
                Sınavı Bitir
              </button>
            )}
            {sonuc && (
              <div className="mt-3 rounded-lg bg-slate-50 p-2 text-sm">
                <p className="font-semibold">Doğru {sonuc.dogru}, yanlış {sonuc.yanlis}, boş {sonuc.bos}</p>
                <p>Net {String(sonuc.net).replace(".", ",")}</p>
                <ul className="mt-1 text-xs text-slate-700">
                  {sonuc.dersler.map((d) => (
                    <li key={d.ders}>
                      {d.ders}: {d.dogru} doğru, {d.yanlis} yanlış, {d.bos} boş, net {String(d.net).replace(".", ",")}
                    </li>
                  ))}
                </ul>
                {ayni ? <p className="mt-1 text-xs">Yeni kayıt oluşmadı.</p> : null}
              </div>
            )}
          </aside>
        </div>
      )}

      {onay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-dershanem-navy">Sınavı bitir</h2>
            <p className="mt-2 text-sm">
              {bos > 0 ? `${bos} soru boş.` : "Boş soru yok."} Teslimden sonra cevaplar değişmez.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 rounded border py-2 text-sm" onClick={() => setOnay(false)}>
                Geri dön
              </button>
              <button type="button" className="flex-1 rounded bg-dershanem-blue py-2 text-sm font-semibold text-white" onClick={() => void teslimEt(true)}>
                Teslim et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
