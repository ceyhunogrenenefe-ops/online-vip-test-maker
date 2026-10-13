/**
 * LaTeX → baskı kalitesinde görsel.
 *
 * NEDEN SVG ÜZERİNDEN:
 * jsPDF formül dizemez. KaTeX HTML+CSS üretir; onu görsele çevirmek için
 * html2canvas gerekir ve sonuç yazı tipi yüklenmesine bağlı olduğu için
 * baskıda güvenilmez. MathJax'in "tex-svg" çıktısı ise yazı tipi
 * gerektirmeyen, yalnızca <path> içeren bir SVG'dir: çözünürlükten bağımsız
 * ve her ortamda aynı çizilir.
 *
 * ÖNEMLİ SINIRLAMA:
 * Formüller PDF'e GÖRSEL olarak gömülür; seçilebilir/aranabilir metin
 * değildir. Normal metinler seçilebilir kalır. Bu, jsPDF'in matematik
 * dizgisi yapamamasının doğrudan sonucudur.
 */

export type RenderedFormula = {
  /** PNG data URL — jsPDF addImage için */
  dataUrl: string;
  /** Piksel ölçüleri */
  widthPx: number;
  heightPx: number;
  /** Yazı yüksekliğine göre genişlik oranı — satır içi hizalama için */
  aspect: number;
  /**
   * MathJax'in verdiği ex cinsinden ölçüler. PDF'te formülleri sabit bir
   * kutu yüksekliğine sığdırmak yanlış: tek satırlık bir denklem ile iki
   * katlı bir kesir aynı kutuya girince harf boyutları farklı çıkıyor.
   * Doğru ölçekleme bu ex değeri üzerinden yapılır.
   */
  widthEx: number;
  heightEx: number;
};

export class LatexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LatexError";
  }
}

type MathJaxModule = {
  tex2svg: (tex: string, options?: Record<string, unknown>) => Element;
  startup?: { document?: unknown };
};

let mathjaxYukleme: Promise<MathJaxModule> | null = null;

/** MathJax ağır; yalnızca ilk formülde yüklenir. */
async function mathjax(): Promise<MathJaxModule> {
  if (mathjaxYukleme) return mathjaxYukleme;
  mathjaxYukleme = (async () => {
    const { mathjax: MJ } = await import("mathjax-full/js/mathjax.js");
    const { TeX } = await import("mathjax-full/js/input/tex.js");
    const { SVG } = await import("mathjax-full/js/output/svg.js");
    const { browserAdaptor } = await import(
      "mathjax-full/js/adaptors/browserAdaptor.js"
    );
    const { RegisterHTMLHandler } = await import(
      "mathjax-full/js/handlers/html.js"
    );
    const { AllPackages } = await import(
      "mathjax-full/js/input/tex/AllPackages.js"
    );

    const adaptor = browserAdaptor();
    RegisterHTMLHandler(adaptor);
    const belge = MJ.document(document, {
      InputJax: new TeX({ packages: AllPackages }),
      OutputJax: new SVG({ fontCache: "local" }),
    });

    return {
      tex2svg(tex: string, options: Record<string, unknown> = {}) {
        const node = belge.convert(tex, { display: false, ...options });
        return node as unknown as Element;
      },
    };
  })();
  return mathjaxYukleme;
}

/** MathJax hata ürettiyse SVG içinde data-mjx-error taşır. */
function svgHatasi(svg: Element): string | null {
  const err = svg.querySelector("[data-mjx-error]");
  if (err) return err.getAttribute("data-mjx-error") || "Geçersiz LaTeX";
  const merror = svg.querySelector("merror");
  if (merror) return merror.textContent || "Geçersiz LaTeX";
  return null;
}

/** ex birimini piksele çevirmek için — MathJax ölçüleri ex cinsinden verir. */
const EX_PX = 8;

/**
 * LaTeX'i PNG'ye çevirir.
 * @param olcek Baskı için 1'den büyük tutulur; 4 ≈ 300 dpi karşılığı.
 */
export async function renderLatexToPng(
  latex: string,
  { display = false, olcek = 4 }: { display?: boolean; olcek?: number } = {}
): Promise<RenderedFormula> {
  const tex = String(latex || "").trim();
  if (!tex) throw new LatexError("Formül boş");

  const mj = await mathjax();
  const kapsayici = mj.tex2svg(tex, { display });
  const svg = kapsayici.querySelector("svg");
  if (!svg) throw new LatexError("Formül çizilemedi");

  const hata = svgHatasi(svg);
  if (hata) throw new LatexError(hata);

  // MathJax genislik/yuksekligi "ex" biriminde verir
  const wEx = parseFloat(svg.getAttribute("width") || "0");
  const hEx = parseFloat(svg.getAttribute("height") || "0");
  if (!wEx || !hEx) throw new LatexError("Formül ölçüsü okunamadı");

  const wPx = Math.max(1, Math.round(wEx * EX_PX * olcek));
  const hPx = Math.max(1, Math.round(hEx * EX_PX * olcek));

  // Siyah metin; PDF'te zemin beyaz
  svg.setAttribute("width", String(wPx));
  svg.setAttribute("height", String(hPx));
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.style.color = "#000000";

  const kaynak = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;base64,${btoa(
    unescape(encodeURIComponent(kaynak))
  )}`;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new LatexError("Formül görsele çevrilemedi"));
    el.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new LatexError("Canvas açılamadı");
  // Seffaf birakilirsa PDF'te siyah zemin olarak cikabiliyor
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, wPx, hPx);
  ctx.drawImage(img, 0, 0, wPx, hPx);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthPx: wPx,
    heightPx: hPx,
    aspect: wPx / hPx,
    widthEx: wEx,
    heightEx: hEx,
  };
}

/** Geçerlilik denetimi — editörde anlık uyarı için (görsel üretmez). */
export async function validateLatex(latex: string): Promise<string | null> {
  const tex = String(latex || "").trim();
  if (!tex) return null;
  try {
    const mj = await mathjax();
    const kapsayici = mj.tex2svg(tex);
    const svg = kapsayici.querySelector("svg");
    if (!svg) return "Formül çizilemedi";
    return svgHatasi(svg);
  } catch (e) {
    return e instanceof Error ? e.message : "Formül çözümlenemedi";
  }
}

/**
 * Formülün PDF'teki mm ölçüsü.
 *
 * Sabit kutu yüksekliği kullanılmaz: MathJax ölçüleri "ex" cinsinden verir
 * ve 1 ex ≈ gövde harf yüksekliğinin yarısıdır. Hepsini aynı ex ölçeğiyle
 * çarpınca bütün formüllerin harf boyutu eşit çıkar.
 *
 * @param govdePt Çevresindeki metnin punto değeri (varsayılan 10 pt)
 */
export function formulaSizeMm(
  f: Pick<RenderedFormula, "widthEx" | "heightEx">,
  govdePt = 10
): { widthMm: number; heightMm: number } {
  const PT_MM = 0.352777;
  const exMm = govdePt * PT_MM * 0.5;
  return {
    widthMm: f.widthEx * exMm,
    heightMm: f.heightEx * exMm,
  };
}
