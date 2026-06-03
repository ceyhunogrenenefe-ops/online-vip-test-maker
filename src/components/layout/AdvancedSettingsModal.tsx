"use client";

import { useRef } from "react";
import { Upload, Trash2, ImageIcon } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { ColumnCount } from "@/types";
import { readFileAsDataUrl } from "@/lib/crop";

const THEME_COLORS = [
  "#f59e0b",
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#db2777",
  "#ca8a04",
  "#0891b2",
  "#dc2626",
  "#64748b",
];

const COLUMN_OPTIONS: ColumnCount[] = [1, 2, 3, 4, 5, 6];

interface Props {
  onClose: () => void;
}

export function AdvancedSettingsModal({ onClose }: Props) {
  const paperSettings = useAppStore((s) => s.paperSettings);
  const setPaperSettings = useAppStore((s) => s.setPaperSettings);
  const logoRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPaperSettings({
      watermarkLogoImage: dataUrl,
      watermarkType: "logo",
      watermark: true,
    });
  };

  const opacityPct = Math.round(paperSettings.watermarkOpacity * 100);
  const watermarkType = paperSettings.watermarkType ?? "text";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-dershanem-navy">
          Gelişmiş Ayarlar
        </h2>

        <div className="space-y-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={paperSettings.smartPlacement}
              onChange={(e) =>
                setPaperSettings({ smartPlacement: e.target.checked })
              }
            />
            Akıllı soru yerleşimi (tasarruflu PDF)
          </label>
          <p className="text-xs text-slate-500 -mt-2 ml-6">
            Açıkken PDF soru sırasını otomatik optimize eder. Kapalıyken panelde
            sürükleyerek sırayı siz belirlersiniz.
          </p>

          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <p className="font-medium text-dershanem-navy">Logo & filigran</p>

            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Logo</p>
              {paperSettings.watermarkLogoImage ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={paperSettings.watermarkLogoImage}
                    alt="Logo önizleme"
                    className="h-14 max-w-[120px] object-contain"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPaperSettings({
                        watermarkLogoImage: undefined,
                        watermarkType: "text",
                      })
                    }
                    className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                  >
                    <Trash2 size={14} />
                    Kaldır
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Henüz logo yüklenmedi.</p>
              )}
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dershanem-blue py-2 text-xs font-medium text-dershanem-blue hover:bg-dershanem-sky/40"
              >
                <Upload size={14} />
                Logo yükle (PNG, JPG)
              </button>
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLogoUpload(f);
                  e.target.value = "";
                }}
              />
            </div>

            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={paperSettings.watermark}
                onChange={(e) =>
                  setPaperSettings({ watermark: e.target.checked })
                }
              />
              Filigran / arka plan ekle
            </label>

            {paperSettings.watermark && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!paperSettings.watermarkLogoImage}
                    onClick={() => setPaperSettings({ watermarkType: "logo" })}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      watermarkType === "logo"
                        ? "border-dershanem-blue bg-dershanem-sky/50 text-dershanem-navy"
                        : "border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    }`}
                  >
                    <ImageIcon size={14} />
                    Logo arka plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSettings({ watermarkType: "text" })}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      watermarkType === "text"
                        ? "border-dershanem-blue bg-dershanem-sky/50 text-dershanem-navy"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Metin filigran
                  </button>
                </div>

                {watermarkType === "text" && (
                  <input
                    type="text"
                    value={paperSettings.watermarkText}
                    onChange={(e) =>
                      setPaperSettings({ watermarkText: e.target.value })
                    }
                    placeholder="Filigran metni"
                    className="w-full rounded border px-3 py-2"
                  />
                )}

                {watermarkType === "logo" && paperSettings.watermarkLogoImage && (
                  <label className="block">
                    Logo boyutu ({paperSettings.watermarkLogoScale ?? 45}%)
                    <input
                      type="range"
                      min={20}
                      max={70}
                      step={1}
                      value={paperSettings.watermarkLogoScale ?? 45}
                      onChange={(e) =>
                        setPaperSettings({
                          watermarkLogoScale: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                )}

                <label className="block">
                  Şeffaflık ({opacityPct}%)
                  <input
                    type="range"
                    min={3}
                    max={55}
                    step={1}
                    value={opacityPct}
                    onChange={(e) =>
                      setPaperSettings({
                        watermarkOpacity: Number(e.target.value) / 100,
                      })
                    }
                    className="mt-1 w-full"
                  />
                </label>

                <div
                  className="relative h-28 overflow-hidden rounded border bg-white"
                  aria-hidden
                >
                  {watermarkType === "logo" && paperSettings.watermarkLogoImage ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ opacity: paperSettings.watermarkOpacity }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={paperSettings.watermarkLogoImage}
                        alt=""
                        className="max-h-[70%] max-w-[70%] object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 p-2"
                      style={{ opacity: paperSettings.watermarkOpacity }}
                    >
                      {Array.from({ length: 4 }).map((_, i) => (
                        <span
                          key={i}
                          className="text-sm font-bold text-slate-400"
                          style={{ transform: "rotate(-25deg)" }}
                        >
                          {paperSettings.watermarkText || "Dershanem"}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="absolute bottom-1 right-2 text-[10px] text-slate-400">
                    Önizleme
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 font-medium">Sayfa tasarım rengi</p>
            <div className="flex flex-wrap gap-2">
              {THEME_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPaperSettings({ themeColor: c })}
                  className={`h-8 w-8 rounded border-2 ${
                    paperSettings.themeColor === c
                      ? "border-slate-800"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <label>
            <span className="mb-1 block font-medium">Kağıt boyutu</span>
            <select
              value={paperSettings.paperSize}
              onChange={(e) =>
                setPaperSettings({
                  paperSize: e.target.value as "A4" | "A3" | "custom",
                })
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value="A4">A4 (210 × 297 mm)</option>
              <option value="A3">A3 (297 × 420 mm)</option>
              <option value="custom">Özel boyut</option>
            </select>
          </label>

          {paperSettings.paperSize === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Genişlik (mm)
                </span>
                <input
                  type="number"
                  min={80}
                  max={600}
                  step={1}
                  value={paperSettings.customPaperWidthMm ?? 210}
                  onChange={(e) =>
                    setPaperSettings({
                      customPaperWidthMm: Math.min(
                        600,
                        Math.max(80, Number(e.target.value) || 210)
                      ),
                    })
                  }
                  className="w-full rounded border px-3 py-2"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Yükseklik (mm)
                </span>
                <input
                  type="number"
                  min={80}
                  max={900}
                  step={1}
                  value={paperSettings.customPaperHeightMm ?? 297}
                  onChange={(e) =>
                    setPaperSettings({
                      customPaperHeightMm: Math.min(
                        900,
                        Math.max(80, Number(e.target.value) || 297)
                      ),
                    })
                  }
                  className="w-full rounded border px-3 py-2"
                />
              </label>
            </div>
          )}

          <label>
            <span className="mb-1 block font-medium">Yönlendirme</span>
            <select
              value={paperSettings.orientation}
              onChange={(e) =>
                setPaperSettings({
                  orientation: e.target.value as "portrait" | "landscape",
                })
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value="portrait">Dikey</option>
              <option value="landscape">Yatay</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block font-medium">Sütun sayısı</span>
            <select
              value={paperSettings.columns}
              onChange={(e) => {
                const columns = Number(e.target.value) as ColumnCount;
                setPaperSettings({
                  columns,
                  columnDivider: columns >= 2,
                });
              }}
              className="w-full rounded border px-3 py-2"
            >
              {COLUMN_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} sütun
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block font-medium">
              Soru ölçeği ({paperSettings.questionScalePercent ?? 92}%)
            </span>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={paperSettings.questionScalePercent ?? 92}
              onChange={(e) =>
                setPaperSettings({
                  questionScalePercent: Number(e.target.value),
                })
              }
              className="w-full"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={paperSettings.uniformQuestionSize !== false}
              onChange={(e) =>
                setPaperSettings({ uniformQuestionSize: e.target.checked })
              }
            />
            Soruları eşit boyutta göster (önerilen)
          </label>
          <p className="text-xs text-slate-500 -mt-2 ml-6">
            Açıkken tüm sorular aynı sütun genişliğine hizalanır; küçük/büyük
            farkı azalır.
          </p>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={paperSettings.strictColumnFit !== false}
              onChange={(e) =>
                setPaperSettings({ strictColumnFit: e.target.checked })
              }
            />
            Soruları sütun içinde tut (taşmayı önle)
          </label>

          {paperSettings.columns >= 2 && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={paperSettings.columnDivider}
                onChange={(e) =>
                  setPaperSettings({ columnDivider: e.target.checked })
                }
              />
              Sütunlar arası dikey çizgi
            </label>
          )}

          {paperSettings.includeOpticalForm && (
            <label>
              <span className="mb-1 block font-medium">Optik form konumu</span>
              <select
                value={
                  paperSettings.opticalPlacement === "sidebar"
                    ? "bottom"
                    : paperSettings.opticalPlacement ?? "bottom"
                }
                onChange={(e) =>
                  setPaperSettings({
                    opticalPlacement: e.target.value as
                      | "bottom"
                      | "separate",
                  })
                }
                className="w-full rounded border px-3 py-2"
              >
                <option value="bottom">Sayfa altında (önerilen)</option>
                <option value="separate">Ayrı sayfa</option>
              </select>
            </label>
          )}

          <label>
            <span className="mb-1 block font-medium">Kenar boşluğu (cm)</span>
            <select
              value={paperSettings.marginCm}
              onChange={(e) =>
                setPaperSettings({ marginCm: Number(e.target.value) })
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value={1}>1 cm</option>
              <option value={1.5}>1,5 cm (Normal)</option>
              <option value={2}>2 cm</option>
              <option value={2.5}>2,5 cm</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-dershanem-blue py-2.5 font-semibold text-white hover:bg-blue-700"
        >
          Tamam
        </button>
      </div>
    </div>
  );
}
