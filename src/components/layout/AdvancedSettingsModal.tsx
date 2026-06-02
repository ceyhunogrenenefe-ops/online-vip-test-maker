"use client";

import { useAppStore } from "@/store/useAppStore";

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
            Akıllı soru yerleşimi uygula
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={paperSettings.watermark}
              onChange={(e) =>
                setPaperSettings({ watermark: e.target.checked })
              }
            />
            Filigran ekle
          </label>

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
              onChange={(e) =>
                setPaperSettings({
                  columns: Number(e.target.value) as 1 | 2,
                })
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block font-medium">
              Kenar boşluğu (cm)
            </span>
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
