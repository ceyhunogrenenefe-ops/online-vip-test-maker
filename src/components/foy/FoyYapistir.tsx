"use client";

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { cleanFromClipboard, type PasteBlock } from "@/lib/paste-clean";

/**
 * Word / Google Docs / PDF / web içeriğini föye alır.
 *
 * Yapıştırma panoyu OLDUĞU GİBİ okur: tarayıcı HTML sunuyorsa biçim
 * (kalın, üst/alt simge, tablo, MathML formülü) korunur, yoksa düz
 * metinden yapı çıkarılır. Dönüşüm kullanıcı onayına sunulur —
 * doğrudan föye yazılmaz.
 */
export function FoyYapistir({
  onEkle,
}: {
  onEkle: (bloklar: PasteBlock[]) => void;
}) {
  const [bekleyen, setBekleyen] = useState<PasteBlock[] | null>(null);
  const [uyarilar, setUyarilar] = useState<string[]>([]);

  return (
    <div className="space-y-2">
      <div
        contentEditable
        suppressContentEditableWarning
        onPaste={(e) => {
          e.preventDefault();
          const r = cleanFromClipboard(e.clipboardData);
          setBekleyen(r.blocks);
          setUyarilar(r.warnings);
        }}
        className="min-h-[90px] rounded-lg border-2 border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600 outline-none focus:border-dershanem-navy"
        data-test="foy-yapistir-alani"
      >
        Word, Google Docs, PDF veya web sayfasından kopyaladığınız içeriği buraya yapıştırın
        (Ctrl+V).
      </div>

      {uyarilar.length > 0 ? (
        <ul className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          {uyarilar.map((u, i) => (
            <li key={i}>• {u}</li>
          ))}
        </ul>
      ) : null}

      {bekleyen ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="mb-2 text-xs font-semibold text-slate-700">
            {bekleyen.length} parça tanındı — föye eklemek için onaylayın
          </p>
          <ul className="mb-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
            {bekleyen.map((b, i) => (
              <li key={i} className="truncate">
                <span className="mr-1 rounded bg-slate-200 px-1 font-mono text-[10px]">
                  {b.kind}
                </span>
                {ozet(b)}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onEkle(bekleyen);
                setBekleyen(null);
                setUyarilar([]);
              }}
              className="flex items-center gap-1 rounded-lg bg-dershanem-navy px-3 py-1.5 text-xs font-semibold text-white"
              data-test="foy-yapistir-onayla"
            >
              <ClipboardPaste size={14} />
              Föye ekle
            </button>
            <button
              type="button"
              onClick={() => {
                setBekleyen(null);
                setUyarilar([]);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ozet(b: PasteBlock): string {
  if (b.kind === "heading") return b.text;
  if (b.kind === "paragraph") return b.runs.map((r) => r.text).join("");
  if (b.kind === "list") return `${b.items.length} madde`;
  if (b.kind === "question") return b.stem.map((r) => r.text).join("");
  if (b.kind === "table") return `${b.rows.length} satır`;
  if (b.kind === "formula") return b.latex;
  return "görsel";
}
