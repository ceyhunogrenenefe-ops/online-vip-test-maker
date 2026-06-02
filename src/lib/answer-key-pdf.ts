import { jsPDF } from "jspdf";
import type { AnswerOption, Question, QuestionSnapshot } from "@/types";
import { registerTurkishFont, setTurkishFont } from "./pdf-font";

type KeyItem = { index: number; answerKey: AnswerOption };

function collectKeys(
  items: { answerKey?: AnswerOption }[]
): KeyItem[] {
  return items
    .map((item, index) =>
      item.answerKey
        ? { index: index + 1, answerKey: item.answerKey }
        : null
    )
    .filter((x): x is KeyItem => !!x);
}

export async function generateAnswerKeyPdf(
  title: string,
  schoolName: string,
  keys: KeyItem[]
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerTurkishFont(doc);
  const margin = 20;
  let y = margin;

  doc.setFontSize(16);
  setTurkishFont(doc, "bold");
  doc.text("CEVAP ANAHTARI", margin, y);
  y += 10;

  doc.setFontSize(12);
  setTurkishFont(doc, "normal");
  if (schoolName) {
    doc.text(schoolName, margin, y);
    y += 7;
  }
  doc.text(title || "Online Test", margin, y);
  y += 14;

  if (keys.length === 0) {
    doc.setFontSize(11);
    doc.text("Henüz cevap anahtarı girilmemiş.", margin, y);
  } else {
    const cols = 4;
    const colW = 42;
    keys.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const lineY = y + row * 9;
      if (lineY > 275 && col === 0 && i > 0) {
        doc.addPage();
        y = margin;
      }
      const fy = y + Math.floor(i / cols) * 9;
      const x = margin + col * colW;
      doc.setFontSize(12);
      setTurkishFont(doc, "bold");
      doc.text(`${k.index}.`, x, fy);
      setTurkishFont(doc, "normal");
      doc.text(k.answerKey, x + 14, fy);
    });
  }

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Toplam ${keys.length} soru · Dershanem VIP Test Maker`,
    margin,
    290
  );

  return doc.output("blob");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadAnswerKeyFromQuestions(
  questions: Question[],
  title: string,
  schoolName: string
) {
  const keys = collectKeys(questions);
  const blob = await generateAnswerKeyPdf(title, schoolName, keys);
  triggerDownload(
    blob,
    `${(title || "cevap_anahtari").replace(/\s+/g, "_")}_cevap.pdf`
  );
}

export async function downloadAnswerKeyFromExam(
  title: string,
  schoolName: string,
  snapshots: QuestionSnapshot[]
) {
  const keys = collectKeys(snapshots);
  const blob = await generateAnswerKeyPdf(title, schoolName, keys);
  triggerDownload(
    blob,
    `${(title || "cevap_anahtari").replace(/\s+/g, "_")}_cevap.pdf`
  );
}

export function gradeAnswers(
  snapshots: QuestionSnapshot[],
  answers: Record<number, string>
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  snapshots.forEach((q, i) => {
    if (!q.answerKey) return;
    total++;
    if (answers[i] === q.answerKey) correct++;
  });
  return { correct, total };
}
