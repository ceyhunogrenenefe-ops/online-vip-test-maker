"use client";

import { useEffect, useState } from "react";
import type { DersSonuc } from "@/lib/deneme/model";

type DenemeOzet = { id: string; kod: string; ad: string; yayin: boolean; olusturma: number };
type SmsKayit = { durum: "gonderildi" | "hata"; hata: string | null; metin: string; saglayici: string };
type SonucSatir = {
  id: string;
  ad: string;
  soyad: string;
  telefonMaske: string;
  telefonKaynak: string;
  teslim: boolean;
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
            <code>{`${window.location.origin}/sinav/${aktif.kod}`}</code>
            <button type="button" className="rounded border px-2" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/sinav/${aktif.kod}`)}>
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
          <h3 className="font-bold text-dershanem-navy">Teslimler ve SMS</h3>
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
                        <div className="text-xs text-slate-500">
                          {o.telefonKaynak === "giris" ? "Girilen numara" : o.telefonKaynak === "veli" ? "Veli kaydı" : "Öğrenci kaydı"} {o.telefonMaske}
                        </div>
                      </td>
                      <td className="py-2 pr-2">{o.teslim ? "Teslim etti" : "Devam ediyor"}</td>
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
