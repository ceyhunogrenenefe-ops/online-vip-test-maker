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
  /** Sorular arası boşluk (mm) — boşluk seçeneği açıkken */
  questionSpacingMm: number;
  /** Yaprak test / deneme: PDF üst bilgisinde gösterilen açıklamalar */
  testDescription: string;
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
  /** text = metin filigran; logo = tek logo arka planda */
  watermarkType: "text" | "logo";
  watermarkText: string;
  watermarkOpacity: number;
  /** Logo görseli (data URL) */
  watermarkLogoImage?: string;
  /** Logo genişliği sayfa yüzdesi (20–70) */
  watermarkLogoScale: number;
  themeColor: string;
  paperSize: "A4" | "A3" | "custom";
  /** Özel kağıt boyutu (mm) — paperSize custom iken */
  customPaperWidthMm: number;
  customPaperHeightMm: number;
  orientation: "portrait" | "landscape";
  columns: ColumnCount;
  columnDivider: boolean;
  marginCm: number;
  /** Soru görseli ölçeği % (sütun taşmasını önlemek için küçültülebilir) */
  questionScalePercent: number;
  /** true: sorular kesinlikle sütun genişliğini aşmaz */
  strictColumnFit: boolean;
  /** true: tüm sorular aynı sütun genişliği / tutarlı yükseklik bandında çizilir */
  uniformQuestionSize: boolean;
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
  questionSpacingMm: 10,
  testDescription: "",
  includeTeacherName: false,
  teacherName: "",
  includeOpticalForm: false,
  opticalChoiceCount: 5,
  opticalPlacement: "bottom",
  smartPlacement: true,
  watermark: false,
  watermarkType: "text",
  watermarkText: "Dershanem",
  watermarkOpacity: 0.12,
  watermarkLogoScale: 45,
  themeColor: "#2563eb",
  paperSize: "A4",
  customPaperWidthMm: 210,
  customPaperHeightMm: 297,
  orientation: "portrait",
  columns: 2,
  columnDivider: true,
  marginCm: 1.5,
  questionScalePercent: 92,
  strictColumnFit: true,
  uniformQuestionSize: true,
};

/** Kayıtlı projelerde eksik alanları varsayılanlarla tamamlar */
export function mergePaperSettings(
  stored: Partial<PaperSettings> | PaperSettings
): PaperSettings {
  return { ...DEFAULT_PAPER_SETTINGS, ...stored };
}
