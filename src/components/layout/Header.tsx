"use client";

import {
  Home,
  Building2,
  Crop,
  Pencil,
  Globe,
  ScanLine,
  BookOpen,
  Tag,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const navItems: {
  id: "home" | "crop" | "editor" | "online";
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "home", label: "Anasayfa", icon: Home },
  { id: "crop", label: "Kırpma Aracı", icon: Crop },
  { id: "editor", label: "Soru Editörü", icon: Pencil },
  { id: "online", label: "Online Testlerim", icon: Globe },
];

export function Header() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);

  return (
    <header className="bg-dershanem-navy text-white shadow-lg">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="min-w-[200px]">
          <h1 className="text-lg font-bold tracking-tight">
            Online VIP Test Maker
          </h1>
          <p className="text-xs text-slate-300">
            Soru kesme, PDF ve online sınav
          </p>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                activeView === id
                  ? "bg-white/15 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
          <span className="mx-2 h-6 w-px bg-white/20" />
          <button
            type="button"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500"
            title="Yakında"
          >
            <Building2 size={16} />
            Kurum Yönetimi
          </button>
          <button
            type="button"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500"
            title="Yakında"
          >
            <ScanLine size={16} />
            Optik Okuyucu
          </button>
          <button
            type="button"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500"
            title="Yakında"
          >
            <BookOpen size={16} />
            Kılavuz
          </button>
          <button
            type="button"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500"
            title="Yakında"
          >
            <Tag size={16} />
            Fiyatlandırma
          </button>
        </nav>

        <div className="flex items-center gap-2 text-right text-sm">
          <div className="hidden sm:block">
            <p className="font-medium">Öğretmen</p>
            <p className="text-xs text-slate-400">dershanem.vip</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-dershanem-blue text-sm font-bold">
            D
          </div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-2 py-1 md:hidden">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveView(id)}
            className={`flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs ${
              activeView === id ? "bg-white/15" : "text-slate-400"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
