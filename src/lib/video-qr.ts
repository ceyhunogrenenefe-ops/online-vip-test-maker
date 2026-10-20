import QRCode from "qrcode";

/** Yalnızca http(s) bağlantısı karekod olur. Başka şema yazılmaz. */
export function videoLinkiGecerli(ham: string): string | null {
  const t = ham.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function videoQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 280, errorCorrectionLevel: "M" });
}
