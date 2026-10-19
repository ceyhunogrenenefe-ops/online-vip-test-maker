"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { blokEtiketi } from "@/lib/foy-icerik";
import { kapakSatirlari, type FoyKunye } from "@/lib/foy-kunye";
import type { FoyOge } from "@/lib/foy-baski";
import type { DocBlock } from "@/lib/pdf-blocks";

export function FoySayfa({
  kunye,
  ogeler,
  secili,
  prova,
  onSec,
  onTasi,
  onSil,
  onBlok,
  onCevap,
  onPuan,
  onSayfaSonu,
  onSutunSonu,
  onBirak,
}: {
  kunye: FoyKunye;
  ogeler: FoyOge[];
  secili: number;
  prova: boolean;
  onSec: (i: number) => void;
  onTasi: (i: number, yon: -1 | 1) => void;
  onSil: (i: number) => void;
  onBlok: (i: number, blok: DocBlock) => void;
  onCevap: (i: number, cevap: string, cozum: string) => void;
  onPuan: (i: number, puan: number) => void;
  onSayfaSonu: () => void;
  onSutunSonu: () => void;
  onBirak: (kaynak: number, hedef: number) => void;
}) {
  const kapak = kapakSatirlari(kunye);
  const toplamPuan = ogeler.reduce((t, o) => t + (o.puan || 0), 0);

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={onSayfaSonu} className="rounded border px-2 py-1 text-xs">
          Sayfa sonu
        </button>
        <button type="button" onClick={onSutunSonu} className="rounded border px-2 py-1 text-xs">
          Sütun sonu
        </button>
        {prova ? (
          <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
            Prova puanı: {toplamPuan} / 100
          </span>
        ) : null}
      </div>
      <article className="min-h-[680px] rounded-sm bg-white px-6 py-5 shadow-md">
        <header className="mb-4 border-b-2 border-red-600 pb-2 text-center">
          {kapak.map((s, i) => (
            <div
              key={s}
              className={i === 0 ? "text-sm font-bold tracking-wide text-[#173b70]" : "text-[11px] text-slate-600"}
            >
              {s}
            </div>
          ))}
        </header>
        {ogeler.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            Soldaki araçlarla soru ekleyin. Bu sayfa A4 düzeninin çalışma kopyasıdır.
          </p>
        ) : (
          <ul className="space-y-2" data-test="foy-blok-listesi">
            {ogeler.map((o, i) => (
              <li
                key={o.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(i));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const kaynak = Number(e.dataTransfer.getData("text/plain"));
                  if (Number.isFinite(kaynak)) onBirak(kaynak, i);
                }}
                onClick={() => onSec(i)}
                className={`rounded border px-2 py-1.5 ${
                  secili === i ? "border-[#173b70] bg-slate-50" : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-5 text-center text-[10px] text-slate-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-xs">{blokEtiketi(o.blok)}</span>
                  <button type="button" aria-label="Yukarı taşı" onClick={() => onTasi(i, -1)} disabled={i === 0}>
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Aşağı taşı"
                    onClick={() => onTasi(i, 1)}
                    disabled={i === ogeler.length - 1}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" aria-label="Sil" onClick={() => onSil(i)} className="text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
                {o.blok.kind === "image" ? (
                  <img src={o.blok.dataUrl} alt="" className="mt-1 max-h-40 w-full object-contain" />
                ) : null}
                {secili === i ? (
                  <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                    {o.blok.kind === "question" || o.blok.kind === "paragraph" || o.blok.kind === "sectionTitle" ? (
                      <textarea
                        value={metinOku(o.blok)}
                        onChange={(e) => onBlok(i, metinYaz(o.blok, e.target.value))}
                        rows={3}
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                    ) : null}
                    {o.blok.kind === "image" ? (
                      <label className="block text-[11px] text-slate-500">
                        Görsel yüksekliği ({o.blok.maxHeightMm ?? 60} mm)
                        <input
                          type="range"
                          min={20}
                          max={140}
                          value={o.blok.maxHeightMm ?? 60}
                          onChange={(e) =>
                            onBlok(i, {
                              kind: "image",
                              dataUrl: o.blok.kind === "image" ? o.blok.dataUrl : "",
                              aspect: o.blok.kind === "image" ? o.blok.aspect : 1,
                              maxHeightMm: Number(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                      </label>
                    ) : null}
                    {o.blok.kind === "question" ? (
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          value={o.cevap || ""}
                          onChange={(e) => onCevap(i, e.target.value, o.cozum || "")}
                          placeholder="Cevap (öğretmen sürümü)"
                          className="rounded border px-2 py-1 text-xs"
                        />
                        <input
                          value={o.cozum || ""}
                          onChange={(e) => onCevap(i, o.cevap || "", e.target.value)}
                          placeholder="Kısa çözüm"
                          className="rounded border px-2 py-1 text-xs"
                        />
                        {prova ? (
                          <label className="col-span-2 text-[11px]">
                            Puan
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={o.puan ?? 0}
                              onChange={(e) => onPuan(i, Number(e.target.value))}
                              className="ml-1 w-16 rounded border px-1 py-0.5"
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

function metinOku(b: DocBlock): string {
  if (b.kind === "sectionTitle") return b.text;
  if (b.kind === "paragraph") return b.runs.map((r) => r.text).join("");
  if (b.kind === "question") return b.stem.map((r) => r.text).join("");
  return "";
}

function metinYaz(b: DocBlock, text: string): DocBlock {
  if (b.kind === "sectionTitle") return { ...b, text };
  if (b.kind === "paragraph") return { ...b, runs: [{ text }] };
  if (b.kind === "question") return { ...b, stem: [{ text }] };
  return b;
}
