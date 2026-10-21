"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor } from "lucide-react";
import {
  akisiKapat,
  ekranHatasi,
  ekranPaylasimiVar,
  ekranPaylasiminiAc,
  EKRAN_YOK,
  videoKaresi,
} from "@/lib/ekran-yakala";

/**
 * Z-kitap, tarayıcı sekmesi veya açık dosya penceresini gösterir.
 * Öğretmen kareyi alınca mevcut kırpma kutusu devreye girer.
 */
export function EkranSeridi({
  akis,
  onAkis,
  onKare,
}: {
  akis: MediaStream | null;
  onAkis: (stream: MediaStream | null) => void;
  onKare: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [aciliyor, setAciliyor] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !akis) return;
    video.srcObject = akis;
    void video.play().catch(() => undefined);
    const iz = akis.getVideoTracks()[0];
    const bitti = () => onAkis(null);
    iz?.addEventListener("ended", bitti);
    return () => {
      iz?.removeEventListener("ended", bitti);
      video.srcObject = null;
    };
  }, [akis, onAkis]);

  const baslat = async () => {
    setHata(null);
    if (!ekranPaylasimiVar()) {
      setHata(EKRAN_YOK);
      return;
    }
    setAciliyor(true);
    try {
      akisiKapat(akis);
      onAkis(await ekranPaylasiminiAc());
    } catch (e) {
      setHata(ekranHatasi(e));
    } finally {
      setAciliyor(false);
    }
  };

  const kapat = () => {
    akisiKapat(akis);
    onAkis(null);
  };

  const kare = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      onKare(videoKaresi(video));
      setHata(null);
    } catch (e) {
      setHata(ekranHatasi(e));
    }
  };

  return (
    <div className="space-y-2" data-test="ekran-seridi">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void baslat()}
          disabled={aciliyor}
          className="inline-flex items-center gap-1 rounded-lg bg-[#173b70] px-3 py-2 text-sm font-semibold text-white hover:bg-[#102848] disabled:opacity-60"
          data-test="ekran-ac"
        >
          <Monitor size={16} />
          Açık sayfadan al
        </button>
        {akis ? (
          <>
            <button
              type="button"
              onClick={kare}
              className="rounded-lg bg-dershanem-blue px-3 py-2 text-sm font-semibold text-white"
              data-test="ekran-kare"
            >
              Bu kareyi kırp
            </button>
            <button type="button" onClick={kapat} className="rounded-lg border px-3 py-2 text-sm">
              Paylaşımı kapat
            </button>
          </>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        Z-kitap, tarayıcı sekmesi veya bilgisayarda açık dosya penceresini seçin. Sayfa burada görünür;
        sorunun olduğu kareyi alıp kırparsınız. Görüntü dışarı gönderilmez.
      </p>
      {hata ? <p className="rounded bg-amber-50 p-2 text-xs text-amber-950">{hata}</p> : null}
      {akis ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="max-h-[42vh] w-full rounded border bg-black object-contain"
        />
      ) : null}
    </div>
  );
}
