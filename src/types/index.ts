export type PaperType = "yazili" | "yaprak" | "deneme";

export type QuestionSource = "crop" | "upload" | "editor";

export interface Question {
  id: string;
  imageDataUrl: string;
  source: QuestionSource;
  createdAt: number;
  label?: string;
}

export interface PaperSettings {
  paperType: PaperType;
  testName: string;
  schoolName: string;
  examType: string;
  classSection: string;
  group: string;
  spacingBetweenQuestions: boolean;
  includeTeacherName: boolean;
  teacherName: string;
  includeOpticalForm: boolean;
  smartPlacement: boolean;
  watermark: boolean;
  themeColor: string;
  paperSize: "A4" | "A3";
  orientation: "portrait" | "landscape";
  columns: 1 | 2;
  marginCm: number;
}

export interface OnlineExam {
  id: string;
  title: string;
  schoolName: string;
  questionIds: string[];
  /** Soru görselleri — paylaşılabilir sınav için paketlenir */
  questionSnapshots: { id: string; imageDataUrl: string }[];
  createdAt: number;
  published: boolean;
  durationMinutes?: number;
}

export const DEFAULT_PAPER_SETTINGS: PaperSettings = {
  paperType: "yazili",
  testName: "",
  schoolName: "",
  examType: "1. Dönem Çoktan Seçmeli Test",
  classSection: "",
  group: "Grup Yok",
  spacingBetweenQuestions: true,
  includeTeacherName: false,
  teacherName: "",
  includeOpticalForm: false,
  smartPlacement: true,
  watermark: false,
  themeColor: "#2563eb",
  paperSize: "A4",
  orientation: "portrait",
  columns: 2,
  marginCm: 1.5,
};
