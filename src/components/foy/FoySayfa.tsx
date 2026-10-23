"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { blokEtiketi, kazanimSatiri, kazanimYaz } from "@/lib/foy-icerik";
import { kapakSatirlari, type FoyKunye } from "@/lib/foy-kunye";
import type { FoyOge } from "@/lib/foy-baski";
import type { DocBlock, GorselRol } from "@/lib/pdf-blocks";
import { videoLinkiGecerli, videoQrDataUrl } from "@/lib/video-qr";
import { FoyGorselSilgi } from "./FoyGorselSilgi";
import { FoyKazanimSec } from "./FoyKazanimSec";

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
  onSoruAyar,
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
  onSoruAyar: (i: number, kismi: { cozumSatir?: number; videoUrl?: string }) => void;
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
                draggable={!(secili === i && o.blok.kind === "image")}
                onDragStart={(e) => {
                  if (secili === i && o.blok.kind === "image") {
                    e.preventDefault();
                    return;
                  }
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
                {secili !== i && kazanimSatiri(o.blok) ? (
                  <p
                    className="mb-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold leading-snug text-amber-950"
                    data-test="foy-soru-kazanim"
                  >
                    {kazanimSatiri(o.blok)}
                  </p>
                ) : null}
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
                {o.blok.kind === "image" &&
                o.blok.rol === "soru" &&
                o.blok.no &&
                o.videoUrl &&
                videoLinkiGecerli(o.videoUrl) ? (
                  <div className="mt-1 flex items-start gap-1">
                    <div className="flex w-12 shrink-0 flex-col">
                      <span className="rounded-br bg-[#173b70] px-1.5 py-0.5 text-center text-xs font-bold text-white">
                        {o.blok.no}
                      </span>
                      <SoruKarekod url={o.videoUrl} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {secili === i ? (
                        <FoyGorselSilgi
                          dataUrl={o.blok.dataUrl}
                          onUygula={(dataUrl) => {
                            if (o.blok.kind !== "image") return;
                            onBlok(i, { ...o.blok, dataUrl });
                          }}
                        />
                      ) : (
                        <img src={o.blok.dataUrl} alt="" className="max-h-40 w-full object-contain" />
                      )}
                    </div>
                  </div>
                ) : o.blok.kind === "image" ? (
                  <div className="relative mt-1">
                    {o.blok.rol === "soru" && o.blok.no ? (
                      <span className="pointer-events-none absolute left-0 top-0 rounded-br bg-[#173b70] px-1.5 py-0.5 text-xs font-bold text-white">
                        {o.blok.no}
                      </span>
                    ) : o.blok.rol === "aciklama" ? (
                      <span className="pointer-events-none absolute left-0 top-0 rounded-br bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Açıklama
                      </span>
                    ) : o.blok.rol === "cozum" ? (
                      <span className="pointer-events-none absolute left-0 top-0 rounded-br bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Çözüm
                      </span>
                    ) : null}
                    {secili === i ? (
                      <FoyGorselSilgi
                        dataUrl={o.blok.dataUrl}
                        onUygula={(dataUrl) => {
                          if (o.blok.kind !== "image") return;
                          onBlok(i, { ...o.blok, dataUrl });
                        }}
                      />
                    ) : (
                      <img src={o.blok.dataUrl} alt="" className="max-h-40 w-full object-contain" />
                    )}
                  </div>
                ) : null}
                {secili === i ? (
                  <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                    {o.blok.kind === "question" || (o.blok.kind === "image" && o.blok.rol === "soru") ? (
                      <FoyKazanimSec
                        sinif={kunye.sinif}
                        brans={kunye.brans}
                        yazili={kunye.yazili}
                        value={o.blok.kazanim || ""}
                        onChange={(kazanim) => onBlok(i, kazanimYaz(o.blok, kazanim))}
                        sade
                      />
                    ) : null}
                    {o.blok.kind === "question" && o.videoUrl && videoLinkiGecerli(o.videoUrl) ? (
                      <div className="flex items-start gap-1">
                        <div className="flex w-12 shrink-0 flex-col">
                          <span className="rounded bg-[#173b70] px-1.5 py-0.5 text-center text-xs font-bold text-white">
                            {o.blok.no ?? "?"}
                          </span>
                          <SoruKarekod url={o.videoUrl} />
                        </div>
                        <textarea
                          value={metinOku(o.blok)}
                          onChange={(e) => onBlok(i, metinYaz(o.blok, e.target.value))}
                          rows={3}
                          className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
                        />
                      </div>
                    ) : o.blok.kind === "question" || o.blok.kind === "paragraph" || o.blok.kind === "sectionTitle" ? (
                      <textarea
                        value={metinOku(o.blok)}
                        onChange={(e) => onBlok(i, metinYaz(o.blok, e.target.value))}
                        rows={3}
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                    ) : null}
                    {o.blok.kind === "image" ? (
                      <>
                        <label className="block text-[11px] text-slate-500">
                          Bu parça
                          <select
                            value={o.blok.rol ?? ""}
                            aria-label="Parça türü"
                            data-test="foy-gorsel-rol"
                            onChange={(e) => {
                              if (o.blok.kind !== "image") return;
                              const secim = e.target.value;
                              if (secim !== "soru" && secim !== "aciklama" && secim !== "cozum") {
                                const { rol: _rol, no: _no, ...kalan } = o.blok;
                                onBlok(i, kalan);
                                return;
                              }
                              onBlok(i, { ...o.blok, rol: secim as GorselRol });
                            }}
                            className="mt-0.5 w-full rounded border px-2 py-1 text-xs"
                          >
                            <option value="">Görsel</option>
                            <option value="soru">Soru</option>
                            <option value="aciklama">Açıklama</option>
                            <option value="cozum">Çözüm</option>
                          </select>
                        </label>
                        <label className="block text-[11px] text-slate-500">
                          Görsel yüksekliği ({o.blok.maxHeightMm ?? 60} mm)
                          <input
                            type="range"
                            min={20}
                            max={140}
                            value={o.blok.maxHeightMm ?? 60}
                            onChange={(e) => {
                              if (o.blok.kind !== "image") return;
                              onBlok(i, { ...o.blok, maxHeightMm: Number(e.target.value) });
                            }}
                            className="w-full"
                          />
                        </label>
                      </>
                    ) : null}
                    {o.blok.kind === "question" || o.blok.kind === "image" ? (
                      <label className="flex items-start gap-2 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={o.blok.tamGenislik === true}
                          data-test="foy-tam-genislik"
                          onChange={(e) => onBlok(i, { ...o.blok, tamGenislik: e.target.checked || undefined })}
                        />
                        <span>
                          Sayfa genişliğinde
                          <span className="mt-0.5 block text-slate-500">
                            Bu parça tek başına sayfanın tamamını kullanır. Diğer sorular iki sütunda kalır.
                          </span>
                        </span>
                      </label>
                    ) : null}
                    {o.blok.kind === "question" || (o.blok.kind === "image" && o.blok.rol === "soru") ? (
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
                        <label className="col-span-2 text-[11px] text-slate-500">
                          Bu sorunun altındaki boşluk (satır)
                          <input
                            type="number"
                            min={0}
                            max={20}
                            placeholder="Sayfa tasarımı"
                            value={o.cozumSatir ?? ""}
                            data-test="foy-soru-bosluk"
                            onChange={(e) => {
                              const ham = e.target.value;
                              onSoruAyar(i, {
                                cozumSatir: ham === "" ? undefined : Math.min(20, Math.max(0, Math.round(Number(ham)) || 0)),
                              });
                            }}
                            className="mt-0.5 w-full rounded border px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="col-span-2 text-[11px] text-slate-500">
                          Video çözüm linki
                          <input
                            value={o.videoUrl || ""}
                            placeholder="https://..."
                            data-test="foy-video-link"
                            onChange={(e) => onSoruAyar(i, { videoUrl: e.target.value })}
                            className="mt-0.5 w-full rounded border px-2 py-1 text-xs"
                          />
                        </label>
                        {o.videoUrl && !videoLinkiGecerli(o.videoUrl) ? (
                          <p className="col-span-2 text-[11px] text-red-600">Link http veya https ile başlamalı.</p>
                        ) : o.videoUrl ? (
                          <p className="col-span-2 text-[11px] text-slate-500">
                            Karekod soru numarasının altında basılır. Link yazılmaz.
                          </p>
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

function SoruKarekod({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const gecerli = videoLinkiGecerli(url);
    if (!gecerli) {
      setSrc(null);
      return;
    }
    let iptal = false;
    videoQrDataUrl(gecerli)
      .then((s) => {
        if (!iptal) setSrc(s);
      })
      .catch(() => {
        if (!iptal) setSrc(null);
      });
    return () => {
      iptal = true;
    };
  }, [url]);
  if (!src) return null;
  return <img src={src} alt="Video çözüm karekodu" className="mt-0.5 h-11 w-11 bg-white" />;
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
