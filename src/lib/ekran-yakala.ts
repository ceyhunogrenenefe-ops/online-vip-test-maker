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

/** Ekranın cihaz piksellerine yakın bir paylaşım ister; tarayıcı ideal değeri düşürebilir. */
export function ekranVideoAyari(ekran: { width: number; height: number; dpr: number }) {
  const oran = Math.min(3, Math.max(1, ekran.dpr || 1));
  const genislik = Math.max(1, ekran.width || 1920);
  const yukseklik = Math.max(1, ekran.height || 1080);
  return {
    frameRate: { ideal: 8, max: 15 },
    width: { ideal: Math.round(Math.min(3840, genislik * oran)) },
    height: { ideal: Math.round(Math.min(2160, yukseklik * oran)) },
    resizeMode: "none" as const,
  };
}

function ekranOlcusu() {
  if (typeof window === "undefined") return { width: 1920, height: 1080, dpr: 1 };
  return {
    width: window.screen?.width || window.innerWidth || 1920,
    height: window.screen?.height || window.innerHeight || 1080,
    dpr: window.devicePixelRatio || 1,
  };
}

async function netligiYukselt(stream: MediaStream) {
  const iz = stream.getVideoTracks()[0];
  if (!iz) return;
  (iz as MediaStreamTrack & { contentHint?: string }).contentHint = "detail";
  const kapasite = iz.getCapabilities?.();
  const en = kapasite?.width?.max;
  const boy = kapasite?.height?.max;
  if (!en || !boy) return;
  await iz
    .applyConstraints({
      width: { ideal: en },
      height: { ideal: boy },
      frameRate: { ideal: 8, max: 15 },
    })
    .catch(() => undefined);
}

export async function ekranPaylasiminiAc(): Promise<MediaStream> {
  if (!ekranPaylasimiVar()) throw new Error(EKRAN_YOK);
  const ortak = {
    audio: false,
    preferCurrentTab: false,
    selfBrowserSurface: "exclude" as const,
    surfaceSwitching: "include" as const,
    monitorTypeSurfaces: "include" as const,
  };
  const video = ekranVideoAyari(ekranOlcusu());
  let akis: MediaStream;
  try {
    akis = await navigator.mediaDevices.getDisplayMedia({
      ...ortak,
      video: { ...video, logicalSurface: false, displaySurface: "window" },
    } as EkranSecenek);
  } catch (e) {
    if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) throw e;
    akis = await navigator.mediaDevices.getDisplayMedia({ ...ortak, video } as EkranSecenek);
  }
  await netligiYukselt(akis);
  return akis;
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
