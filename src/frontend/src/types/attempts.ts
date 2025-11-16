export type AttemptResult = {
  questionId: string;
  correct: boolean;
  chosenAnswer: string;
  usedHint?: boolean;
  timeSec?: number;
};

export type AttemptRecord = {
  id: string;
  unitId: string;
  quizId: string;
  quizType: string;
  sectionId?: string | null;
  scorePct: number;
  createdAt?: number;
  results: AttemptResult[];
};
