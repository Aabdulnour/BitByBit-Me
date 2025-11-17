from __future__ import annotations

from collections import Counter, defaultdict
from typing import Dict

from ..models import Attempt, StudentState
from ..repository import load_questions, get_attempts_for_all_students
from .difficulty import estimate_question_difficulty


def _pretty_skill_name(skill_id: str) -> str:
    return skill_id.replace("_", " ").replace("-", " ").title()


def generate_personalized_feedback(
    student_state: StudentState,
    last_attempt: Attempt,
) -> str:
    """
    Craft a short feedback blurb by combining the student's skill mastery,
    recent streak, and the observed question difficulty.
    """

    if not last_attempt or not last_attempt.results:
        return "Thanks for submitting your work. Keep going — every attempt helps us personalize your path."

    questions = load_questions()
    all_attempts = get_attempts_for_all_students()
    difficulty_lookup = estimate_question_difficulty(all_attempts, questions)

    skill_scores: Dict[str, Counter] = defaultdict(Counter)
    for result in last_attempt.results:
        question = questions.get(result.question_id)
        skill_ids = (
            question.skill_ids
            if question and question.skill_ids
            else [question.unit_id if question else last_attempt.unit_id or "general"]
        )
        for skill_id in skill_ids:
            skill_scores[skill_id]["count"] += 1
            if result.correct:
                skill_scores[skill_id]["correct"] += 1

    if not skill_scores:
        return "Attempt recorded. We'll analyze it to tune your next recommendation."

    focus_skill_id = max(skill_scores.items(), key=lambda item: item[1]["count"])[0]
    focus_skill = _pretty_skill_name(focus_skill_id)
    mastery_entry = (student_state.skill_mastery or {}).get(
        focus_skill_id,
        {"p_mastery": 0.3, "n_observations": 0, "recent_correct": 0},
    )
    mastery_score = mastery_entry.get("p_mastery", 0.3)
    streak = mastery_entry.get("recent_correct", 0)

    avg_difficulty = 0.0
    diff_count = 0
    for result in last_attempt.results:
        diff_entry = difficulty_lookup.get(result.question_id)
        if diff_entry:
            avg_difficulty += diff_entry["difficulty"]
            diff_count += 1
    avg_difficulty = avg_difficulty / diff_count if diff_count else 0.5
    difficulty_level = "medium"
    if avg_difficulty < 0.35:
        difficulty_level = "easier"
    elif avg_difficulty > 0.65:
        difficulty_level = "challenging"

    score_pct = last_attempt.score_pct or 0

    if mastery_score >= 0.75 and score_pct >= 80:
        return (
            f"Nice work, you're showing strong mastery in {focus_skill}. "
            f"Let's try a slightly { 'more challenging' if difficulty_level != 'challenging' else 'broader' } set next."
        )
    if mastery_score < 0.4:
        if score_pct >= 60:
            return (
                f"Great progress building {focus_skill}. We'll stay with {difficulty_level} items until it feels automatic."
            )
        return (
            f"You're still building confidence with {focus_skill}. "
            "We'll keep the next set targeted and review any tricky steps together."
        )
    if streak >= 3:
        return (
            f"Three-in-a-row on {focus_skill}! We'll nudge the difficulty upward to keep you challenged."
        )
    if score_pct < 50:
        return (
            f"Let's revisit a few fundamentals in {focus_skill}. We'll give you more guided practice at the current level."
        )

    return (
        f"Solid effort on {focus_skill}. A bit more practice with {difficulty_level} problems will lock it in."
    )
