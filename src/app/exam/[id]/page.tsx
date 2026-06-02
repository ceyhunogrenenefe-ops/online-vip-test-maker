"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getOnlineExam } from "@/lib/storage";
import type { OnlineExam } from "@/types";

export default function ExamPage() {
  const params = useParams();
  const id = params.id as string;
  const [exam, setExam] = useState<OnlineExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    getOnlineExam(id).then((e) => {
      setExam(e ?? null);
      setLoading(false);
    });
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
        <h1 className="text-xl font-bold">Sınav bulunamadı</h1>
        <p className="text-slate-600">
          Bu link geçersiz olabilir veya sınav henüz bu cihazda
          yayınlanmamış olabilir. Öğretmeninizden linki tekrar isteyin.
        </p>
        <p className="text-sm text-slate-400">
          Not: Şu an sınav verileri tarayıcıda saklanır; farklı cihazda
          açmak için bulut depolama (yakında) gerekebilir.
        </p>
      </div>
    );
  }

  const questions = exam.questionSnapshots;

  const submit = () => {
    if (!studentName.trim()) {
      alert("Ad soyad girin.");
      return;
    }
    const key = `exam-result:${exam.id}:${Date.now()}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        studentName,
        answers,
        submittedAt: Date.now(),
      })
    );
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold text-green-700">Teslim edildi</h1>
        <p>{studentName}, cevaplarınız kaydedildi.</p>
        <p className="text-sm text-slate-500">
          Öğretmen bu cihazda sonuçları görüntüleyebilir.
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
          <p className="text-sm mt-1">
            Süre: {exam.durationMinutes} dakika
          </p>
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
                src={q.imageDataUrl}
                alt={`Soru ${i + 1}`}
                className="mb-4 max-w-full rounded border"
              />
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
          onClick={submit}
          className="mt-8 w-full rounded-lg bg-dershanem-blue py-3 font-semibold text-white hover:bg-blue-700"
        >
          Sınavı Teslim Et
        </button>
      </div>
    </div>
  );
}
