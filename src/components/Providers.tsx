"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { foyBankaListele, getAllQuestions } from "@/lib/storage";
import { havuzEsitle } from "@/lib/havuz/istemci";
import { blokEtiketi } from "@/lib/foy-icerik";
import type { DocBlock } from "@/lib/pdf-blocks";
import { ProjectAutosave } from "@/components/layout/ProjectAutosave";

export function Providers({ children }: { children: React.ReactNode }) {
  const setQuestions = useAppStore((s) => s.setQuestions);
  const hydrateProjects = useAppStore((s) => s.hydrateProjects);

  useEffect(() => {
    void (async () => {
      const questions = await getAllQuestions();
      setQuestions(questions);
      await hydrateProjects();

      // Bu tarayıcıda kalmış soruları ve föy bankasını ortak havuza taşı.
      const banka = await foyBankaListele();
      if (!questions.length && !banka.length) return;
      void havuzEsitle(
        questions,
        banka.map((k) => ({ ...k, etiket: blokEtiketi(k.blok as DocBlock) }))
      ).catch(() => undefined);
    })();
  }, [setQuestions, hydrateProjects]);

  return (
    <>
      <ProjectAutosave />
      {children}
    </>
  );
}
