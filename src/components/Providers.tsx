"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  getAllQuestions,
  getDraftQuestionIds,
} from "@/lib/storage";

export function Providers({ children }: { children: React.ReactNode }) {
  const setQuestions = useAppStore((s) => s.setQuestions);
  const setDraftIds = useAppStore((s) => s.setDraftIds);

  useEffect(() => {
    Promise.all([getAllQuestions(), getDraftQuestionIds()]).then(
      ([questions, draftIds]) => {
        setQuestions(questions);
        setDraftIds(draftIds);
      }
    );
  }, [setQuestions, setDraftIds]);

  return <>{children}</>;
}
