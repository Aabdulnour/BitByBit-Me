from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

from ..models import Attempt, StudentState, Unit
from ..repository import (
    load_questions,
    load_quizzes,
    get_attempts_for_all_students,
)
from .difficulty import estimate_question_difficulty


@dataclass
class CandidateQuiz:
    unit_id: str
    section_id: Optional[str]
    quiz_id: str
    activity: str
    skill_id: str
    avg_difficulty: float


def _build_skill_index(units: Iterable[Unit]) -> Dict[str, List[CandidateQuiz]]:
    questions = load_questions()
    quizzes = load_quizzes()
    difficulty_lookup = estimate_question_difficulty(
        get_attempts_for_all_students(), questions
    )

    skill_to_candidates: Dict[str, List[CandidateQuiz]] = {}

    def register_candidate(
        unit: Unit,
        quiz_id: Optional[str],
        section_id: Optional[str],
        activity: str,
    ):
        if not quiz_id:
            return
        quiz = quizzes.get(quiz_id)
        if not quiz:
            return
        question_ids = quiz.question_ids or []
        skills_for_quiz = set()
        total_difficulty = 0.0
        diff_count = 0
        for qid in question_ids:
            question = questions.get(qid)
            if question:
                skills_for_quiz.update(question.skill_ids or [question.unit_id])
            diff_entry = difficulty_lookup.get(qid)
            if diff_entry:
                total_difficulty += diff_entry["difficulty"]
                diff_count += 1
        avg_difficulty = (
            total_difficulty / diff_count if diff_count else 0.5
        )
        for skill_id in skills_for_quiz:
            skill_to_candidates.setdefault(skill_id, []).append(
                CandidateQuiz(
                    unit_id=unit.id,
                    section_id=section_id,
                    quiz_id=quiz_id,
                    activity=activity,
                    skill_id=skill_id,
                    avg_difficulty=avg_difficulty,
                )
            )

    for unit in units:
        diagnostic_quiz = unit.diagnostic_quiz_id
        if diagnostic_quiz:
            register_candidate(unit, diagnostic_quiz, None, "diagnostic")
        if unit.comprehensive_quiz_id:
            register_candidate(unit, unit.comprehensive_quiz_id, None, "unit_test")
        for section in unit.sections or []:
            section_id = section.get("id")
            if section.get("practiceQuizId"):
                register_candidate(
                    unit, section["practiceQuizId"], section_id, "practice"
                )
            if section.get("miniQuizId"):
                register_candidate(unit, section["miniQuizId"], section_id, "mini_quiz")

    return skill_to_candidates


def _target_difficulty(p_mastery: float) -> float:
    if p_mastery < 0.35:
        return 0.4
    if p_mastery < 0.65:
        return 0.55
    return 0.7


def recommend_next_activity(
    student_state: StudentState,
    attempts: Iterable[Attempt],
    units: Iterable[Unit],
) -> Optional[Dict[str, object]]:
    """
    Recommend the next activity by combining the student's skill mastery
    estimates with the current question difficulty landscape.
    """

    units = list(units)
    if not units:
        return None

    attempts = list(attempts or [])
    diagnostic_units = {
        attempt.unit_id
        for attempt in attempts
        if attempt.quiz_type == "diagnostic" and attempt.unit_id
    }
    if not diagnostic_units:
        first_unit = next((u for u in units if u.diagnostic_quiz_id), units[0])
        if first_unit and first_unit.diagnostic_quiz_id:
            return {
                "unit_id": first_unit.id,
                "section_id": None,
                "activity": "diagnostic",
                "quiz_id": first_unit.diagnostic_quiz_id,
                "reason": f"need placement data for {first_unit.title}",
            }

    skill_state = student_state.skill_mastery or {}
    if not skill_state:
        # Encourage at least one diagnostic per unit if no skill evidence
        missing_unit = next(
            (u for u in units if u.id not in diagnostic_units), None
        )
        if missing_unit:
            return {
                "unit_id": missing_unit.id,
                "section_id": None,
                "activity": "diagnostic",
                "quiz_id": missing_unit.diagnostic_quiz_id,
                "reason": f"collecting baseline data for {missing_unit.title}",
            }

    skill_candidates: List[Tuple[float, str, Dict[str, float]]] = []
    for skill_id, data in skill_state.items():
        observations = data.get("n_observations", 0)
        mastery = data.get("p_mastery", 0.3)
        penalty = 0.0 if observations >= 3 else 0.05
        skill_candidates.append((mastery - penalty, skill_id, data))

    if not skill_candidates:
        return None

    skill_candidates.sort(key=lambda entry: entry[0])
    focus_mastery, focus_skill_id, focus_meta = skill_candidates[0]

    candidates_by_skill = _build_skill_index(units)
    candidate_quizzes = candidates_by_skill.get(focus_skill_id)
    if not candidate_quizzes:
        return None

    target_diff = _target_difficulty(focus_mastery)

    def candidate_score(candidate: CandidateQuiz) -> float:
        difficulty_gap = abs(candidate.avg_difficulty - target_diff)
        # Encourage practice/mini quizzes before unit tests unless mastery is high
        activity_penalty = 0.0
        if focus_mastery < 0.65 and candidate.activity == "unit_test":
            activity_penalty = 0.25
        return difficulty_gap + activity_penalty

    best_candidate = min(candidate_quizzes, key=candidate_score)

    reason = (
        f"targeting weakest skill: {focus_skill_id.replace('_', ' ')} "
        f"({int(round(focus_mastery * 100))}% mastery)"
    )
    return {
        "unit_id": best_candidate.unit_id,
        "section_id": best_candidate.section_id,
        "activity": best_candidate.activity,
        "quiz_id": best_candidate.quiz_id,
        "reason": reason,
        "skill_id": focus_skill_id,
        "difficulty_target": target_diff,
    }
