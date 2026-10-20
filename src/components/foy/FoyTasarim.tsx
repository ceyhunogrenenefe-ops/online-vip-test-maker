"use client";

import type { FoyTasarim } from "@/lib/foy-kunye";

export function FoyTasarimPanel({
  tasarim,
  onChange,
}: {
  tasarim: FoyTasarim;
  onChange: (t: FoyTasarim) => void;
}) {
  const alan = "mt-0.5 w-full rounded border border-slate-300 px-2 py-1";
  const set = <K extends keyof FoyTasarim>(k: K, v: FoyTasarim[K]) => onChange({ ...tasarim, [k]: v });

  return (
    <div className="space-y-2 text-xs">
      <button
        type="button"
        className="w-full rounded-lg border border-slate-300 px-2 py-2 text-left hover:bg-slate-50"
        onClick={() =>
          onChange({
            ...tasarim,
            yon: "portrait",
            sutun: 1,
            filigran: true,
            filigranLogo: false,
            kenarMm: 14,
          })
        }
      >
        Siyah-beyaz yazıcı ön ayarı
        <span className="mt-0.5 block text-[11px] text-slate-500">
          Tek sütun, geniş kenar, açık metin filigranı. Kurum renkleri yazıcıda gri basılır.
        </span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <label>
          Sayfa
          <select
            value={tasarim.yon}
            onChange={(e) => set("yon", e.target.value as FoyTasarim["yon"])}
            className={alan}
          >
            <option value="portrait">A4 dikey</option>
            <option value="landscape">A4 yatay</option>
          </select>
        </label>
        <label>
          Sütun
          <select
            value={tasarim.sutun}
            onChange={(e) => set("sutun", Number(e.target.value) as 1 | 2)}
            className={alan}
          >
            <option value={1}>Tek sütun</option>
            <option value={2}>İki sütun</option>
          </select>
        </label>
        <label>
          Kenar (mm)
          <input
            type="number"
            min={8}
            max={25}
            value={tasarim.kenarMm}
            onChange={(e) => set("kenarMm", Number(e.target.value))}
            className={alan}
          />
        </label>
        <label>
          Soru aralığı (mm)
          <input
            type="number"
            min={0}
            max={20}
            value={tasarim.soruAraligiMm}
            onChange={(e) => set("soruAraligiMm", Number(e.target.value))}
            className={alan}
          />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={tasarim.akilliYerlesim}
          onChange={(e) => set("akilliYerlesim", e.target.checked)}
          data-test="foy-akilli-yerlesim"
        />
        Akıllı yerleştirme
      </label>
      <p className="text-[11px] text-slate-500">
        Sütunun dibine sığmayan çözüm boşluğu kısalır. Soru sırası değişmez; boş kağıt azalır.
      </p>
      <label className="block">
        Çözüm alanı
        <select
          value={tasarim.cozum}
          onChange={(e) => set("cozum", e.target.value as FoyTasarim["cozum"])}
          className={alan}
        >
          <option value="yok">Yok</option>
          <option value="cizgili">Çizgili</option>
          <option value="kareli">Kareli</option>
          <option value="bos">Boş</option>
        </select>
      </label>
      {tasarim.cozum !== "yok" ? (
        <label className="block">
          Sorunun altındaki çözüm boşluğu (satır)
          <input
            type="number"
            min={1}
            max={20}
            value={tasarim.cozumSatir}
            onChange={(e) => set("cozumSatir", Number(e.target.value))}
            className={alan}
          />
        </label>
      ) : null}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={tasarim.filigran}
          onChange={(e) => set("filigran", e.target.checked)}
        />
        Sayfa ortasında ONLINE VIP DERSHANE filigranı
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={tasarim.filigranLogo}
          onChange={(e) => set("filigranLogo", e.target.checked)}
          disabled={!tasarim.filigran}
        />
        Kurum logosu yüklüyse onu kullan
      </label>
      <p className="text-[11px] text-slate-500">
        Logo, koçluk platformundaki kurumsal kimlikten okunur. Logo yoksa metin filigranı kalır;
        yerine rastgele bir logo konmaz.
      </p>
    </div>
  );
}
