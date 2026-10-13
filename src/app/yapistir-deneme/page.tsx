"use client";

/**
 * Yapıştırma sistemi deneme sayfası.
 * Üstte gerçek yapıştırma alanı, altta örneklerle otomatik denetim.
 */

import { useCallback, useEffect, useState } from "react";
import {
  cleanFromClipboard,
  cleanPastedHtml,
  cleanPastedText,
  runlariMetne,
} from "@/lib/paste-clean";
import type { PasteBlock, PasteResult } from "@/lib/paste-clean";
import { FIXTURES } from "@/lib/paste-clean.fixtures";

function BlokGoster({ b }: { b: PasteBlock }) {
  const etiket = (
    <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
      {b.kind}
    </span>
  );
  if (b.kind === "heading")
    return (
      <p className="text-sm font-bold text-slate-800">
        {etiket}
        {b.text}
      </p>
    );
  if (b.kind === "paragraph")
    return (
      <p className="whitespace-pre-wrap text-sm text-slate-700">
        {etiket}
        {b.runs.map((r, i) => (
          <span
            key={i}
            className={[
              r.bold ? "font-bold" : "",
              r.italic ? "italic" : "",
              r.sup ? "align-super text-[10px]" : "",
              r.sub ? "align-sub text-[10px]" : "",
            ].join(" ")}
          >
            {r.text}
          </span>
        ))}
      </p>
    );
  if (b.kind === "list")
    return (
      <div className="text-sm text-slate-700">
        {etiket}
        <ul className={b.ordered ? "ml-6 list-decimal" : "ml-6 list-disc"}>
          {b.items.map((it, i) => (
            <li key={i}>{runlariMetne(it)}</li>
          ))}
        </ul>
      </div>
    );
  if (b.kind === "question")
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
        {etiket}
        <p className="font-medium text-slate-800">{runlariMetne(b.stem)}</p>
        <ul className="mt-1 space-y-0.5">
          {b.options.map((o) => (
            <li key={o.label} className="text-slate-600">
              <b className="text-[#173b70]">{o.label})</b> {runlariMetne(o.runs)}
            </li>
          ))}
        </ul>
      </div>
    );
  if (b.kind === "table")
    return (
      <div className="text-sm">
        {etiket}
        <table className="mt-1 border-collapse text-xs">
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="border border-slate-300 px-2 py-1">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (b.kind === "formula")
    return (
      <p className="text-sm">
        {etiket}
        <code className="rounded bg-[#edf5fb] px-2 py-0.5 text-[#173b70]">{b.latex}</code>
      </p>
    );
  return (
    <p className="text-sm">
      {etiket}
      <span className="text-slate-500">{b.src.slice(0, 60)}…</span>
    </p>
  );
}

export default function YapistirDenemePage() {
  const [sonuc, setSonuc] = useState<PasteResult | null>(null);
  const [testler, setTestler] = useState<
    { ad: string; gecti: boolean; aciklama: string }[]
  >([]);

  const yapistir = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    setSonuc(cleanFromClipboard(e.clipboardData));
  }, []);

  useEffect(() => {
    const r = FIXTURES.map((f) => {
      try {
        const res = f.html ? cleanPastedHtml(f.html) : cleanPastedText(f.text || "");
        const d = f.bekle(res);
        return { ad: f.ad, gecti: d.gecti, aciklama: d.aciklama };
      } catch (err) {
        return {
          ad: f.ad,
          gecti: false,
          aciklama: err instanceof Error ? err.message : String(err),
        };
      }
    });
    setTestler(r);
  }, []);

  const gecen = testler.filter((t) => t.gecti).length;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Yapıştırma sistemi</h1>
          <p className="mt-1 text-sm text-slate-600">
            Word, Google Dokümanlar, PDF veya web sayfasından kopyaladığınız
            içeriği aşağıdaki alana yapıştırın.
          </p>
          <div
            onPaste={yapistir}
            contentEditable
            suppressContentEditableWarning
            data-test="yapistirma-alani"
            className="mt-3 min-h-[90px] rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 text-sm text-slate-400 outline-none focus:border-[#173b70]"
          >
            Buraya yapıştırın…
          </div>

          {sonuc && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Çözümlenen içerik — {sonuc.blocks.length} blok
              </p>
              {sonuc.warnings.map((w, i) => (
                <p key={i} className="mb-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {w}
                </p>
              ))}
              <div className="space-y-2">
                {sonuc.blocks.map((b, i) => (
                  <BlokGoster key={i} b={b} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-800">
            Otomatik denetim —{" "}
            <span data-test="test-ozeti">
              {gecen}/{testler.length} geçti
            </span>
          </h2>
          <ul className="mt-2 space-y-1">
            {testler.map((t) => (
              <li
                key={t.ad}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  t.gecti
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
              >
                <span className="font-semibold">{t.gecti ? "✓" : "✗"} {t.ad}</span>
                <span className="ml-2 opacity-70">{t.aciklama}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
