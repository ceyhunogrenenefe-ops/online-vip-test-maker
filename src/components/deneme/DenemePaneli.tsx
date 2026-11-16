"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DenemeKirp, type KesikSoru } from "@/components/deneme/DenemeKirp";
import { pdfdenAyikla, pdfDuzMetin } from "@/lib/deneme/pdf-ayikla";
import { lgsBolumleri } from "@/lib/deneme/sablon";
import { DERS_ADLARI, SIKLAR, VARSAYILAN_CEZA } from "@/lib/deneme/model";
import type { AyiklananSoru, Bolum, DersSonuc, EksikDers, PdfKayit, SecilenSoru, Sik, Soru } from "@/lib/deneme/model";

type DenemeOzet = {
  id: string;
  kod: string;
  ad: string;
  yayin: boolean;
  yanlisCezasi: number;
  smsAlici: "ogrenci" | "veli";
  bolumler: Bolum[];
  pdfIdler: string[];
  sorular: SecilenSoru[];
};

type SmsKayit = { durum: "gonderildi" | "hata"; hata: string | null; metin: string; saglayici: string };

type SonucSatir = {
  id: string;
  ad: string;
  soyad: string;
  telefonMaske: string;
  telefonKaynak: string;
  teslim: boolean;
  sonuc: { dogru: number; yanlis: number; bos: number; net: number; dersler: DersSonuc[] } | null;
  sms: SmsKayit[];
};

async function api<T>(sorgu: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/deneme${sorgu}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await r.json()) as T & { hata?: string };
  if (!r.ok) throw new Error(json.hata || "İşlem tamamlanamadı.");
  return json;
}

function eksikYazi(e: EksikDers) {
  const fark = e.gereken - e.bulunan;
  const inceleme = e.incelemede ? ` ${e.incelemede} soru henüz incelemede.` : "";
  return `${e.ders}: ${e.bulunan} soru bulundu, ${fark} soru daha gerekli.${inceleme}`;
}

export function DenemePaneli() {
  const [pdfler, setPdfler] = useState<PdfKayit[]>([]);
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [denemeler, setDenemeler] = useState<DenemeOzet[]>([]);
  const [seciliPdf, setSeciliPdf] = useState<string[]>([]);
  const [bolumler, setBolumler] = useState<Bolum[]>(() => lgsBolumleri());
  const [ad, setAd] = useState("LGS Deneme");
  const [ceza, setCeza] = useState(String(VARSAYILAN_CEZA));
  const [alici, setAlici] = useState<"ogrenci" | "veli">("veli");
  const [aktif, setAktif] = useState<DenemeOzet | null>(null);
  const [eksikler, setEksikler] = useState<EksikDers[]>([]);
  const [sonuclar, setSonuclar] = useState<SonucSatir[]>([]);
  const [durum, setDurum] = useState("");
  const [hata, setHata] = useState("");
  const [yeniDers, setYeniDers] = useState<string>(DERS_ADLARI[0]);
  const [anahtar, setAnahtar] = useState("");
  const [anahtarPdf, setAnahtarPdf] = useState("");
  const [kesiyor, setKesiyor] = useState(false);
  const pdfKimlik = useRef<{ ad: string; id: string } | null>(null);

  const yenile = async () => {
    const veri = await api<{ pdfler: PdfKayit[]; sorular: Soru[]; denemeler: DenemeOzet[] }>("?op=havuz");
    setPdfler(veri.pdfler);
    setSorular(veri.sorular);
    setDenemeler(veri.denemeler);
  };

  useEffect(() => {
    void yenile().catch((e: Error) => setHata(e.message));
  }, []);

  const yerlestir = async (kesik: KesikSoru) => {
    setHata("");
    const sira = sorular.filter((s) => s.ders === kesik.ders).length + 1;
    const soru: AyiklananSoru = {
      yerelId: crypto.randomUUID(),
      ders: kesik.ders,
      sayfa: kesik.sayfa,
      numara: sira,
      metin: "",
      secenekler: { A: "A", B: "B", C: "C", D: "D" },
      dogru: kesik.dogru,
      grupId: null,
      ortakMetin: null,
      guven: 100,
      inceleme: false,
      incelemeNeden: null,
      matematikVar: false,
      kutu: { x: 0, y: 0, w: 1, h: 1 },
      ortakKutu: null,
    };
    const paket = { soru, gorsel: kesik.gorsel, ortakGorsel: null as string | null };
    let pdfId = pdfKimlik.current?.ad === kesik.dosyaAd ? pdfKimlik.current.id : "";
    if (!pdfId) {
      const kayit = await api<{ pdfId: string }>("", {
        op: "pdf",
        ad: kesik.dosyaAd,
        sayfaSayisi: kesik.sayfaSayisi || 1,
        sorular: [paket],
      });
      pdfId = kayit.pdfId;
      pdfKimlik.current = { ad: kesik.dosyaAd, id: pdfId };
    } else {
      await api("", { op: "pdf-ek", pdfId, sorular: [paket] });
    }
    setSeciliPdf((v) => (v.includes(pdfId) ? v : [...v, pdfId]));
    await yenile();
    setDurum(`${kesik.ders} sorusu havuza girdi. Denemeyi bu PDF’ten oluşturabilirsiniz.`);
  };

  const otomatikKes = async (file: File) => {
    setHata("");
    setKesiyor(true);
    try {
      const ayik = await pdfdenAyikla(file, setDurum);
      const hazir = ayik.sorular.filter((s) => s.soru.numara);
      const belirsiz = ayik.sorular.length - hazir.length;
      if (!hazir.length) {
        setHata("Sorular otomatik ayrılamadı. Alttan elle kesin.");
        return;
      }
      let pdfId = "";
      for (let i = 0; i < hazir.length; i += 3) {
        const dilim = hazir.slice(i, i + 3).map(({ soru, gorsel, ortakGorsel }) => ({
          soru: { ...soru, dogru: null },
          gorsel,
          ortakGorsel,
        }));
        setDurum(`${file.name}: ${Math.min(i + 3, hazir.length)}/${hazir.length} soru kaydediliyor`);
        if (!pdfId) {
          const kayit = await api<{ pdfId: string }>("", {
            op: "pdf",
            ad: file.name,
            sayfaSayisi: ayik.sayfaSayisi,
            sorular: dilim,
          });
          pdfId = kayit.pdfId;
        } else {
          await api("", { op: "pdf-ek", pdfId, sorular: dilim });
        }
      }
      pdfKimlik.current = { ad: file.name, id: pdfId };
      setAnahtarPdf(pdfId);
      setSeciliPdf((v) => (v.includes(pdfId) ? v : [...v, pdfId]));
      await yenile();
      setDurum(
        `${hazir.length} soru kesildi.${belirsiz ? ` ${belirsiz} kesit ayrılamadı.` : ""} Cevap anahtarını yükleyip eşleştirin.`
      );
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Sorular kesilemedi.");
    } finally {
      setKesiyor(false);
    }
  };

  const anahtarYukle = async (file: File) => {
    setHata("");
    try {
      const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const metin = pdf ? await pdfDuzMetin(file) : await file.text();
      if (metin.replace(/\s/g, "").length < 2) {
        setHata("Bu dosyada okunacak cevap yok. Metni kutuya yapıştırın.");
        return;
      }
      setAnahtar(metin);
      setDurum("Cevap anahtarı okundu. Eşleştir’e basın.");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Cevap dosyası okunamadı.");
    }
  };

  const eslestir = async () => {
    if (!anahtarPdf) {
      setHata("Önce soruları kesin.");
      return;
    }
    setHata("");
    try {
      const sonuc = await api<{ eslesen: number; eslesmeyen: number }>("", {
        op: "anahtar",
        pdfId: anahtarPdf,
        metin: anahtar,
      });
      await yenile();
      setDurum(`${sonuc.eslesen} cevap eşleşti.${sonuc.eslesmeyen ? ` ${sonuc.eslesmeyen} soru anahtarda yok.` : ""}`);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Cevaplar eşleşmedi.");
    }
  };

  const soruKaydet = async (soru: Soru) => {
    setHata("");
    try {
      await api("", {
        op: "soru",
        id: soru.id,
        patch: {
          ders: soru.ders,
          metin: soru.metin,
          secenekler: soru.secenekler,
          dogru: soru.dogru,
          gorsel: soru.gorsel,
        },
      });
      await yenile();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Soru kaydedilemedi.");
    }
  };

  const olustur = async () => {
    setHata("");
    try {
      const sonuc = await api<{ deneme: DenemeOzet; eksikler: EksikDers[] }>("", {
        op: "olustur",
        ad,
        yanlisCezasi: Number(ceza),
        smsAlici: alici,
        bolumler,
        pdfIdler: seciliPdf,
      });
      setAktif(sonuc.deneme);
      setEksikler(sonuc.eksikler);
      await yenile();
      setDurum(sonuc.eksikler.length ? "Deneme taslak. Eksik dersler aşağıda." : "Deneme hazır. Yayımlamadan önce kontrol edin.");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Deneme oluşturulamadı.");
    }
  };

  const sorulariGuncelle = async (liste: SecilenSoru[]) => {
    if (!aktif) return;
    const sonuc = await api<{ deneme: DenemeOzet; eksikler: EksikDers[] }>("", {
      op: "guncelle",
      id: aktif.id,
      patch: { sorular: liste.map((s, i) => ({ ...s, sira: i + 1 })) },
    });
    setAktif(sonuc.deneme);
    setEksikler(sonuc.eksikler);
  };

  const yayinla = async () => {
    if (!aktif) return;
    setHata("");
    try {
      const sonuc = await api<{ deneme: DenemeOzet }>("", { op: "yayinla", id: aktif.id });
      setAktif(sonuc.deneme);
      await yenile();
      const link = `${window.location.origin}/sinav/${sonuc.deneme.kod}`;
      await navigator.clipboard.writeText(link).catch(() => undefined);
      setDurum(`Yayınlandı. Bağlantı kopyalandı: ${link}`);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Yayımlanamadı.");
    }
  };

  const sonuclariGetir = async (id: string) => {
    const veri = await api<{ oturumlar: SonucSatir[] }>(`?op=sonuclar&id=${encodeURIComponent(id)}`);
    setSonuclar(veri.oturumlar);
    setAktif(denemeler.find((d) => d.id === id) || aktif);
  };

  const smsTekrar = async (oturumId: string) => {
    setHata("");
    try {
      await api("", { op: "sms", oturumId });
      if (aktif) await sonuclariGetir(aktif.id);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "SMS yeniden gönderilemedi.");
    }
  };

  const havuzDers = useMemo(() => {
    const kume = new Map<string, Soru[]>();
    for (const s of sorular) {
      const liste = kume.get(s.ders) || [];
      liste.push(s);
      kume.set(s.ders, liste);
    }
    return [...kume.entries()];
  }, [sorular]);

  const taslakSorular = aktif
    ? [...aktif.sorular].sort((a, b) => a.sira - b.sira)
    : [];

  return (
    <div className="m-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-8">
      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-dershanem-navy">PDF’den soru kes</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sorular sayfadan otomatik kesilir. Cevapları siz yüklersiniz; ders ve soru numarasıyla eşleşir.
        </p>
        <label className="mt-3 inline-flex cursor-pointer rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-medium text-white">
          {kesiyor ? "Kesiliyor" : "Soruları otomatik kes"}
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={kesiyor}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void otomatikKes(f);
            }}
          />
        </label>
        <div className="mt-4 rounded-lg border p-3">
          <h3 className="text-sm font-bold text-dershanem-navy">Cevap anahtarı</h3>
          <p className="mt-1 text-xs text-slate-500">
            Ders adının altına şıkları yazın. Örnek: TÜRKÇE sonra BACD ya da 1-B 2-A. MATEMATİK numarası yeniden 1’den başlar.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              className="rounded border px-2 py-1 text-sm"
              value={anahtarPdf}
              onChange={(e) => setAnahtarPdf(e.target.value)}
            >
              <option value="">Kesilen PDF</option>
              {pdfler.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ad}
                </option>
              ))}
            </select>
            <label className="cursor-pointer rounded border px-2 py-1 text-sm">
              Anahtar dosyası
              <input
                type="file"
                accept="application/pdf,text/plain,.txt"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void anahtarYukle(f);
                }}
              />
            </label>
          </div>
          <textarea
            className="mt-2 w-full rounded border px-2 py-1 text-sm"
            rows={5}
            placeholder={"TÜRKÇE\nBACD\nMATEMATİK\n1-C 2-B"}
            value={anahtar}
            onChange={(e) => setAnahtar(e.target.value)}
          />
          <button type="button" className="mt-2 rounded bg-dershanem-navy px-3 py-1 text-sm font-semibold text-white" onClick={() => void eslestir()}>
            Cevapları eşleştir
          </button>
        </div>
        <h3 className="mt-4 text-sm font-bold text-dershanem-navy">Elle kes</h3>
        <p className="mt-1 text-xs text-slate-500">Otomatik kesemediği sorunun çevresini çizin.</p>
        <div className="mt-3">
          <DenemeKirp onYerles={yerlestir} />
        </div>
        {durum ? <p className="mt-2 text-sm text-slate-700">{durum}</p> : null}
        {hata ? <p className="mt-2 text-sm font-medium text-red-700">{hata}</p> : null}
        {pdfler.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {pdfler.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={seciliPdf.includes(p.id)}
                    onChange={(e) =>
                      setSeciliPdf((v) => (e.target.checked ? [...v, p.id] : v.filter((id) => id !== p.id)))
                    }
                  />
                  {p.ad}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-bold text-dershanem-navy">Soru havuzu</h3>
        {sorular.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Henüz soru yok.</p>
        ) : (
          <div className="mt-3 space-y-6">
            {havuzDers.map(([ders, liste]) => (
              <div key={ders}>
                <h4 className="text-sm font-semibold text-slate-700">
                  {ders} · {liste.length} soru
                </h4>
                <div className="mt-2 grid gap-3">
                  {liste.map((soru) => (
                    <SoruKarti key={soru.id} soru={soru} onKaydet={soruKaydet} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-bold text-dershanem-navy">Deneme oluştur</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Deneme adı
            <input className="mt-1 w-full rounded border px-2 py-1" value={ad} onChange={(e) => setAd(e.target.value)} />
          </label>
          <label className="text-sm">
            Yanlış cezası (net)
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={ceza}
              onChange={(e) => setCeza(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Kayıtlı öğrencide SMS alıcısı
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={alici}
              onChange={(e) => setAlici(e.target.value as "ogrenci" | "veli")}
            >
              <option value="veli">Veli telefonu</option>
              <option value="ogrenci">Öğrenci telefonu</option>
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {bolumler.map((bolum, bi) => (
            <div key={bolum.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="rounded border px-2 py-1 text-sm font-semibold"
                  value={bolum.ad}
                  onChange={(e) =>
                    setBolumler((v) => v.map((b) => (b.id === bolum.id ? { ...b, ad: e.target.value } : b)))
                  }
                />
                <label className="text-sm">
                  Süre (dk)
                  <input
                    type="number"
                    min={1}
                    className="ml-2 w-20 rounded border px-2 py-1"
                    value={bolum.sureDakika}
                    onChange={(e) =>
                      setBolumler((v) =>
                        v.map((b) => (b.id === bolum.id ? { ...b, sureDakika: Number(e.target.value) } : b))
                      )
                    }
                  />
                </label>
                <button type="button" className="text-sm text-slate-600" onClick={() => tasiBolum(bi, -1)}>
                  Yukarı
                </button>
                <button type="button" className="text-sm text-slate-600" onClick={() => tasiBolum(bi, 1)}>
                  Aşağı
                </button>
                <button
                  type="button"
                  className="text-sm text-red-700"
                  onClick={() => setBolumler((v) => v.filter((b) => b.id !== bolum.id))}
                >
                  Bölümü çıkar
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {bolum.dersler.map((d, di) => (
                  <li key={`${d.ders}-${di}`} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1">{d.ders}</span>
                    <input
                      type="number"
                      min={1}
                      className="w-16 rounded border px-2 py-1"
                      value={d.adet}
                      onChange={(e) => dersAdet(bolum.id, di, Number(e.target.value))}
                    />
                    <button type="button" className="text-red-700" onClick={() => dersSil(bolum.id, di)}>
                      Çıkar
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <select className="rounded border px-2 py-1 text-sm" value={yeniDers} onChange={(e) => setYeniDers(e.target.value)}>
                  {DERS_ADLARI.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-sm"
                  onClick={() =>
                    setBolumler((v) =>
                      v.map((b) =>
                        b.id === bolum.id ? { ...b, dersler: [...b.dersler, { ders: yeniDers, adet: 10 }] } : b
                      )
                    )
                  }
                >
                  Ders ekle
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm"
            onClick={() =>
              setBolumler((v) => [
                ...v,
                { id: crypto.randomUUID(), ad: "Yeni bölüm", sureDakika: 40, dersler: [{ ders: "Türkçe", adet: 10 }] },
              ])
            }
          >
            Bölüm ekle
          </button>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setBolumler(lgsBolumleri())}>
            LGS şablonuna dön
          </button>
          <button type="button" onClick={() => void olustur()} className="rounded-lg bg-dershanem-navy px-4 py-2 text-sm font-semibold text-white">
            Deneme Oluştur
          </button>
        </div>
        {eksikler.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-amber-800">
            {eksikler.map((e) => (
              <li key={e.ders}>{eksikYazi(e)}</li>
            ))}
          </ul>
        )}
      </section>

      {aktif && (
        <section className="rounded-xl bg-white p-4 shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-dershanem-navy">
              {aktif.ad} {aktif.yayin ? "· yayında" : "· taslak"}
            </h3>
            <div className="flex flex-wrap gap-2">
              <a className="rounded border px-3 py-2 text-sm" href={`/onizleme/${aktif.id}`} target="_blank" rel="noreferrer">
                Öğrenci ekranını ön izle
              </a>
              {aktif.yayin ? (
                <button
                  type="button"
                  className="rounded border px-3 py-2 text-sm"
                  onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/sinav/${aktif.kod}`)}
                >
                  Sınav bağlantısını kopyala
                </button>
              ) : (
                <button type="button" onClick={() => void yayinla()} className="rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-semibold text-white">
                  Yayımla
                </button>
              )}
            </div>
          </div>
          <ol className="mt-3 space-y-2">
            {taslakSorular.map((sec, index) => {
              const soru = sorular.find((s) => s.id === sec.soruId);
              const aday = sorular.filter(
                (s) =>
                  s.ders === sec.ders &&
                  aktif.pdfIdler.includes(s.pdfId) &&
                  !taslakSorular.some((t) => t.soruId === s.id)
              );
              return (
                <li key={sec.soruId} className="flex flex-wrap items-center gap-2 rounded border px-2 py-2 text-sm">
                  <span className="w-8 font-semibold">{index + 1}.</span>
                  <span className="min-w-0 flex-1">
                    {sec.ders}: {soru?.metin || "Soru"} {soru?.dogru ? `· ${soru.dogru}` : "· anahtar yok"}
                    {soru?.inceleme ? " · inceleme" : ""}
                  </span>
                  {!aktif.yayin && (
                    <>
                      <button type="button" onClick={() => void yerDegistir(index, -1)}>
                        Yukarı
                      </button>
                      <button type="button" onClick={() => void yerDegistir(index, 1)}>
                        Aşağı
                      </button>
                      <button type="button" className="text-red-700" onClick={() => void sorulariGuncelle(taslakSorular.filter((s) => s.soruId !== sec.soruId))}>
                        Çıkar
                      </button>
                      {aday.length > 0 && (
                        <select
                          className="rounded border px-1 py-1"
                          defaultValue=""
                          onChange={(e) => {
                            const id = e.target.value;
                            if (!id) return;
                            void sorulariGuncelle(taslakSorular.map((s) => (s.soruId === sec.soruId ? { ...s, soruId: id } : s)));
                          }}
                        >
                          <option value="">Başka soru</option>
                          {aday.map((a) => (
                            <option key={a.id} value={a.id}>
                              {(a.metin || "Soru").slice(0, 48)}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-bold text-dershanem-navy">Teslim ve SMS</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {denemeler.map((d) => (
            <button key={d.id} type="button" className="rounded border px-3 py-1 text-sm" onClick={() => void sonuclariGetir(d.id)}>
              {d.ad}
              {d.yayin ? "" : " (taslak)"}
            </button>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-1 pr-2">Öğrenci</th>
                <th className="py-1 pr-2">Teslim</th>
                <th className="py-1 pr-2">Sonuç</th>
                <th className="py-1">SMS</th>
              </tr>
            </thead>
            <tbody>
              {sonuclar.map((o) => {
                const son = o.sms[o.sms.length - 1];
                return (
                  <tr key={o.id} className="border-b align-top">
                    <td className="py-2 pr-2">
                      {o.ad} {o.soyad}
                      <div className="text-xs text-slate-500">
                        {o.telefonKaynak === "giris" ? "Girilen numara" : o.telefonKaynak === "veli" ? "Veli kaydı" : "Öğrenci kaydı"}{" "}
                        {o.telefonMaske}
                      </div>
                    </td>
                    <td className="py-2 pr-2">{o.teslim ? "Teslim etti" : "Devam ediyor"}</td>
                    <td className="py-2 pr-2">
                      {o.sonuc ? (
                        <>
                          <div>
                            Doğru {o.sonuc.dogru}, yanlış {o.sonuc.yanlis}, boş {o.sonuc.bos}, net {String(o.sonuc.net).replace(".", ",")}
                          </div>
                          <div className="text-xs text-slate-600">
                            {o.sonuc.dersler.map((d) => `${d.ders} ${d.dogru}/${d.yanlis}/${d.bos}`).join(" · ")}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      {son ? (
                        <>
                          <div>
                            {son.durum === "hata"
                              ? "Gönderilemedi"
                              : son.saglayici === "twilio"
                                ? "Gönderildi"
                                : "SMS metni kayda alındı"}
                          </div>
                          {son.hata ? <div className="text-xs text-red-700">{son.hata}</div> : null}
                          <div className="max-w-xs text-xs text-slate-600">{son.metin}</div>
                          {son.durum === "hata" && (
                            <button type="button" className="mt-1 text-xs font-semibold text-dershanem-blue" onClick={() => void smsTekrar(o.id)}>
                              SMS’i yeniden gönder
                            </button>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sonuclar.length === 0 && <p className="py-3 text-sm text-slate-500">Sonuç görmek için bir deneme seçin.</p>}
        </div>
      </section>
    </div>
  );

  function tasiBolum(index: number, yon: -1 | 1) {
    setBolumler((v) => {
      const j = index + yon;
      if (j < 0 || j >= v.length) return v;
      const kopya = [...v];
      [kopya[index], kopya[j]] = [kopya[j], kopya[index]];
      return kopya;
    });
  }

  function dersAdet(bolumId: string, index: number, adet: number) {
    setBolumler((v) =>
      v.map((b) =>
        b.id === bolumId
          ? { ...b, dersler: b.dersler.map((d, i) => (i === index ? { ...d, adet: Math.max(1, adet || 1) } : d)) }
          : b
      )
    );
  }

  function dersSil(bolumId: string, index: number) {
    setBolumler((v) =>
      v.map((b) => (b.id === bolumId ? { ...b, dersler: b.dersler.filter((_, i) => i !== index) } : b))
    );
  }

  async function yerDegistir(index: number, yon: -1 | 1) {
    const j = index + yon;
    if (j < 0 || j >= taslakSorular.length) return;
    if (taslakSorular[index].ders !== taslakSorular[j].ders) return;
    const kopya = [...taslakSorular];
    [kopya[index], kopya[j]] = [kopya[j], kopya[index]];
    await sorulariGuncelle(kopya);
  }
}

function SoruKarti({ soru, onKaydet }: { soru: Soru; onKaydet: (s: Soru) => Promise<void> }) {
  const [taslak, setTaslak] = useState(soru);
  useEffect(() => setTaslak(soru), [soru]);
  return (
    <article className={`rounded-lg border p-3 ${taslak.inceleme ? "border-amber-400 bg-amber-50" : ""}`}>
      {taslak.inceleme && (
        <p className="mb-2 text-sm font-medium text-amber-800">
          {taslak.incelemeNeden || "Bu kesiti kontrol edin."}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <div>
          {taslak.gorsel ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={taslak.gorsel} alt="Soru görseli" className="max-h-64 w-full rounded border bg-white object-contain" />
          ) : (
            <p className="text-xs text-slate-500">Görsel yok</p>
          )}
          <label className="mt-1 block text-xs text-slate-600">
            Görseli değiştir
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const okuyucu = new FileReader();
                okuyucu.onload = () => setTaslak((s) => ({ ...s, gorsel: String(okuyucu.result) }));
                okuyucu.readAsDataURL(file);
              }}
            />
          </label>
        </div>
        <div className="space-y-2 text-sm">
          <label className="block">
            Ders
            <input
              list={`deneme-ders-${soru.id}`}
              className="mt-1 w-full rounded border px-2 py-1"
              value={taslak.ders}
              onChange={(e) => setTaslak((s) => ({ ...s, ders: e.target.value }))}
            />
            <datalist id={`deneme-ders-${soru.id}`}>
              {DERS_ADLARI.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>
          {taslak.ortakMetin ? <p className="rounded bg-slate-50 p-2 text-xs">Ortak metin: {taslak.ortakMetin}</p> : null}
          <textarea
            className="w-full rounded border px-2 py-1"
            rows={2}
            value={taslak.metin}
            onChange={(e) => setTaslak((s) => ({ ...s, metin: e.target.value }))}
          />
          <div className="grid gap-1 sm:grid-cols-2">
            {SIKLAR.map((harf) => (
              <label key={harf} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`h-7 w-7 rounded-full border text-xs font-bold ${taslak.dogru === harf ? "bg-dershanem-navy text-white" : ""}`}
                  onClick={() => setTaslak((s) => ({ ...s, dogru: harf as Sik }))}
                >
                  {harf}
                </button>
                <input
                  className="min-w-0 flex-1 rounded border px-2 py-1"
                  value={taslak.secenekler[harf] || ""}
                  onChange={(e) =>
                    setTaslak((s) => ({ ...s, secenekler: { ...s.secenekler, [harf]: e.target.value } }))
                  }
                />
              </label>
            ))}
          </div>
          <button type="button" className="rounded bg-slate-800 px-3 py-1 text-xs text-white" onClick={() => void onKaydet(taslak)}>
            Düzeltmeyi kaydet
          </button>
        </div>
      </div>
    </article>
  );
}
