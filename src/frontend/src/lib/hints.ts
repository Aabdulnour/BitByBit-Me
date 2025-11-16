const QUESTION_HINTS: Record<
  string,
  { level1: string; level2?: string; level3?: string }
> = {
  "q1": {
    level1: "Start by isolating the term with x.",
    level2: "Subtract 3 from both sides before dividing by 2.",
    level3: "2x = 4 so x = 2.",
  },
  "q2": {
    level1: "Move the -10 by adding 10 to both sides.",
    level2: "After simplifying you should have 5x = 25.",
    level3: "Divide by 5 to find x = 5.",
  },
  "q4": {
    level1: "Get all the x terms on one side.",
    level2: "Subtract 3x from both sides to get x - 5 = 11.",
    level3: "Then add 5 to both sides to find x = 16.",
  },
  "q5": {
    level1: "Both expressions equal y, so set them equal.",
    level2: "Solve 2x + 3 = x + 9 for x.",
    level3: "Subtract x to get x + 3 = 9, so x = 6.",
  },
  "q7": {
    level1: "Substitution works best when one variable is isolated.",
    level2: "If an equation already has y = … it is ready.",
  },
  "q9": {
    level1: "Translate the sentence into an equation.",
    level2: "Cost = 3n + 2, plug in the total cost 8.",
    level3: "3n + 2 = 8 so n = 2 dollars per notebook.",
  },
  "q10": {
    level1: "Distance = rate × time.",
    level2: "Solve 120 = 40t.",
  },
  "q13": {
    level1: "Distribute 3 across the parentheses.",
    level2: "Combine like terms after distributing.",
    level3: "3x + 6 - x = 2x + 6.",
  },
  "q14": {
    level1: "Group the like terms (x terms together).",
    level2: "Be careful with the signs when combining.",
  },
};

const FALLBACK_HINTS = {
  level1: "Think about what the question is really asking.",
  level2: "Write each step explicitly to avoid mistakes.",
  level3: "Break the problem into smaller actions you can verify.",
};

export function getHintsForQuestion(questionId: string) {
  return QUESTION_HINTS[questionId] || FALLBACK_HINTS;
}
