"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { saveQuestion } from "@/lib/storage";
import {
  havuzGorselAdresi,
  havuzListele,
  havuzSil,
  havuzSoruGetir,
  type HavuzListe,
  type HavuzSoru,
} from "@/lib/havuz/istemci";

interface Props {
  onClose: () => void;
}

/** Soru Bankası: bütün öğretmenlerin yüklediği sorular (ortak havuz). */
export function QuestionBankModal({ onClose }: Props) {
  const questions = useAppStore((s) => s.questions);
  const draftIds = useAppStore((s) => s.draftIds);
  const addToDraft = useAppStore((s) => s.addToDraft);
  const addQuestion = useAppStore((s) => s.addQuestion);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);

  const [liste, setListe] = useState<HavuzSoru[]>([]);
  const [ben, setBen] = useState<HavuzListe["ben"] | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [ekleyen, setEkleyen] = useState("");

  useEffect(() => {
    let iptal = false;
    void havuzListele()
      .then((j) => {
        if (iptal) return;
        setListe(j.sorular);
        setBen(j.ben);
      })
      .catch((e: Error) => !iptal && setHata(e.message))
      .finally(() => !iptal && setYukleniyor(false));
    return () => {
      iptal = true;
    };
  }, []);

  // Havuza henüz ulaşmamış yerel sorular da listede kalsın.
  const havuzIdler = new Set(liste.map((s) => s.id));
  const yerelEk: HavuzSoru[] = questions
    .filter((q) => !havuzIdler.has(q.id))
    .map((q) => ({
      id: q.id,
      ekleyen: { id: ben?.id ?? "", ad: "Bu cihaz" },
      createdAt: q.createdAt,
      guncelleme: q.createdAt,
      label: q.label,
      pdfSourceName: q.pdfSourceName,
      pdfPage: q.pdfPage,
    }));
  const tumu = [...yerelEk, ...liste];

  const sorgu = arama.toLocaleLowerCase("tr-TR");
  const goren = tumu.filter((s) => {
    if (ekleyen && s.ekleyen.id !== ekleyen) return false;
    if (!sorgu) return true;
    return [s.label, s.pdfSourceName, s.ekleyen.ad].some((m) => m?.toLocaleLowerCase("tr-TR").includes(sorgu));
  });
  const ekleyenler = [...new Map(liste.map((s) => [s.ekleyen.id, s.ekleyen.ad])).entries()];

  const gorsel = (s: HavuzSoru) => questions.find((q) => q.id === s.id)?.imageDataUrl ?? havuzGorselAdresi(s);

  const ekle = async (s: HavuzSoru) => {
    setHata(null);
    if (questions.some((q) => q.id === s.id)) {
      addToDraft(s.id);
      void saveCurrentProject();
      return;
    }
    setMesgul(s.id);
    try {
      const q = await havuzSoruGetir(s.id);
      await saveQuestion(q, { yalnizYerel: true });
      addQuestion(q);
      void saveCurrentProject();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Soru alınamadı.");
    } finally {
      setMesgul(null);
    }
  };

  const sil = async (s: HavuzSoru) => {
    if (!confirm("Bu soru ortak havuzdan herkes için silinecek. Emin misiniz?")) return;
    setMesgul(s.id);
    try {
      await havuzSil("soru", s.id);
      setListe((p) => p.filter((x) => x.id !== s.id));
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Silinemedi.");
    } finally {
      setMesgul(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-bold">Soru Bankası</h2>
            <p className="text-xs text-slate-500">Ortak havuz: bütün öğretmenlerin yüklediği sorular</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-b px-4 py-2 text-sm">
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Kaynak PDF, etiket veya öğretmen ara"
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
          />
          <select value={ekleyen} onChange={(e) => setEkleyen(e.target.value)} className="rounded border px-2 py-1">
            <option value="">Tüm öğretmenler</option>
            {ekleyenler.map(([id, ad]) => (
              <option key={id} value={id}>
                {ad}
              </option>
            ))}
          </select>
        </div>
        {hata ? <p className="px-4 pt-2 text-sm text-amber-800">{hata}</p> : null}
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
          {yukleniyor && tumu.length === 0 ? (
            <p className="col-span-full py-8 text-center text-slate-500">Havuz yükleniyor…</p>
          ) : goren.length === 0 ? (
            <p className="col-span-full py-8 text-center text-slate-500">
              Henüz kayıtlı soru yok. Kırpma aracı ile ekleyin.
            </p>
          ) : (
            goren.map((s) => {
              const eklendi = draftIds.includes(s.id);
              const silebilir = !!ben && (ben.yonetici || ben.id === s.ekleyen.id) && havuzIdler.has(s.id);
              return (
                <div key={s.id} className="flex flex-col rounded-lg border p-2 text-left">
                  <button
                    type="button"
                    onClick={() => void ekle(s)}
                    disabled={eklendi || mesgul === s.id}
                    className="rounded hover:ring-2 hover:ring-dershanem-blue disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gorsel(s)} alt="Soru" loading="lazy" className="h-24 w-full object-contain" />
                  </button>
                  <span className="mt-1 truncate text-[11px] text-slate-500" title={s.pdfSourceName}>
                    {[s.ekleyen.ad, s.pdfSourceName, s.pdfPage ? `s.${s.pdfPage}` : ""].filter(Boolean).join(" · ")}
                  </span>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => void ekle(s)}
                      disabled={eklendi || mesgul === s.id}
                      className={eklendi ? "text-slate-400" : "font-semibold text-dershanem-navy"}
                    >
                      {eklendi ? "Eklendi" : mesgul === s.id ? "Ekleniyor…" : "Ekle"}
                    </button>
                    {silebilir ? (
                      <button
                        type="button"
                        onClick={() => void sil(s)}
                        disabled={mesgul === s.id}
                        className="text-red-600 disabled:opacity-50"
                      >
                        Havuzdan sil
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
