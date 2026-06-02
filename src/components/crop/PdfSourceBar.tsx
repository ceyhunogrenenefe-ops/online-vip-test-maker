"use client";

import { ChevronDown, FilePlus, X } from "lucide-react";

export interface PdfSession {
  id: string;
  name: string;
  pageCount: number;
}

interface Props {
  sessions: PdfSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove?: (id: string) => void;
}

export function PdfSourceBar({
  sessions,
  activeId,
  onSelect,
  onAdd,
  onRemove,
}: Props) {
  if (sessions.length === 0) return null;

  const active = sessions.find((s) => s.id === activeId);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-xs font-medium text-slate-500">PDF:</span>
      <div className="relative min-w-[200px] flex-1">
        <select
          value={activeId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 py-2 pl-3 pr-8 text-sm font-medium"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.pageCount} sayfa)
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
      {active && onRemove && sessions.length > 1 && (
        <button
          type="button"
          onClick={() => onRemove(active.id)}
          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Listeden kaldır"
        >
          <X size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 rounded-lg border border-dershanem-blue px-3 py-2 text-sm font-medium text-dershanem-blue hover:bg-dershanem-sky"
      >
        <FilePlus size={16} />
        PDF Ekle
      </button>
    </div>
  );
}
