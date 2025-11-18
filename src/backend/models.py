from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Literal
import time


Difficulty = Literal["easy", "medium", "hard"]
QuestionType = Literal["mcq", "boolean"]
QuizType = Literal["diagnostic", "practice", "mini_quiz", "unit_test"]
ActivityType = QuizType


@dataclass
class Question:
    id: str
    unit_id: str
    section_id: str
    text: str
    type: QuestionType
    options: List[str]  # for boolean use ["True", "False"]
    correct_answer: str
    skill_ids: List[str] = field(default_factory=list)
    difficulty: Difficulty = "easy"
    estimated_time_sec: int = 60

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class Quiz:
    id: str
    title: str
    unit_id: str
    section_id: Optional[str]
    type: QuizType
    question_ids: List[str]
    passing_score_pct: int = 60

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class SkillMastery:
    skill_id: str
    correct: int = 0
    total: int = 0

    @property
    def pct(self) -> float:
        return (self.correct / self.total * 100.0) if self.total > 0 else 0.0

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class StudentState:
    student_id: str
    name: str
    email: Optional[str] = None
    grade_level: str = "9"
    preferred_difficulty: Difficulty = "medium"
    mastery_by_skill: Dict[str, SkillMastery] = field(default_factory=dict)
    skill_mastery: Dict[str, Dict[str, float]] = field(default_factory=dict)
    last_unit_id: Optional[str] = None
    last_section_id: Optional[str] = None
    last_activity: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_name: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "student_id": self.student_id,
            "name": self.name,
            "email": self.email,
            "grade_level": self.grade_level,
            "preferred_difficulty": self.preferred_difficulty,
            "mastery_by_skill": {k: v.to_dict() for k, v in self.mastery_by_skill.items()},
            "skill_mastery": self.skill_mastery,
            "last_unit_id": self.last_unit_id,
            "last_section_id": self.last_section_id,
            "last_activity": self.last_activity,
            "avatar_url": self.avatar_url,
            "avatar_name": self.avatar_name,
        }


@dataclass
class AttemptQuestionResult:
    question_id: str
    correct: bool
    chosen_answer: str
    time_sec: float
    used_hint: bool = False

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class Attempt:
    id: str
    student_id: str
    quiz_id: str
    quiz_type: QuizType
    unit_id: str
    section_id: Optional[str]
    score_pct: float
    created_at: float = field(default_factory=time.time)
    results: List[AttemptQuestionResult] = field(default_factory=list)

    def to_dict(self) -> Dict:
        data = asdict(self)
        results_list: List[Dict] = []
        for r in self.results:
            if hasattr(r, "to_dict"):
                results_list.append(r.to_dict())  # AttemptQuestionResult
            else:
                results_list.append(r)
        data["results"] = results_list
        return data


@dataclass
class Unit:
    id: str
    title: str
    description: str
    sections: List[Dict[str, str]]
    diagnostic_quiz_id: Optional[str] = None
    comprehensive_quiz_id: Optional[str] = None

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class NextActivity:
    unit_id: str
    section_id: Optional[str]
    activity: ActivityType
    reason: Optional[str] = None
    quiz_id: Optional[str] = None
    skill_id: Optional[str] = None
    difficulty_target: Optional[float] = None

    def to_dict(self) -> Dict:
        payload = {
            "unit_id": self.unit_id,
            "section_id": self.section_id,
            "activity": self.activity,
        }
        if self.reason:
            payload["reason"] = self.reason
        if self.quiz_id:
            payload["quiz_id"] = self.quiz_id
        if self.skill_id:
            payload["skill_id"] = self.skill_id
        if self.difficulty_target is not None:
            payload["difficulty_target"] = self.difficulty_target
        return payload


@dataclass
class TeacherStudentSummary:
    """
    Snapshot of a student's progress for teacher dashboards.
    """

    student_id: str
    name: str
    overall_mastery: float
    questions_answered: int
    attempt_count: int
    last_activity_at: Optional[str]
    hint_usage_rate: Optional[float] = None

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class TeacherUnitSummary:
    """
    Aggregated performance for a unit across all students.
    """

    unit_id: str
    unit_name: str
    average_mastery: float
    attempt_count: int
    student_count: int
    hint_usage_rate: Optional[float] = None

    def to_dict(self) -> Dict:
        return asdict(self)


Role = Literal["student", "teacher"]


@dataclass
class User:
    id: str
    email: str
    password: str
    role: Role
    student_id: Optional[str] = None

    def to_safe_dict(self) -> Dict:
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "student_id": self.student_id,
        }

    def to_dict(self) -> Dict:
        return asdict(self)
