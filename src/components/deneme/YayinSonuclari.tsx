"use client";

import { useEffect, useState } from "react";
import { sinavLinki } from "@/lib/deneme/havuz";
import type { DersSonuc } from "@/lib/deneme/model";

type DenemeOzet = { id: string; kod: string; ad: string; yayin: boolean; olusturma: number };
type SmsKayit = { durum: "gonderildi" | "hata"; hata: string | null; metin: string; saglayici: string };
type SonucSatir = {
  id: string;
  ad: string;
  soyad: string;
  telefonMaske: string;
  telefon?: string;
  telefonKaynak: string;
  teslim: boolean;
  teslimZamani?: number | null;
  sonuc: { dogru: number; yanlis: number; bos: number; net: number; dersler: DersSonuc[] } | null;
  sms: SmsKayit[];
};

async function api<T>(sorgu: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/deneme${sorgu}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await r.json()) as T & { hata?: string };
  if (!r.ok) throw new Error(json.hata || "İşlem tamamlanamadı.");
  return json;
}

function excelIndir(ad: string, satirlar: SonucSatir[]) {
  const dersler = [...new Set(satirlar.flatMap((o) => o.sonuc?.dersler.map((d) => d.ders) ?? []))];
  const hucre = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const baslik = ["Ad", "Soyad", "Telefon", "Telefon kaynağı", "Durum", "Teslim zamanı", "Doğru", "Yanlış", "Boş", "Net", ...dersler.map((d) => `${d} net`)];
  const govde = satirlar.map((o) => [
    o.ad,
    o.soyad,
    o.telefon || o.telefonMaske,
    o.telefonKaynak === "giris" ? "Öğrencinin girdiği" : o.telefonKaynak === "veli" ? "Veli kaydı" : "Öğrenci kaydı",
    o.teslim ? "Teslim etti" : "Devam ediyor",
    o.teslimZamani ? new Date(o.teslimZamani).toLocaleString("tr-TR") : "",
    o.sonuc?.dogru ?? "",
    o.sonuc?.yanlis ?? "",
    o.sonuc?.bos ?? "",
    o.sonuc ? String(o.sonuc.net).replace(".", ",") : "",
    ...dersler.map((d) => {
      const x = o.sonuc?.dersler.find((y) => y.ders === d);
      return x ? String(x.net).replace(".", ",") : "";
    }),
  ]);
  // Türkçe Excel noktalı virgül ayırıcı ve BOM ister.
  const csv = "\uFEFF" + [baslik, ...govde].map((r) => r.map(hucre).join(";")).join("\r\n");
  const u = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = `${ad} - katılımcılar.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}

/** Online yayımlanan denemelerin teslimleri ve SMS durumu. */
export function YayinSonuclari() {
  const [denemeler, setDenemeler] = useState<DenemeOzet[]>([]);
  const [aktif, setAktif] = useState<DenemeOzet | null>(null);
  const [sonuclar, setSonuclar] = useState<SonucSatir[]>([]);
  const [hata, setHata] = useState("");

  useEffect(() => {
    void api<{ denemeler: DenemeOzet[] }>("?op=havuz")
      .then((v) => setDenemeler(v.denemeler.filter((d) => d.yayin)))
      .catch((e: Error) => setHata(e.message));
  }, []);

  const getir = async (d: DenemeOzet) => {
    setAktif(d);
    try {
      const v = await api<{ oturumlar: SonucSatir[] }>(`?op=sonuclar&id=${encodeURIComponent(d.id)}`);
      setSonuclar(v.oturumlar);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Sonuçlar okunamadı.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-dershanem-navy">Yayındaki denemeler</h2>
        {hata ? <p className="mt-2 text-sm text-red-700">{hata}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {denemeler.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`rounded border px-3 py-1 text-sm ${aktif?.id === d.id ? "bg-dershanem-navy text-white" : ""}`}
              onClick={() => void getir(d)}
            >
              {d.ad}
            </button>
          ))}
          {!denemeler.length && !hata ? <p className="text-sm text-slate-500">Henüz online yayınlanan deneme yok.</p> : null}
        </div>
        {aktif ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Link:</span>
            <code>{sinavLinki(aktif.kod)}</code>
            <button type="button" className="rounded border px-2" onClick={() => void navigator.clipboard.writeText(sinavLinki(aktif.kod))}>
              Kopyala
            </button>
            <a className="rounded border px-2" href={`/onizleme/${aktif.id}`} target="_blank" rel="noreferrer">
              Önizle
            </a>
          </div>
        ) : null}
      </section>

      {aktif ? (
        <section className="rounded-xl bg-white p-4 shadow">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-dershanem-navy">Katılımcılar ({sonuclar.length})</h3>
            <button
              type="button"
              disabled={!sonuclar.length}
              className="ml-auto rounded bg-green-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => excelIndir(aktif.ad, sonuclar)}
            >
              Excel’e indir
            </button>
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void getir(aktif)}>
              Yenile
            </button>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-1 pr-2">Öğrenci</th>
                  <th className="py-1 pr-2">Durum</th>
                  <th className="py-1 pr-2">Sonuç</th>
                  <th className="py-1">SMS</th>
                </tr>
              </thead>
              <tbody>
                {sonuclar.map((o) => {
                  const son = o.sms[o.sms.length - 1];
                  return (
                    <tr key={o.id} className="border-b align-top">
                      <td className="py-2 pr-2">
                        {o.ad} {o.soyad}
                        <div className="text-xs text-slate-600">
                          <a className="font-semibold text-dershanem-blue" href={`tel:${o.telefon || ""}`}>
                            {o.telefon || o.telefonMaske}
                          </a>{" "}
                          · {o.telefonKaynak === "giris" ? "öğrencinin girdiği" : o.telefonKaynak === "veli" ? "veli kaydı" : "öğrenci kaydı"}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        {o.teslim ? "Teslim etti" : "Devam ediyor"}
                        {o.teslimZamani ? <div className="text-xs text-slate-500">{new Date(o.teslimZamani).toLocaleString("tr-TR")}</div> : null}
                      </td>
                      <td className="py-2 pr-2">
                        {o.sonuc ? (
                          <>
                            <div>
                              D {o.sonuc.dogru} · Y {o.sonuc.yanlis} · B {o.sonuc.bos} · Net {String(o.sonuc.net).replace(".", ",")}
                            </div>
                            <div className="text-xs text-slate-600">
                              {o.sonuc.dersler.map((d) => `${d.ders} ${String(d.net).replace(".", ",")}`).join(" · ")}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2">
                        {son ? (
                          <>
                            <div>{son.durum === "hata" ? "Gönderilemedi" : son.saglayici === "twilio" ? "Gönderildi" : "SMS metni kayda alındı"}</div>
                            {son.hata ? <div className="text-xs text-red-700">{son.hata}</div> : null}
                            {son.durum === "hata" ? (
                              <button
                                type="button"
                                className="mt-1 text-xs font-semibold text-dershanem-blue"
                                onClick={async () => {
                                  await api("", { op: "sms", oturumId: o.id }).catch((e: Error) => setHata(e.message));
                                  await getir(aktif);
                                }}
                              >
                                Yeniden gönder
                              </button>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!sonuclar.length ? <p className="py-3 text-sm text-slate-500">Henüz katılan yok.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
