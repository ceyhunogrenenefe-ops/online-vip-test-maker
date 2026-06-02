"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
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
} from "lucide-react";
import {
  cropAreaToPosition,
  estimateZoomForCrop,
  getCroppedImage,
  readFileAsDataUrl,
} from "@/lib/crop";
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
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [detected, setDetected] = useState<DetectedQuestion[]>([]);
  const [selectedDetectId, setSelectedDetectId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [enhance, setEnhance] = useState<EnhanceSettings>({ ...DEFAULT_ENHANCE });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showEnhance, setShowEnhance] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedRegion = detected.find((d) => d.id === selectedDetectId);

  const loadPdfPage = useCallback(
    async (file: File, page: number) => {
      setLoadingPage(true);
      try {
        const dataUrl = await renderPdfPageToDataUrl(file, page, pdfScale);
        setImageSrc(dataUrl);
        setDetected([]);
        setSelectedDetectId(null);
        setCroppedAreaPixels(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
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
    const region =
      cropMode === "auto" && selectedRegion
        ? selectedRegion.crop
        : croppedAreaPixels;

    if (!imageSrc || !region) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    getCroppedImage(imageSrc, region, enhance).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc, croppedAreaPixels, selectedRegion, enhance, cropMode]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
    setSelectedDetectId(null);
  }, []);

  const handleImageFile = async (file: File) => {
    setPdfFile(null);
    setPdfPageCount(0);
    const dataUrl = await readFileAsDataUrl(file);
    setImageSrc(dataUrl);
    setDetected([]);
    setSelectedDetectId(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
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
        applyRegionToCropper(regions[0]);
      } else {
        alert(
          "Otomatik soru bulunamadı. Manuel kırpma modunu deneyin veya PDF çözünürlüğünü artırın."
        );
      }
    } finally {
      setDetecting(false);
    }
  };

  const applyRegionToCropper = (region: DetectedQuestion) => {
    if (!imageSize.width) return;
    const pos = cropAreaToPosition(
      region.crop,
      imageSize.width,
      imageSize.height
    );
    setCrop(pos);
    setZoom(
      estimateZoomForCrop(
        region.crop,
        imageSize.width,
        imageSize.height
      )
    );
    setCroppedAreaPixels(region.crop);
  };

  const selectRegion = (region: DetectedQuestion) => {
    setSelectedDetectId(region.id);
    applyRegionToCropper(region);
  };

  const activeCrop =
    cropMode === "auto" && selectedRegion
      ? selectedRegion.crop
      : croppedAreaPixels;

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
          applyRegionToCropper(next);
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
    setCroppedAreaPixels(null);
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
          PDF sayfaları yüksek çözünürlükle açılır. &quot;Soruları otomatik
          bul&quot; ile bölgeler tanınır; netlik ve kontrast ayarlanabilir.
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
            <span className="text-sm font-medium truncate max-w-[180px]">
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
            onClick={() => setCropMode("manual")}
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
            Otomatik kutular ({detected.length})
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

          {cropMode === "manual" && imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              onMediaLoaded={(size) =>
                setImageSize({ width: size.width, height: size.height })
              }
            />
          )}

          {cropMode === "auto" && imageSrc && (
            <div className="flex h-full w-full justify-center overflow-auto bg-slate-800 p-2">
              <div className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt="PDF sayfa"
                  className="block max-w-full h-auto"
                  onLoad={(e) => {
                    const t = e.currentTarget;
                    setImageSize({
                      width: t.naturalWidth,
                      height: t.naturalHeight,
                    });
                  }}
                />
                {detected.map((region) => {
                  const sel = region.id === selectedDetectId;
                  const left = (region.crop.x / imageSize.width) * 100;
                  const top = (region.crop.y / imageSize.height) * 100;
                  const w = (region.crop.width / imageSize.width) * 100;
                  const h = (region.crop.height / imageSize.height) * 100;
                  if (!imageSize.width) return null;
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => selectRegion(region)}
                      className={`absolute border-2 transition ${
                        sel
                          ? "border-amber-400 bg-amber-400/20 ring-2 ring-amber-300"
                          : "border-green-400/80 bg-green-400/10 hover:bg-green-400/25"
                      }`}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${w}%`,
                        height: `${h}%`,
                      }}
                      title={`Güven: %${Math.round(region.confidence * 100)}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {cropMode === "manual" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
            <label className="flex flex-1 min-w-[160px] items-center gap-2 text-sm">
              Yakınlaştır
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </label>
          </div>
        )}
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

        {detected.length > 0 && (
          <p className="text-xs text-slate-500">
            {detected.length} bölge bulundu. Kutuya tıklayarak seçin; netlik
            ayarları kayıtta uygulanır.
          </p>
        )}
      </aside>
    </div>
  );
}
