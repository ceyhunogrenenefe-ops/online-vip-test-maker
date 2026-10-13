/**
 * Matematiksel OCR — sağlayıcı soyutlaması.
 *
 * NEDEN SOYUTLAMA:
 * Pix2Text tarayıcıda çalışamıyor. Model (breezedeus/pix2text-mfr) bir
 * TrOCR türevi ve ONNX'e çevrilebiliyor, ama hazır bir transformers.js /
 * onnxruntime-web sürümü yok; ayrıca formül BULMA (MFD) aşaması ayrı bir
 * model. Yani Python tarafı şart. Bu dosya o Python servisini HTTP
 * üzerinden çağırır; servis yoksa uygulama çalışmaya devam eder, yalnızca
 * formül tanıma kapalı kalır.
 *
 * Böylece servisi önce kendi bilgisayarınızda (localhost) deneyip sonra
 * sunucuya taşıyabilirsiniz; uygulama kodu değişmez.
 *
 * Servis kodu: tools/pix2text-service/main.py
 */

export type MathOcrSonuc = {
  latex: string;
  /** 0-1 arası; sağlayıcı vermiyorsa null */
  guven: number | null;
  saglayici: string;
};

export type MathOcrDurum =
  | { hazir: true; saglayici: string; surum?: string }
  | { hazir: false; neden: string };

const VARSAYILAN_UC =
  process.env.NEXT_PUBLIC_MATH_OCR_URL?.replace(/\/+$/, "") ||
  "http://127.0.0.1:8777";

function uc(): string {
  return VARSAYILAN_UC;
}

/** Servis ayakta mı? Onay ekranı bunu açılışta sorar. */
export async function mathOcrDurumu(zamanAsimiMs = 2500): Promise<MathOcrDurum> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), zamanAsimiMs);
  try {
    const r = await fetch(`${uc()}/saglik`, { signal: ac.signal });
    if (!r.ok) return { hazir: false, neden: `Servis ${r.status} döndü` };
    const j = (await r.json()) as { saglayici?: string; surum?: string };
    return { hazir: true, saglayici: j.saglayici || "pix2text", surum: j.surum };
  } catch (e) {
    const abort = e instanceof DOMException && e.name === "AbortError";
    return {
      hazir: false,
      neden: abort
        ? "Formül tanıma servisine ulaşılamadı (zaman aşımı)"
        : "Formül tanıma servisi çalışmıyor",
    };
  }
}

/**
 * Tek bir formül görüntüsünü LaTeX'e çevirir.
 * Girdi, onay ekranında öğretmenin "bu satır formül" dediği bölgenin
 * kırpılmış görüntüsüdür — tüm sayfa gönderilmez.
 */
export async function formuluTani(dataUrl: string): Promise<MathOcrSonuc> {
  const r = await fetch(`${uc()}/formul`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!r.ok) {
    const metin = await r.text().catch(() => "");
    throw new Error(`Formül tanınamadı (${r.status}) ${metin.slice(0, 120)}`);
  }
  const j = (await r.json()) as {
    latex?: string;
    confidence?: number | null;
    provider?: string;
  };
  if (!j.latex) throw new Error("Servis boş sonuç döndü");
  return {
    latex: j.latex,
    guven: typeof j.confidence === "number" ? j.confidence : null,
    saglayici: j.provider || "pix2text",
  };
}

/** Satır kutusunu görüntüden kırpar — formül tanımaya yalnızca o bölge gider. */
export async function bolgeyiKirp(
  dataUrl: string,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  pay = 6
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = () => rej(new Error("Görsel okunamadı"));
    el.src = dataUrl;
  });
  const x0 = Math.max(0, bbox.x0 - pay);
  const y0 = Math.max(0, bbox.y0 - pay);
  const x1 = Math.min(img.naturalWidth, bbox.x1 + pay);
  const y1 = Math.min(img.naturalHeight, bbox.y1 + pay);
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas açılamadı");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
  return c.toDataURL("image/png");
}
