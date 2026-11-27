"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getOnlineExam } from "@/lib/storage";
import {
  ogrenciTestiGetir,
  sunucuyaYukle,
  testTeslimEt,
  type OgrenciTesti,
} from "@/lib/online/istemci";

export default function ExamPage() {
  const params = useParams();
  const id = params.id as string;
  const [exam, setExam] = useState<OgrenciTesti | null>(null);
  const [yukHata, setYukHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [score, setScore] = useState<{ correct: number; total: number } | null>(
    null
  );

  useEffect(() => {
    let iptal = false;
    (async () => {
      let t = await ogrenciTestiGetir(id);
      if (!t) {
        // Eski sürümde yalnızca öğretmenin tarayıcısında kalan test: bu cihazdaysa sunucuya taşı.
        const yerel = await getOnlineExam(id).catch(() => undefined);
        if (yerel) {
          await sunucuyaYukle(yerel);
          t = await ogrenciTestiGetir(id);
        }
      }
      if (!iptal) setExam(t);
    })()
      .catch((e: Error) => !iptal && setYukHata(e.message || "Sınav yüklenemedi."))
      .finally(() => !iptal && setLoading(false));
    return () => {
      iptal = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Yükleniyor...
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-bold">{yukHata ? "Sınav yüklenemedi" : "Sınav bulunamadı"}</h1>
        <p className="text-slate-600">
          {yukHata
            ? `${yukHata} Sayfayı yenileyip tekrar deneyin.`
            : "Bu link geçersiz olabilir veya sınav silinmiş olabilir. Öğretmeninizden linki yeniden isteyin."}
        </p>
      </div>
    );
  }

  const questions = exam.sorular;

  const submit = async () => {
    if (!studentName.trim()) {
      alert("Ad soyad girin.");
      return;
    }
    const unanswered = questions.findIndex((_, i) => !answers[i]);
    if (unanswered >= 0) {
      const ok = confirm(
        `${unanswered + 1}. soru boş. Yine de teslim edilsin mi?`
      );
      if (!ok) return;
    }

    setGonderiliyor(true);
    try {
      const r = await testTeslimEt(exam.id, studentName, answers);
      setScore(r.total > 0 ? { correct: r.score, total: r.total } : null);
      setSubmitted(true);
    } catch (e) {
      alert(`Teslim edilemedi: ${e instanceof Error ? e.message : "bağlantı hatası"}. Tekrar deneyin.`);
    } finally {
      setGonderiliyor(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold text-green-700">Teslim edildi</h1>
        <p>{studentName}, cevaplarınız kaydedildi.</p>
        {score && score.total > 0 && (
          <p className="text-lg font-semibold text-dershanem-navy">
            Sonuç: {score.correct} / {score.total} doğru
          </p>
        )}
        <p className="text-sm text-slate-500">
          Öğretmen sonuçları Online Testlerim bölümünden görebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="px-6 py-4 text-white"
        style={{ backgroundColor: "#1a2744" }}
      >
        <p className="text-sm opacity-80">{exam.schoolName}</p>
        <h1 className="text-xl font-bold">{exam.title}</h1>
        {exam.durationMinutes && (
          <p className="mt-1 text-sm">Süre: {exam.durationMinutes} dakika</p>
        )}
      </header>

      <div className="mx-auto max-w-3xl p-6">
        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-medium">Ad Soyad</span>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="Öğrenci adı"
          />
        </label>

        <ol className="space-y-8">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-xl bg-white p-4 shadow">
              <p className="mb-3 font-bold text-dershanem-navy">
                Soru {i + 1}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={q.gorsel}
                alt={`Soru ${i + 1}`}
                className="mb-4 max-w-full rounded border"
              />
              <p className="mb-2 text-xs text-slate-500">Cevabınızı işaretleyin</p>
              <div className="flex flex-wrap gap-3">
                {["A", "B", "C", "D", "E"].map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 ${
                      answers[i] === opt
                        ? "border-dershanem-blue bg-dershanem-sky"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${i}`}
                      value={opt}
                      checked={answers[i] === opt}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [i]: opt }))
                      }
                      className="sr-only"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={gonderiliyor}
          className="mt-8 w-full rounded-lg bg-dershanem-blue py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {gonderiliyor ? "Gönderiliyor..." : "Sınavı Teslim Et"}
        </button>
      </div>
    </div>
  );
}
