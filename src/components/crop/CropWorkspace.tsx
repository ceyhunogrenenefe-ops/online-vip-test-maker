"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Upload,
  ChevronLeft,
  ChevronRight,
  ScanSearch,
  Loader2,
  Maximize2,
  CloudUpload,
  Settings,
  X,
} from "lucide-react";
import { getCroppedImage, readFileAsDataUrl } from "@/lib/crop";
import type { PixelCrop } from "@/lib/crop";
import { defaultCenterCrop } from "@/lib/crop-math";
import { secimiGenislet } from "@/lib/kirp-secim";
import { akisiKapat, bekleyenAkisiAl, ekranPaylasiminiBeklet } from "@/lib/ekran-yakala";

/** Geliştirme modunda etki iki kez kurulur; eski kurulum akışı kesmesin. */
let ekranKurulum = 0;
import {
  DEFAULT_ENHANCE,
  type EnhanceSettings,
} from "@/lib/image-enhance";
import {
  detectQuestionsOnImage,
  suggestNextQuestionCrop,
  stackCropBelow,
  type DetectedQuestion,
} from "@/lib/question-detect";
import {
  getPdfPageCount,
  isPdfFile,
  renderPdfPageToDataUrl,
} from "@/lib/pdf-document";
import { saveQuestion } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";
import type { AnswerOption, Question } from "@/types";
import { ImageCropCanvas } from "./ImageCropCanvas";
import { EkranSeridi } from "./EkranSeridi";
import { syncCropToDetected } from "./ResizableCropBox";
import { PdfSourceBar, type PdfSession } from "./PdfSourceBar";
import { QuestionEditModal } from "./QuestionEditModal";
import { QuestionImageEraser } from "./QuestionImageEraser";
import {
  PreUploadQuestionEditor,
  type PreUploadEditResult,
} from "./PreUploadQuestionEditor";

type CropMode = "manual" | "auto";

export function CropWorkspace() {
  const addQuestion = useAppStore((s) => s.addQuestion);
  const removeQuestion = useAppStore((s) => s.removeQuestion);
  const questions = useAppStore((s) => s.questions);
  const draftIds = useAppStore((s) => s.draftIds);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const fileRef = useRef<HTMLInputElement>(null);
  const addPdfRef = useRef<HTMLInputElement>(null);
  const pdfFilesRef = useRef<Map<string, File>>(new Map());

  const [pdfSessions, setPdfSessions] = useState<PdfSession[]>([]);
  const [ekranAkisi, setEkranAkisi] = useState<MediaStream | null>(null);
  const [ekranAdi, setEkranAdi] = useState<string | null>(null);
  const ekranRef = useRef<MediaStream | null>(null);
  const kaynakNesil = useRef(0);
  ekranRef.current = ekranAkisi;
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
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const [panelSelectedId, setPanelSelectedId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [erasingQuestion, setErasingQuestion] = useState<Question | null>(null);
  const [pendingAnswerKey, setPendingAnswerKey] = useState<AnswerOption | null>(
    null
  );
  const [preUploadEditor, setPreUploadEditor] = useState<{
    imageDataUrl: string;
    sourceCrop: PixelCrop;
  } | null>(null);

  const activeSession = pdfSessions.find((s) => s.id === activePdfId);
  const activeFile = activePdfId
    ? pdfFilesRef.current.get(activePdfId)
    : undefined;
  const pdfPageCount = activeSession?.pageCount ?? 0;

  const panelQuestions = draftIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is Question => !!q);

  const pageQuestions = panelQuestions
    .filter((q) => {
      if (activeFile && activeSession) {
        return q.pdfPage === pdfPage && q.pdfSourceName === activeSession.name;
      }
      if (ekranAdi) return !q.pdfPage && q.pdfSourceName === ekranAdi;
      return !q.pdfPage && !q.pdfSourceName;
    })
    .map((q) => ({
      question: q,
      index: draftIds.indexOf(q.id) + 1,
    }));

  const placeNextCrop = useCallback(
    async (w: number, h: number, lastSaved?: PixelCrop) => {
      if (!imageSrc) return;

      const occupied = [
        ...(lastSaved ? [lastSaved] : []),
        ...pageQuestions
          .map(({ question }) => question.sourceCrop)
          .filter((c): c is PixelCrop => !!c),
      ];

      const anchor = lastSaved ?? occupied[occupied.length - 1];

      if (anchor) {
        const suggested = await suggestNextQuestionCrop(imageSrc, anchor, occupied);
        if (suggested) {
          setActiveCrop(suggested);
          setCropMode("manual");
          return;
        }
        const stacked = stackCropBelow(anchor, w, h);
        if (stacked) {
          setActiveCrop(stacked);
          setCropMode("manual");
          return;
        }
      }

      setActiveCrop(defaultCenterCrop(w, h));
      setCropMode("manual");
    },
    [pageQuestions, imageSrc]
  );

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
      const nesil = ++kaynakNesil.current;
      setEkranAdi(null);
      setLoadingPage(true);
      try {
        const dataUrl = await renderPdfPageToDataUrl(file, page, pdfScale);
        if (kaynakNesil.current !== nesil) return;
        setImageSrc(dataUrl);
        setDetected([]);
        setSelectedDetectId(null);
        setActiveCrop(null);
      } finally {
        if (kaynakNesil.current === nesil) setLoadingPage(false);
      }
    },
    [pdfScale]
  );

  useEffect(() => {
    if (activeFile && pdfPage >= 1) loadPdfPage(activeFile, pdfPage);
  }, [activeFile, pdfPage, pdfScale, loadPdfPage]);

  useEffect(() => {
    const ben = ++ekranKurulum;
    const hazir = bekleyenAkisiAl();
    if (hazir) setEkranAkisi(hazir);
    return () => {
      const akis = ekranRef.current ?? hazir;
      if (akis) ekranPaylasiminiBeklet(akis);
      queueMicrotask(() => {
        if (ekranKurulum !== ben) return;
        const artik = bekleyenAkisiAl();
        if (artik) akisiKapat(artik);
      });
    };
  }, []);

  const goruntuAc = (dataUrl: string) => {
    kaynakNesil.current += 1;
    setLoadingPage(false);
    setEkranAdi("Açık sayfa");
    setActivePdfId(null);
    setImageSrc(dataUrl);
    setDetected([]);
    setSelectedDetectId(null);
    setActiveCrop(null);
    setCropMode("manual");
  };

  const secimiOynat = (yon: 1 | -1) => {
    if (!activeCrop || imageSize.width < 1 || imageSize.height < 1) return;
    const adim =
      Math.max(16, Math.round(Math.min(imageSize.width, imageSize.height) * 0.012)) * yon;
    setActiveCrop(secimiGenislet(activeCrop, adim, imageSize.width, imageSize.height));
  };

  const initManualCrop = useCallback((w: number, h: number) => {
    setActiveCrop(defaultCenterCrop(w, h));
  }, []);

  const handleImageSize = useCallback(
    (w: number, h: number) => {
      setImageSize({ width: w, height: h });
      if (cropMode === "manual" && !activeCrop && w > 0) {
        void placeNextCrop(w, h);
      }
    },
    [cropMode, activeCrop, placeNextCrop]
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
    kaynakNesil.current += 1;
    setEkranAdi(null);
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

  const afterAddToPanel = async (savedCrop: PixelCrop) => {
    if (cropMode === "auto" && detected.length > 0 && selectedDetectId) {
      const idx = detected.findIndex((d) => d.id === selectedDetectId);
      const next = detected[idx + 1];
      if (next) {
        setSelectedDetectId(next.id);
        setActiveCrop(next.crop);
        return;
      }
    }
    if (imageSize.width > 0) {
      await placeNextCrop(imageSize.width, imageSize.height, savedCrop);
    }
  };

  const saveQuestionToPanel = async (result: PreUploadEditResult) => {
    const savedCrop = result.sourceCrop;
    const question: Question = {
      id: uuidv4(),
      imageDataUrl: result.imageDataUrl,
      source: "crop",
      createdAt: Date.now(),
      pdfSourceName: activeSession?.name ?? ekranAdi ?? undefined,
      pdfPage: activeFile ? pdfPage : undefined,
      answerKey: result.answerKey,
      overlayText: result.overlayText,
      fontSize: result.fontSize,
      fontFamily: result.fontFamily,
      fontBold: result.fontBold,
      sourceCrop: savedCrop,
      sourceImageWidth: imageSize.width,
      sourceImageHeight: imageSize.height,
    };
    await saveQuestion(question);
    addQuestion(question);
    setPanelSelectedId(question.id);
    setPendingAnswerKey(null);
    setPreUploadEditor(null);
    await afterAddToPanel(savedCrop);
  };

  const openPreUploadEditor = async () => {
    if (!imageSrc || !activeCrop) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedImage(imageSrc, activeCrop, enhance);
      setPreUploadEditor({
        imageDataUrl: dataUrl,
        sourceCrop: { ...activeCrop },
      });
    } finally {
      setSaving(false);
    }
  };

  const addToPanel = async () => {
    await openPreUploadEditor();
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
          pdfSourceName: activeSession?.name ?? ekranAdi ?? undefined,
          pdfPage: activeFile ? pdfPage : undefined,
          sourceCrop: { ...region.crop },
          sourceImageWidth: imageSize.width,
          sourceImageHeight: imageSize.height,
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

  const handleFinishUpload = async () => {
    await saveCurrentProject();
    setActiveView("home");
  };

  const settingsModal = showSettings && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-dershanem-navy">Kırpma ayarları</h3>
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runAutoDetect}
            disabled={detecting || !imageSrc}
            className="flex items-center gap-1.5 rounded-lg bg-dershanem-navy px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
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
                void placeNextCrop(imageSize.width, imageSize.height);
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Manuel kırp
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
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          >
            <Maximize2 size={16} />
            Genişlet
          </button>
        </div>
        {activeFile && (
          <label className="mt-4 block text-sm">
            PDF netliği
            <select
              value={pdfScale}
              onChange={(e) => setPdfScale(Number(e.target.value))}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value={1.5}>Normal</option>
              <option value={2}>Yüksek</option>
              <option value={2.5}>Çok yüksek</option>
              <option value={3}>Maksimum</option>
            </select>
          </label>
        )}
        <div className="mt-4 space-y-2 text-sm">
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
        {detected.length > 1 && (
          <button
            type="button"
            onClick={() => void saveAllDetected()}
            disabled={saving}
            className="mt-4 w-full rounded-lg border border-dershanem-navy py-2 text-sm font-medium text-dershanem-navy disabled:opacity-50"
          >
            Tüm kutuları panele ekle ({detected.length})
          </button>
        )}
      </div>
    </div>
  );

  const resetAll = () => {
    kaynakNesil.current += 1;
    pdfFilesRef.current.clear();
    setPdfSessions([]);
    setEkranAdi(null);
    setActivePdfId(null);
    setImageSrc(null);
    setDetected([]);
    setSelectedDetectId(null);
    setActiveCrop(null);
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
            PDF yükleyebilir veya Z-kitap gibi açık bir sayfayı, sekmeyi ya da dosya
            penceresini burada görüp kırpabilirsiniz.
          </p>
          <div className="mb-4 w-full max-w-xl">
            <EkranSeridi akis={ekranAkisi} onAkis={setEkranAkisi} onKare={goruntuAc} />
          </div>
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
        {editingQuestion && (
          <QuestionEditModal
            question={editingQuestion}
            onClose={() => setEditingQuestion(null)}
          />
        )}
        {erasingQuestion && (
          <QuestionImageEraser
            question={
              questions.find((q) => q.id === erasingQuestion.id) ??
              erasingQuestion
            }
            onClose={() => setErasingQuestion(null)}
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-200">
      {pdfSessions.length > 0 ? (
        <PdfSourceBar
          sessions={pdfSessions}
          activeId={activePdfId}
          onSelect={switchPdf}
          onAdd={() => addPdfRef.current?.click()}
          onRemove={removePdfSession}
          onSettings={() => setShowSettings(true)}
          onClose={resetAll}
        />
      ) : (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded p-2 text-slate-500 hover:bg-slate-100"
            title="Ayarlar"
          >
            <Settings size={20} />
          </button>
          <span className="flex-1 truncate text-sm font-medium text-slate-700">
            {ekranAdi ?? "Görsel kırpma"}
          </span>
          <button
            type="button"
            onClick={resetAll}
            className="rounded p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-3 py-2">
        <EkranSeridi akis={ekranAkisi} onAkis={setEkranAkisi} onKare={goruntuAc} />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {loadingPage && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 text-white">
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
            savedOnPage={pageQuestions}
            onDeleteSaved={(id) => {
              removeQuestion(id);
              if (panelSelectedId === id) setPanelSelectedId(null);
            }}
            pendingAnswerKey={pendingAnswerKey}
            onAnswerKeyChange={setPendingAnswerKey}
            onConfirmCrop={() => void addToPanel()}
            saving={saving}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            PDF seçin veya sayfa yükleniyor…
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-300 bg-white px-3 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        {activeFile && pdfPageCount > 0 ? (
          <>
            <button
              type="button"
              disabled={pdfPage <= 1}
              onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
              className="rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <ChevronLeft size={16} className="inline" /> Önce
            </button>
            <select
              value={pdfPage}
              onChange={(e) => setPdfPage(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              className="rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Sonra <ChevronRight size={16} className="inline" />
            </button>
          </>
        ) : (
          <span className="text-sm text-slate-400">{ekranAdi ?? "Tek görsel"}</span>
        )}

        {activeCrop ? (
          <>
            <button
              type="button"
              onClick={() => secimiOynat(1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              data-test="kirp-genislet"
            >
              Genişlet
            </button>
            <button
              type="button"
              onClick={() => secimiOynat(-1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              data-test="kirp-daralt"
            >
              Daralt
            </button>
          </>
        ) : null}

        <span className="mx-auto text-sm font-medium text-slate-700">
          Toplam Soru: {panelQuestions.length}
        </span>

        <button
          type="button"
          onClick={() => void handleFinishUpload()}
          className="ml-auto flex items-center gap-2 rounded-lg bg-dershanem-blue px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <CloudUpload size={18} />
          Yükle
        </button>
      </div>

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

      {settingsModal}

      {preUploadEditor && (
        <PreUploadQuestionEditor
          imageDataUrl={preUploadEditor.imageDataUrl}
          sourceCrop={preUploadEditor.sourceCrop}
          initialAnswerKey={pendingAnswerKey}
          saving={saving}
          onCancel={() => setPreUploadEditor(null)}
          onConfirm={(result) => {
            setSaving(true);
            void saveQuestionToPanel(result).finally(() => setSaving(false));
          }}
        />
      )}

      {editingQuestion && (
        <QuestionEditModal
          question={
            questions.find((q) => q.id === editingQuestion.id) ??
            editingQuestion
          }
          onClose={() => setEditingQuestion(null)}
        />
      )}
      {erasingQuestion && (
        <QuestionImageEraser
          question={
            questions.find((q) => q.id === erasingQuestion.id) ?? erasingQuestion
          }
          onClose={() => setErasingQuestion(null)}
        />
      )}
    </div>
  );
}
