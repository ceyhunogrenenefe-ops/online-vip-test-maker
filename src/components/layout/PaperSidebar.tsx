"use client";

import { useState } from "react";
import { Settings, Save, Loader2, Eye } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { PaperType } from "@/types";
import { AdvancedSettingsModal } from "./AdvancedSettingsModal";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { generateTestPdf } from "@/lib/pdf";
import { saveDraftQuestionIds } from "@/lib/storage";

const paperTabs: { id: PaperType; label: string }[] = [
  { id: "yazili", label: "Yazılı Kağıdı" },
  { id: "yaprak", label: "Yaprak Test" },
  { id: "deneme", label: "Deneme Sınavı" },
];

export function PaperSidebar() {
  const paperSettings = useAppStore((s) => s.paperSettings);
  const setPaperSettings = useAppStore((s) => s.setPaperSettings);
  const draftIds = useAppStore((s) => s.draftIds);
  const questions = useAppStore((s) => s.questions);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState("sinav.pdf");

  const draftQuestions = draftIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q);

  const handlePreview = async () => {
    if (draftQuestions.length === 0) {
      alert("Önce en az bir soru ekleyin.");
      return;
    }
    setGenerating(true);
    try {
      await saveDraftQuestionIds(draftIds);
      const blob = await generateTestPdf(draftQuestions, paperSettings);
      const name = `${(paperSettings.testName || "sinav").replace(/\s+/g, "_")}.pdf`;
      setPdfFilename(name);
      setPreviewBlob(blob);
    } catch (e) {
      console.error(e);
      alert("PDF hazırlanırken hata oluştu.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <aside className="flex w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-72">
        <div className="flex border-b border-slate-200">
          {paperTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPaperSettings({ paperType: tab.id })}
              className={`flex-1 px-2 py-2.5 text-xs font-medium transition ${
                paperSettings.paperType === tab.id
                  ? "border-b-2 border-dershanem-blue bg-slate-50 text-dershanem-blue"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAdvanced(true)}
            className="px-2 text-slate-500 hover:text-dershanem-blue"
            title="Gelişmiş ayarlar"
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            onClick={() => saveDraftQuestionIds(draftIds)}
            className="px-2 text-slate-500 hover:text-dershanem-blue"
            title="Taslağı kaydet"
          >
            <Save size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Test Adı
            </span>
            <input
              type="text"
              value={paperSettings.testName}
              onChange={(e) =>
                setPaperSettings({ testName: e.target.value })
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-dershanem-blue focus:outline-none focus:ring-1 focus:ring-dershanem-blue"
              placeholder="Örn: 7. Sınıf Matematik Yazılı"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Okul Adı
            </span>
            <input
              type="text"
              value={paperSettings.schoolName}
              onChange={(e) =>
                setPaperSettings({ schoolName: e.target.value })
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Dershanem"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Sınav Türü
            </span>
            <select
              value={paperSettings.examType}
              onChange={(e) =>
                setPaperSettings({ examType: e.target.value })
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option>1. Dönem Çoktan Seçmeli Test</option>
              <option>2. Dönem Yazılı Sınavı</option>
              <option>Tarama Testi</option>
              <option>Deneme Sınavı</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Sınıf / Şube
            </span>
            <input
              type="text"
              value={paperSettings.classSection}
              onChange={(e) =>
                setPaperSettings({ classSection: e.target.value })
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="7/A"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Grup
            </span>
            <select
              value={paperSettings.group}
              onChange={(e) => setPaperSettings({ group: e.target.value })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option>Grup Yok</option>
              <option>A Grubu</option>
              <option>B Grubu</option>
            </select>
          </label>

          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={paperSettings.spacingBetweenQuestions}
                onChange={(e) =>
                  setPaperSettings({
                    spacingBetweenQuestions: e.target.checked,
                  })
                }
                className="rounded"
              />
              Sorular arasına boşluk bırak
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={paperSettings.includeTeacherName}
                onChange={(e) =>
                  setPaperSettings({
                    includeTeacherName: e.target.checked,
                  })
                }
                className="rounded"
              />
              Kağıda öğretmen ismini ekle
            </label>
            {paperSettings.includeTeacherName && (
              <input
                type="text"
                value={paperSettings.teacherName}
                onChange={(e) =>
                  setPaperSettings({ teacherName: e.target.value })
                }
                placeholder="Öğretmen adı"
                className="ml-6 w-[calc(100%-1.5rem)] rounded border border-slate-300 px-2 py-1 text-sm"
              />
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={paperSettings.includeOpticalForm}
                onChange={(e) =>
                  setPaperSettings({
                    includeOpticalForm: e.target.checked,
                  })
                }
                className="rounded"
              />
              Optik form ekle
            </label>
          </div>

          <p className="text-xs text-slate-500">
            {draftQuestions.length} soru · {paperSettings.columns} sütun
            {paperSettings.columnDivider && paperSettings.columns >= 2
              ? " · çizgili"
              : ""}
          </p>

          <button
            type="button"
            onClick={handlePreview}
            disabled={generating}
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-dershanem-blue py-3 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Hazırlanıyor...
              </>
            ) : (
              <>
                <Eye size={18} />
                Kağıdı PDF Olarak Hazırla
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView("online")}
            className="w-full rounded-lg border border-dershanem-blue py-2 text-sm font-medium text-dershanem-blue hover:bg-dershanem-sky"
          >
            Online sınav olarak yayınla
          </button>
        </div>
      </aside>

      {showAdvanced && (
        <AdvancedSettingsModal onClose={() => setShowAdvanced(false)} />
      )}

      {previewBlob && (
        <PdfPreviewModal
          blob={previewBlob}
          filename={pdfFilename}
          onClose={() => setPreviewBlob(null)}
        />
      )}
    </>
  );
}
