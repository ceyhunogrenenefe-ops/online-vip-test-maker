"use client";

import { ChevronDown, FilePlus, Settings, X } from "lucide-react";

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
  onSettings?: () => void;
  onClose?: () => void;
}

export function PdfSourceBar({
  sessions,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  onSettings,
  onClose,
}: Props) {
  if (sessions.length === 0) return null;

  const active = sessions.find((s) => s.id === activeId);
  const displayName = active?.name ?? "PDF seçin";

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
      {onSettings && (
        <button
          type="button"
          onClick={onSettings}
          className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-dershanem-blue"
          title="Kırpma ayarları"
        >
          <Settings size={20} />
        </button>
      )}

      <div className="relative min-w-0 flex-1">
        <select
          value={activeId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none truncate rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm font-medium text-slate-800"
          title={displayName}
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="flex shrink-0 items-center justify-center rounded-lg bg-dershanem-blue p-2 text-white hover:bg-blue-700"
        title="PDF ekle"
      >
        <FilePlus size={18} />
      </button>

      {active && onRemove && sessions.length > 1 && (
        <button
          type="button"
          onClick={() => onRemove(active.id)}
          className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Kaldır"
        >
          <X size={18} />
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Oturumu kapat"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
