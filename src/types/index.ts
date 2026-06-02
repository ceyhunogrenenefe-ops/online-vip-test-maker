export type PaperType = "yazili" | "yaprak" | "deneme";

export type QuestionSource = "crop" | "upload" | "editor";

export type ColumnCount = 1 | 2 | 3 | 4 | 5 | 6;

export type AnswerOption = "A" | "B" | "C" | "D" | "E";

export const ANSWER_OPTIONS: AnswerOption[] = ["A", "B", "C", "D", "E"];

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
