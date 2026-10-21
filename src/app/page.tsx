"use client";

import { Header } from "@/components/layout/Header";
import { PaperSidebar } from "@/components/layout/PaperSidebar";
import { QuestionWorkspace } from "@/components/home/QuestionWorkspace";
import { CropWorkspace } from "@/components/crop/CropWorkspace";
import { QuestionEditor } from "@/components/editor/QuestionEditor";
import { OnlineExamsPanel } from "@/components/online/OnlineExamsPanel";
import { FoyWorkspace } from "@/components/foy/FoyWorkspace";
import { TestProjectsBar } from "@/components/layout/TestProjectsBar";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function HomePage() {
  const activeView = useAppStore((s) => s.activeView);
  const [kagitAcik, setKagitAcik] = useState(false);
  useEffect(() => {
    setKagitAcik(false);
  }, [activeView]);

  const mainContent = () => {
    switch (activeView) {
      case "crop":
        return <CropWorkspace />;
      case "editor":
        return <QuestionEditor />;
      case "online":
        return <OnlineExamsPanel />;
      case "foy":
        return <FoyWorkspace />;
      default:
        return <QuestionWorkspace />;
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {activeView === "foy" ? null : (
          <button
            type="button"
            className="relative z-40 shrink-0 border-b bg-white px-3 py-2 text-left text-sm font-semibold text-[#173b70] md:hidden"
            onClick={() => setKagitAcik((v) => !v)}
          >
            {kagitAcik ? "Çalışma alanına dön" : "Kağıt ayarları"}
          </button>
        )}
        <div className="relative flex min-h-0 flex-1 flex-col md:contents">
        {activeView === "foy" ? null : (
          <>
            {kagitAcik ? (
              <button
                type="button"
                className="absolute inset-0 z-20 bg-black/40 md:hidden"
                aria-label="Kağıt ayarlarını kapat"
                onClick={() => setKagitAcik(false)}
              />
            ) : null}
            <div
              className={`${kagitAcik ? "absolute inset-y-0 left-0 z-30 w-[min(100%,20rem)]" : "hidden"} md:static md:z-auto md:block md:h-full md:w-72 md:shrink-0`}
            >
              <PaperSidebar />
            </div>
          </>
        )}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
          {activeView === "foy" ? null : <TestProjectsBar />}
          {mainContent()}
        </main>
        </div>
      </div>
      <footer className="shrink-0 py-1 pr-4 pb-[env(safe-area-inset-bottom)] text-right text-xs text-slate-400">
        v1.0 · Online VIP Test Maker
      </footer>
    </div>
  );
}
