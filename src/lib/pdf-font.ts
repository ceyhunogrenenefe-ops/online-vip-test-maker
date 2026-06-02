import type { jsPDF } from "jspdf";

const FONT_NAME = "NotoSans";
const FONT_FILE = "NotoSans-Regular.ttf";
const FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";

let cachedBase64: string | null = null;

async function loadFontBase64(): Promise<string> {
  if (cachedBase64) return cachedBase64;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error("Türkçe font yüklenemedi");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  cachedBase64 = btoa(binary);
  return cachedBase64;
}

export async function registerTurkishFont(doc: jsPDF): Promise<void> {
  try {
    const base64 = await loadFontBase64();
    const list = doc.getFontList() as Record<string, unknown>;
    if (!list[FONT_NAME]) {
      doc.addFileToVFS(FONT_FILE, base64);
      doc.addFont(FONT_FILE, FONT_NAME, "normal");
      doc.addFont(FONT_FILE, FONT_NAME, "bold");
    }
    doc.setFont(FONT_NAME, "normal");
  } catch {
    doc.setFont("helvetica", "normal");
  }
}

export function setTurkishFont(
  doc: jsPDF,
  style: "normal" | "bold" = "normal"
) {
  const list = doc.getFontList() as Record<string, unknown>;
  if (list[FONT_NAME]) {
    doc.setFont(FONT_NAME, style);
  } else {
    doc.setFont("helvetica", style);
  }
}
