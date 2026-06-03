"use client";

import { useState } from "react";
import { Settings, Save, Loader2, Eye } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { PaperSettings, PaperType } from "@/types";
import { AdvancedSettingsModal } from "./AdvancedSettingsModal";
import { OpticalFormSelectModal } from "./OpticalFormSelectModal";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { generateTestPdf } from "@/lib/pdf";

const paperTabs: { id: PaperType; label: string }[] = [
  { id: "yazili", label: "Yazılı Kağıdı" },
  { id: "yaprak", label: "Yaprak Test" },
  { id: "deneme", label: "Deneme Sınavı" },
];

function defaultTestDescription(type: PaperType): string {
  if (type === "yaprak") {
    return "Konu:\nSüre: 40 dk\nNot: Her soru eşit puandır.";
  }
  if (type === "deneme") {
    return "Deneme sınavı talimatları:\nSüre: 120 dk\nCevaplarınızı optik forma işaretleyiniz.";
  }
  return "";
}

function handlePaperTypeChange(
  type: PaperType,
  current: PaperSettings,
  setPaperSettings: (s: Partial<PaperSettings>) => void
) {
  const patch: Partial<PaperSettings> = { paperType: type };
  if (
    (type === "yaprak" || type === "deneme") &&
    !current.testDescription.trim()
  ) {
    patch.testDescription = defaultTestDescription(type);
  }
  setPaperSettings(patch);
}

export function PaperSidebar() {
  const paperSettings = useAppStore((s) => s.paperSettings);
  const setPaperSettings = useAppStore((s) => s.setPaperSettings);
  const draftIds = useAppStore((s) => s.draftIds);
  const questions = useAppStore((s) => s.questions);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOpticalModal, setShowOpticalModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState("sinav.pdf");

  const draftQuestions = draftIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q);

  const isProfilePaper =
    paperSettings.paperType === "yaprak" ||
    paperSettings.paperType === "deneme";
  const spacingMm = paperSettings.questionSpacingMm ?? 10;

  const handlePreview = async () => {
    if (draftQuestions.length === 0) {
      alert("Önce en az bir soru ekleyin.");
      return;
    }
    setGenerating(true);
    try {
      await saveCurrentProject();
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
              onClick={() =>
                handlePaperTypeChange(
                  tab.id,
                  paperSettings,
                  setPaperSettings
                )
              }
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
            onClick={() => void saveCurrentProject()}
            className="px-2 text-slate-500 hover:text-dershanem-blue"
            title="Testi kaydet"
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

          {isProfilePaper ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-dershanem-blue">
                Test profili
              </p>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Test açıklamaları
                </span>
                <textarea
                  value={paperSettings.testDescription}
                  onChange={(e) =>
                    setPaperSettings({ testDescription: e.target.value })
                  }
                  rows={4}
                  className="w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm leading-relaxed"
                  placeholder="Konu, süre, talimatlar…"
                />
              </label>
            </>
          ) : (
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
          )}

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
            {paperSettings.spacingBetweenQuestions && (
              <div className="ml-6 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                <p className="text-xs font-medium text-slate-600">
                  Boşluk miktarı
                </p>
                <div className="flex gap-2">
                  {[15, 65].map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      onClick={() =>
                        setPaperSettings({ questionSpacingMm: mm })
                      }
                      className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium transition ${
                        spacingMm === mm
                          ? "border-dershanem-blue bg-dershanem-sky/50 text-dershanem-navy"
                          : "border-slate-200 bg-white hover:bg-slate-100"
                      }`}
                    >
                      {mm} mm
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 text-slate-600">Özel:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={spacingMm}
                    onChange={(e) =>
                      setPaperSettings({
                        questionSpacingMm: Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0)
                        ),
                      })
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1"
                  />
                  <span className="shrink-0 text-slate-500">mm</span>
                </label>
              </div>
            )}
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
                onChange={(e) => {
                  if (e.target.checked) {
                    setShowOpticalModal(true);
                  } else {
                    setPaperSettings({
                      includeOpticalForm: false,
                      opticalCustomImage: undefined,
                    });
                  }
                }}
                className="rounded"
              />
              Optik form ekle
            </label>
            {paperSettings.includeOpticalForm && (
              <button
                type="button"
                onClick={() => setShowOpticalModal(true)}
                className="ml-6 text-left text-xs text-dershanem-blue hover:underline"
              >
                {paperSettings.opticalCustomImage
                  ? "Kişisel form"
                  : `${paperSettings.opticalChoiceCount ?? 5} şık`}{" "}
                · sayfa altı — değiştir
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            {draftQuestions.length} soru · {paperSettings.columns} sütun · ölçek{" "}
            {paperSettings.questionScalePercent ?? 92}%
            {paperSettings.spacingBetweenQuestions
              ? ` · boşluk ${spacingMm} mm`
              : ""}
            {paperSettings.columnDivider && paperSettings.columns >= 2
              ? " · çizgili"
              : ""}
          </p>
          <p className="text-[10px] text-slate-400">
            Taşma olursa dişli → Soru ölçeğini düşürün veya 1 sütun seçin.
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

      {showOpticalModal && (
        <OpticalFormSelectModal
          onClose={() => setShowOpticalModal(false)}
          onConfirm={() => setShowOpticalModal(false)}
        />
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
