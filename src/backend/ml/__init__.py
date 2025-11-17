"""
Lightweight ML utilities for the BitByBit ITS backend.

The goal of this package is to keep the core logic in plain Python functions
so they are easy to understand, test, and iterate on.
"""

from .difficulty import estimate_question_difficulty
from .knowledge_tracing import update_student_skill_state
from .recommendation import recommend_next_activity
from .feedback import generate_personalized_feedback

__all__ = [
    "estimate_question_difficulty",
    "update_student_skill_state",
    "recommend_next_activity",
    "generate_personalized_feedback",
]
