/** PDF deneme havuzu, sınav ve teslim kayıtlarının ortak tipleri. */

export type Sik = "A" | "B" | "C" | "D";

export const SIKLAR: Sik[] = ["A", "B", "C", "D"];

export type Kutu = { x: number; y: number; w: number; h: number };

export type MetinSatir = {
  metin: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** OCR kullanıldıysa 0–100. Metin katmanında yoktur. */
  guven?: number;
};

export type SayfaGirdi = {
  sayfa: number;
  genislik: number;
  yukseklik: number;
  ocr: boolean;
  satirlar: MetinSatir[];
};

export type AyiklananSoru = {
  yerelId: string;
  ders: string;
  sayfa: number;
  numara: number | null;
  metin: string;
  secenekler: Partial<Record<Sik, string>>;
  dogru: Sik | null;
  grupId: string | null;
  ortakMetin: string | null;
  guven: number;
  inceleme: boolean;
  incelemeNeden: string | null;
  matematikVar: boolean;
  kutu: Kutu;
  ortakKutu: Kutu | null;
};

export type Soru = AyiklananSoru & {
  id: string;
  pdfId: string;
  gorsel: string | null;
  ortakGorsel: string | null;
};

export type PdfKayit = {
  id: string;
  ad: string;
  sayfaSayisi: number;
  yukleme: number;
};

export type DersIstek = { ders: string; adet: number };

export type Bolum = {
  id: string;
  ad: string;
  sureDakika: number;
  dersler: DersIstek[];
};

export type SecilenSoru = {
  soruId: string;
  bolumId: string;
  ders: string;
  sira: number;
};

export type EksikDers = {
  ders: string;
  bulunan: number;
  gereken: number;
  incelemede: number;
};

export type Deneme = {
  id: string;
  kod: string;
  ad: string;
  yanlisCezasi: number;
  smsAlici: "ogrenci" | "veli";
  bolumler: Bolum[];
  pdfIdler: string[];
  sorular: SecilenSoru[];
  yayin: boolean;
  olusturma: number;
};

export type DersSonuc = {
  ders: string;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
};

export type PuanSonuc = {
  dersler: DersSonuc[];
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
};

export type SmsKayit = {
  zaman: number;
  metin: string;
  durum: "gonderildi" | "hata";
  hata: string | null;
  saglayici: string;
};

export type Oturum = {
  id: string;
  denemeId: string;
  ad: string;
  soyad: string;
  telefon: string;
  telefonKaynak: "ogrenci" | "veli" | "giris";
  ogrenciId: string | null;
  cevaplar: Record<string, Sik>;
  baslama: number;
  guncelleme: number;
  teslim: boolean;
  teslimZamani: number | null;
  sonuc: PuanSonuc | null;
  sms: SmsKayit[];
};

export const VARSAYILAN_CEZA = 1 / 3;

export const DERS_ADLARI = [
  "Türkçe",
  "T.C. İnkılap Tarihi ve Atatürkçülük",
  "Din Kültürü ve Ahlak Bilgisi",
  "İngilizce",
  "Matematik",
  "Fen Bilimleri",
] as const;
