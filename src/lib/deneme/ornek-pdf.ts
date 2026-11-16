import { readFileSync } from "fs";
import { jsPDF } from "jspdf";

/**
 * Karışık dersli örnek deneme.
 * Sözel sayfada ortak parçaya bağlı üç Türkçe sorusu ve tarih,
 * sayısal sayfada işlem, üçgen çizimi, fen ve cevap anahtarı vardır.
 */
export function karisikDenemePdf(): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const font = readFileSync("C:/Windows/Fonts/arial.ttf");
  doc.addFileToVFS("arial.ttf", Buffer.from(font).toString("base64"));
  doc.addFont("arial.ttf", "ArialTR", "normal");
  doc.setFont("ArialTR", "normal");
  doc.setFontSize(12);

  let y = 56;
  const yaz = (metin: string, bosluk = 18) => {
    doc.text(metin, 48, y);
    y += bosluk;
  };

  yaz("TÜRKÇE", 24);
  yaz("1-3. soruları aşağıdaki parçaya göre cevaplayınız.", 20);
  yaz("Ali her sabah erken kalkar ve okula yürüyerek gider.", 16);
  yaz("Akşamları kitap okur.", 22);
  yaz("1. Parçada Ali okula nasıl gider?", 18);
  yaz("A) Koşarak", 16);
  yaz("B) Yürüyerek", 16);
  yaz("C) Servisle", 16);
  yaz("D) Bisikletle", 22);
  yaz("2. Ali akşamları ne yapar?", 18);
  yaz("A) Kitap okur", 16);
  yaz("B) Yüzer", 16);
  yaz("C) Uyur", 16);
  yaz("D) Koşar", 22);
  yaz("3. Parçaya göre Ali sabahları nasıldır?", 18);
  yaz("A) Geç kalır", 16);
  yaz("B) Hiç kalkmaz", 16);
  yaz("C) Erken kalkar", 16);
  yaz("D) Evde kalır", 28);
  yaz("T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK", 22);
  yaz("1. TBMM hangi yıl açıldı?", 18);
  yaz("A) 1919", 16);
  yaz("B) 1923", 16);
  yaz("C) 1920", 16);
  yaz("D) 1938", 16);

  doc.addPage();
  y = 56;
  yaz("MATEMATİK", 24);
  yaz("1. 2x + 6 = 12 ise x kaçtır?", 22);
  doc.setDrawColor(23, 59, 112);
  doc.setLineWidth(1.4);
  doc.triangle(72, y + 26, 116, y + 26, 94, y);
  y += 40;
  yaz("A) 2", 16);
  yaz("B) 3", 16);
  yaz("C) 4", 16);
  yaz("D) 6", 28);
  yaz("FEN BİLİMLERİ", 24);
  yaz("1. Fotosentez için gerekli ışık kaynağı hangisidir?", 18);
  yaz("A) Ay", 16);
  yaz("B) Güneş", 16);
  yaz("C) Rüzgar", 16);
  yaz("D) Kaya", 28);
  yaz("CEVAP ANAHTARI", 22);
  yaz("Türkçe: 1-B 2-A 3-C", 18);
  yaz("T.C. İnkılap Tarihi ve Atatürkçülük: 1-C", 18);
  yaz("Matematik: 1-B", 18);
  yaz("Fen Bilimleri: 1-B", 18);

  return new Uint8Array(doc.output("arraybuffer"));
}
