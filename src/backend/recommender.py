from __future__ import annotations

import random
from typing import Optional

from .models import Question, StudentState
from .repository import load_questions


def pick_next_question(
    student: StudentState,
    unit_id: Optional[str] = None,
    section_id: Optional[str] = None,
) -> Optional[Question]:
    """
    Simple next question strategy:
    - filter by unit and section if provided
    - prefer questions whose skills have lower mastery
    - within that, respect preferred difficulty if possible
    """
    all_questions = list(load_questions().values())
    if unit_id:
        all_questions = [q for q in all_questions if q.unit_id == unit_id]
    if section_id:
        all_questions = [q for q in all_questions if q.section_id == section_id]

    if not all_questions:
        return None

    def mastery_score(q: Question) -> float:
        if not q.skill_ids:
            return 50.0
        vals = []
        for s_id in q.skill_ids:
            mastery = student.mastery_by_skill.get(s_id)
            vals.append(mastery.pct if mastery else 0.0)
        return sum(vals) / len(vals)

    preferred = student.preferred_difficulty
    scored = []
    for q in all_questions:
        base = mastery_score(q)
        if q.difficulty == preferred:
            base -= 10.0
        scored.append((base, q))

    scored.sort(key=lambda t: t[0])
    top_n = [q for _, q in scored[: min(10, len(scored))]]
    return random.choice(top_n)
