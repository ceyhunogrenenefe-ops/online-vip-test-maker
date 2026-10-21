"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Redo2, Save, Sigma, Undo2 } from "lucide-react";
import type { DocBlock, GorselRol } from "@/lib/pdf-blocks";
import type { PasteBlock } from "@/lib/paste-clean";
import { cleanPastedText } from "@/lib/paste-clean";
import { KAZANIM_EKSIK, kazanimYaz, numaraliSoruMu, soruNumaralariniYenile, yapistirmayiBelgeye } from "@/lib/foy-icerik";
import { foyPdfOlustur, foyTeshisMesaji, type FoyTeshis } from "@/lib/foy-pdf";
import { videoLinkiGecerli, videoQrDataUrl } from "@/lib/video-qr";
import { foyKaliteKontrol, puanOner, soruOgeleriniYenile, type FoyOge } from "@/lib/foy-baski";
import type { KirpilmisParca as KirpParca } from "./FoyPdfKirp";
import {
  kapakSatirlari,
  kunyeEskiden,
  varsayilanKunye,
  varsayilanTasarim,
  yeniId,
  type FoyKunye,
  type FoyTasarim,
} from "@/lib/foy-kunye";
import { FormulaEditor } from "@/components/editor/FormulaEditor";
import { FoyKazanimSec } from "./FoyKazanimSec";
import { FoyYapistir } from "./FoyYapistir";
import { FoyFotograf } from "./FoyFotograf";
import { FoyYzSoru } from "./FoyYzSoru";
import { FoyKunyeForm } from "./FoyKunyeForm";
import { FoyTasarimPanel } from "./FoyTasarim";
import { FoySayfa } from "./FoySayfa";
import { FoyOnizleme } from "./FoyOnizleme";
import { FoyPdfKirp, type FoyKirpHandle } from "./FoyPdfKirp";
import { FoyBanka } from "./FoyBanka";
import {
  foyBankaKaydet,
  foyBelgeListele,
  foyBelgeOku,
  foyBelgeYaz,
  getFoyTaslak,
  saveFoyTaslak,
  type FoyBelgeOzet,
  type FoyTaslak,
} from "@/lib/storage";
import { DEFAULT_PAPER_SETTINGS, type PaperSettings } from "@/types";
import type { UretilenSoru } from "@/lib/soru-uret-ayristir";

type Arac = "kunye" | "pdf" | "kirp" | "gorsel" | "yz" | "metin" | "banka" | "tasarim";

const ARACLAR: [Arac, string][] = [
  ["kunye", "Doküman bilgileri"],
  ["pdf", "PDF'den soru al"],
  ["kirp", "Kırpma aracı"],
  ["gorsel", "Görsel yükle / yapıştır"],
  ["yz", "Yapay zekâyla soru üret"],
  ["metin", "Metin / formül ekle"],
  ["banka", "Soru bankam"],
  ["tasarim", "Sayfa ve tasarım"],
];

type Surum = { guncelleme: number; ogeler: FoyOge[]; ad: string };

export function FoyWorkspace() {
  const [kunye, setKunye] = useState<FoyKunye>(() => varsayilanKunye());
  const [kazanim, setKazanim] = useState("");
  const [tasarim, setTasarim] = useState<FoyTasarim>(() => varsayilanTasarim());
  const [ogeler, setOgeler] = useState<FoyOge[]>([]);
  const [secili, setSecili] = useState(-1);
  const [arac, setArac] = useState<Arac>("kunye");
  const [mobil, setMobil] = useState<"arac" | "sayfa" | "onizleme">("sayfa");
  const [solAcik, setSolAcik] = useState(true);
  const [sagAcik, setSagAcik] = useState(true);
  const [solW, setSolW] = useState(340);
  const [sagW, setSagW] = useState(380);
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [teshis, setTeshis] = useState<FoyTeshis | null>(null);
  const [uretiliyor, setUretiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [formulAcik, setFormulAcik] = useState(false);
  const [kayit, setKayit] = useState<"hazir" | "kaydediliyor" | "kaydedildi" | "hata">("hazir");
  const [adim, setAdim] = useState(0);
  const [pdfDosya, setPdfDosya] = useState<File | null>(null);
  const [bankaYenile, setBankaYenile] = useState(0);
  const [belgeler, setBelgeler] = useState<FoyBelgeOzet[]>([]);
  const [kalite, setKalite] = useState<{ surum: "ogrenci" | "ogretmen"; notlar: string[] } | null>(null);
  const [surumListe, setSurumListe] = useState<Surum[]>([]);
  const [acikBelge, setAcikBelge] = useState("");

  const yuklendi = useRef(false);
  const [hazir, setHazir] = useState(false);
  const ogelerRef = useRef(ogeler);
  const gecmis = useRef<FoyOge[][]>([]);
  const ileri = useRef<FoyOge[][]>([]);
  const belgeId = useRef("");
  const bosYeni = useRef(false);
  const belgeAta = (id: string) => {
    belgeId.current = id;
    setAcikBelge(id);
  };
  const surumler = useRef<Surum[]>([]);
  const pano = useRef<FoyOge | null>(null);
  const kirpRef = useRef<FoyKirpHandle>(null);
  const kazanimRef = useRef("");
  kazanimRef.current = kazanim;
  const pdfUrlRef = useRef<string | null>(null);
  const indirmeBlob = useRef<Blob | null>(null);
  ogelerRef.current = ogeler;

  const yenileListe = () => {
    void foyBelgeListele().then(setBelgeler).catch(() => undefined);
  };

  const uygulaTaslak = (t: FoyTaslak) => {
    setKunye(kunyeEskiden(t.kunye));
    if (t.tasarim && typeof t.tasarim === "object") {
      setTasarim({ ...varsayilanTasarim(), ...(t.tasarim as FoyTasarim) });
    }
    const ham = Array.isArray(t.ogeler) && t.ogeler.length ? (t.ogeler as FoyOge[]) : null;
    const bloklar = !ham && Array.isArray(t.bloklar) ? (t.bloklar as DocBlock[]) : [];
    const liste = soruOgeleriniYenile(
      ham
        ? ham.map((o) => ({ ...o, id: o.id || yeniId() }))
        : bloklar.map((blok) => ({ id: yeniId(), blok }))
    );
    ogelerRef.current = liste;
    setOgeler(liste);
    belgeAta(t.belgeId || yeniId());
    surumler.current = (t.surumler as Surum[] | undefined) ?? [];
    setSurumListe(surumler.current);
  };

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const t = await getFoyTaslak();
        if (iptal) return;
        if (t) uygulaTaslak(t);
        else belgeAta(yeniId());
        yenileListe();
      } catch {
        if (!belgeId.current) belgeAta(yeniId());
      } finally {
        if (!iptal) {
          yuklendi.current = true;
          setHazir(true);
        }
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  const taslak = useCallback((): FoyTaslak => {
    const bloklar = soruNumaralariniYenile(ogelerRef.current.map((o) => o.blok));
    return {
      bloklar,
      ogeler: ogelerRef.current,
      tasarim,
      belgeId: belgeId.current,
      ad: kunye.dokumanAdi,
      surumler: surumler.current,
      guncelleme: Date.now(),
      kunye: {
        sinif: `${kunye.sinif}. SINIF`,
        sinifNo: kunye.sinif,
        brans: kunye.brans,
        konu: kunye.konu,
        tur: kunye.tur,
        dokumanAdi: kunye.dokumanAdi,
        egitimYili: kunye.egitimYili,
        donem: kunye.donem,
        yazili: kunye.yazili,
        ogretmen: kunye.ogretmen,
        website: kunye.website,
      },
    };
  }, [kunye, tasarim]);

  const kaydet = useCallback(
    async (manuel: boolean): Promise<boolean> => {
      if (!yuklendi.current) return false;
      if (!belgeId.current) belgeAta(yeniId());
      const bosTaslak =
        bosYeni.current && !manuel && ogelerRef.current.length === 0 && !kunye.dokumanAdi.trim();
      if (bosTaslak) {
        try {
          await saveFoyTaslak(taslak());
          return true;
        } catch {
          setKayit("hata");
          return false;
        }
      }
      bosYeni.current = false;
      setKayit("kaydediliyor");
      try {
        if (manuel) {
          const snap: Surum = {
            guncelleme: Date.now(),
            ogeler: ogelerRef.current,
            ad: kunye.dokumanAdi || "Kayıt",
          };
          surumler.current = [snap, ...surumler.current].slice(0, 8);
          setSurumListe(surumler.current);
        }
        const t = taslak();
        await saveFoyTaslak(t);
        await foyBelgeYaz(belgeId.current, t, {
          id: belgeId.current,
          ad: kunye.dokumanAdi || kapakSatirlari(kunye)[3],
          guncelleme: t.guncelleme,
          arsiv: false,
        });
        setKayit("kaydedildi");
        yenileListe();
        return true;
      } catch {
        setKayit("hata");
        return false;
      }
    },
    [kunye, taslak]
  );

  useEffect(() => {
    if (!yuklendi.current) return;
    const z = setTimeout(() => void kaydet(false), 700);
    return () => clearTimeout(z);
  }, [ogeler, kunye, tasarim, kaydet]);

  const degistir = (sonraki: FoyOge[]) => {
    gecmis.current.push(ogelerRef.current);
    if (gecmis.current.length > 50) gecmis.current.shift();
    ileri.current = [];
    const n = soruOgeleriniYenile(sonraki);
    ogelerRef.current = n;
    setOgeler(n);
    setAdim((a) => a + 1);
  };

  const geriAl = () => {
    const once = gecmis.current.pop();
    if (!once) return;
    ileri.current.push(ogelerRef.current);
    ogelerRef.current = once;
    setOgeler(once);
    setAdim((a) => a + 1);
  };
  const yinele = () => {
    const sonra = ileri.current.pop();
    if (!sonra) return;
    gecmis.current.push(ogelerRef.current);
    ogelerRef.current = sonra;
    setOgeler(sonra);
    setAdim((a) => a + 1);
  };

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement | null;
      const yaziyor = hedef && (hedef.tagName === "INPUT" || hedef.tagName === "TEXTAREA" || hedef.isContentEditable);
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void kaydet(true);
      } else if (e.key.toLowerCase() === "z" && !yaziyor) {
        e.preventDefault();
        geriAl();
      } else if (e.key.toLowerCase() === "y" && !yaziyor) {
        e.preventDefault();
        yinele();
      } else if (e.key.toLowerCase() === "c" && !yaziyor && secili >= 0) {
        pano.current = ogelerRef.current[secili] ?? null;
      } else if (e.key.toLowerCase() === "v" && !yaziyor && pano.current) {
        e.preventDefault();
        const kopya: FoyOge = {
          ...pano.current,
          id: yeniId(),
          blok: { ...pano.current.blok },
        };
        const n = [...ogelerRef.current];
        n.splice(secili + 1, 0, kopya);
        degistir(n);
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [kaydet, secili]);

  const settings = useMemo(() => {
    const satir = kapakSatirlari(kunye);
    return {
      ...DEFAULT_PAPER_SETTINGS,
      corporateTemplate: true,
      academicYear: kunye.egitimYili,
      documentKind: satir[3],
      classSection: `${kunye.sinif}. SINIF`,
      subjectBranch: kunye.brans.toLocaleUpperCase("tr-TR"),
      topicTitle: kunye.konu,
      includeTeacherName: Boolean(kunye.ogretmen.trim()),
      teacherName: kunye.ogretmen,
      website: kunye.website,
      orientation: tasarim.yon,
      columns: tasarim.sutun,
    } as PaperSettings;
  }, [kunye, tasarim]);

  const pdfSecenek = useCallback(
    (surum: "ogrenci" | "ogretmen") => ({
      sutunSayisi: tasarim.sutun,
      yon: tasarim.yon,
      kenarMm: tasarim.kenarMm,
      soruAraligiMm: tasarim.soruAraligiMm,
      cozum: tasarim.cozum,
      cozumSatir: tasarim.cozumSatir,
      akilliYerlesim: tasarim.akilliYerlesim,
      filigran: tasarim.filigran,
      filigranLogo: tasarim.filigranLogo,
      surum,
      cevaplar: surum === "ogretmen" ? ogelerRef.current : [],
    }),
    [tasarim]
  );

  const pdfUret = useCallback(
    async (surum: "ogrenci" | "ogretmen") => {
      setUretiliyor(true);
      setHata(null);
      try {
        const ogeler = ogelerRef.current;
        const bloklar = ogeler.map((o) => o.blok);
        const baskiEk = await Promise.all(
          ogeler.map(async (o) => {
            const url = o.videoUrl ? videoLinkiGecerli(o.videoUrl) : null;
            if (!url) return { cozumSatir: o.cozumSatir };
            try {
              const dataUrl = await videoQrDataUrl(url);
              return { cozumSatir: o.cozumSatir, qr: { kind: "qr" as const, dataUrl, url } };
            } catch {
              return { cozumSatir: o.cozumSatir };
            }
          })
        );
        const { doc, teshis: t } = await foyPdfOlustur(bloklar, settings, { ...pdfSecenek(surum), baskiEk });
        setTeshis(t);
        const blob = doc.output("blob");
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfUrl(url);
        return { t, blob };
      } catch (e) {
        setHata(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUretiliyor(false);
      }
    },
    [pdfSecenek, settings]
  );

  useEffect(() => {
    if (!yuklendi.current) return;
    const z = setTimeout(() => void pdfUret("ogrenci"), 900);
    return () => clearTimeout(z);
  }, [ogeler, kunye, tasarim, pdfUret, hazir]);

  const indir = async (surum: "ogrenci" | "ogretmen") => {
    const sonuc = await pdfUret(surum);
    if (!sonuc) return;
    const cevapsiz = ogelerRef.current.filter((o) => numaraliSoruMu(o.blok) && !(o.cevap || "").trim()).length;
    const notlar = foyKaliteKontrol({
      bloklar: ogelerRef.current.map((o) => o.blok),
      ogretmenIndir: surum === "ogretmen",
      cevapsizSoru: cevapsiz,
      filigran: tasarim.filigran,
      teshisDusen: sonuc.t.dusen.length,
      teshisZorlanan: sonuc.t.zorlanan.length,
    }).map((n) => n.mesaj);
    if (notlar.length) {
      indirmeBlob.current = sonuc.blob;
      setKalite({ surum, notlar });
      return;
    }
    dosyaIn(sonuc.blob, surum);
  };

  const dosyaIn = (blob: Blob, surum: "ogrenci" | "ogretmen") => {
    const ad = (kunye.dokumanAdi || kunye.konu || kunye.brans || "foy").replace(/\s+/g, "-").toLowerCase();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ad}-${surum}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const pasteEkle = async (gelen: PasteBlock[]) => {
    setHata(null);
    const soruVar = gelen.some((b) => b.kind === "question");
    const seciliKazanim = kazanimRef.current.trim();
    if (soruVar && !seciliKazanim) {
      setHata(KAZANIM_EKSIK);
      return false;
    }
    try {
      const mevcutSoru = ogelerRef.current.filter((o) => o.blok.kind === "question").length;
      const r = await yapistirmayiBelgeye(gelen, {
        ilkSoruNo: mevcutSoru + 1,
        kazanim: seciliKazanim,
      });
      degistir([
        ...ogelerRef.current,
        ...r.bloklar.map((blok) => ({ id: yeniId(), blok })),
      ]);
      if (r.uyarilar.length) setUyarilar((p) => [...p, ...r.uyarilar]);
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    }
  };

  const yzKabul = (sorular: UretilenSoru[]) => {
    const seciliKazanim = kazanimRef.current.trim();
    if (!seciliKazanim) {
      setHata(KAZANIM_EKSIK);
      return;
    }
    const yeni: FoyOge[] = sorular.map((s) => ({
      id: yeniId(),
      blok: {
        kind: "question",
        stem: [{ text: s.stem }],
        options: s.options.map((o) => ({ label: o.label, runs: [{ text: o.text }] })),
        kazanim: seciliKazanim,
      },
      cevap: s.answer,
      cozum: s.explanation,
    }));
    degistir([...ogelerRef.current, ...yeni]);
  };

  const gorselBlok = (dataUrl: string, aspect: number, rol: GorselRol, kazanimMetni = ""): DocBlock => ({
    kind: "image",
    dataUrl,
    aspect: aspect || 1,
    maxHeightMm: 70,
    rol,
    ...(rol === "soru" && kazanimMetni ? { kazanim: kazanimMetni } : {}),
  });

  const kirpEkle = (parcalar: KirpParca[]) => {
    const seciliKazanim = kazanimRef.current.trim();
    if (parcalar.some((p) => p.rol === "soru") && !seciliKazanim) {
      setHata(KAZANIM_EKSIK);
      return;
    }
    setHata(null);
    degistir([
      ...ogelerRef.current,
      ...parcalar.map((p) => ({
        id: yeniId(),
        blok: gorselBlok(p.dataUrl, p.aspect, p.rol, seciliKazanim),
        kaynak: p.kaynak,
      })),
    ]);
  };

  const gorselEkle = (dataUrl: string, rol: GorselRol) => {
    const seciliKazanim = kazanimRef.current.trim();
    if (rol === "soru" && !seciliKazanim) {
      setHata(KAZANIM_EKSIK);
      return;
    }
    setHata(null);
    const img = new Image();
    img.onload = () => {
      degistir([
        ...ogelerRef.current,
        {
          id: yeniId(),
          blok: gorselBlok(dataUrl, img.naturalWidth / Math.max(1, img.naturalHeight), rol, seciliKazanim),
        },
      ]);
    };
    img.src = dataUrl;
  };

  const tasi = (i: number, yon: -1 | 1) => {
    const j = i + yon;
    if (j < 0 || j >= ogelerRef.current.length) return;
    const n = [...ogelerRef.current];
    [n[i], n[j]] = [n[j], n[i]];
    degistir(n);
    setSecili(j);
  };

  const bankaya = async () => {
    const o = ogelerRef.current[secili];
    if (!o) return;
    await foyBankaKaydet({
      id: yeniId(),
      ders: kunye.brans,
      sinif: String(kunye.sinif),
      konu: kunye.konu,
      zorluk: "",
      tip: o.blok.kind,
      blok: o.blok,
      olusturma: Date.now(),
    });
    setBankaYenile((n) => n + 1);
    setArac("banka");
  };

  const puanDagit = () => {
    const sorular = ogelerRef.current.filter((o) => numaraliSoruMu(o.blok));
    const puanlar = puanOner(sorular.length);
    let k = 0;
    degistir(
      ogelerRef.current.map((o) => (numaraliSoruMu(o.blok) ? { ...o, puan: puanlar[k++] } : o))
    );
  };

  const yeniFoy = async () => {
    const dolu = ogelerRef.current.length > 0 || kunye.dokumanAdi.trim().length > 0;
    if (dolu) {
      const oldu = await kaydet(true);
      if (!oldu) return;
    }
    belgeAta(yeniId());
    bosYeni.current = true;
    gecmis.current = [];
    ileri.current = [];
    surumler.current = [];
    setSurumListe([]);
    setSecili(-1);
    setKazanim("");
    setHata(null);
    setUyarilar([]);
    setFormulAcik(false);
    setKalite(null);
    setArac("kunye");
    setMobil("sayfa");
    ogelerRef.current = [];
    setOgeler([]);
    setKunye({ ...kunye, dokumanAdi: "", konu: "" });
    setAdim((a) => a + 1);
  };

  const belgeAc = async (id: string) => {
    const t = await foyBelgeOku(id);
    if (!t) return;
    gecmis.current = [];
    ileri.current = [];
    bosYeni.current = false;
    uygulaTaslak(t);
  };

  const teshisMesaji = teshis ? foyTeshisMesaji(teshis) : null;
  const pdfAcik = arac === "pdf" || arac === "kirp";

  useEffect(() => {
    if (!pdfAcik) return;
    const kapat = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArac("kunye");
    };
    window.addEventListener("keydown", kapat);
    return () => window.removeEventListener("keydown", kapat);
  }, [pdfAcik]);

  const panelSurukle = (e: React.PointerEvent, taraf: "sol" | "sag") => {
    e.preventDefault();
    const basX = e.clientX;
    const ilk = taraf === "sol" ? solW : sagW;
    const hareket = (ev: PointerEvent) => {
      const dx = ev.clientX - basX;
      const hedef = taraf === "sol" ? ilk + dx : ilk - dx;
      const w = Math.min(520, Math.max(260, hedef));
      if (taraf === "sol") setSolW(w);
      else setSagW(w);
    };
    const birak = () => {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
    };
    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => void yeniFoy()}
          className="flex items-center gap-1 rounded bg-[#173b70] px-2 py-1 font-semibold text-white"
          data-test="foy-yeni"
        >
          <Plus size={13} /> Yeni föy
        </button>
        <input
          value={kunye.dokumanAdi}
          onChange={(e) => setKunye({ ...kunye, dokumanAdi: e.target.value })}
          placeholder="Doküman adı"
          className="w-48 rounded border px-2 py-1"
          data-test="foy-dokuman-adi"
        />
        <span className="text-slate-500">
          {kayit === "kaydediliyor" ? "Kaydediliyor…" : kayit === "hata" ? "Kayıt hatası" : "Kaydedildi"}
        </span>
        <button type="button" onClick={() => void kaydet(true)} className="flex items-center gap-1 rounded border px-2 py-1">
          <Save size={13} /> Kaydet
        </button>
        <button type="button" onClick={geriAl} disabled={!adim || gecmis.current.length === 0} className="rounded border px-2 py-1 disabled:opacity-40">
          <Undo2 size={13} className="inline" /> Geri al
        </button>
        <button type="button" onClick={yinele} className="rounded border px-2 py-1">
          <Redo2 size={13} className="inline" /> Yinele
        </button>
        <button type="button" onClick={() => void bankaya()} disabled={secili < 0} className="rounded border px-2 py-1 disabled:opacity-40">
          Seçiliyi bankaya kaydet
        </button>
        {kunye.tur === "Yazılı Provası" ? (
          <button type="button" onClick={puanDagit} className="rounded border px-2 py-1">
            100 puana dağıtımı onayla
          </button>
        ) : null}
        <select
          className="rounded border px-1 py-1"
          value=""
          onChange={(e) => {
            const i = Number(e.target.value);
            const s = surumListe[i];
            if (s) degistir(s.ogeler);
          }}
        >
          <option value="">Önceki sürüm</option>
          {surumListe.map((s, i) => (
            <option key={s.guncelleme} value={i}>
              {new Date(s.guncelleme).toLocaleString("tr-TR")} · {s.ad}
            </option>
          ))}
        </select>
        <select
          className="max-w-[180px] rounded border px-1 py-1"
          value={acikBelge}
          onChange={(e) => void belgeAc(e.target.value)}
          data-test="foy-belge-listesi"
        >
          <option value={acikBelge}>{kunye.dokumanAdi || "Bu föy"}</option>
          {belgeler
            .filter((b) => b.id !== acikBelge && !b.arsiv)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.ad}
              </option>
            ))}
        </select>
        <button
          type="button"
          className="rounded border px-2 py-1"
          onClick={() => {
            belgeAta(yeniId());
            bosYeni.current = false;
            setKunye({ ...kunye, dokumanAdi: `Kopya — ${kunye.dokumanAdi || "föy"}` });
            void kaydet(true);
          }}
        >
          Kopyala
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1"
          onClick={() => {
            const id = belgeId.current;
            void (async () => {
              const t = taslak();
              await foyBelgeYaz(id, t, {
                id,
                ad: kunye.dokumanAdi || "Arşiv",
                guncelleme: Date.now(),
                arsiv: true,
              });
              belgeAta(yeniId());
              bosYeni.current = true;
              setKunye(varsayilanKunye());
              setTasarim(varsayilanTasarim());
              degistir([]);
              yenileListe();
            })();
          }}
        >
          Arşivle
        </button>
        <span className="text-[11px] text-slate-400">Ctrl+S kaydet · Ctrl+Z geri · Ctrl+Y yinele</span>
      </div>

      <div className="flex gap-1 border-b bg-white px-2 py-1 lg:hidden">
        {(["arac", "sayfa", "onizleme"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMobil(m)}
            className={`rounded px-2 py-1 text-xs ${mobil === m ? "bg-dershanem-navy text-white" : "bg-slate-100"}`}
          >
            {m === "arac" ? "Araçlar" : m === "sayfa" ? "Sayfa" : "Önizleme"}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <section
          style={{ width: solW }}
          className={`shrink-0 overflow-y-auto border-r bg-slate-50 p-2 ${mobil !== "arac" ? "max-lg:hidden" : ""} ${solAcik ? "" : "lg:hidden"}`}
        >
          <div className="mb-2 flex flex-wrap gap-1">
            {ARACLAR.map(([id, ad]) => (
              <button
                key={id}
                type="button"
                onClick={() => setArac(id)}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  arac === id ? "bg-dershanem-navy text-white" : "bg-white text-slate-600"
                }`}
              >
                {ad}
              </button>
            ))}
          </div>
          {arac === "kunye" ? <FoyKunyeForm kunye={kunye} onChange={setKunye} /> : null}
          {arac === "gorsel" ? (
            <div className="space-y-3">
              <FoyKazanimSec sinif={kunye.sinif} brans={kunye.brans} yazili={kunye.yazili} value={kazanim} onChange={setKazanim} />
              <FoyFotograf onEkle={(b) => void pasteEkle(b)} onGorsel={gorselEkle} />
              <FoyYapistir onEkle={(b) => void pasteEkle(b)} />
            </div>
          ) : null}
          {arac === "yz" ? (
            <div className="space-y-2">
              <FoyKazanimSec sinif={kunye.sinif} brans={kunye.brans} yazili={kunye.yazili} value={kazanim} onChange={setKazanim} />
              <FoyYzSoru
                sinif={`${kunye.sinif}. sınıf`}
                brans={kunye.brans}
                konu={kunye.konu}
                kazanim={kazanim}
                onKabul={yzKabul}
              />
            </div>
          ) : null}
          {arac === "metin" ? (
            <div className="space-y-2 text-xs">
              <FoyKazanimSec sinif={kunye.sinif} brans={kunye.brans} yazili={kunye.yazili} value={kazanim} onChange={setKazanim} />
              <FoyYapistir onEkle={(b) => void pasteEkle(b)} />
              <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded border bg-white px-2 py-2" onClick={() => {
                const t = window.prompt("Bölüm başlığı");
                if (t?.trim()) degistir([...ogelerRef.current, { id: yeniId(), blok: { kind: "sectionTitle", text: t.trim() } }]);
              }}>
                <Plus size={12} className="inline" /> Bölüm başlığı
              </button>
              <button type="button" className="rounded border bg-white px-2 py-2" data-test="foy-formul-ac" onClick={() => setFormulAcik(true)}>
                <Sigma size={12} className="inline" /> Formül ekle
              </button>
              <button type="button" className="rounded border bg-white px-2 py-2" onClick={() => {
                const n = Number(window.prompt("Kaç cevap satırı?", "4"));
                if (Number.isFinite(n) && n > 0)
                  degistir([...ogelerRef.current, { id: yeniId(), blok: { kind: "answerLines", count: Math.min(30, Math.round(n)) } }]);
              }}>
                Cevap satırı
              </button>
              <button type="button" className="rounded border bg-white px-2 py-2" onClick={() => {
                const t = window.prompt("Bilgi kutusu");
                if (t?.trim())
                  degistir([...ogelerRef.current, { id: yeniId(), blok: { kind: "infoBox", tone: "bilgi", title: "BİLGİ", text: t.trim() } }]);
              }}>
                Bilgi kutusu
              </button>
              </div>
            </div>
          ) : null}
          {arac === "banka" ? (
            <div className="space-y-2">
            <FoyKazanimSec sinif={kunye.sinif} brans={kunye.brans} yazili={kunye.yazili} value={kazanim} onChange={setKazanim} />
            <FoyBanka
              yenileme={bankaYenile}
              onEkle={(blok) => {
                const soru = blok.kind === "question" || (blok.kind === "image" && blok.rol === "soru");
                const seciliKazanim = kazanimRef.current.trim();
                const varOlan = (blok.kind === "question" || blok.kind === "image" ? blok.kazanim : "") || "";
                if (soru && !seciliKazanim && !varOlan.trim()) {
                  setHata(KAZANIM_EKSIK);
                  return;
                }
                const sonraki =
                  soru && seciliKazanim && !varOlan.trim() ? kazanimYaz(blok, seciliKazanim) : blok;
                setHata(null);
                degistir([...ogelerRef.current, { id: yeniId(), blok: sonraki }]);
              }}
            />
            </div>
          ) : null}
          {arac === "tasarim" ? <FoyTasarimPanel tasarim={tasarim} onChange={setTasarim} /> : null}
          {uyarilar.length > 0 ? (
            <ul className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-900">
              {uyarilar.map((u, i) => (
                <li key={i}>• {u}</li>
              ))}
            </ul>
          ) : null}
          {secili >= 0 && ogeler[secili]?.kaynak ? (
            <button
              type="button"
              className="mt-2 text-xs text-dershanem-navy underline"
              onClick={() => {
                const k = ogeler[secili].kaynak;
                if (!k) return;
                setArac("kirp");
                setMobil("arac");
                kirpRef.current?.odak(k);
              }}
            >
              Kırpmayı kaynağında düzenle
            </button>
          ) : null}
        </section>

        <button
          type="button"
          className="hidden w-2 cursor-col-resize bg-slate-200 text-[10px] lg:block"
          title="Sürükleyerek genişletin, çift tıklayınca kapanır"
          onDoubleClick={() => setSolAcik((v) => !v)}
          onPointerDown={(e) => panelSurukle(e, "sol")}
          aria-label="Sol paneli boyutlandır"
        >
          {solAcik ? "‹" : "›"}
        </button>

        <section className={`min-w-0 flex-1 overflow-y-auto bg-slate-200 p-3 ${mobil !== "sayfa" ? "max-lg:hidden" : ""}`}>
          {hata ? <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{hata}</p> : null}
          {teshis ? (
            <p
              className={`mb-2 rounded p-2 text-xs ${teshisMesaji ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}
              data-test="foy-teshis"
            >
              {teshisMesaji ?? `${teshis.sayfa} sayfa hazır.`}
            </p>
          ) : null}
          <FoySayfa
            kunye={kunye}
            ogeler={ogeler}
            secili={secili}
            prova={kunye.tur === "Yazılı Provası"}
            onSec={setSecili}
            onTasi={tasi}
            onSil={(i) => degistir(ogelerRef.current.filter((_, j) => j !== i))}
            onBlok={(i, blok) => degistir(ogelerRef.current.map((o, j) => (j === i ? { ...o, blok } : o)))}
            onCevap={(i, cevap, cozum) =>
              degistir(ogelerRef.current.map((o, j) => (j === i ? { ...o, cevap, cozum } : o)))
            }
            onPuan={(i, puan) => degistir(ogelerRef.current.map((o, j) => (j === i ? { ...o, puan } : o)))}
            onSoruAyar={(i, kismi) =>
              degistir(ogelerRef.current.map((o, j) => (j === i ? { ...o, ...kismi } : o)))
            }
            onSayfaSonu={() => degistir([...ogelerRef.current, { id: yeniId(), blok: { kind: "pageBreak" } }])}
            onSutunSonu={() => degistir([...ogelerRef.current, { id: yeniId(), blok: { kind: "columnBreak" } }])}
            onBirak={(kaynak, hedef) => {
              if (kaynak === hedef) return;
              const n = [...ogelerRef.current];
              const [alinan] = n.splice(kaynak, 1);
              n.splice(hedef, 0, alinan);
              degistir(n);
            }}
          />
        </section>

        <button
          type="button"
          className="hidden w-2 cursor-col-resize bg-slate-200 text-[10px] lg:block"
          title="Sürükleyerek genişletin, çift tıklayınca kapanır"
          onDoubleClick={() => setSagAcik((v) => !v)}
          onPointerDown={(e) => panelSurukle(e, "sag")}
          aria-label="Sağ paneli boyutlandır"
        >
          {sagAcik ? "›" : "‹"}
        </button>

        <section
          style={{ width: sagW }}
          className={`shrink-0 overflow-hidden border-l bg-white p-2 ${mobil !== "onizleme" ? "max-lg:hidden" : ""} ${sagAcik ? "" : "lg:hidden"}`}
        >
          <FoyOnizleme
            url={pdfUrl}
            sayfa={teshis?.sayfa ?? 1}
            uretiliyor={uretiliyor}
            hata={hata}
            onIndirOgrenci={() => void indir("ogrenci")}
            onIndirOgretmen={() => void indir("ogretmen")}
          />
        </section>
      </div>

      <div
        className={pdfAcik ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" : "hidden"}
        role="dialog"
        aria-modal={pdfAcik}
        aria-label="PDF'den soru al"
      >
        <div className="flex h-[min(94vh,960px)] w-[min(1120px,96vw)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h2 className="text-sm font-bold text-[#173b70]">{"PDF'den soru al"}</h2>
            <button
              type="button"
              className="rounded border px-3 py-1 text-xs font-semibold"
              onClick={() => setArac("kunye")}
              data-test="foy-kirp-kapat"
            >
              Kapat
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3">
              <FoyKazanimSec sinif={kunye.sinif} brans={kunye.brans} yazili={kunye.yazili} value={kazanim} onChange={setKazanim} />
            </div>
            <FoyPdfKirp
              ref={kirpRef}
              dosya={pdfDosya}
              onDosya={setPdfDosya}
              mevcut={ogeler.flatMap((o) => (o.kaynak ? [o.kaynak] : []))}
              sonrakiNo={ogeler.reduce((n, o) => n + (numaraliSoruMu(o.blok) ? 1 : 0), 0) + 1}
              onEkle={kirpEkle}
              onMetin={(metin) => {
                const r = cleanPastedText(metin);
                void pasteEkle(r.blocks);
              }}
            />
          </div>
        </div>
      </div>

      {formulAcik ? (
        <FormulaEditor
          onKapat={() => setFormulAcik(false)}
          onKaydet={({ latex, gorsel }) => {
            degistir([...ogelerRef.current, { id: yeniId(), blok: { kind: "formula", render: gorsel, latex } }]);
            setFormulAcik(false);
          }}
        />
      ) : null}

      {kalite ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-4 text-sm shadow-xl">
            <h3 className="mb-2 font-bold">İndirmeden önce</h3>
            <ul className="mb-3 list-disc space-y-1 pl-4 text-xs">
              {kalite.notlar.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded bg-dershanem-navy px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => {
                  if (indirmeBlob.current) dosyaIn(indirmeBlob.current, kalite.surum);
                  indirmeBlob.current = null;
                  setKalite(null);
                }}
              >
                Yine de indir
              </button>
              <button type="button" className="rounded border px-3 py-1.5 text-xs" onClick={() => setKalite(null)}>
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
