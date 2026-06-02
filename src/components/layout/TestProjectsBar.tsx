"use client";

import { useState } from "react";
import { Plus, Save, Trash2, FolderOpen } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function TestProjectsBar() {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const projectsReady = useAppStore((s) => s.projectsReady);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const switchProject = useAppStore((s) => s.switchProject);
  const createNewProject = useAppStore((s) => s.createNewProject);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);
  const removeProject = useAppStore((s) => s.removeProject);
  const [saving, setSaving] = useState(false);

  if (!projectsReady) {
    return (
      <div className="border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
        Testler yükleniyor…
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCurrentProject();
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    const name = window.prompt("Yeni test adı (isteğe bağlı):", "");
    if (name === null) return;
    void createNewProject(name.trim() || undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
        <FolderOpen size={14} />
        Testlerim
      </span>

      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
        {projects.map((p) => (
          <div
            key={p.id}
            className={`group flex shrink-0 items-center rounded-lg border text-sm transition ${
              p.id === currentProjectId
                ? "border-dershanem-blue bg-dershanem-sky/50 font-semibold text-dershanem-navy"
                : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <button
              type="button"
              onClick={() => void switchProject(p.id)}
              className="flex items-center gap-1.5 px-3 py-1.5"
              title={`${p.draftCount} soru · ${new Date(p.updatedAt).toLocaleString("tr-TR")}`}
            >
              <span className="max-w-[140px] truncate">{p.name}</span>
              <span className="rounded bg-white/80 px-1.5 text-[10px] font-normal text-slate-500">
                {p.draftCount}
              </span>
            </button>
            {projects.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `"${p.name}" testini silmek istediğinize emin misiniz?`
                    )
                  ) {
                    void removeProject(p.id);
                  }
                }}
                className="rounded-r-lg px-1.5 py-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Testi sil"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleNew}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-dershanem-blue px-2.5 py-1.5 text-xs font-medium text-dershanem-blue hover:bg-dershanem-sky/30"
      >
        <Plus size={14} />
        Yeni test
      </button>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-dershanem-blue px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        title="Taslağı kaydet"
      >
        <Save size={14} />
        {saving ? "Kaydediliyor…" : "Kaydet"}
      </button>

      {lastSavedAt && (
        <span className="hidden text-[10px] text-slate-400 sm:inline">
          Kayıt: {new Date(lastSavedAt).toLocaleTimeString("tr-TR")}
        </span>
      )}
    </div>
  );
}
