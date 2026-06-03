"use client";

import { Header } from "@/components/layout/Header";
import { PaperSidebar } from "@/components/layout/PaperSidebar";
import { QuestionWorkspace } from "@/components/home/QuestionWorkspace";
import { CropWorkspace } from "@/components/crop/CropWorkspace";
import { QuestionEditor } from "@/components/editor/QuestionEditor";
import { OnlineExamsPanel } from "@/components/online/OnlineExamsPanel";
import { TestProjectsBar } from "@/components/layout/TestProjectsBar";
import { useAppStore } from "@/store/useAppStore";

export default function HomePage() {
  const activeView = useAppStore((s) => s.activeView);

  const mainContent = () => {
    switch (activeView) {
      case "crop":
        return <CropWorkspace />;
      case "editor":
        return <QuestionEditor />;
      case "online":
        return <OnlineExamsPanel />;
      default:
        return <QuestionWorkspace />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row">
        <PaperSidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-slate-100">
          <TestProjectsBar />
          {mainContent()}
        </main>
      </div>
      <footer className="py-1 text-right pr-4 text-xs text-slate-400">
        v1.0 · Online VIP Test Maker
      </footer>
    </div>
  );
}
