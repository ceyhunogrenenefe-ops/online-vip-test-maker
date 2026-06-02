"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Upload,
  Check,
  Plus,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileText,
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

type CropMode = "manual" | "auto";

export function CropWorkspace() {
  const addQuestion = useAppStore((s) => s.addQuestion);
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(0);
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
    if (pdfFile && pdfPage >= 1) loadPdfPage(pdfFile, pdfPage);
  }, [pdfFile, pdfPage, pdfScale, loadPdfPage]);

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
    setPdfFile(null);
    setPdfPageCount(0);
    const dataUrl = await readFileAsDataUrl(file);
    setImageSrc(dataUrl);
    setDetected([]);
    setSelectedDetectId(null);
    setActiveCrop(null);
    setCropMode("manual");
  };

  const handlePdfFile = async (file: File) => {
    setPdfFile(file);
    setPdfPage(1);
    const count = await getPdfPageCount(file);
    setPdfPageCount(count);
  };

  const handleFile = async (file: File) => {
    if (isPdfFile(file)) await handlePdfFile(file);
    else await handleImageFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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
        alert(
          "Otomatik soru bulunamadı. Manuel modda kutuyu kendiniz ayarlayın."
        );
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

  const switchToManual = () => {
    setCropMode("manual");
    setSelectedDetectId(null);
    if (!activeCrop && imageSize.width > 0) {
      initManualCrop(imageSize.width, imageSize.height);
    }
  };

  const expandCropFullWidth = () => {
    if (!imageSize.width || !activeCrop) return;
    setActiveCrop({
      ...activeCrop,
      x: Math.round(imageSize.width * 0.05),
      width: Math.round(imageSize.width * 0.9),
    });
  };

  const saveCrop = async (keepOpen = false) => {
    if (!imageSrc || !activeCrop) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedImage(imageSrc, activeCrop, enhance);
      const question: Question = {
        id: uuidv4(),
        imageDataUrl: dataUrl,
        source: "crop",
        createdAt: Date.now(),
      };
      await saveQuestion(question);
      addQuestion(question);

      if (cropMode === "auto" && detected.length > 0) {
        const idx = detected.findIndex((d) => d.id === selectedDetectId);
        const next = detected[idx + 1];
        if (keepOpen && next) {
          setSelectedDetectId(next.id);
          setActiveCrop(next.crop);
        } else if (!keepOpen) {
          resetWorkspace();
        }
      } else if (!keepOpen) {
        resetWorkspace();
      }
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
        };
        await saveQuestion(question);
        addQuestion(question);
      }
      alert(`${detected.length} soru kaydedildi.`);
      resetWorkspace();
    } finally {
      setSaving(false);
    }
  };

  const resetWorkspace = () => {
    setImageSrc(null);
    setPdfFile(null);
    setPdfPageCount(0);
    setDetected([]);
    setSelectedDetectId(null);
    setActiveCrop(null);
    setPreviewUrl(null);
  };

  if (!imageSrc && !pdfFile) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="m-4 flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-dershanem-sky/40 p-12"
      >
        <Upload size={64} className="mb-4 text-dershanem-blue" />
        <p className="mb-2 text-lg font-medium text-slate-700">
          PDF veya görsel seçin, soruları otomatik bulun
        </p>
        <p className="mb-6 max-w-md text-center text-sm text-slate-500">
          Kırpma kutusunun kenarlarından sağa-sola çekerek boyutlandırın.
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg bg-dershanem-blue px-6 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          Dosya Seç
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
    );
  }

  if (pdfFile && !imageSrc && loadingPage) {
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
        {pdfFile && pdfPageCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
            <FileText size={18} className="text-dershanem-blue" />
            <span className="max-w-[180px] truncate text-sm font-medium">
              {pdfFile.name}
            </span>
            <button
              type="button"
              disabled={pdfPage <= 1}
              onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
              className="rounded border p-1 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm">
              Sayfa {pdfPage} / {pdfPageCount}
            </span>
            <button
              type="button"
              disabled={pdfPage >= pdfPageCount}
              onClick={() =>
                setPdfPage((p) => Math.min(pdfPageCount, p + 1))
              }
              className="rounded border p-1 disabled:opacity-40"
            >
              <ChevronRight size={18} />
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
            Soruları otomatik bul
          </button>
          <button
            type="button"
            onClick={switchToManual}
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
            onClick={() => {
              setCropMode("auto");
              if (selectedDetectId) {
                const r = detected.find((d) => d.id === selectedDetectId);
                if (r) setActiveCrop(r.crop);
              }
            }}
            disabled={detected.length === 0}
            className={`rounded-lg border px-3 py-2 text-sm ${
              cropMode === "auto"
                ? "border-dershanem-blue bg-dershanem-sky"
                : "bg-white"
            }`}
          >
            Otomatik kutular ({detected.length})
          </button>
          <button
            type="button"
            onClick={expandCropFullWidth}
            disabled={!activeCrop}
            className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            title="Seçili kutuyu sayfa genişliğine yaklaştır"
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

        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-xl bg-slate-900">
          {loadingPage && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="animate-spin" />
            </div>
          )}

          {imageSrc && (
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
          )}
        </div>

        <p className="rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-600">
          <strong>İpucu:</strong> Sarı kutunun ortasından sürükleyerek taşıyın;
          kenar ve köşe noktalarından sağa, sola, yukarı veya aşağı çekerek
          boyutlandırın.
        </p>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
        {showEnhance && (
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-dershanem-navy">
              <Sparkles size={16} />
              Netlik ayarları
            </h3>
            <div className="space-y-3 text-sm">
              <label className="block">
                Kontrast ({enhance.contrast.toFixed(1)})
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
                  className="mt-1 w-full"
                />
              </label>
              <label className="block">
                Parlaklık ({enhance.brightness})
                <input
                  type="range"
                  min={-30}
                  max={40}
                  step={1}
                  value={enhance.brightness}
                  onChange={(e) =>
                    setEnhance((s) => ({
                      ...s,
                      brightness: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full"
                />
              </label>
              <label className="block">
                Keskinlik ({enhance.sharpness.toFixed(1)})
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
                  className="mt-1 w-full"
                />
              </label>
              <button
                type="button"
                onClick={() => setEnhance({ ...DEFAULT_ENHANCE })}
                className="text-xs text-dershanem-blue hover:underline"
              >
                Varsayılana sıfırla
              </button>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-slate-500">Önizleme</p>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Kırpılmış soru önizleme"
              className="max-h-40 w-full rounded border object-contain"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded border border-dashed text-xs text-slate-400">
              Alan seçin
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => saveCrop(false)}
            disabled={saving || !activeCrop}
            className="flex items-center justify-center gap-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            <Check size={16} />
            Soruyu kaydet
          </button>
          <button
            type="button"
            onClick={() => saveCrop(true)}
            disabled={saving || !activeCrop}
            className="flex items-center justify-center gap-1 rounded-lg bg-dershanem-blue py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus size={16} />
            Kaydet, sonrakine geç
          </button>
          {detected.length > 1 && (
            <button
              type="button"
              onClick={saveAllDetected}
              disabled={saving}
              className="rounded-lg border border-dershanem-navy py-2.5 text-sm font-medium text-dershanem-navy hover:bg-slate-50 disabled:opacity-60"
            >
              Tümünü kaydet ({detected.length})
            </button>
          )}
          <button
            type="button"
            onClick={resetWorkspace}
            className="flex items-center justify-center gap-1 rounded border py-2 text-sm hover:bg-slate-50"
          >
            <RotateCcw size={16} />
            Yeni dosya
          </button>
        </div>
      </aside>
    </div>
  );
}
