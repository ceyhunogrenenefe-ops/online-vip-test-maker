"use client";

import { FormEvent, useState } from "react";

export default function GirisSayfasi() {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const gonder = async (e: FormEvent) => {
    e.preventDefault();
    setHata(null);
    setCalisiyor(true);
    try {
      const r = await fetch("/api/giris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: sifre }),
      });
      const j = (await r.json().catch(() => null)) as { hata?: string; tamam?: boolean } | null;
      if (!r.ok || !j?.tamam) {
        setHata(j?.hata || "Giriş yapılamadı.");
        return;
      }
      window.location.assign("/");
    } catch {
      setHata("Bağlantı kurulamadı. Yeniden deneyin.");
    } finally {
      setCalisiyor(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef4fa] px-4">
      <form
        onSubmit={(e) => void gonder(e)}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[#173b70]">Online VIP Test Maker</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Öğretmen girişi</h1>
        <p className="mt-2 text-sm text-slate-600">
          Smart VIP Koçlukta öğretmen veya koç olarak kayıtlı hesaplar girebilir. Öğrenci hesapları bu araca alınmaz.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          E-posta
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            data-test="giris-email"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Şifre
          <input
            type="password"
            autoComplete="current-password"
            required
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            data-test="giris-sifre"
          />
        </label>
        {hata ? (
          <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700" data-test="giris-hata">
            {hata}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={calisiyor}
          className="mt-4 w-full rounded-lg bg-[#173b70] py-2 text-sm font-semibold text-white disabled:opacity-60"
          data-test="giris-gonder"
        >
          {calisiyor ? "Kontrol ediliyor…" : "Giriş yap"}
        </button>
      </form>
    </main>
  );
}
