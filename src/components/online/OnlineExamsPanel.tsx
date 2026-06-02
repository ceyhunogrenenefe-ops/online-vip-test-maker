"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Link2,
  Trash2,
  ExternalLink,
  Plus,
  Copy,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import {
  getAllOnlineExams,
  saveOnlineExam,
  deleteOnlineExam,
} from "@/lib/storage";
import type { OnlineExam } from "@/types";

export function OnlineExamsPanel() {
  const draftIds = useAppStore((s) => s.draftIds);
  const questions = useAppStore((s) => s.questions);
  const paperSettings = useAppStore((s) => s.paperSettings);
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [creating, setCreating] = useState(false);

  const load = () => getAllOnlineExams().then(setExams);
  useEffect(() => {
    load();
  }, []);

  const publish = async () => {
    if (draftIds.length === 0) {
      alert("Yayınlamak için önce soru ekleyin.");
      return;
    }
    setCreating(true);
    const snapshots = draftIds
      .map((id) => questions.find((q) => q.id === id))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .map((q) => ({ id: q.id, imageDataUrl: q.imageDataUrl }));

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
    alert(`Sınav yayınlandı! Link kopyalandı:\n${url}`);
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

  return (
    <div className="m-4 flex flex-1 flex-col rounded-xl bg-white shadow">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-lg font-bold text-dershanem-navy">
            Online Testlerim
          </h2>
          <p className="text-sm text-slate-500">
            Yayınlanan testler · Depolama: {exams.length} / 50
          </p>
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={creating}
          className="flex items-center gap-2 rounded-lg bg-dershanem-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus size={18} />
          Mevcut taslağı yayınla
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {exams.length === 0 ? (
          <p className="py-12 text-center text-slate-500">
            Henüz online test yok. Ana sayfada soruları hazırlayıp
            &quot;Mevcut taslağı yayınla&quot; ile paylaşın.
          </p>
        ) : (
          <ul className="space-y-3">
            {exams.map((exam) => (
              <li
                key={exam.id}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium">{exam.title}</p>
                  <p className="text-sm text-slate-500">
                    {exam.schoolName} · {exam.questionIds.length} soru ·{" "}
                    {new Date(exam.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(exam.id)}
                    className="rounded p-2 hover:bg-slate-100"
                    title="Linki kopyala"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyLink(exam.id)}
                    className="rounded p-2 hover:bg-slate-100"
                    title="Paylaş"
                  >
                    <Link2 size={18} />
                  </button>
                  <a
                    href={`/exam/${exam.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-2 hover:bg-slate-100"
                    title="Önizleme"
                  >
                    <ExternalLink size={18} />
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(exam.id)}
                    className="rounded p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
