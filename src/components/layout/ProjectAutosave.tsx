"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

/** Taslak değişikliklerini otomatik kaydeder */
export function ProjectAutosave() {
  const projectsReady = useAppStore((s) => s.projectsReady);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const draftIds = useAppStore((s) => s.draftIds);
  const paperSettings = useAppStore((s) => s.paperSettings);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (!projectsReady || !currentProjectId) return;

    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveCurrentProject();
    }, 900);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draftIds, paperSettings, projectsReady, currentProjectId, saveCurrentProject]);

  return null;
}
