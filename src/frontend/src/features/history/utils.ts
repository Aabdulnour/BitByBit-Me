export function formatAttemptDate(timestamp?: number) {
  if (!timestamp) return "Unknown date";
  const date = new Date(timestamp * 1000);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getQuizTypeLabel(type: string) {
  switch (type) {
    case "diagnostic":
      return "Diagnostic";
    case "practice":
      return "Practice";
    case "mini_quiz":
      return "Mini quiz";
    case "unit_test":
    default:
      return "Unit test";
  }
}
