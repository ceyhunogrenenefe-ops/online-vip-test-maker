"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { v4 as uuidv4 } from "uuid";
import { Upload, Check, Plus, RotateCcw } from "lucide-react";
import { getCroppedImage, readFileAsDataUrl } from "@/lib/crop";
import { saveQuestion } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";
import type { Question } from "@/types";

export function CropWorkspace() {
  const addQuestion = useAppStore((s) => s.addQuestion);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleFile = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    setImageSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const saveCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedImage(imageSrc, croppedAreaPixels);
      const question: Question = {
        id: uuidv4(),
        imageDataUrl: dataUrl,
        source: "crop",
        createdAt: Date.now(),
      };
      await saveQuestion(question);
      addQuestion(question);
      setImageSrc(null);
      setCroppedAreaPixels(null);
    } finally {
      setSaving(false);
    }
  };

  if (!imageSrc) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-dershanem-sky/40 p-12 m-4"
      >
        <Upload size={64} className="mb-4 text-dershanem-blue" />
        <p className="mb-2 text-lg font-medium text-slate-700">
          Kırpılacak dosyayı seçin veya sürükleyin
        </p>
        <p className="mb-6 text-sm text-slate-500">
          PDF, JPG, PNG desteklenir
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
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col m-4 gap-4">
      <div className="relative h-[min(60vh,500px)] rounded-xl bg-slate-900 overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white p-4 shadow">
        <label className="flex flex-1 min-w-[200px] items-center gap-2 text-sm">
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
        <button
          type="button"
          onClick={() => setImageSrc(null)}
          className="flex items-center gap-1 rounded border px-4 py-2 text-sm hover:bg-slate-50"
        >
          <RotateCcw size={16} />
          Yeni dosya
        </button>
        <button
          type="button"
          onClick={saveCrop}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          <Check size={16} />
          Soruyu kaydet
        </button>
        <button
          type="button"
          onClick={saveCrop}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus size={16} />
          Kaydet ve devam et
        </button>
      </div>
      <p className="text-xs text-slate-500 px-1">
        İpucu: Eski soru numaralarını kırpma kutusunun dışında bırakın; sistem
        otomatik numaralandırır.
      </p>
    </div>
  );
}
