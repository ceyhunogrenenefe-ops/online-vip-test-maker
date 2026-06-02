"use client";

import { useAppStore } from "@/store/useAppStore";
import type { ColumnCount } from "@/types";

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
            Açıkken PDF soru sırasını otomatik optimize eder; panel sırası
            kullanılmaz. Kapalıyken panelde sürükleyerek sırayı siz belirlersiniz.
          </p>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={paperSettings.watermark}
                onChange={(e) =>
                  setPaperSettings({ watermark: e.target.checked })
                }
              />
              Filigran ekle
            </label>
            {paperSettings.watermark && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={paperSettings.watermarkText}
                  onChange={(e) =>
                    setPaperSettings({ watermarkText: e.target.value })
                  }
                  placeholder="Filigran metni"
                  className="w-full rounded border px-3 py-2"
                />
                <label className="block">
                  Saydamlık ({Math.round(paperSettings.watermarkOpacity * 100)}%)
                  <input
                    type="range"
                    min={0.05}
                    max={0.3}
                    step={0.01}
                    value={paperSettings.watermarkOpacity}
                    onChange={(e) =>
                      setPaperSettings({
                        watermarkOpacity: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <div
                  className="relative h-24 overflow-hidden rounded border bg-white"
                  aria-hidden
                >
                  <div
                    className="absolute inset-0 flex flex-wrap items-center justify-center gap-4 p-2"
                    style={{ opacity: paperSettings.watermarkOpacity }}
                  >
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span
                        key={i}
                        className="text-lg font-bold text-slate-400"
                        style={{ transform: "rotate(-25deg)" }}
                      >
                        {paperSettings.watermarkText || "Dershanem"}
                      </span>
                    ))}
                  </div>
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
                  paperSize: e.target.value as "A4" | "A3",
                })
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value="A4">A4 (210 × 297 mm)</option>
              <option value="A3">A3 (297 × 420 mm)</option>
            </select>
          </label>

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
            <p className="mt-1 text-xs text-slate-500">
              Sütundan taşma varsa yüzdeyi düşürün (ör. %75–85).
            </p>
          </label>

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
