export type PaperType = "yazili" | "yaprak" | "deneme";

export type QuestionSource = "crop" | "upload" | "editor";

export type ColumnCount = 1 | 2 | 3 | 4 | 5 | 6;

export type OpticalFormChoiceCount = 3 | 4 | 5;

export type OpticalFormPlacement = "bottom" | "sidebar" | "separate";

export type AnswerOption = "A" | "B" | "C" | "D" | "E";

export const ANSWER_OPTIONS: AnswerOption[] = ["A", "B", "C", "D", "E"];

/** PDF: auto = boyuta göre tam/sütun, column = tek sütun, full = tüm genişlik */
export type QuestionLayoutSpan = "auto" | "column" | "full";

export const LAYOUT_SPAN_LABELS: Record<
  QuestionLayoutSpan,
  string
> = {
  auto: "Otomatik",
  column: "Sütun",
  full: "Tam genişlik",
};

export interface Question {
  id: string;
  imageDataUrl: string;
  source: QuestionSource;
  createdAt: number;
  label?: string;
  overlayText?: string;
  fontSize?: number;
  pdfSourceName?: string;
  pdfPage?: number;
  /** Doğru cevap — online test ve cevap anahtarı için */
  answerKey?: AnswerOption;
  /** Kağıtta yerleşim — çok sütunlu modda tek soru tam sayfa genişliği */
  layoutSpan?: QuestionLayoutSpan;
}

export interface QuestionSnapshot {
  id: string;
  imageDataUrl: string;
  answerKey?: AnswerOption;
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
  /** 3, 4 veya 5 şıklı optik form */
  opticalChoiceCount: OpticalFormChoiceCount;
  /** bottom = sayfa altı; sidebar = sağ sütun; separate = ayrı sayfa */
  opticalPlacement: OpticalFormPlacement;
  opticalFormId?: string;
  /** Kişisel yüklenen optik form görseli */
  opticalCustomImage?: string;
  smartPlacement: boolean;
  watermark: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  themeColor: string;
  paperSize: "A4" | "A3";
  orientation: "portrait" | "landscape";
  columns: ColumnCount;
  columnDivider: boolean;
  marginCm: number;
}

/** Kayıtlı kağıt / test taslağı — soru sırası ve ayarlar */
export interface TestProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  draftIds: string[];
  paperSettings: PaperSettings;
}

export interface TestProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  draftCount: number;
}

export interface OnlineExam {
  id: string;
  title: string;
  schoolName: string;
  questionIds: string[];
  questionSnapshots: QuestionSnapshot[];
  createdAt: number;
  published: boolean;
  durationMinutes?: number;
}

export interface ExamSubmission {
  studentName: string;
  answers: Record<number, string>;
  submittedAt: number;
  score?: number;
  totalGraded?: number;
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
  opticalChoiceCount: 5,
  opticalPlacement: "bottom",
  smartPlacement: true,
  watermark: false,
  watermarkText: "Dershanem",
  watermarkOpacity: 0.12,
  themeColor: "#2563eb",
  paperSize: "A4",
  orientation: "portrait",
  columns: 2,
  columnDivider: true,
  marginCm: 1.5,
};
