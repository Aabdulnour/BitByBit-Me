from __future__ import annotations

from typing import Dict, Iterable, Optional

from ..models import Attempt
from ..repository import load_questions

DEFAULT_PRIOR = 0.3
LEARN_RATE = 0.25
FORGET_RATE = 0.1


def _get_skill_ids(question, attempt: Attempt) -> Iterable[str]:
    if question and question.skill_ids:
        return question.skill_ids
    if attempt.section_id:
        return [f"{attempt.unit_id}:{attempt.section_id}"]
    if question:
        return [question.unit_id]
    return [attempt.unit_id or "general"]


def update_student_skill_state(
    student_id: str,
    attempts: Iterable[Attempt],
    current_state: Optional[Dict[str, Dict[str, float]]],
) -> Dict[str, Dict[str, float]]:
    """
    Apply a low-parameter Bayesian-inspired update rule to the student's skill
    estimates based on the provided attempts.
    """

    questions = load_questions()
    skill_state: Dict[str, Dict[str, float]] = {
        skill_id: {
            "p_mastery": float(data.get("p_mastery", DEFAULT_PRIOR)),
            "n_observations": int(data.get("n_observations", 0)),
            "recent_correct": int(data.get("recent_correct", 0)),
        }
        for skill_id, data in (current_state or {}).items()
    }

    sorted_attempts = sorted(
        attempts or [], key=lambda a: a.created_at or 0.0
    )
    for attempt in sorted_attempts:
        for result in attempt.results or []:
            question = questions.get(result.question_id)
            for skill_id in _get_skill_ids(question, attempt):
                state = skill_state.setdefault(
                    skill_id,
                    {
                        "p_mastery": DEFAULT_PRIOR,
                        "n_observations": 0,
                        "recent_correct": 0,
                    },
                )
                p_mastery = float(state["p_mastery"])
                if result.correct:
                    p_mastery = min(
                        0.995,
                        p_mastery + LEARN_RATE * (1.0 - p_mastery),
                    )
                    state["recent_correct"] = min(
                        5, state.get("recent_correct", 0) + 1
                    )
                else:
                    p_mastery = max(
                        0.01,
                        p_mastery * (1.0 - FORGET_RATE),
                    )
                    state["recent_correct"] = 0

                state["p_mastery"] = round(p_mastery, 4)
                state["n_observations"] = state.get("n_observations", 0) + 1

    return skill_state
