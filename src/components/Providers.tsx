"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getAllQuestions } from "@/lib/storage";
import { ProjectAutosave } from "@/components/layout/ProjectAutosave";

export function Providers({ children }: { children: React.ReactNode }) {
  const setQuestions = useAppStore((s) => s.setQuestions);
  const hydrateProjects = useAppStore((s) => s.hydrateProjects);

  useEffect(() => {
    void (async () => {
      const questions = await getAllQuestions();
      setQuestions(questions);
      await hydrateProjects();
    })();
  }, [setQuestions, hydrateProjects]);

  return (
    <>
      <ProjectAutosave />
      {children}
    </>
  );
}
