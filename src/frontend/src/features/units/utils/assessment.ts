import type { Question } from "../services/unitsAPI";

export interface AssessmentResultEntry {
  questionId: string;
  prompt: string;
  selectedChoiceLabel?: string | null;
  correctChoiceLabel?: string | null;
  explanation?: string | null;
  isCorrect: boolean;
  usedHint: boolean;
}

export function buildResultEntry(
  question: Question | null,
  choice: string | null | undefined,
  usedHint: boolean
): AssessmentResultEntry {
  if (!question) {
    return {
      questionId: `missing-${Date.now()}`,
      prompt: "Question data unavailable.",
      selectedChoiceLabel: choice ?? null,
      correctChoiceLabel: null,
      explanation: null,
      isCorrect: false,
      usedHint,
    };
  }

  const normalizedChoice = String(choice ?? "").trim();
  const normalizedAnswer = String(question.answer ?? "").trim();
  const prompt =
    (typeof question.prompt === "string" && question.prompt.trim()) ||
    "Untitled question";

  // TODO: hook in ML-based difficulty adjustments once backend exposes richer metadata.
  return {
    questionId: question.id,
    prompt,
    selectedChoiceLabel: normalizedChoice || null,
    correctChoiceLabel: normalizedAnswer || null,
    explanation: question.explanation,
    isCorrect:
      normalizedChoice.length > 0 &&
      normalizedAnswer.length > 0 &&
      normalizedChoice === normalizedAnswer,
    usedHint,
  };
}

export function calcScorePct(
  entries: AssessmentResultEntry[],
  totalQuestions: number
): number {
  if (!totalQuestions) return 0;
  const correctCount = entries.filter((entry) => entry.isCorrect).length;
  return Math.round((correctCount / totalQuestions) * 100);
}

export function buildAttemptResults(entries: AssessmentResultEntry[]) {
  return entries.map((entry) => ({
    questionId: entry.questionId,
    correct: entry.isCorrect,
    chosenAnswer: entry.selectedChoiceLabel ?? "",
    timeSec: 0,
    usedHint: entry.usedHint,
  }));
}

export function describeComprehensiveRecommendation(scorePct: number) {
  if (scorePct >= 85) {
    return "You are ready to move on to harder units.";
  }
  if (scorePct >= 60) {
    return "You might want to review some practice questions.";
  }
  return "We suggest more practice before moving on.";
}
