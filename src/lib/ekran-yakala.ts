/**
 * Öğretmenin bilgisayarında, tabletinde veya tarayıcısında açık duran
 * sayfayı (Z-kitap, sekme, pencere) göstermek için ekran paylaşımı.
 * Görüntü yalnızca bu cihazda kalır.
 */

type EkranSecenek = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  monitorTypeSurfaces?: "include" | "exclude";
};

let bekleyen: MediaStream | null = null;

export function ekranPaylasimiVar(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

export const EKRAN_YOK =
  "Bu tarayıcı açık pencereyi gösteremiyor. Z-kitabın veya sayfanın ekran görüntüsünü kaydedip görsel olarak yükleyin.";

export async function ekranPaylasiminiAc(): Promise<MediaStream> {
  if (!ekranPaylasimiVar()) throw new Error(EKRAN_YOK);
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 8 } },
    audio: false,
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    monitorTypeSurfaces: "include",
  } as EkranSecenek);
}

/** Anasayfadan kırpma aracına geçerken akış kaybolmasın. */
export function ekranPaylasiminiBeklet(stream: MediaStream) {
  bekleyen = stream;
}

export function bekleyenAkisiAl(): MediaStream | null {
  const akis = bekleyen;
  bekleyen = null;
  return akis;
}

export function akisiKapat(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function videoKaresi(video: HTMLVideoElement): string {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("Görüntü henüz gelmedi. Sayfayı seçtikten sonra bir kez daha deneyin.");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görüntü tuvali açılamadı");
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

export function ekranHatasi(e: unknown): string {
  if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) {
    return "Pencere seçimi iptal edildi.";
  }
  return e instanceof Error ? e.message : "Açık sayfa alınamadı";
}
