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
import {
  onlineTestLinki,
  sunucuTeslimleri,
  sunucudaVarMi,
  sunucudanSil,
  sunucuyaYukle,
  type SunucuTeslim,
} from "@/lib/online/istemci";

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

export function OnlineExamsPanel() {
  const draftIds = useAppStore((s) => s.draftIds);
  const questions = useAppStore((s) => s.questions);
  const paperSettings = useAppStore((s) => s.paperSettings);
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [creating, setCreating] = useState(false);
  const [viewResultsId, setViewResultsId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SunucuTeslim[]>([]);
  const [sonucDurum, setSonucDurum] = useState("");
  const [durum, setDurum] = useState("");

  const draftQuestions = draftIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q);

  const load = () => getAllOnlineExams().then((l) => (setExams(l), l));

  /** Eski sürümde yalnızca bu tarayıcıda kalan testleri sunucuya taşır; daha önce verilen linkler de açılır. */
  const eskileriTasi = async (liste: OnlineExam[]) => {
    const bekleyen = liste.filter((e) => !e.sunucuda);
    for (let i = 0; i < bekleyen.length; i++) {
      const e = bekleyen[i];
      try {
        if (await sunucudaVarMi(e.id)) {
          await saveOnlineExam({ ...e, sunucuda: true });
        } else {
          await sunucuyaYukle(e, (n, t) =>
            setDurum(`Eski testler sunucuya aktarılıyor (${i + 1}/${bekleyen.length}): ${e.title} ${n}/${t}`)
          );
        }
      } catch (err) {
        setDurum(`"${e.title}" sunucuya aktarılamadı: ${err instanceof Error ? err.message : "hata"}`);
        return;
      }
    }
    if (bekleyen.length) {
      setDurum("");
      await load();
    }
  };

  useEffect(() => {
    void load().then(eskileriTasi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!viewResultsId) return;
    setSubmissions([]);
    setSonucDurum("Yükleniyor...");
    sunucuTeslimleri(viewResultsId)
      .then((l) => {
        setSubmissions(l);
        setSonucDurum("");
      })
      .catch((e: Error) => setSonucDurum(e.message));
  }, [viewResultsId]);

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
    try {
      await saveOnlineExam(exam);
      await sunucuyaYukle(exam, (n, t) => setDurum(`Yayınlanıyor: görseller ${n}/${t}`));
      await load();
      const url = onlineTestLinki(exam.id);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      alert(`Online test yayınlandı!\nLink kopyalandı:\n${url}`);
    } catch (e) {
      await load();
      alert(`Test sunucuya yüklenemedi, link öğrencilerde açılmaz: ${e instanceof Error ? e.message : "hata"}\nTekrar denemek için link simgesine basın.`);
    } finally {
      setDurum("");
      setCreating(false);
    }
  };

  const copyLink = async (exam: OnlineExam) => {
    try {
      if (!exam.sunucuda) {
        await sunucuyaYukle(exam, (n, t) => setDurum(`Sunucuya yükleniyor: ${n}/${t}`));
        await load();
      }
      const url = onlineTestLinki(exam.id);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      alert(`Link kopyalandı:\n${url}`);
    } catch (e) {
      alert(`Test sunucuya yüklenemedi: ${e instanceof Error ? e.message : "hata"}`);
    } finally {
      setDurum("");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Bu online testi silmek istiyor musunuz?")) return;
    try {
      await sunucudanSil(id);
    } catch (e) {
      alert(`Sunucudan silinemedi: ${e instanceof Error ? e.message : "hata"}`);
      return;
    }
    await deleteOnlineExam(id);
    if (viewResultsId === id) setViewResultsId(null);
    load();
  };

  const viewExam = exams.find((e) => e.id === viewResultsId);

  return (
    <div className="m-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow">
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

      {durum && (
        <div className="border-b bg-blue-50 px-4 py-2 text-sm text-blue-800">{durum}</div>
      )}

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
                        {!exam.sunucuda && (
                          <p className="text-xs text-amber-700">
                            Sunucuya yüklenmedi — link öğrencilerde açılmaz. Link simgesine basınca yüklenir.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void copyLink(exam)}
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
            {sonucDurum ? (
              <p className="text-xs text-slate-500">{sonucDurum}</p>
            ) : submissions.length === 0 ? (
              <p className="text-xs text-slate-500">Henüz teslim yok.</p>
            ) : (
              <ul className="space-y-2">
                {submissions.map((s, i) => (
                    <li
                      key={i}
                      className="rounded border bg-white p-2 text-sm"
                    >
                      <p className="font-medium">{s.studentName}</p>
                      {s.total > 0 ? (
                        <p className="text-green-700">
                          {s.score} / {s.total} doğru
                        </p>
                      ) : (
                        <p className="text-slate-500">Anahtar yok</p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        {new Date(s.submittedAt).toLocaleString("tr-TR")}
                      </p>
                    </li>
                ))}
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
