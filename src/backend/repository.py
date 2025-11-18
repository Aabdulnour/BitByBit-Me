from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
import time
from datetime import datetime

from .models import (
    Question,
    Quiz,
    Unit,
    StudentState,
    SkillMastery,
    Attempt,
    AttemptQuestionResult,
    NextActivity,
    TeacherStudentSummary,
    TeacherUnitSummary,
    User,
)


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)


def _load_json(path: Path, default):
    if not path.exists():
        path.write_text(json.dumps(default, indent=2))
        return default
    try:
        with path.open() as f:
            return json.load(f)
    except json.JSONDecodeError:
        return default


def _save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2))


UNITS_PATH = DATA_DIR / "units.json"
QUESTIONS_PATH = DATA_DIR / "questions.json"
QUIZZES_PATH = DATA_DIR / "quizzes.json"
STUDENTS_PATH = DATA_DIR / "students.json"
USERS_PATH = DATA_DIR / "users.json"
ATTEMPTS_PATH = DATA_DIR / "attempts.json"
MASTERY_QUIZ_TYPES = {"mini_quiz", "unit_test"}


def _coerce_skill_mastery(skill_id: str, raw_value: Any) -> SkillMastery:
    """
    Normalize persisted skill mastery rows so legacy payloads (with pct) and current
    dicts consistently hydrate SkillMastery objects.
    """

    if isinstance(raw_value, SkillMastery):
        return raw_value
    if not isinstance(raw_value, dict):
        return SkillMastery(skill_id=skill_id)

    normalized = dict(raw_value)
    normalized.pop("pct", None)  # legacy serialized key

    return SkillMastery(
        skill_id=str(normalized.get("skill_id") or skill_id),
        correct=int(normalized.get("correct", 0) or 0),
        total=int(normalized.get("total", 0) or 0),
    )


def load_units() -> List[Unit]:
    raw = _load_json(UNITS_PATH, [])
    return [Unit(**u) for u in raw]


def load_unit(unit_id: str) -> Optional[Unit]:
    return next((u for u in load_units() if u.id == unit_id), None)


def load_questions() -> Dict[str, Question]:
    raw = _load_json(QUESTIONS_PATH, [])
    return {q["id"]: Question(**q) for q in raw}


def load_quizzes() -> Dict[str, Quiz]:
    raw = _load_json(QUIZZES_PATH, [])
    return {q["id"]: Quiz(**q) for q in raw}


def load_quiz(quiz_id: str) -> Optional[Quiz]:
    return load_quizzes().get(quiz_id)


def _deserialize_student_state(data: Dict[str, Any]) -> StudentState:
    mastery = {
        key: _coerce_skill_mastery(key, value)
        for key, value in data.get("mastery_by_skill", {}).items()
    }
    skill_mastery = {
        key: {
            "p_mastery": float(value.get("p_mastery", 0.3)),
            "n_observations": int(value.get("n_observations", 0)),
            "recent_correct": int(value.get("recent_correct", 0)),
        }
        for key, value in data.get("skill_mastery", {}).items()
        if isinstance(value, dict)
    }
    return StudentState(
        student_id=data["student_id"],
        name=data.get("name", f"Student {data['student_id']}"),
        email=data.get("email"),
        grade_level=data.get("grade_level", "9"),
        preferred_difficulty=data.get("preferred_difficulty", "medium"),
        mastery_by_skill=mastery,
        skill_mastery=skill_mastery,
        last_unit_id=data.get("last_unit_id"),
        last_section_id=data.get("last_section_id"),
        last_activity=data.get("last_activity"),
        avatar_url=data.get("avatar_url"),
        avatar_name=data.get("avatar_name"),
    )


def load_student(student_id: str) -> Optional[StudentState]:
    raw = _load_json(STUDENTS_PATH, {})
    data = raw.get(student_id)
    if not data:
        return None
    return _deserialize_student_state(data)


def get_all_students() -> List[StudentState]:
    """
    Return every student stored in students.json.
    """

    raw = _load_json(STUDENTS_PATH, {})
    students = [_deserialize_student_state(data) for data in raw.values()]
    students.sort(key=lambda s: s.name.lower())
    return students


def _next_student_id(raw: Dict[str, Any]) -> str:
    max_index = 1
    for key in raw.keys():
        if key.startswith("student-"):
            try:
                idx = int(key.split("-", 1)[1])
                max_index = max(max_index, idx)
            except ValueError:
                continue
    return f"student-{max_index + 1}"


def create_student(name: str, email: Optional[str] = None) -> StudentState:
    """
    Create a new demo student entry with default data.
    """

    raw = _load_json(STUDENTS_PATH, {})
    student_id = _next_student_id(raw) if raw else "student-2"
    normalized_name = name.strip() or f"Student {student_id}"
    fallback_email = email or f"{student_id}@example.edu"
    state = StudentState(
        student_id=student_id,
        name=normalized_name,
        email=fallback_email,
        grade_level="9",
        preferred_difficulty="medium",
        mastery_by_skill={},
        skill_mastery={},
        avatar_url=None,
        avatar_name=None,
    )
    raw[student_id] = state.to_dict()
    _save_json(STUDENTS_PATH, raw)
    return state


def save_student(state: StudentState) -> None:
    raw = _load_json(STUDENTS_PATH, {})
    raw[state.student_id] = state.to_dict()
    _save_json(STUDENTS_PATH, raw)


def load_attempts(student_id: Optional[str] = None) -> List[Attempt]:
    raw = _load_json(ATTEMPTS_PATH, [])

    # normalize to a list of attempt dicts
    if isinstance(raw, dict):
        if student_id:
            items = raw.get(student_id, [])
        else:
            items = [a for attempts in raw.values() for a in attempts]
    else:
        items = raw

    attempts: List[Attempt] = []
    for item in items:
        if student_id and item.get("student_id") != student_id:
            continue

        results: List[AttemptQuestionResult] = []
        for r in item.get("results", []):
            if isinstance(r, AttemptQuestionResult):
                results.append(r)
            else:
                results.append(
                    AttemptQuestionResult(
                        question_id=r.get("question_id", ""),
                        correct=bool(r.get("correct", False)),
                        chosen_answer=r.get("chosen_answer", ""),
                        time_sec=float(r.get("time_sec", 0)),
                        used_hint=bool(r.get("used_hint", False)),
                    )
                )

        attempts.append(
            Attempt(
                id=item.get("id", ""),
                student_id=item.get("student_id") or (student_id or ""),
                quiz_id=item.get("quiz_id", ""),
                quiz_type=item.get("quiz_type", ""),
                unit_id=item.get("unit_id", ""),
                section_id=item.get("section_id"),
                score_pct=float(item.get("score_pct", 0)),
                created_at=float(item.get("created_at", time.time())),
                results=results,
            )
        )

    return attempts


def append_attempt(attempt: Attempt) -> None:
    raw = _load_json(ATTEMPTS_PATH, [])
    raw.append(attempt.to_dict())
    _save_json(ATTEMPTS_PATH, raw)


def get_attempts_for_all_students() -> List[Attempt]:
    """
    Load every attempt regardless of student id.
    """

    return load_attempts(None)


def _average(scores: List[float]) -> float:
    return round(sum(scores) / len(scores)) if scores else 0.0


def _get_section_value(section: Dict[str, str], *keys: str) -> Optional[str]:
    for key in keys:
        if key in section and section[key]:
            return section[key]
    return None


def _mastery_scores_for_attempts(attempts: List[Attempt]) -> List[float]:
    return [
        attempt.score_pct
        for attempt in attempts
        if attempt.quiz_type in MASTERY_QUIZ_TYPES
    ]


def compute_student_mastery(student_id: str) -> float:
    """
    Compute a student's mastery using mini quizzes and unit tests only.
    """

    attempts = load_attempts(student_id)
    mastery_scores = _mastery_scores_for_attempts(attempts)
    return _average(mastery_scores)


def compute_unit_mastery_for_student(student_id: str) -> Dict[str, float]:
    """
    Return unit-level mastery for a given student keyed by unit id.
    """

    attempts = load_attempts(student_id)
    mastery_by_unit: Dict[str, List[float]] = {}
    for attempt in attempts:
        if attempt.unit_id and attempt.quiz_type in MASTERY_QUIZ_TYPES:
            mastery_by_unit.setdefault(attempt.unit_id, []).append(attempt.score_pct)
    return {unit_id: _average(scores) for unit_id, scores in mastery_by_unit.items()}


def compute_teacher_student_summaries() -> List[TeacherStudentSummary]:
    """
    Build teacher-facing metrics for every student in the system.
    """

    students = {student.student_id: student for student in get_all_students()}
    attempts = get_attempts_for_all_students()
    attempts_by_student: Dict[str, List[Attempt]] = {}

    for attempt in attempts:
        attempts_by_student.setdefault(attempt.student_id, []).append(attempt)
        if attempt.student_id not in students:
            students[attempt.student_id] = StudentState(
                student_id=attempt.student_id,
                name=f"Student {attempt.student_id}",
            )

    summaries: List[TeacherStudentSummary] = []
    for student_id, student in students.items():
        student_attempts = attempts_by_student.get(student_id, [])
        mastery_scores = _mastery_scores_for_attempts(student_attempts)
        questions_answered = sum(len(a.results or []) for a in student_attempts)
        attempt_count = len(student_attempts)
        hint_attempts = sum(
            1 for attempt in student_attempts if any(r.used_hint for r in attempt.results)
        )
        hint_rate = (hint_attempts / attempt_count) if attempt_count else None
        last_activity = None
        if student_attempts:
            last_attempt = max(student_attempts, key=lambda a: a.created_at)
            last_activity = (
                datetime.utcfromtimestamp(last_attempt.created_at).isoformat() + "Z"
            )
        summaries.append(
            TeacherStudentSummary(
                student_id=student.student_id,
                name=student.name,
                overall_mastery=_average(mastery_scores),
                questions_answered=questions_answered,
                attempt_count=attempt_count,
                last_activity_at=last_activity,
                hint_usage_rate=hint_rate,
            )
        )

    summaries.sort(key=lambda summary: summary.name.lower())
    return summaries


def compute_teacher_unit_summaries() -> List[TeacherUnitSummary]:
    """
    Aggregate mastery and activity information per unit.
    """

    units = load_units()
    attempts = get_attempts_for_all_students()
    attempts_by_unit: Dict[str, List[Attempt]] = {}
    mastery_by_unit_student: Dict[str, Dict[str, List[float]]] = {}

    for attempt in attempts:
        if not attempt.unit_id:
            continue
        attempts_by_unit.setdefault(attempt.unit_id, []).append(attempt)
        if attempt.quiz_type in MASTERY_QUIZ_TYPES:
            mastery_by_unit_student.setdefault(attempt.unit_id, {}).setdefault(
                attempt.student_id, []
            ).append(attempt.score_pct)

    summaries: List[TeacherUnitSummary] = []
    for unit in units:
        unit_attempts = attempts_by_unit.get(unit.id, [])
        students_with_activity = {a.student_id for a in unit_attempts}
        mastery_entries = mastery_by_unit_student.get(unit.id, {})
        per_student_mastery = [
            _average(scores) for scores in mastery_entries.values() if scores
        ]
        hint_attempts = sum(
            1 for attempt in unit_attempts if any(r.used_hint for r in attempt.results)
        )
        hint_rate = (hint_attempts / len(unit_attempts)) if unit_attempts else None
        summaries.append(
            TeacherUnitSummary(
                unit_id=unit.id,
                unit_name=unit.title,
                average_mastery=_average(per_student_mastery),
                attempt_count=len(unit_attempts),
                student_count=len(students_with_activity),
                hint_usage_rate=hint_rate,
            )
        )

    return summaries


def get_next_activity_for_student(student_id: str) -> NextActivity:
    units = load_units()
    if not units:
        return NextActivity(unit_id="", section_id=None, activity="diagnostic")

    attempts = load_attempts(student_id)
    diag_taken_units: Set[str] = {
        a.unit_id for a in attempts if a.quiz_type == "diagnostic" and a.unit_id
    }
    diag_taken_any = bool(diag_taken_units)

    if not diag_taken_any:
        fallback_unit = next((u for u in units if u.diagnostic_quiz_id), units[0])
        return NextActivity(
            unit_id=fallback_unit.id,
            section_id=None,
            activity="diagnostic",
        )

    mastery_types = {"mini_quiz", "unit_test"}
    unit_scores: Dict[str, List[float]] = {}
    section_scores: Dict[str, Dict[str, List[float]]] = {}
    for attempt in attempts:
        if attempt.quiz_type == "diagnostic" or attempt.unit_id is None:
            continue
        if attempt.quiz_type not in mastery_types:
            continue
        unit_scores.setdefault(attempt.unit_id, []).append(attempt.score_pct)
        if attempt.section_id:
            section_scores.setdefault(attempt.unit_id, {}).setdefault(
                attempt.section_id, []
            ).append(attempt.score_pct)

    unit_mastery: Dict[str, float] = {}
    for unit in units:
        unit_mastery[unit.id] = _average(unit_scores.get(unit.id, []))

    # Choose the unit with the lowest mastery (defaulting to 0)
    target_unit = min(units, key=lambda u: unit_mastery.get(u.id, 0.0))

    if target_unit.id not in diag_taken_units:
        return NextActivity(
            unit_id=target_unit.id,
            section_id=None,
            activity="diagnostic",
        )

    section_stats: Dict[str, float] = {}
    unit_sections = target_unit.sections or []
    for section in unit_sections:
        section_id = section.get("id")
        if not section_id:
            continue
        section_scores_for_unit = section_scores.get(target_unit.id, {})
        section_stats[section_id] = _average(section_scores_for_unit.get(section_id, []))

    best_section = None
    best_section_mastery = None
    for section in unit_sections:
        section_id = section.get("id")
        if not section_id:
            continue
        mastery = section_stats.get(section_id, 0.0)
        if best_section is None or mastery < (best_section_mastery or 101):
            best_section = section
            best_section_mastery = mastery

    unit_mastery_value = unit_mastery.get(target_unit.id, 0.0)
    section_id = best_section.get("id") if best_section else None

    if best_section and best_section_mastery is not None:
        mini_quiz_id = _get_section_value(best_section, "miniQuizId", "mini_quiz_id")
        if best_section_mastery < 75 and mini_quiz_id:
            return NextActivity(
                unit_id=target_unit.id,
                section_id=section_id,
                activity="mini_quiz",
            )

    if unit_mastery_value >= 85 and target_unit.comprehensive_quiz_id:
        return NextActivity(
            unit_id=target_unit.id,
            section_id=None,
            activity="unit_test",
        )

    if best_section:
        practice_quiz_id = _get_section_value(
            best_section, "practiceQuizId", "practice_quiz_id"
        )
        if practice_quiz_id:
            return NextActivity(
                unit_id=target_unit.id,
                section_id=section_id,
                activity="practice",
            )
        mini_quiz_id = _get_section_value(best_section, "miniQuizId", "mini_quiz_id")
        if mini_quiz_id:
            return NextActivity(
                unit_id=target_unit.id,
                section_id=section_id,
                activity="mini_quiz",
            )

    # Fallback: recommend the unit diagnostic again if available
    fallback_activity = "diagnostic" if target_unit.diagnostic_quiz_id else "practice"
    return NextActivity(
        unit_id=target_unit.id,
        section_id=None,
        activity=fallback_activity,
    )


def get_user_by_email(email: str) -> Optional[User]:
    normalized = (email or "").strip().lower()
    if not normalized:
        return None
    raw = _load_json(USERS_PATH, [])
    for entry in raw:
        entry_email = (entry.get("email") or "").strip().lower()
        if entry_email != normalized:
            continue
        try:
            return User(
                id=entry["id"],
                email=entry["email"],
                password=entry["password"],
                role=entry.get("role", "student"),
                student_id=entry.get("student_id"),
            )
        except KeyError:
            continue
    return None
