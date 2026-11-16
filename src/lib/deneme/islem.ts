import { depoIsle, depoOku, type DepoDosya } from "./depo.ts";
import type {
  AyiklananSoru,
  Bolum,
  Deneme,
  Oturum,
  PuanSonuc,
  SecilenSoru,
  Sik,
  Soru,
} from "./model.ts";
import { SIKLAR, VARSAYILAN_CEZA } from "./model.ts";
import { ogrenciAra } from "./ogrenci-ara.ts";
import { puanla } from "./puan.ts";
import { eksikleriHesapla, soruSec } from "./sec.ts";
import { smsIlet } from "./sms-gonder.ts";
import { smsMetni } from "./sms-metin.ts";
import { telefonKarari } from "./telefon.ts";
import { norm, telefonMaske } from "./turkce.ts";

export class DenemeHatasi extends Error {
  durum: number;
  constructor(mesaj: string, durum = 400) {
    super(mesaj);
    this.durum = durum;
  }
}

function id(): string {
  return crypto.randomUUID();
}

function kodUret(varOlan: Set<string>): string {
  for (let i = 0; i < 8; i++) {
    const kod = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    if (!varOlan.has(kod)) return kod;
  }
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function sikMi(v: unknown): v is Sik {
  return v === "A" || v === "B" || v === "C" || v === "D";
}

function gorselTemiz(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !v.startsWith("data:image/")) {
    throw new DenemeHatasi("Soru görseli okunamadı.");
  }
  if (v.length > 1_800_000) throw new DenemeHatasi("Soru görseli çok büyük.");
  return v;
}

function soruKaydet(pdfId: string, ham: AyiklananSoru, gorsel: string | null, ortakGorsel: string | null): Soru {
  return {
    ...ham,
    id: id(),
    pdfId,
    gorsel,
    ortakGorsel,
    dogru: sikMi(ham.dogru) ? ham.dogru : null,
  };
}

export async function pdfSoruEkle(
  pdfId: string,
  sorular: { soru: AyiklananSoru; gorsel?: string | null; ortakGorsel?: string | null }[]
) {
  return depoIsle((depo) => {
    if (!depo.pdfler.some((p) => p.id === pdfId)) throw new DenemeHatasi("PDF bulunamadı.", 404);
    const kayit = (sorular || []).map((s) =>
      soruKaydet(pdfId, s.soru, gorselTemiz(s.gorsel), gorselTemiz(s.ortakGorsel))
    );
    depo.sorular.unshift(...kayit);
    return { pdfId, sorular: kayit };
  });
}

export async function pdfEkle(girdi: {
  ad: string;
  sayfaSayisi: number;
  sorular: { soru: AyiklananSoru; gorsel?: string | null; ortakGorsel?: string | null }[];
}) {
  const ad = girdi.ad?.trim();
  if (!ad) throw new DenemeHatasi("PDF adı gerekli.");
  return depoIsle((depo) => {
    const pdfId = id();
    const sorular = (girdi.sorular || []).map((s) =>
      soruKaydet(pdfId, s.soru, gorselTemiz(s.gorsel), gorselTemiz(s.ortakGorsel))
    );
    depo.pdfler.unshift({
      id: pdfId,
      ad,
      sayfaSayisi: girdi.sayfaSayisi || 1,
      yukleme: Date.now(),
    });
    depo.sorular.unshift(...sorular);
    return { pdfId, soruSayisi: sorular.length, sorular };
  });
}

export async function soruGuncelle(
  soruId: string,
  patch: Partial<Pick<Soru, "ders" | "metin" | "secenekler" | "dogru" | "gorsel" | "inceleme">>
) {
  return depoIsle((depo) => {
    const soru = depo.sorular.find((s) => s.id === soruId);
    if (!soru) throw new DenemeHatasi("Soru bulunamadı.", 404);
    if (typeof patch.ders === "string" && patch.ders.trim()) soru.ders = patch.ders.trim();
    if (typeof patch.metin === "string") soru.metin = patch.metin.trim();
    if (patch.secenekler && typeof patch.secenekler === "object") {
      const temiz: Soru["secenekler"] = {};
      for (const harf of SIKLAR) {
        const metin = patch.secenekler[harf];
        if (typeof metin === "string" && metin.trim()) temiz[harf] = metin.trim();
      }
      soru.secenekler = temiz;
    }
    if (patch.dogru === null) soru.dogru = null;
    else if (sikMi(patch.dogru)) soru.dogru = patch.dogru;
    if (patch.gorsel !== undefined) soru.gorsel = gorselTemiz(patch.gorsel);
    const sikSayisi = Object.keys(soru.secenekler).length;
    if (soru.dogru && soru.ders !== "Belirsiz" && sikSayisi >= 2 && patch.inceleme !== true) {
      soru.inceleme = false;
      soru.incelemeNeden = null;
    } else if (patch.inceleme === true) {
      soru.inceleme = true;
    }
    return { soru };
  });
}

function bolumTemiz(liste: Bolum[]): Bolum[] {
  if (!Array.isArray(liste) || !liste.length) throw new DenemeHatasi("En az bir bölüm gerekli.");
  return liste.map((b) => {
    const ad = String(b.ad || "").trim();
    if (!ad) throw new DenemeHatasi("Bölüm adı gerekli.");
    const sure = Number(b.sureDakika);
    if (!Number.isFinite(sure) || sure < 1 || sure > 300) {
      throw new DenemeHatasi("Bölüm süresi 1 ile 300 dakika arasında olmalı.");
    }
    const dersler = (b.dersler || [])
      .map((d) => ({ ders: String(d.ders || "").trim(), adet: Math.floor(Number(d.adet)) }))
      .filter((d) => d.ders && d.adet > 0);
    if (!dersler.length) throw new DenemeHatasi(`${ad} bölümünde ders kalmadı.`);
    return { id: b.id || id(), ad, sureDakika: sure, dersler };
  });
}

function cezaTemiz(v: unknown): number {
  const n = v == null || v === "" ? VARSAYILAN_CEZA : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new DenemeHatasi("Yanlış cezası 0 ile 1 arasında olmalı.");
  }
  return Math.round(n * 1000) / 1000;
}

export async function denemeOlustur(girdi: {
  ad: string;
  yanlisCezasi?: number;
  smsAlici?: "ogrenci" | "veli";
  bolumler: Bolum[];
  pdfIdler: string[];
}) {
  const ad = girdi.ad?.trim();
  if (!ad) throw new DenemeHatasi("Deneme adı gerekli.");
  const bolumler = bolumTemiz(girdi.bolumler);
  const pdfIdler = [...new Set((girdi.pdfIdler || []).filter(Boolean))];
  if (!pdfIdler.length) throw new DenemeHatasi("Kaynak PDF seçin.");
  const smsAlici = girdi.smsAlici === "ogrenci" ? "ogrenci" : "veli";
  return depoIsle((depo) => {
    const secim = soruSec(depo.sorular, bolumler, pdfIdler);
    const deneme: Deneme = {
      id: id(),
      kod: kodUret(new Set(depo.denemeler.map((d) => d.kod))),
      ad,
      yanlisCezasi: cezaTemiz(girdi.yanlisCezasi),
      smsAlici,
      bolumler,
      pdfIdler,
      sorular: secim.sorular,
      yayin: false,
      olusturma: Date.now(),
    };
    depo.denemeler.unshift(deneme);
    return { deneme, eksikler: secim.eksikler };
  });
}

function ayniSoruIkiKez(liste: SecilenSoru[]) {
  const ids = liste.map((s) => s.soruId);
  if (new Set(ids).size !== ids.length) {
    throw new DenemeHatasi("Aynı soru denemeye iki kez eklenemez.");
  }
}

export async function denemeGuncelle(
  denemeId: string,
  patch: {
    ad?: string;
    yanlisCezasi?: number;
    smsAlici?: "ogrenci" | "veli";
    bolumler?: Bolum[];
    sorular?: SecilenSoru[];
  }
) {
  return depoIsle((depo) => {
    const deneme = depo.denemeler.find((d) => d.id === denemeId);
    if (!deneme) throw new DenemeHatasi("Deneme bulunamadı.", 404);
    if (deneme.yayin) throw new DenemeHatasi("Yayımlanmış denemenin soruları değişmez.");
    if (typeof patch.ad === "string" && patch.ad.trim()) deneme.ad = patch.ad.trim();
    if (patch.yanlisCezasi !== undefined) deneme.yanlisCezasi = cezaTemiz(patch.yanlisCezasi);
    if (patch.smsAlici === "ogrenci" || patch.smsAlici === "veli") deneme.smsAlici = patch.smsAlici;
    if (patch.bolumler) deneme.bolumler = bolumTemiz(patch.bolumler);
    if (patch.sorular) {
      const izin = new Set(deneme.pdfIdler);
      const temiz = patch.sorular.map((s, i) => ({
        soruId: s.soruId,
        bolumId: s.bolumId,
        ders: s.ders,
        sira: i + 1,
      }));
      ayniSoruIkiKez(temiz);
      for (const s of temiz) {
        const kayit = depo.sorular.find((q) => q.id === s.soruId);
        if (!kayit || !izin.has(kayit.pdfId)) {
          throw new DenemeHatasi("Seçilen soru bu denemenin kaynak PDF’lerinde yok.");
        }
        s.ders = kayit.ders;
      }
      deneme.sorular = temiz;
    }
    return { deneme, eksikler: eksikleriHesapla(deneme.bolumler, deneme.sorular) };
  });
}

export async function denemeYayinla(denemeId: string) {
  return depoIsle((depo) => {
    const deneme = depo.denemeler.find((d) => d.id === denemeId);
    if (!deneme) throw new DenemeHatasi("Deneme bulunamadı.", 404);
    const eksikler = eksikleriHesapla(deneme.bolumler, deneme.sorular);
    if (eksikler.length) {
      const e = eksikler[0];
      throw new DenemeHatasi(
        `${e.ders}: ${e.bulunan} soru bulundu, ${e.gereken - e.bulunan} soru daha gerekli.`
      );
    }
    const gorulen = new Set<string>();
    for (const sec of deneme.sorular) {
      if (gorulen.has(sec.soruId)) throw new DenemeHatasi("Aynı soru denemeye iki kez eklenemez.");
      gorulen.add(sec.soruId);
      const soru = depo.sorular.find((s) => s.id === sec.soruId);
      if (!soru) throw new DenemeHatasi("Soru bulunamadı.");
      if (soru.inceleme) {
        throw new DenemeHatasi("İncelemesi bitmemiş soru yayımlanamaz.");
      }
      if (!soru.dogru) throw new DenemeHatasi("Doğru cevabı eksik olan soru yayımlanamaz.");
    }
    deneme.yayin = true;
    return { deneme };
  });
}

export async function havuzOku() {
  const depo = await depoOku();
  return { pdfler: depo.pdfler, sorular: depo.sorular, denemeler: depo.denemeler };
}

function sinavSorulari(deneme: Deneme, sorular: Soru[], anahtar: boolean) {
  const harita = new Map(sorular.map((s) => [s.id, s]));
  return [...deneme.sorular]
    .sort((a, b) => a.sira - b.sira)
    .map((sec) => {
      const s = harita.get(sec.soruId);
      if (!s) return null;
      return {
        id: s.id,
        ders: s.ders,
        bolumId: sec.bolumId,
        sira: sec.sira,
        numara: s.numara,
        metin: s.metin,
        secenekler: s.secenekler,
        gorsel: s.gorsel,
        ortakMetin: s.ortakMetin,
        ortakGorsel: s.ortakGorsel,
        grupId: s.grupId,
        dogru: anahtar ? s.dogru : undefined,
      };
    })
    .filter((s): s is NonNullable<typeof s> => !!s);
}

export async function denemeDetay(denemeId: string) {
  const depo = await depoOku();
  const deneme = depo.denemeler.find((d) => d.id === denemeId);
  if (!deneme) throw new DenemeHatasi("Deneme bulunamadı.", 404);
  return {
    deneme,
    sorular: sinavSorulari(deneme, depo.sorular, true),
    eksikler: eksikleriHesapla(deneme.bolumler, deneme.sorular),
    havuz: depo.sorular.filter((s) => deneme.pdfIdler.includes(s.pdfId)),
  };
}

export async function onizlemeGetir(denemeId: string) {
  const depo = await depoOku();
  const deneme = depo.denemeler.find((d) => d.id === denemeId);
  if (!deneme) throw new DenemeHatasi("Deneme bulunamadı.", 404);
  return sinavGovde(deneme, depo.sorular, true);
}

export async function sinavGetir(kod: string) {
  const depo = await depoOku();
  const deneme = depo.denemeler.find((d) => d.kod === kod && d.yayin);
  if (!deneme) throw new DenemeHatasi("Sınav bulunamadı.", 404);
  return sinavGovde(deneme, depo.sorular, false);
}

function sinavGovde(deneme: Deneme, sorular: Soru[], onizleme: boolean) {
  return {
    onizleme,
    deneme: {
      id: deneme.id,
      kod: deneme.kod,
      ad: deneme.ad,
      smsAlici: deneme.smsAlici,
      bolumler: deneme.bolumler.map((b) => ({
        id: b.id,
        ad: b.ad,
        sureDakika: b.sureDakika,
      })),
    },
    sorular: sinavSorulari(deneme, sorular, false),
  };
}

function adTemiz(v: unknown, etiket: string): string {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (s.length < 2) throw new DenemeHatasi(`${etiket} gerekli.`);
  return s;
}

export async function sinavBasla(girdi: { kod: string; ad: string; soyad: string; telefon?: string }) {
  const ad = adTemiz(girdi.ad, "Ad");
  const soyad = adTemiz(girdi.soyad, "Soyad");
  const depoOn = await depoOku();
  const deneme = depoOn.denemeler.find((d) => d.kod === girdi.kod && d.yayin);
  if (!deneme) throw new DenemeHatasi("Sınav bulunamadı.", 404);

  const arama = await ogrenciAra(soyad).catch((e: Error) => {
    throw new DenemeHatasi(e.message || "Öğrenci kayıtları şu an okunamadı.", 503);
  });
  const karar = telefonKarari({
    ad,
    soyad,
    alici: deneme.smsAlici,
    kayitlar: arama.kayitlar,
    girilen: girdi.telefon,
  });
  if (karar.gerekli) {
    return {
      telefonGerekli: true,
      mesaj:
        arama.kayitVar && arama.kayitlar.some((k) => norm(k.ad) === norm(`${ad} ${soyad}`))
          ? "Kayıtlı numarada seçilen alıcı boş. Sonuç SMS'inin gideceği cep numarasını yazın."
          : "Bu ad soyad ile kayıtlı numara bulunamadı. Sonuç SMS'inin gideceği cep numarasını yazın.",
    };
  }

  return depoIsle((depo) => {
    const oturum: Oturum = {
      id: id(),
      denemeId: deneme.id,
      ad,
      soyad,
      telefon: karar.telefon,
      telefonKaynak: karar.kaynak,
      ogrenciId: karar.ogrenciId,
      cevaplar: {},
      baslama: Date.now(),
      guncelleme: Date.now(),
      teslim: false,
      teslimZamani: null,
      sonuc: null,
      sms: [],
    };
    depo.oturumlar.push(oturum);
    return {
      telefonGerekli: false,
      oturumId: oturum.id,
      telefonMaske: telefonMaske(oturum.telefon),
      telefonKaynak: oturum.telefonKaynak,
    };
  });
}

function cevapTemiz(ham: Record<string, unknown> | undefined, izin: Set<string>): Record<string, Sik> {
  const out: Record<string, Sik> = {};
  if (!ham) return out;
  for (const [soruId, deger] of Object.entries(ham)) {
    if (!izin.has(soruId) || !sikMi(deger)) continue;
    out[soruId] = deger;
  }
  return out;
}

export async function oturumGetir(oturumId: string) {
  const depo = await depoOku();
  const oturum = depo.oturumlar.find((o) => o.id === oturumId);
  if (!oturum) throw new DenemeHatasi("Oturum bulunamadı.", 404);
  const deneme = depo.denemeler.find((d) => d.id === oturum.denemeId);
  return {
    oturumId: oturum.id,
    teslim: oturum.teslim,
    cevaplar: oturum.cevaplar,
    sonuc: oturum.sonuc,
    ad: oturum.ad,
    soyad: oturum.soyad,
    baslama: oturum.baslama,
    deneme: deneme
      ? { ad: deneme.ad, kod: deneme.kod, bolumler: deneme.bolumler, id: deneme.id }
      : null,
    karsilastirma: oturum.teslim && deneme ? karsilastirma(depo, deneme, oturum) : undefined,
  };
}

export async function cevapKaydet(oturumId: string, cevaplar: Record<string, unknown>) {
  return depoIsle((depo) => {
    const oturum = depo.oturumlar.find((o) => o.id === oturumId);
    if (!oturum) throw new DenemeHatasi("Oturum bulunamadı.", 404);
    if (oturum.teslim) return { kaydedildi: false, teslim: true, cevaplar: oturum.cevaplar };
    const deneme = depo.denemeler.find((d) => d.id === oturum.denemeId);
    if (!deneme) throw new DenemeHatasi("Sınav bulunamadı.", 404);
    const izin = new Set(deneme.sorular.map((s) => s.soruId));
    oturum.cevaplar = { ...oturum.cevaplar, ...cevapTemiz(cevaplar, izin) };
    oturum.guncelleme = Date.now();
    return { kaydedildi: true, teslim: false, cevaplar: oturum.cevaplar };
  });
}

function karsilastirma(depo: DepoDosya, deneme: Deneme, oturum: Oturum) {
  return deneme.sorular
    .slice()
    .sort((a, b) => a.sira - b.sira)
    .map((sec) => {
      const soru = depo.sorular.find((s) => s.id === sec.soruId);
      return {
        soruId: sec.soruId,
        ders: sec.ders,
        sira: sec.sira,
        verilen: oturum.cevaplar[sec.soruId] ?? null,
        dogru: soru?.dogru ?? null,
      };
    });
}

async function smsIsle(oturumId: string, denemeAd: string, sonuc: PuanSonuc, telefon: string, ad: string, soyad: string) {
  const metin = smsMetni({
    ad,
    soyad,
    deneme: denemeAd,
    dogru: sonuc.dogru,
    yanlis: sonuc.yanlis,
    bos: sonuc.bos,
    net: sonuc.net,
  });
  const iletim = await smsIlet(telefon, metin);
  await depoIsle((depo) => {
    const oturum = depo.oturumlar.find((o) => o.id === oturumId);
    if (!oturum) return;
    oturum.sms.push({
      zaman: Date.now(),
      metin,
      durum: iletim.ok ? "gonderildi" : "hata",
      hata: iletim.hata,
      saglayici: iletim.saglayici,
    });
  });
}

export async function sinavTeslim(oturumId: string, cevaplar?: Record<string, unknown>) {
  const hazir = await depoIsle((depo) => {
    const oturum = depo.oturumlar.find((o) => o.id === oturumId);
    if (!oturum) throw new DenemeHatasi("Oturum bulunamadı.", 404);
    const deneme = depo.denemeler.find((d) => d.id === oturum.denemeId);
    if (!deneme) throw new DenemeHatasi("Sınav bulunamadı.", 404);
    if (oturum.teslim && oturum.sonuc) {
      return { ayni: true as const, oturum, deneme, depo };
    }
    const izin = new Set(deneme.sorular.map((s) => s.soruId));
    if (cevaplar) oturum.cevaplar = { ...oturum.cevaplar, ...cevapTemiz(cevaplar, izin) };
    const havuz = new Map(depo.sorular.map((s) => [s.id, s]));
    oturum.sonuc = puanla(deneme.sorular, havuz, oturum.cevaplar, deneme.yanlisCezasi);
    oturum.teslim = true;
    oturum.teslimZamani = Date.now();
    oturum.guncelleme = Date.now();
    return { ayni: false as const, oturum, deneme };
  });

  if (!hazir.ayni && hazir.oturum.sonuc) {
    await smsIsle(
      hazir.oturum.id,
      hazir.deneme.ad,
      hazir.oturum.sonuc,
      hazir.oturum.telefon,
      hazir.oturum.ad,
      hazir.oturum.soyad
    );
  }

  const guncel = await depoOku();
  const oturum = guncel.oturumlar.find((o) => o.id === oturumId)!;
  const deneme = guncel.denemeler.find((d) => d.id === oturum.denemeId)!;
  return {
    ayni: hazir.ayni,
    sonuc: oturum.sonuc,
    sms: oturum.sms,
    karsilastirma: karsilastirma(guncel, deneme, oturum),
  };
}

export async function smsYeniden(oturumId: string) {
  const kayit = await depoIsle((depo) => {
    const oturum = depo.oturumlar.find((o) => o.id === oturumId);
    if (!oturum?.teslim || !oturum.sonuc) throw new DenemeHatasi("Önce sınav teslim edilmeli.");
    const deneme = depo.denemeler.find((d) => d.id === oturum.denemeId);
    if (!deneme) throw new DenemeHatasi("Deneme bulunamadı.", 404);
    return {
      telefon: oturum.telefon,
      ad: oturum.ad,
      soyad: oturum.soyad,
      deneme: deneme.ad,
      sonuc: oturum.sonuc,
    };
  });
  await smsIsle(oturumId, kayit.deneme, kayit.sonuc, kayit.telefon, kayit.ad, kayit.soyad);
  const oturum = (await depoOku()).oturumlar.find((o) => o.id === oturumId)!;
  return { sms: oturum.sms, sonuc: oturum.sonuc };
}

export async function sonucListesi(denemeId: string) {
  const depo = await depoOku();
  const deneme = depo.denemeler.find((d) => d.id === denemeId);
  if (!deneme) throw new DenemeHatasi("Deneme bulunamadı.", 404);
  const oturumlar = depo.oturumlar
    .filter((o) => o.denemeId === denemeId)
    .sort((a, b) => (b.teslimZamani || b.guncelleme) - (a.teslimZamani || a.guncelleme))
    .map((o) => ({
      id: o.id,
      ad: o.ad,
      soyad: o.soyad,
      telefonMaske: o.telefon ? telefonMaske(o.telefon) : "",
      telefonKaynak: o.telefonKaynak,
      teslim: o.teslim,
      teslimZamani: o.teslimZamani,
      sonuc: o.sonuc,
      sms: o.sms,
    }));
  return { deneme, oturumlar };
}
