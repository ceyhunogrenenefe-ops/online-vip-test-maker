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
    // Aynı şıkka tekrar dokunmak işareti kaldırır.
    setCevaplar((v) => {
      const k = { ...v };
      if (k[soruId] === harf) delete k[soruId];
      else k[soruId] = harf;
      return k;
    });
  };

  return (
    <SinavGorunum
      sinav={sinav}
      harfler={HARFLER}
      ad={ad}
      soyad={soyad}
      setAd={setAd}
      setSoyad={setSoyad}
      telefon={telefon}
      setTelefon={setTelefon}
      telefonIstendi={telefonIstendi}
      girisYapildi={Boolean(oturumId) || Boolean(onizlemeId)}
      onizleme={Boolean(onizlemeId)}
      basla={basla}
      cevaplar={cevaplar}
      isaretle={isaretle}
      kalan={kalan}
      bos={bos}
      sonuc={sonuc}
      karsilastirma={karsilastirma}
      ayni={ayni}
      mesaj={mesaj}
      hata={hata}
      gonderiliyor={gonderiliyor}
      onay={onay}
      setOnay={setOnay}
      teslimEt={teslimEt}
    />
  );
}

function sure(saniye: number) {
  const s = Math.max(0, saniye);
  const sa = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  const sn = s % 60;
  return `${sa ? `${sa}:` : ""}${String(dk).padStart(sa ? 2 : 1, "0")}:${String(sn).padStart(2, "0")}`;
}

const virgul = (n: number) => String(n).replace(".", ",");

type GorunumProps = {
  sinav: Sinav;
  harfler: Sik[];
  ad: string;
  soyad: string;
  setAd: (v: string) => void;
  setSoyad: (v: string) => void;
  telefon: string;
  setTelefon: (v: string) => void;
  telefonIstendi: string;
  girisYapildi: boolean;
  onizleme: boolean;
  basla: () => Promise<void>;
  cevaplar: Record<string, Sik>;
  isaretle: (soruId: string, h: Sik) => void;
  kalan: number | null;
  bos: number;
  sonuc: Sonuc | null;
  karsilastirma: Karsilastirma[];
  ayni: boolean;
  mesaj: string;
  hata: string;
  gonderiliyor: boolean;
  onay: boolean;
  setOnay: (v: boolean) => void;
  teslimEt: (zorla?: boolean) => Promise<void>;
};

function SinavGorunum(p: GorunumProps) {
  const { sinav, harfler, cevaplar, sonuc } = p;
  const sorular = sinav.sorular;
  const [aktif, setAktif] = useState(0);
  const [harita, setHarita] = useState(false);
  const [buyut, setBuyut] = useState<string | null>(null);
  const [isaretli, setIsaretli] = useState<Set<string>>(new Set());
  const dokunma = useRef<{ x: number; y: number } | null>(null);
  const ustRef = useRef<HTMLDivElement>(null);

  const soru = sorular[Math.min(aktif, sorular.length - 1)];
  const bolum = sinav.deneme.bolumler.find((b) => b.id === soru?.bolumId);
  const kars = useMemo(() => new Map(p.karsilastirma.map((k) => [k.soruId, k])), [p.karsilastirma]);
  const cevapli = sorular.length - p.bos;

  const git = (i: number) => {
    const n = Math.max(0, Math.min(sorular.length - 1, i));
    setAktif(n);
    setHarita(false);
    ustRef.current?.scrollIntoView({ block: "start" });
  };

  useEffect(() => {
    if (!p.girisYapildi) return;
    const tus = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || buyut) return;
      if (e.key === "ArrowRight") setAktif((a) => Math.min(sorular.length - 1, a + 1));
      else if (e.key === "ArrowLeft") setAktif((a) => Math.max(0, a - 1));
      else {
        const h = e.key.toUpperCase() as Sik;
        if (harfler.includes(h) && soru) p.isaretle(soru.id, h);
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [p, harfler, soru, sorular.length, buyut]);

  // Bölüm/ders gruplarıyla soru haritası
  const gruplar = useMemo(() => {
    const out: { baslik: string; liste: { s: Soru; i: number }[] }[] = [];
    sorular.forEach((s, i) => {
      const b = sinav.deneme.bolumler.find((x) => x.id === s.bolumId)?.ad ?? "";
      const baslik = sinav.deneme.bolumler.length > 1 ? `${b} · ${s.ders}` : s.ders;
      const son = out[out.length - 1];
      if (son && son.baslik === baslik) son.liste.push({ s, i });
      else out.push({ baslik, liste: [{ s, i }] });
    });
    return out;
  }, [sorular, sinav.deneme.bolumler]);

  const hucreRenk = (s: Soru, i: number) => {
    const k = kars.get(s.id);
    if (sonuc && k) {
      if (!k.verilen) return "bg-slate-100 text-slate-400";
      return k.verilen === k.dogru ? "bg-emerald-500 text-white" : "bg-rose-500 text-white";
    }
    if (i === aktif) return "bg-dershanem-navy text-white ring-2 ring-dershanem-accent";
    if (cevaplar[s.id]) return "bg-dershanem-blue/15 text-dershanem-navy";
    return "bg-white text-slate-500 ring-1 ring-inset ring-slate-200";
  };

  const Harita = ({ sik }: { sik: boolean }) => (
    <div className="space-y-3">
      {gruplar.map((g) => (
        <div key={g.baslik}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.baslik}</p>
          <div className={`grid gap-1.5 ${sik ? "grid-cols-5" : "grid-cols-6 sm:grid-cols-8"}`}>
            {g.liste.map(({ s, i }) => (
              <button
                key={s.id}
                type="button"
                onClick={() => git(i)}
                className={`relative flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition ${hucreRenk(s, i)}`}
              >
                {s.sira}
                {cevaplar[s.id] && !sonuc ? <span className="ml-0.5 text-[10px] font-bold opacity-80">{cevaplar[s.id]}</span> : null}
                {isaretli.has(s.id) ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" /> : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // ---------- Giriş ----------
  if (!p.girisYapildi) {
    const toplamDk = sinav.deneme.bolumler.reduce((t, b) => t + b.sureDakika, 0);
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-dershanem-navy via-[#1e3a6e] to-dershanem-blue p-4">
        <form
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            void p.basla();
          }}
        >
          <div className="bg-slate-50 px-6 pb-5 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dershanem-blue">Online VIP Dershane</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-dershanem-navy">{sinav.deneme.ad}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">{sorular.length} soru</span>
              <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">{toplamDk} dakika</span>
              {sinav.deneme.bolumler.length > 1
                ? sinav.deneme.bolumler.map((b) => (
                    <span key={b.id} className="rounded-full bg-white px-3 py-1 text-slate-500 ring-1 ring-slate-200">
                      {b.ad}
                    </span>
                  ))
                : null}
            </div>
          </div>
          <div className="space-y-4 px-6 py-5">
            {(
              [
                ["Ad", p.ad, p.setAd, "given-name"],
                ["Soyad", p.soyad, p.setSoyad, "family-name"],
              ] as const
            ).map(([etiket, deger, ayarla, ac]) => (
              <label key={etiket} className="block">
                <span className="text-sm font-medium text-slate-700">{etiket}</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-dershanem-blue focus:ring-4 focus:ring-dershanem-blue/15"
                  value={deger}
                  autoComplete={ac}
                  onChange={(e) => ayarla(e.target.value)}
                  required
                />
              </label>
            ))}
            {p.telefonIstendi ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{p.telefonIstendi}</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-dershanem-blue focus:ring-4 focus:ring-dershanem-blue/15"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="05xx xxx xx xx"
                  value={p.telefon}
                  onChange={(e) => p.setTelefon(e.target.value)}
                  required
                />
              </label>
            ) : null}
            {p.hata ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{p.hata}</p> : null}
            <button type="submit" className="w-full rounded-xl bg-dershanem-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-dershanem-blue/30 transition active:scale-[0.99]">
              Sınava başla
            </button>
            <p className="text-center text-xs text-slate-500">Süre, başla dediğin anda işlemeye başlar. Cevapların otomatik kaydedilir.</p>
          </div>
        </form>
      </div>
    );
  }

  if (!soru) return <div className="p-8 text-center">Bu denemede soru yok.</div>;

  const azKaldi = p.kalan != null && p.kalan <= 300 && !sonuc;
  const grupOrtak = soru.grupId ? sorular.find((x) => x.grupId === soru.grupId && (x.ortakGorsel || x.ortakMetin)) : null;
  const k = kars.get(soru.id);

  return (
    <div className="min-h-[100dvh] bg-slate-100 pb-40 lg:pb-8">
      {/* Üst çubuk */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-dershanem-navy/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{sinav.deneme.ad}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/15 sm:w-40">
                <div className="h-full rounded-full bg-dershanem-accent transition-all" style={{ width: `${(cevapli / sorular.length) * 100}%` }} />
              </div>
              <span className="text-[11px] text-slate-300">
                {cevapli}/{sorular.length}
              </span>
            </div>
          </div>
          {p.kalan != null && !sonuc ? (
            <span className={`rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums ${azKaldi ? "animate-pulse bg-rose-500" : "bg-white/10"}`}>
              {sure(p.kalan)}
            </span>
          ) : null}
          {p.onizleme ? <span className="rounded-lg bg-amber-400/20 px-2 py-1 text-xs text-amber-200">Ön izleme</span> : null}
          {!p.onizleme && !sonuc ? (
            <button
              type="button"
              disabled={p.gonderiliyor}
              onClick={() => p.setOnay(true)}
              className="rounded-lg bg-dershanem-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Bitir
            </button>
          ) : null}
        </div>
      </header>

      <div ref={ustRef} className="mx-auto grid max-w-6xl gap-4 px-2 pt-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0 space-y-3">
          {sonuc ? (
            <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="bg-gradient-to-r from-dershanem-navy to-dershanem-blue px-5 py-4 text-white">
                <p className="text-xs uppercase tracking-wide text-slate-200">Sonucun</p>
                <p className="text-3xl font-bold">{virgul(sonuc.net)} net</p>
                <p className="text-sm text-slate-200">
                  {sonuc.dogru} doğru · {sonuc.yanlis} yanlış · {sonuc.bos} boş
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
                {sonuc.dersler.map((d) => (
                  <div key={d.ders} className="bg-white px-4 py-3">
                    <p className="truncate text-xs font-medium text-slate-500">{d.ders}</p>
                    <p className="text-lg font-bold text-dershanem-navy">{virgul(d.net)}</p>
                    <p className="text-[11px] text-slate-500">
                      {d.dogru}D · {d.yanlis}Y · {d.bos}B
                    </p>
                  </div>
                ))}
              </div>
              {p.mesaj || p.ayni ? <p className="border-t px-5 py-2 text-xs text-slate-600">{p.mesaj}</p> : null}
            </section>
          ) : p.mesaj ? (
            <p className="rounded-xl bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">{p.mesaj}</p>
          ) : null}

          <article
            className="overflow-clip rounded-2xl bg-white shadow-sm"
            onTouchStart={(e) => (dokunma.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
            onTouchEnd={(e) => {
              const d = dokunma.current;
              dokunma.current = null;
              if (!d) return;
              const dx = e.changedTouches[0].clientX - d.x;
              const dy = e.changedTouches[0].clientY - d.y;
              if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) git(aktif + (dx < 0 ? 1 : -1));
            }}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-dershanem-navy px-2 text-sm font-bold text-white">{soru.sira}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold text-slate-800">{soru.ders}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {bolum && sinav.deneme.bolumler.length > 1 ? `${bolum.ad} · ` : ""}
                  {aktif + 1} / {sorular.length}
                </p>
              </div>
              {!sonuc ? (
                <button
                  type="button"
                  onClick={() =>
                    setIsaretli((v) => {
                      const n = new Set(v);
                      if (n.has(soru.id)) n.delete(soru.id);
                      else n.add(soru.id);
                      return n;
                    })
                  }
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${isaretli.has(soru.id) ? "bg-amber-100 text-amber-800" : "text-slate-500 ring-1 ring-slate-200"}`}
                >
                  {isaretli.has(soru.id) ? "★ Dönülecek" : "☆ Sonra dön"}
                </button>
              ) : null}
            </div>

            {grupOrtak ? (
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ortak metin</p>
                {grupOrtak.ortakGorsel ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={grupOrtak.ortakGorsel}
                    alt="Ortak metin"
                    className="w-full cursor-zoom-in rounded-lg bg-white"
                    onClick={() => setBuyut(grupOrtak.ortakGorsel)}
                  />
                ) : null}
                {grupOrtak.ortakMetin ? <p className="text-sm">{grupOrtak.ortakMetin}</p> : null}
              </div>
            ) : null}

            <div className="px-2 py-3 sm:px-4">
              {soru.gorsel ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={soru.gorsel}
                  alt={`Soru ${soru.sira}`}
                  className="mx-auto w-full max-w-[640px] cursor-zoom-in select-none"
                  onClick={() => setBuyut(soru.gorsel)}
                  draggable={false}
                />
              ) : null}
              {soru.metin ? <p className="mt-2 px-2 font-medium">{soru.metin}</p> : null}
              {harfler.some((h) => soru.secenekler[h] && soru.secenekler[h] !== h) ? (
                <ul className="mt-2 space-y-1 px-2 text-sm">
                  {harfler.map((h) => (soru.secenekler[h] ? <li key={h}>{h}) {soru.secenekler[h]}</li> : null))}
                </ul>
              ) : null}
            </div>

            {/* Şıklar: masaüstünde kartın altına yapışık; telefonda alt çubukta */}
            <div className={`border-t border-slate-100 bg-slate-50/95 px-3 py-3 backdrop-blur sm:px-4 lg:sticky lg:bottom-0 ${k ? "" : "hidden lg:block"}`}>
              <div className="hidden gap-3 lg:flex">
                {harfler.map((h) => {
                  const secili = cevaplar[soru.id] === h;
                  const dogru = k?.dogru === h;
                  const yanlisSecim = k && k.verilen === h && k.verilen !== k.dogru;
                  return (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={secili}
                      aria-label={`${soru.sira}. soru ${h} şıkkı`}
                      disabled={Boolean(sonuc) || p.onizleme}
                      onClick={() => p.isaretle(soru.id, h)}
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold transition active:scale-95 sm:h-12 sm:w-12 ${
                        sonuc
                          ? dogru
                            ? "bg-emerald-500 text-white"
                            : yanlisSecim
                              ? "bg-rose-500 text-white"
                              : "bg-white text-slate-400 ring-1 ring-slate-200"
                          : secili
                            ? "bg-dershanem-navy text-white shadow-md shadow-dershanem-navy/30"
                            : "bg-white text-slate-700 ring-1 ring-slate-300 hover:ring-dershanem-blue"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
              {k ? (
                <p className={`text-sm font-medium lg:mt-2 ${k.verilen === k.dogru ? "text-emerald-700" : "text-rose-700"}`}>
                  {k.verilen ? `Cevabın ${k.verilen}` : "Boş bıraktın"} · Doğru cevap {k.dogru}
                </p>
              ) : null}
            </div>
          </article>

          {/* Masaüstü gezinme */}
          <div className="hidden items-center justify-between lg:flex">
            <button type="button" disabled={aktif === 0} onClick={() => git(aktif - 1)} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-40">
              ← Önceki
            </button>
            <span className="text-xs text-slate-500">Klavye: ← → ile geç, A–{harfler[harfler.length - 1]} ile işaretle</span>
            <button type="button" disabled={aktif === sorular.length - 1} onClick={() => git(aktif + 1)} className="rounded-xl bg-dershanem-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40">
              Sonraki →
            </button>
          </div>
        </main>

        {/* Masaüstü soru haritası */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-dershanem-navy">Soru haritası</p>
            <Harita sik />
            {!p.onizleme && !sonuc ? (
              <button type="button" onClick={() => p.setOnay(true)} className="mt-4 w-full rounded-xl bg-dershanem-blue py-2.5 text-sm font-semibold text-white">
                Sınavı bitir
              </button>
            ) : null}
            {p.hata ? <p className="mt-2 text-xs text-rose-700">{p.hata}</p> : null}
          </div>
        </aside>
      </div>

      {/* Telefon alt çubuğu: şıklar her zaman başparmağın altında */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
        {(
          <div className="mx-auto flex max-w-xl justify-between gap-2 px-4 pt-2.5">
            {harfler.map((h) => {
              const secili = cevaplar[soru.id] === h;
              const dogru = k?.dogru === h;
              const yanlisSecim = k && k.verilen === h && k.verilen !== k.dogru;
              return (
                <button
                  key={h}
                  type="button"
                  aria-pressed={secili}
                  aria-label={`${soru.sira}. soru ${h} şıkkı`}
                  disabled={Boolean(sonuc) || p.onizleme}
                  onClick={() => p.isaretle(soru.id, h)}
                  className={`flex h-12 flex-1 items-center justify-center rounded-2xl text-lg font-bold transition active:scale-95 ${
                    sonuc
                      ? dogru
                        ? "bg-emerald-500 text-white"
                        : yanlisSecim
                          ? "bg-rose-500 text-white"
                          : "bg-slate-50 text-slate-400"
                      : secili
                        ? "bg-dershanem-navy text-white shadow-md shadow-dershanem-navy/30"
                        : "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-300"
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        )}
        <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2">
          <button type="button" disabled={aktif === 0} onClick={() => git(aktif - 1)} className="flex h-11 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-700 disabled:opacity-40" aria-label="Önceki soru">
            ‹
          </button>
          <button type="button" onClick={() => setHarita(true)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
            <span className="grid grid-cols-3 gap-0.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="h-1 w-1 rounded-[1px] bg-slate-500" />
              ))}
            </span>
            Soru {aktif + 1}/{sorular.length}
          </button>
          <button type="button" disabled={aktif === sorular.length - 1} onClick={() => git(aktif + 1)} className="flex h-11 w-12 items-center justify-center rounded-xl bg-dershanem-navy text-xl text-white disabled:opacity-40" aria-label="Sonraki soru">
            ›
          </button>
        </div>
      </nav>

      {/* Telefon soru haritası (alttan açılan) */}
      {harita ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 lg:hidden" onClick={() => setHarita(false)}>
          <div className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold text-dershanem-navy">Soru haritası</p>
              <p className="text-xs text-slate-500">
                {cevapli} cevaplı · {p.bos} boş{isaretli.size ? ` · ${isaretli.size} dönülecek` : ""}
              </p>
            </div>
            <Harita sik={false} />
            {!p.onizleme && !sonuc ? (
              <button
                type="button"
                onClick={() => {
                  setHarita(false);
                  p.setOnay(true);
                }}
                className="mt-4 w-full rounded-xl bg-dershanem-blue py-3 font-semibold text-white"
              >
                Sınavı bitir
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Büyütme */}
      {buyut ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={() => setBuyut(null)}>
          <div className="flex justify-end p-3">
            <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
              Kapat ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={buyut} alt="" className="mx-auto w-[160%] max-w-none rounded bg-white sm:w-auto sm:max-w-full" />
          </div>
        </div>
      ) : null}

      {/* Teslim onayı */}
      {p.onay ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <h2 className="text-lg font-bold text-dershanem-navy">Sınavı bitirmek istiyor musun?</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 py-2">
                <p className="text-xl font-bold text-dershanem-navy">{cevapli}</p>
                <p className="text-[11px] text-slate-500">cevaplı</p>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <p className="text-xl font-bold text-slate-700">{p.bos}</p>
                <p className="text-[11px] text-slate-500">boş</p>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <p className="text-xl font-bold text-amber-600">{isaretli.size}</p>
                <p className="text-[11px] text-slate-500">dönülecek</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">Teslim ettikten sonra cevaplarını değiştiremezsin.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold" onClick={() => p.setOnay(false)}>
                Devam et
              </button>
              <button
                type="button"
                disabled={p.gonderiliyor}
                className="flex-1 rounded-xl bg-dershanem-blue py-3 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void p.teslimEt(true)}
              >
                {p.gonderiliyor ? "Gönderiliyor…" : "Teslim et"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
