from __future__ import annotations

from typing import Dict, Iterable, Mapping, Optional

from ..models import Attempt, Question

SMOOTHING = 1.0
BASE_DIFFICULTY = {
    "easy": 0.25,
    "medium": 0.5,
    "hard": 0.75,
}


def _difficulty_label(score: float) -> str:
    if score < 0.35:
        return "easy"
    if score < 0.65:
        return "medium"
    return "hard"


def estimate_question_difficulty(
    attempt_history: Iterable[Attempt],
    question_lookup: Optional[Mapping[str, Question]] = None,
) -> Dict[str, Dict[str, float]]:
    """
    Estimate the relative difficulty of each question using a smoothed
    proportion-correct metric with an optional adjustment based on average
    response time.
    """

    stats: Dict[str, Dict[str, float]] = {}
    for attempt in attempt_history or []:
        for result in attempt.results or []:
            qid = result.question_id
            if not qid:
                continue
            entry = stats.setdefault(qid, {"correct": 0.0, "total": 0.0, "time": 0.0})
            entry["total"] += 1.0
            if result.correct:
                entry["correct"] += 1.0
            if result.time_sec:
                entry["time"] += max(0.0, float(result.time_sec))

    if question_lookup:
        for qid in question_lookup.keys():
            stats.setdefault(qid, {"correct": 0.0, "total": 0.0, "time": 0.0})

    results: Dict[str, Dict[str, float]] = {}
    for qid, entry in stats.items():
        total = entry["total"]
        correct = entry["correct"]
        avg_time = entry["time"] / total if total else None

        base = 0.5
        if question_lookup and qid in question_lookup:
            q = question_lookup[qid]
            base = BASE_DIFFICULTY.get(q.difficulty, 0.5)

        if total == 0:
            difficulty_score = base
            p_correct = max(0.0, min(1.0, 1.0 - base))
        else:
            p_correct = (correct + SMOOTHING) / (total + 2 * SMOOTHING)
            difficulty_score = 1.0 - p_correct

        if avg_time is not None and question_lookup and qid in question_lookup:
            expected = max(15.0, float(question_lookup[qid].estimated_time_sec or 60))
            ratio = min(avg_time / expected, 3.0)
            difficulty_score = max(
                0.0,
                min(1.0, difficulty_score * 0.8 + (ratio - 1.0) * 0.25 + base * 0.2),
            )
        else:
            difficulty_score = max(0.0, min(1.0, difficulty_score * 0.7 + base * 0.3))

        payload: Dict[str, float] = {
            "difficulty": round(difficulty_score, 3),
            "p_correct": round(p_correct, 3),
            "n_attempts": int(total),
            "level": _difficulty_label(difficulty_score),
        }
        if avg_time is not None and total > 0:
            payload["avg_time_sec"] = round(avg_time, 1)
        results[qid] = payload

    return results
