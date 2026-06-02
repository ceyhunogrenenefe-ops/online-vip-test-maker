"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Upload,
  Check,
  ChevronLeft,
  ChevronRight,
  ScanSearch,
  SlidersHorizontal,
  Loader2,
  Maximize2,
} from "lucide-react";
import { getCroppedImage, readFileAsDataUrl } from "@/lib/crop";
import type { PixelCrop } from "@/lib/crop";
import { defaultCenterCrop } from "@/lib/crop-math";
import {
  DEFAULT_ENHANCE,
  type EnhanceSettings,
} from "@/lib/image-enhance";
import {
  detectQuestionsOnImage,
  type DetectedQuestion,
} from "@/lib/question-detect";
import {
  getPdfPageCount,
  isPdfFile,
  renderPdfPageToDataUrl,
} from "@/lib/pdf-document";
import { saveQuestion } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";
import type { Question } from "@/types";
import { ImageCropCanvas } from "./ImageCropCanvas";
import { syncCropToDetected } from "./ResizableCropBox";
import { PdfSourceBar, type PdfSession } from "./PdfSourceBar";
import { QuestionPanel } from "./QuestionPanel";
import { QuestionEditModal } from "./QuestionEditModal";

type CropMode = "manual" | "auto";

export function CropWorkspace() {
  const addQuestion = useAppStore((s) => s.addQuestion);
  const removeQuestion = useAppStore((s) => s.removeQuestion);
  const questions = useAppStore((s) => s.questions);
  const draftIds = useAppStore((s) => s.draftIds);

  const fileRef = useRef<HTMLInputElement>(null);
  const addPdfRef = useRef<HTMLInputElement>(null);
  const pdfFilesRef = useRef<Map<string, File>>(new Map());

  const [pdfSessions, setPdfSessions] = useState<PdfSession[]>([]);
  const [activePdfId, setActivePdfId] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(2);
  const [loadingPage, setLoadingPage] = useState(false);

  const [cropMode, setCropMode] = useState<CropMode>("manual");
  const [activeCrop, setActiveCrop] = useState<PixelCrop | null>(null);
  const [detected, setDetected] = useState<DetectedQuestion[]>([]);
  const [selectedDetectId, setSelectedDetectId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [enhance, setEnhance] = useState<EnhanceSettings>({ ...DEFAULT_ENHANCE });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showEnhance, setShowEnhance] = useState(true);
  const [saving, setSaving] = useState(false);

  const [panelSelectedId, setPanelSelectedId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const activeSession = pdfSessions.find((s) => s.id === activePdfId);
  const activeFile = activePdfId
    ? pdfFilesRef.current.get(activePdfId)
    : undefined;
  const pdfPageCount = activeSession?.pageCount ?? 0;

  const panelQuestions = draftIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is Question => !!q);

  const registerPdf = async (file: File) => {
    const id = uuidv4();
    const pageCount = await getPdfPageCount(file);
    pdfFilesRef.current.set(id, file);
    setPdfSessions((prev) => [
      ...prev,
      { id, name: file.name, pageCount },
    ]);
    setActivePdfId(id);
    setPdfPage(1);
    setDetected([]);
    setSelectedDetectId(null);
    setActiveCrop(null);
  };

  const loadPdfPage = useCallback(
    async (file: File, page: number) => {
      setLoadingPage(true);
      try {
        const dataUrl = await renderPdfPageToDataUrl(file, page, pdfScale);
        setImageSrc(dataUrl);
        setDetected([]);
        setSelectedDetectId(null);
        setActiveCrop(null);
      } finally {
        setLoadingPage(false);
      }
    },
    [pdfScale]
  );

  useEffect(() => {
    if (activeFile && pdfPage >= 1) loadPdfPage(activeFile, pdfPage);
  }, [activeFile, pdfPage, pdfScale, loadPdfPage]);

  useEffect(() => {
    if (!imageSrc || !activeCrop) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    getCroppedImage(imageSrc, activeCrop, enhance).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc, activeCrop, enhance]);

  const initManualCrop = useCallback((w: number, h: number) => {
    setActiveCrop(defaultCenterCrop(w, h));
  }, []);

  const handleImageSize = useCallback(
    (w: number, h: number) => {
      setImageSize({ width: w, height: h });
      if (cropMode === "manual" && !activeCrop && w > 0) {
        initManualCrop(w, h);
      }
    },
    [cropMode, activeCrop, initManualCrop]
  );

  const handleActiveCropChange = useCallback(
    (crop: PixelCrop) => {
      setActiveCrop(crop);
      if (selectedDetectId) {
        setDetected((prev) => syncCropToDetected(prev, selectedDetectId, crop));
      }
    },
    [selectedDetectId]
  );

  const handleImageFile = async (file: File) => {
    setActivePdfId(null);
    const dataUrl = await readFileAsDataUrl(file);
    setImageSrc(dataUrl);
    setDetected([]);
    setSelectedDetectId(null);
    setActiveCrop(null);
    setCropMode("manual");
  };

  const handleFile = async (file: File) => {
    if (isPdfFile(file)) await registerPdf(file);
    else await handleImageFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const switchPdf = (id: string) => {
    setActivePdfId(id);
    setPdfPage(1);
  };

  const removePdfSession = (id: string) => {
    pdfFilesRef.current.delete(id);
    setPdfSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activePdfId === id) {
        const fallback = next[0]?.id ?? null;
        setActivePdfId(fallback);
        setPdfPage(1);
        if (!fallback) setImageSrc(null);
      }
      return next;
    });
  };

  const runAutoDetect = async () => {
    if (!imageSrc) return;
    setDetecting(true);
    try {
      const regions = await detectQuestionsOnImage(imageSrc);
      setDetected(regions);
      setCropMode("auto");
      if (regions.length > 0) {
        setSelectedDetectId(regions[0].id);
        setActiveCrop(regions[0].crop);
      } else {
        alert("Otomatik soru bulunamadı. Manuel kutuyu ayarlayın.");
      }
    } finally {
      setDetecting(false);
    }
  };

  const selectRegion = (id: string) => {
    const region = detected.find((d) => d.id === id);
    if (!region) return;
    setSelectedDetectId(id);
    setActiveCrop(region.crop);
  };

  const afterAddToPanel = () => {
    if (cropMode === "auto" && detected.length > 0 && selectedDetectId) {
      const idx = detected.findIndex((d) => d.id === selectedDetectId);
      const next = detected[idx + 1];
      if (next) {
        setSelectedDetectId(next.id);
        setActiveCrop(next.crop);
        return;
      }
    }
    if (imageSize.width > 0) initManualCrop(imageSize.width, imageSize.height);
  };

  const addToPanel = async () => {
    if (!imageSrc || !activeCrop) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedImage(imageSrc, activeCrop, enhance);
      const question: Question = {
        id: uuidv4(),
        imageDataUrl: dataUrl,
        source: "crop",
        createdAt: Date.now(),
        pdfSourceName: activeSession?.name,
        pdfPage: activeFile ? pdfPage : undefined,
      };
      await saveQuestion(question);
      addQuestion(question);
      setPanelSelectedId(question.id);
      afterAddToPanel();
    } finally {
      setSaving(false);
    }
  };

  const saveAllDetected = async () => {
    if (!imageSrc || detected.length === 0) return;
    setSaving(true);
    try {
      for (const region of detected) {
        const dataUrl = await getCroppedImage(
          imageSrc,
          region.crop,
          enhance
        );
        const question: Question = {
          id: uuidv4(),
          imageDataUrl: dataUrl,
          source: "crop",
          createdAt: Date.now(),
          pdfSourceName: activeSession?.name,
          pdfPage: activeFile ? pdfPage : undefined,
        };
        await saveQuestion(question);
        addQuestion(question);
      }
      setDetected([]);
      setCropMode("manual");
      if (imageSize.width > 0) initManualCrop(imageSize.width, imageSize.height);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    pdfFilesRef.current.clear();
    setPdfSessions([]);
    setActivePdfId(null);
    setImageSrc(null);
    setDetected([]);
    setSelectedDetectId(null);
    setActiveCrop(null);
    setPreviewUrl(null);
  };

  const hasWorkspace = !!imageSrc || pdfSessions.length > 0;

  if (!hasWorkspace) {
    return (
      <div className="m-4 flex flex-1 flex-col gap-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-dershanem-sky/40 p-12"
        >
          <Upload size={64} className="mb-4 text-dershanem-blue" />
          <p className="mb-2 text-lg font-medium text-slate-700">
            PDF seçin, ardarda soru kırpın
          </p>
          <p className="mb-6 max-w-md text-center text-sm text-slate-500">
            Birden fazla PDF ekleyebilir, üstten geçiş yapabilirsiniz. Sorular
            altta küçük önizleme olarak birikir.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-dershanem-blue px-6 py-2.5 font-medium text-white hover:bg-blue-700"
          >
            PDF / Görsel Seç
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
        {panelQuestions.length > 0 && (
          <QuestionPanel
            questions={panelQuestions}
            selectedId={panelSelectedId}
            onSelect={setPanelSelectedId}
            onEdit={(id) => {
              const q = questions.find((x) => x.id === id);
              if (q) setEditingQuestion(q);
            }}
            onDelete={(id) => {
              removeQuestion(id);
              if (panelSelectedId === id) setPanelSelectedId(null);
            }}
          />
        )}
        {editingQuestion && (
          <QuestionEditModal
            question={editingQuestion}
            onClose={() => setEditingQuestion(null)}
          />
        )}
      </div>
    );
  }

  if (activeFile && !imageSrc && loadingPage) {
    return (
      <div className="m-4 flex flex-1 items-center justify-center gap-2 text-slate-600">
        <Loader2 className="animate-spin" />
        PDF sayfası hazırlanıyor...
      </div>
    );
  }

  return (
    <div className="m-4 flex flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <PdfSourceBar
          sessions={pdfSessions}
          activeId={activePdfId}
          onSelect={switchPdf}
          onAdd={() => addPdfRef.current?.click()}
          onRemove={removePdfSession}
        />

        {activeFile && pdfPageCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
            <button
              type="button"
              disabled={pdfPage <= 1}
              onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
              className="rounded border px-2 py-1 text-sm disabled:opacity-40"
            >
              Önce
            </button>
            <select
              value={pdfPage}
              onChange={(e) => setPdfPage(Number(e.target.value))}
              className="rounded border px-2 py-1 text-sm"
            >
              {Array.from({ length: pdfPageCount }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Sayfa: {i + 1}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pdfPage >= pdfPageCount}
              onClick={() =>
                setPdfPage((p) => Math.min(pdfPageCount, p + 1))
              }
              className="rounded border px-2 py-1 text-sm disabled:opacity-40"
            >
              Sonra
            </button>
            <label className="ml-auto flex items-center gap-2 text-xs">
              PDF netliği
              <select
                value={pdfScale}
                onChange={(e) => setPdfScale(Number(e.target.value))}
                className="rounded border px-2 py-1"
              >
                <option value={1.5}>Normal</option>
                <option value={2}>Yüksek</option>
                <option value={2.5}>Çok yüksek</option>
                <option value={3}>Maksimum</option>
              </select>
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runAutoDetect}
            disabled={detecting || !imageSrc}
            className="flex items-center gap-1.5 rounded-lg bg-dershanem-navy px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {detecting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ScanSearch size={16} />
            )}
            Otomatik bul
          </button>
          <button
            type="button"
            onClick={() => {
              setCropMode("manual");
              setSelectedDetectId(null);
              if (!activeCrop && imageSize.width > 0)
                initManualCrop(imageSize.width, imageSize.height);
            }}
            className={`rounded-lg border px-3 py-2 text-sm ${
              cropMode === "manual"
                ? "border-dershanem-blue bg-dershanem-sky"
                : "bg-white"
            }`}
          >
            Manuel kırp
          </button>
          <button
            type="button"
            onClick={() => setCropMode("auto")}
            disabled={detected.length === 0}
            className={`rounded-lg border px-3 py-2 text-sm ${
              cropMode === "auto"
                ? "border-dershanem-blue bg-dershanem-sky"
                : "bg-white"
            }`}
          >
            Kutular ({detected.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (!imageSize.width || !activeCrop) return;
              setActiveCrop({
                ...activeCrop,
                x: Math.round(imageSize.width * 0.03),
                width: Math.round(imageSize.width * 0.94),
              });
            }}
            disabled={!activeCrop}
            className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            <Maximize2 size={16} />
            Genişlet
          </button>
          <button
            type="button"
            onClick={() => setShowEnhance((s) => !s)}
            className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <SlidersHorizontal size={16} />
            Netlik
          </button>
        </div>

        <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl bg-slate-900">
          {loadingPage && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="animate-spin" />
            </div>
          )}
          {imageSrc ? (
            <ImageCropCanvas
              imageSrc={imageSrc}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              onImageSize={handleImageSize}
              activeCrop={activeCrop}
              onActiveCropChange={handleActiveCropChange}
              detected={cropMode === "auto" ? detected : []}
              selectedDetectId={selectedDetectId}
              onSelectDetect={selectRegion}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400 text-sm">
              PDF seçin veya sayfa yükleniyor…
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
          <span className="text-sm font-medium text-slate-600">
            Toplam soru: {panelQuestions.length}
          </span>
          <div className="flex gap-2">
            {detected.length > 1 && (
              <button
                type="button"
                onClick={saveAllDetected}
                disabled={saving}
                className="rounded-lg border border-dershanem-navy px-3 py-2 text-sm font-medium text-dershanem-navy disabled:opacity-50"
              >
                Tüm kutuları ekle
              </button>
            )}
            <button
              type="button"
              onClick={addToPanel}
              disabled={saving || !activeCrop}
              className="flex items-center gap-1 rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Tamam — Panele ekle
            </button>
          </div>
        </div>

        <QuestionPanel
          questions={panelQuestions}
          selectedId={panelSelectedId}
          onSelect={setPanelSelectedId}
          onEdit={(id) => {
            const q = questions.find((x) => x.id === id);
            if (q) setEditingQuestion(q);
          }}
          onDelete={(id) => {
            removeQuestion(id);
            if (panelSelectedId === id) setPanelSelectedId(null);
          }}
        />

        <input
          ref={addPdfRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) registerPdf(f);
            e.target.value = "";
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-64">
        {showEnhance && (
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-dershanem-navy">
              Netlik
            </h3>
            <div className="space-y-2 text-sm">
              <label className="block">
                Kontrast
                <input
                  type="range"
                  min={0.6}
                  max={1.8}
                  step={0.05}
                  value={enhance.contrast}
                  onChange={(e) =>
                    setEnhance((s) => ({
                      ...s,
                      contrast: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </label>
              <label className="block">
                Keskinlik
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={enhance.sharpness}
                  onChange={(e) =>
                    setEnhance((s) => ({
                      ...s,
                      sharpness: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </label>
            </div>
          </div>
        )}
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs text-slate-500">Önizleme</p>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="max-h-36 w-full rounded border object-contain"
            />
          ) : (
            <div className="flex h-28 items-center justify-center rounded border border-dashed text-xs text-slate-400">
              Kutu seçin
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="rounded border py-2 text-sm hover:bg-slate-50"
        >
          Oturumu kapat
        </button>
        <p className="text-xs text-slate-500">
          Sol panelden <strong>Kağıdı Hazırla</strong> ile PDF alın. Sütun ve
          filigran için dişli ikonuna tıklayın.
        </p>
      </aside>

      {editingQuestion && (
        <QuestionEditModal
          question={
            questions.find((q) => q.id === editingQuestion.id) ??
            editingQuestion
          }
          onClose={() => setEditingQuestion(null)}
        />
      )}
    </div>
  );
}
