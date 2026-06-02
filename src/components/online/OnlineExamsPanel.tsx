"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Trash2,
  ExternalLink,
  Plus,
  Copy,
  FileKey,
  ClipboardList,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import {
  getAllOnlineExams,
  saveOnlineExam,
  deleteOnlineExam,
} from "@/lib/storage";
import type { OnlineExam, QuestionSnapshot } from "@/types";
import {
  downloadAnswerKeyFromExam,
  downloadAnswerKeyFromQuestions,
} from "@/lib/answer-key-pdf";
import { gradeAnswers } from "@/lib/answer-key-pdf";

function buildSnapshots(
  draftIds: string[],
  questions: ReturnType<typeof useAppStore.getState>["questions"]
): QuestionSnapshot[] {
  return draftIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => ({
      id: q.id,
      imageDataUrl: q.imageDataUrl,
      answerKey: q.answerKey,
    }));
}

function loadSubmissions(examId: string) {
  const results: {
    studentName: string;
    answers: Record<number, string>;
    submittedAt: number;
    score?: number;
    total?: number;
  }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(`exam-result:${examId}:`)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key) ?? "{}");
      if (data.studentName) results.push(data);
    } catch {
      /* skip */
    }
  }
  return results.sort((a, b) => b.submittedAt - a.submittedAt);
}

export function OnlineExamsPanel() {
  const draftIds = useAppStore((s) => s.draftIds);
  const questions = useAppStore((s) => s.questions);
  const paperSettings = useAppStore((s) => s.paperSettings);
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [creating, setCreating] = useState(false);
  const [viewResultsId, setViewResultsId] = useState<string | null>(null);

  const draftQuestions = draftIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q);

  const load = () => getAllOnlineExams().then(setExams);
  useEffect(() => {
    load();
  }, []);

  const publish = async () => {
    if (draftIds.length === 0) {
      alert("Yayınlamak için önce soru ekleyin.");
      return;
    }
    const missingKey = draftQuestions.filter((q) => !q.answerKey).length;
    if (missingKey > 0) {
      const ok = confirm(
        `${missingKey} soruda cevap anahtarı yok. Yine de yayınlansın mı? (Otomatik puanlama yapılamaz)`
      );
      if (!ok) return;
    }

    setCreating(true);
    const snapshots = buildSnapshots(draftIds, questions);

    const exam: OnlineExam = {
      id: uuidv4().slice(0, 8),
      title: paperSettings.testName || "Online Test",
      schoolName: paperSettings.schoolName || "Dershanem",
      questionIds: [...draftIds],
      questionSnapshots: snapshots,
      createdAt: Date.now(),
      published: true,
      durationMinutes: 40,
    };
    await saveOnlineExam(exam);
    await load();
    setCreating(false);
    const url = `${window.location.origin}/exam/${exam.id}`;
    navigator.clipboard.writeText(url);
    alert(`Online test yayınlandı!\nLink kopyalandı:\n${url}`);
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/exam/${id}`;
    navigator.clipboard.writeText(url);
    alert("Link kopyalandı.");
  };

  const remove = async (id: string) => {
    if (!confirm("Bu online testi silmek istiyor musunuz?")) return;
    await deleteOnlineExam(id);
    load();
  };

  const viewExam = exams.find((e) => e.id === viewResultsId);
  const submissions = viewResultsId ? loadSubmissions(viewResultsId) : [];

  return (
    <div className="m-4 flex flex-1 flex-col rounded-xl bg-white shadow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-lg font-bold text-dershanem-navy">
            Online Testlerim
          </h2>
          <p className="text-sm text-slate-500">
            Cevap anahtarı girilmiş sorular otomatik puanlanır
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void downloadAnswerKeyFromQuestions(
                draftQuestions,
                paperSettings.testName || "Test",
                paperSettings.schoolName || "Dershanem"
              )
            }
            disabled={draftQuestions.length === 0}
            className="flex items-center gap-1 rounded-lg border border-dershanem-navy px-3 py-2 text-sm font-medium text-dershanem-navy disabled:opacity-50"
          >
            <FileKey size={16} />
            Taslak cevap anahtarı PDF
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus size={18} />
            Online test yayınla
          </button>
        </div>
      </div>

      {draftQuestions.length > 0 && (
        <div className="border-b bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Taslak sorular — cevap anahtarı durumu
          </p>
          <div className="flex flex-wrap gap-2">
            {draftQuestions.map((q, i) => (
              <span
                key={q.id}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  q.answerKey
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {i + 1}. {q.answerKey ?? "?"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          {exams.length === 0 ? (
            <p className="py-12 text-center text-slate-500">
              Henüz online test yok. Sorulara A–E cevap anahtarı ekleyip
              yayınlayın.
            </p>
          ) : (
            <ul className="space-y-3">
              {exams.map((exam) => {
                const keyCount = exam.questionSnapshots.filter(
                  (q) => q.answerKey
                ).length;
                return (
                  <li
                    key={exam.id}
                    className="rounded-lg border p-4 hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{exam.title}</p>
                        <p className="text-sm text-slate-500">
                          {exam.schoolName} · {exam.questionSnapshots.length}{" "}
                          soru · {keyCount} cevap anahtarlı ·{" "}
                          {new Date(exam.createdAt).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => copyLink(exam.id)}
                          className="rounded p-2 hover:bg-slate-100"
                          title="Link"
                        >
                          <Copy size={18} />
                        </button>
                        <a
                          href={`/exam/${exam.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-2 hover:bg-slate-100"
                          title="Öğrenci görünümü"
                        >
                          <ExternalLink size={18} />
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadAnswerKeyFromExam(
                              exam.title,
                              exam.schoolName,
                              exam.questionSnapshots
                            )
                          }
                          className="rounded p-2 hover:bg-slate-100"
                          title="Cevap anahtarı PDF"
                        >
                          <FileKey size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setViewResultsId(
                              viewResultsId === exam.id ? null : exam.id
                            )
                          }
                          className="rounded p-2 hover:bg-slate-100"
                          title="Sonuçlar"
                        >
                          <ClipboardList size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(exam.id)}
                          className="rounded p-2 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {viewExam && (
          <aside className="w-80 shrink-0 border-l bg-slate-50 p-4 overflow-y-auto">
            <h3 className="mb-2 font-bold text-sm">Sonuçlar — {viewExam.title}</h3>
            {submissions.length === 0 ? (
              <p className="text-xs text-slate-500">
                Henüz teslim yok (aynı tarayıcıda kaydedilir).
              </p>
            ) : (
              <ul className="space-y-2">
                {submissions.map((s, i) => {
                  const graded = gradeAnswers(
                    viewExam.questionSnapshots,
                    s.answers
                  );
                  return (
                    <li
                      key={i}
                      className="rounded border bg-white p-2 text-sm"
                    >
                      <p className="font-medium">{s.studentName}</p>
                      {graded.total > 0 ? (
                        <p className="text-green-700">
                          {graded.correct} / {graded.total} doğru
                        </p>
                      ) : (
                        <p className="text-slate-500">Anahtar yok</p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        {new Date(s.submittedAt).toLocaleString("tr-TR")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setViewResultsId(null)}
              className="mt-3 text-xs text-dershanem-blue hover:underline"
            >
              Kapat
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
