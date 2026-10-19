"use client";

import {
  BRANS_ONERILERI,
  DONEMLER,
  FOY_TURLERI,
  SINIFLAR,
  YAZILILAR,
  egitimYillari,
  kapakSatirlari,
  type FoyKunye,
} from "@/lib/foy-kunye";

export function FoyKunyeForm({
  kunye,
  onChange,
}: {
  kunye: FoyKunye;
  onChange: (k: FoyKunye) => void;
}) {
  const yillar = egitimYillari();
  const satirlar = kapakSatirlari(kunye);
  const alan = "mt-0.5 w-full rounded border border-slate-300 px-2 py-1";

  const set = <K extends keyof FoyKunye>(anahtar: K, deger: FoyKunye[K]) =>
    onChange({ ...kunye, [anahtar]: deger });

  return (
    <div className="space-y-2 text-xs">
      <label className="block">
        Doküman adı
        <input
          value={kunye.dokumanAdi}
          onChange={(e) => set("dokumanAdi", e.target.value)}
          placeholder="Örn. 7-A rasyonel sayılar"
          className={alan}
          data-test="foy-ad"
        />
      </label>
      <label className="block">
        Ders / branş
        <input
          value={kunye.brans}
          onChange={(e) => set("brans", e.target.value)}
          list="foy-branslar"
          className={alan}
        />
        <datalist id="foy-branslar">
          {BRANS_ONERILERI.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          Sınıf
          <select
            value={kunye.sinif}
            onChange={(e) => set("sinif", Number(e.target.value))}
            className={alan}
            data-test="foy-sinif"
          >
            {SINIFLAR.map((n) => (
              <option key={n} value={n}>
                {n}. sınıf
              </option>
            ))}
          </select>
        </label>
        <label>
          Eğitim-öğretim yılı
          <select
            value={kunye.egitimYili}
            onChange={(e) => set("egitimYili", e.target.value)}
            className={alan}
            data-test="foy-yil"
          >
            {yillar.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dönem
          <select
            value={kunye.donem}
            onChange={(e) => set("donem", e.target.value as FoyKunye["donem"])}
            className={alan}
            data-test="foy-donem"
          >
            {DONEMLER.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Yazılı numarası
          <select
            value={kunye.yazili}
            onChange={(e) => set("yazili", e.target.value as FoyKunye["yazili"])}
            className={alan}
            data-test="foy-yazili"
          >
            {YAZILILAR.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        Föy türü
        <select
          value={kunye.tur}
          onChange={(e) => set("tur", e.target.value as FoyKunye["tur"])}
          className={alan}
          data-test="foy-tur"
        >
          {FOY_TURLERI.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Ünite / konu
        <input
          value={kunye.konu}
          onChange={(e) => set("konu", e.target.value)}
          className={alan}
          data-test="foy-konu"
        />
      </label>
      <label className="block">
        Hazırlayan öğretmen
        <input
          value={kunye.ogretmen}
          onChange={(e) => set("ogretmen", e.target.value)}
          className={alan}
        />
      </label>
      <label className="block">
        İnternet sitesi (alt bilgi, isteğe bağlı)
        <input
          value={kunye.website}
          onChange={(e) => set("website", e.target.value)}
          placeholder="www.onlinevipdershane.com"
          className={alan}
        />
      </label>
      <div className="rounded-lg bg-slate-50 p-2 text-center leading-5 text-slate-800" data-test="foy-kapak">
        {satirlar.map((s) => (
          <div key={s} className={s.startsWith("ONLINE") ? "font-bold text-dershanem-navy" : ""}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
