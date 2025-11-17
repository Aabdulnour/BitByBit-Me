from __future__ import annotations

import sys
from pathlib import Path
import unittest
from typing import Dict

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from backend.ml.difficulty import estimate_question_difficulty
from backend.ml.knowledge_tracing import update_student_skill_state
from backend.ml.recommendation import recommend_next_activity
from backend.ml.feedback import generate_personalized_feedback
from backend.models import (
    Attempt,
    AttemptQuestionResult,
    Question,
    StudentState,
)
from backend.repository import load_units


class MlModuleTests(unittest.TestCase):
    def test_estimate_question_difficulty_distinguishes_items(self) -> None:
        questions: Dict[str, Question] = {
            "easy-q": Question(
                id="easy-q",
                unit_id="algebra-1",
                section_id="1.1",
                text="Easy question",
                type="mcq",
                options=["1", "2"],
                correct_answer="1",
                skill_ids=["test_skill"],
                difficulty="easy",
                estimated_time_sec=30,
            ),
            "hard-q": Question(
                id="hard-q",
                unit_id="algebra-1",
                section_id="1.1",
                text="Hard question",
                type="mcq",
                options=["1", "2"],
                correct_answer="1",
                skill_ids=["test_skill"],
                difficulty="hard",
                estimated_time_sec=45,
            ),
        }
        attempts = [
            Attempt(
                id="a1",
                student_id="s1",
                quiz_id="quiz",
                quiz_type="practice",
                unit_id="algebra-1",
                section_id="1.1",
                score_pct=100,
                results=[
                    AttemptQuestionResult(
                        question_id="easy-q",
                        correct=True,
                        chosen_answer="1",
                        time_sec=20,
                    ),
                    AttemptQuestionResult(
                        question_id="hard-q",
                        correct=False,
                        chosen_answer="2",
                        time_sec=50,
                    ),
                ],
            ),
            Attempt(
                id="a2",
                student_id="s2",
                quiz_id="quiz",
                quiz_type="practice",
                unit_id="algebra-1",
                section_id="1.1",
                score_pct=50,
                results=[
                    AttemptQuestionResult(
                        question_id="hard-q",
                        correct=False,
                        chosen_answer="2",
                        time_sec=55,
                    ),
                ],
            ),
        ]

        stats = estimate_question_difficulty(attempts, questions)
        self.assertGreater(stats["hard-q"]["difficulty"], stats["easy-q"]["difficulty"])
        self.assertGreater(stats["hard-q"]["n_attempts"], 0)

    def test_update_student_skill_state_tracks_observations(self) -> None:
        attempt = Attempt(
            id="a1",
            student_id="s1",
            quiz_id="quiz",
            quiz_type="practice",
            unit_id="algebra-1",
            section_id="1.1",
            score_pct=60,
            results=[
                AttemptQuestionResult(
                    question_id="q1",
                    correct=True,
                    chosen_answer="2",
                    time_sec=30,
                ),
                AttemptQuestionResult(
                    question_id="q2",
                    correct=True,
                    chosen_answer="5",
                    time_sec=40,
                ),
            ],
        )

        updated = update_student_skill_state("s1", [attempt], current_state=None)
        self.assertIn("solve_linear_one_step", updated)
        mastery = updated["solve_linear_one_step"]["p_mastery"]
        self.assertGreaterEqual(updated["solve_linear_one_step"]["n_observations"], 1)
        self.assertGreater(mastery, 0.3)

    def test_recommend_next_activity_targets_low_skill(self) -> None:
        student = StudentState(
            student_id="s1",
            name="Test Student",
            skill_mastery={
                "solve_linear_one_step": {"p_mastery": 0.8, "n_observations": 5},
                "solve_linear_two_step": {"p_mastery": 0.2, "n_observations": 4},
            },
        )
        attempts = [
            Attempt(
                id="diag",
                student_id="s1",
                quiz_id="diag-1",
                quiz_type="diagnostic",
                unit_id="algebra-1",
                section_id=None,
                score_pct=60,
                results=[
                    AttemptQuestionResult(
                        question_id="q1",
                        correct=True,
                        chosen_answer="2",
                        time_sec=30,
                    )
                ],
            )
        ]
        units = load_units()

        recommendation = recommend_next_activity(student, attempts, units)
        self.assertIsNotNone(recommendation)
        assert recommendation is not None
        self.assertEqual(recommendation.get("skill_id"), "solve_linear_two_step")
        self.assertEqual(recommendation.get("unit_id"), "algebra-1")

    def test_generate_personalized_feedback_mentions_skill(self) -> None:
        student = StudentState(
            student_id="s1",
            name="Skill Tester",
            skill_mastery={
                "solve_linear_one_step": {
                    "p_mastery": 0.6,
                    "n_observations": 3,
                    "recent_correct": 2,
                }
            },
        )
        attempt = Attempt(
            id="attempt-1",
            student_id="s1",
            quiz_id="quiz-1",
            quiz_type="practice",
            unit_id="algebra-1",
            section_id="1.1",
            score_pct=60,
            results=[
                AttemptQuestionResult(
                    question_id="q1",
                    correct=True,
                    chosen_answer="2",
                    time_sec=25,
                )
            ],
        )

        message = generate_personalized_feedback(student, attempt)
        self.assertIn("Linear", message)
        self.assertTrue(len(message) > 20)


if __name__ == "__main__":
    unittest.main()
