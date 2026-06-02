"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { OpticalFormChoiceCount } from "@/types";
import { readFileAsDataUrl } from "@/lib/crop";

interface Props {
  onClose: () => void;
  onConfirm: () => void;
}

const PRESETS: { count: OpticalFormChoiceCount; label: string }[] = [
  { count: 3, label: "3 seçenekli optik form (A–C)" },
  { count: 4, label: "4 seçenekli optik form (A–D)" },
  { count: 5, label: "5 seçenekli optik form (A–E)" },
];

export function OpticalFormSelectModal({ onClose, onConfirm }: Props) {
  const paperSettings = useAppStore((s) => s.paperSettings);
  const setPaperSettings = useAppStore((s) => s.setPaperSettings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"builtin" | "custom">(
    paperSettings.opticalCustomImage ? "custom" : "builtin"
  );
  const [choiceCount, setChoiceCount] = useState<OpticalFormChoiceCount>(
    paperSettings.opticalChoiceCount ?? 5
  );
  const [formId, setFormId] = useState(paperSettings.opticalFormId ?? "");
  const [customName, setCustomName] = useState(
    paperSettings.opticalCustomImage ? "Yüklü form" : ""
  );

  const handleUpload = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    setMode("custom");
    setCustomName(file.name);
    setPaperSettings({ opticalCustomImage: dataUrl });
  };

  const handleOk = () => {
    setPaperSettings({
      includeOpticalForm: true,
      opticalChoiceCount: choiceCount,
      opticalFormId: formId.trim() || undefined,
      opticalCustomImage:
        mode === "custom" ? paperSettings.opticalCustomImage : undefined,
      opticalPlacement: "sidebar",
      columns: paperSettings.columns < 2 ? 2 : paperSettings.columns,
      columnDivider: true,
    });
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    setPaperSettings({ includeOpticalForm: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-center text-lg font-bold text-dershanem-navy">
          OPTİK FORM SEÇİNİZ
        </h2>

        <div className="space-y-2 text-sm">
          {PRESETS.map((p) => (
            <label
              key={p.count}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                mode === "builtin" && choiceCount === p.count
                  ? "border-dershanem-blue bg-dershanem-sky/40"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="optic"
                checked={mode === "builtin" && choiceCount === p.count}
                onChange={() => {
                  setMode("builtin");
                  setChoiceCount(p.count);
                }}
              />
              {p.label}
            </label>
          ))}

          <label
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
              mode === "custom"
                ? "border-dershanem-blue bg-dershanem-sky/40"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="optic"
              checked={mode === "custom"}
              onChange={() => setMode("custom")}
            />
            <span className="flex-1">Kişisel optik form yükle</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-white"
            >
              <Upload size={14} />
              Dosya
            </button>
          </label>
          {mode === "custom" && customName && (
            <p className="ml-8 text-xs text-slate-500">{customName}</p>
          )}
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Form ID (isteğe bağlı)</span>
          <input
            type="text"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            placeholder="Boş bırakılırsa otomatik üretilir"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <p className="mt-3 text-xs text-slate-500">
          Optik form kağıdın sağ sütununda görünür; sorular solda yer alır.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
            e.target.value = "";
          }}
        />

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleOk}
            disabled={mode === "custom" && !paperSettings.opticalCustomImage}
            className="rounded-lg bg-dershanem-blue px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
