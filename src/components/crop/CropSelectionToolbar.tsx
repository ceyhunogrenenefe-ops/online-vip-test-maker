"use client";

import { Loader2 } from "lucide-react";
import type { AnswerOption } from "@/types";
import { ANSWER_OPTIONS } from "@/types";

interface Props {
  left: number;
  top: number;
  width: number;
  value: AnswerOption | null;
  onChange: (v: AnswerOption) => void;
  onConfirm: () => void;
  saving: boolean;
}

export function CropSelectionToolbar({
  left,
  top,
  width,
  value,
  onChange,
  onConfirm,
  saving,
}: Props) {
  return (
    <div
      className="absolute z-20 flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-sm"
      style={{ left, top, minWidth: Math.min(width, 280) }}
    >
      {ANSWER_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`h-8 min-w-[2rem] rounded px-2 text-sm font-bold transition ${
            value === opt
              ? "bg-dershanem-blue text-white"
              : "bg-sky-100 text-dershanem-navy hover:bg-sky-200"
          }`}
        >
          {opt}
        </button>
      ))}
      <button
        type="button"
        onClick={onConfirm}
        disabled={saving}
        className="ml-auto flex min-w-[4.5rem] items-center justify-center gap-1 rounded bg-dershanem-blue px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
        Tamam
      </button>
    </div>
  );
}
