"use client";

import { useEffect, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { downloadBlob } from "@/lib/pdf";

interface Props {
  blob: Blob;
  filename: string;
  onClose: () => void;
}

export function PdfPreviewModal({ blob, filename, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/60 p-2 md:p-6">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-bold text-dershanem-navy">PDF Önizleme</h2>
            <p className="text-xs text-slate-500">
              Kontrol edin, ardından indirin
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadBlob(blob, filename)}
              className="flex items-center gap-2 rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Download size={18} />
              PDF Oluştur / İndir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-3 py-2 hover:bg-slate-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-200 p-2">
          {url ? (
            <iframe
              src={url}
              title="PDF önizleme"
              className="h-full w-full rounded-lg border bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-slate-500">
              <Loader2 className="animate-spin" />
              Önizleme hazırlanıyor...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
