"use client";

import type { AnswerOption } from "@/types";
import { ANSWER_OPTIONS } from "@/types";

interface Props {
  value: AnswerOption | null | undefined;
  onChange: (value: AnswerOption) => void;
  label?: string;
  size?: "sm" | "md";
  required?: boolean;
}

export function AnswerKeyPicker({
  value,
  onChange,
  label = "Cevap anahtarı",
  size = "md",
  required = false,
}: Props) {
  const btn =
    size === "sm"
      ? "h-8 w-8 text-sm font-bold"
      : "h-10 w-10 text-base font-bold";

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {ANSWER_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`${btn} rounded-full border-2 transition ${
              value === opt
                ? "border-dershanem-blue bg-dershanem-blue text-white shadow"
                : "border-slate-300 bg-white text-slate-700 hover:border-dershanem-blue hover:bg-dershanem-sky"
            }`}
            aria-pressed={value === opt}
            aria-label={`Cevap ${opt}`}
          >
            {opt}
          </button>
        ))}
      </div>
      {!value && required && (
        <p className="mt-1 text-[10px] text-amber-600">
          Online test için bir şık seçin
        </p>
      )}
    </div>
  );
}
