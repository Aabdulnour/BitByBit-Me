import unitsFallback from "../data/units.json";
import quizzesFallback from "../data/quizzes.json";
import { apiGet } from "../../../lib/apiClient";

export type QuestionType = "mcq" | "boolean";
export type QuizType = "diagnostic" | "practice" | "mini_quiz" | "unit_test";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // for mcq only
  answer: string; // for boolean use "True" or "False"
  explanation?: string | null;
  skillIds?: string[];
  difficultyTag?: string | null;
}

export interface Quiz {
  id: string;
  title: string;
  type: QuizType;
  questions: Question[];
  passingScorePct?: number;
}

export interface UnitSection {
  id: string;
  title: string;
  summary?: string;
  practiceQuizId?: string;
  miniQuizId?: string;
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  sections: UnitSection[];
  diagnosticQuizId: string;
  comprehensiveQuizId: string;
}

function mapBackendQuestion(raw: any): Question {
  // TODO: replace this simple mapping with ML enriched metadata when backend exposes difficulty bands.
  const promptSource =
    (typeof raw?.text === "string" && raw.text.trim()) ||
    (typeof raw?.prompt === "string" && raw.prompt.trim()) ||
    "";
  const normalizedOptions = Array.isArray(raw?.options)
    ? raw.options
    : undefined;

  const fallbackId =
    raw?.id ??
    (typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `question-${Date.now()}`);

  return {
    id: String(fallbackId),
    type: raw?.type === "boolean" ? "boolean" : "mcq",
    prompt: promptSource || "Untitled question",
    options: normalizedOptions,
    answer: String(raw?.correct_answer ?? raw?.answer ?? "").trim(),
    explanation:
      (typeof raw?.explanation === "string" && raw.explanation) ??
      (typeof raw?.answer_explanation === "string" && raw.answer_explanation) ??
      (typeof raw?.rationale === "string" && raw.rationale) ??
      null,
    skillIds: Array.isArray(raw?.skill_ids ?? raw?.skillIds)
      ? raw.skill_ids ?? raw.skillIds
      : Array.isArray(raw?.skills)
      ? raw.skills
      : [],
    difficultyTag: raw?.difficulty ?? raw?.level ?? null,
  };
}

// Helper to map backend quiz shape into frontend Quiz type
function mapBackendQuiz(raw: any): Quiz {
  const questions: Question[] = (raw.questions || []).map((q: any) =>
    mapBackendQuestion(q)
  );

  return {
    id: String(raw.id),
    title: raw.title,
    type: (raw.type as QuizType) ?? "practice",
    questions,
    passingScorePct: raw.passing_score_pct,
  };
}

function mapSections(sections: any[] | undefined, fallback?: UnitSection[]): UnitSection[] {
  if (!sections || sections.length === 0) {
    return fallback || [];
  }
  return sections.map((section: any) => ({
    id: section.id,
    title: section.title,
    summary: section.summary ?? section.description ?? "",
    practiceQuizId: section.practiceQuizId ?? section.practice_quiz_id,
    miniQuizId: section.miniQuizId ?? section.mini_quiz_id,
  }));
}

function mapUnit(raw: any, fallback?: Unit): Unit {
  const diagnostic =
    raw?.diagnostic_quiz_id ?? raw?.diagnosticQuizId ?? fallback?.diagnosticQuizId ?? "";
  const comprehensive =
    raw?.comprehensive_quiz_id ??
    raw?.comprehensiveQuizId ??
    fallback?.comprehensiveQuizId ??
    "";
  return {
    id: raw?.id ?? fallback?.id ?? "",
    title: raw?.title ?? fallback?.title ?? "",
    description: raw?.description ?? fallback?.description ?? "",
    sections: mapSections(raw?.sections, fallback?.sections),
    diagnosticQuizId: diagnostic,
    comprehensiveQuizId: comprehensive,
  };
}

export const UnitsAPI = {
  async listUnits(): Promise<Unit[]> {
    const fallbackUnits = unitsFallback as unknown as Unit[];
    try {
      const backendUnits = await apiGet("/units");
      const fallbackById = new Map(fallbackUnits.map((u) => [u.id, u]));
      const mapped = backendUnits.map((unit: any) =>
        mapUnit(unit, fallbackById.get(unit.id))
      );
      const fallbackOnly = fallbackUnits.filter(
        (unit) => !backendUnits.find((b: any) => b.id === unit.id)
      );
      return [...mapped, ...fallbackOnly];
    } catch {
      return unitsFallback as unknown as Unit[];
    }
  },

  async getUnit(unitId: string): Promise<Unit | undefined> {
    const all = await this.listUnits();
    return all.find((u) => u.id === unitId);
  },

  async getQuiz(quizId: string): Promise<Quiz | undefined> {
    try {
      const raw = await apiGet(`/quizzes/${quizId}`);
      return mapBackendQuiz(raw);
    } catch {
      const fallback = quizzesFallback as any[];
      const q = fallback.find((q) => q.id === quizId);
      if (!q) return undefined;
      return {
        id: q.id,
        title: q.title,
        type: q.type,
        questions: q.questions.map((question: any) => ({
          ...question,
          explanation: question.explanation ?? question.rationale ?? null,
        })),
        passingScorePct: q.passingScorePct,
      };
    }
  },
};
