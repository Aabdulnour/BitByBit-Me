from __future__ import annotations

from flask import Flask, jsonify, request
from flask_cors import CORS
import uuid

from .models import Attempt, AttemptQuestionResult, StudentState
from .repository import (
    load_units,
    load_unit,
    load_quiz,
    load_questions,
    load_student,
    save_student,
    load_attempts,
    append_attempt,
    get_next_activity_for_student,
    compute_teacher_student_summaries,
    compute_teacher_unit_summaries,
    compute_unit_mastery_for_student,
    get_all_students,
    create_student,
    get_user_by_email,
)
from .recommender import pick_next_question


def create_app() -> Flask:
    app = Flask(__name__)

    # Allow the Vite dev server to talk to this API
    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://127.0.0.1:5173", "http://localhost:5173"]}},
    )

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.post("/api/auth/login")
    def api_auth_login():
        payload = request.get_json(force=True) or {}
        email = (payload.get("email") or "").strip().lower()
        password = (payload.get("password") or "").strip()
        if not email or not password:
            return jsonify({"error": "invalid_credentials"}), 401
        user = get_user_by_email(email)
        if not user or user.password != password:
            return jsonify({"error": "invalid_credentials"}), 401
        return jsonify(user.to_safe_dict())

    @app.post("/api/auth/forgot-password")
    def api_auth_forgot_password():
        payload = request.get_json(force=True) or {}
        email = (payload.get("email") or "").strip()
        message = "If this email exists, we will send reset instructions."
        if email:
            _ = get_user_by_email(email)
        return jsonify({"message": message})

    @app.get("/api/units")
    def api_units():
        units = [u.to_dict() for u in load_units()]
        return jsonify(units)

    @app.get("/api/units/<unit_id>")
    def api_unit(unit_id: str):
        unit = load_unit(unit_id)
        if not unit:
            return jsonify({"error": "unit_not_found"}), 404
        return jsonify(unit.to_dict())

    @app.get("/api/quizzes/<quiz_id>")
    def api_quiz(quiz_id: str):
        """
        Return quiz with a "questions" array so the frontend
        does not have to fetch questions separately.
        """
        quiz = load_quiz(quiz_id)
        if not quiz:
            return jsonify({"error": "quiz_not_found"}), 404

        all_questions = load_questions()
        question_objects = [
            all_questions[qid] for qid in quiz.question_ids if qid in all_questions
        ]

        payload = quiz.to_dict()
        payload["questions"] = [q.to_dict() for q in question_objects]
        return jsonify(payload)

    @app.get("/api/student/<student_id>/state")
    def api_get_student_state(student_id: str):
        student = load_student(student_id)
        if not student:
            student = StudentState(student_id=student_id, name=f"Student {student_id}")
            save_student(student)
        return jsonify(student.to_dict())

    @app.get("/api/student/<student_id>/next-activity")
    def api_next_activity(student_id: str):
        student = load_student(student_id)
        if not student:
            student = StudentState(student_id=student_id, name=f"Student {student_id}")
            save_student(student)
        activity = get_next_activity_for_student(student_id)
        return jsonify(activity.to_dict())

    @app.post("/api/student/<student_id>/state")
    def api_update_student_state(student_id: str):
        payload = request.get_json(force=True) or {}
        student = load_student(student_id) or StudentState(
            student_id=student_id,
            name=payload.get("name", f"Student {student_id}"),
        )
        if "name" in payload:
            student.name = payload["name"]
        if "grade_level" in payload:
            student.grade_level = payload["grade_level"]
        if "preferred_difficulty" in payload:
            student.preferred_difficulty = payload["preferred_difficulty"]
        if "last_unit_id" in payload:
            student.last_unit_id = payload["last_unit_id"] or None
        if "last_section_id" in payload:
            student.last_section_id = payload["last_section_id"] or None
        if "last_activity" in payload:
            student.last_activity = payload["last_activity"] or None
        if "avatar_url" in payload:
            student.avatar_url = payload["avatar_url"] or None
        if "avatar_name" in payload:
            student.avatar_name = payload["avatar_name"] or None
        save_student(student)
        return jsonify(student.to_dict())

    @app.get("/api/attempts/<student_id>")
    def api_attempts(student_id: str):
        attempts = [a.to_dict() for a in load_attempts(student_id)]
        return jsonify(attempts)

    @app.get("/api/students")
    def api_students():
        """Return a lightweight list of students for selection UIs."""

        students = [
            {
                "id": student.student_id,
                "name": student.name,
                "email": student.email,
            }
            for student in get_all_students()
        ]
        return jsonify({"students": students})

    @app.post("/api/students")
    def api_create_student_record():
        """
        Demo endpoint that appends a student to students.json so the app feels multi-tenant.
        """

        payload = request.get_json(force=True) or {}
        name = (payload.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name_required"}), 400
        email = payload.get("email")
        student = create_student(name=name, email=email)
        return jsonify(student.to_dict()), 201

    @app.get("/api/teacher/overview")
    def api_teacher_overview():
        """Return aggregated stats for the teacher dashboard."""

        raw_student_summaries = compute_teacher_student_summaries()
        student_summaries = [summary.to_dict() for summary in raw_student_summaries]
        unit_summaries = [
            summary.to_dict() for summary in compute_teacher_unit_summaries()
        ]

        total_students = len(raw_student_summaries)
        total_attempts = sum(summary.attempt_count for summary in raw_student_summaries)
        average_mastery = (
            sum(summary.overall_mastery for summary in raw_student_summaries) / total_students
            if total_students
            else 0.0
        )
        hint_weighted_total = sum(
            (summary.hint_usage_rate or 0) * summary.attempt_count
            for summary in raw_student_summaries
        )
        average_hint_usage = (
            (hint_weighted_total / total_attempts) if total_attempts else None
        )

        summary_payload = {
            "total_students": total_students,
            "average_mastery": round(average_mastery, 1) if total_students else 0.0,
            "total_attempts": total_attempts,
            "average_hint_usage": average_hint_usage,
        }

        return jsonify(
            {
                "summary": summary_payload,
                "students": student_summaries,
                "units": unit_summaries,
            }
        )

    @app.get("/api/teacher/students/<student_id>")
    def api_teacher_student_detail(student_id: str):
        """Return detail for a single student so teachers can drill down."""

        student = load_student(student_id)
        if not student:
            student = StudentState(student_id=student_id, name=f"Student {student_id}")
            save_student(student)
        attempts = [attempt.to_dict() for attempt in load_attempts(student_id)]
        mastery_lookup = compute_unit_mastery_for_student(student_id)
        units = {unit.id: unit.title for unit in load_units()}
        unit_mastery = [
            {
                "unit_id": unit_id,
                "unit_name": units.get(unit_id, unit_id),
                "mastery": mastery,
            }
            for unit_id, mastery in mastery_lookup.items()
        ]
        return jsonify(
            {
                "student": student.to_dict(),
                "attempts": attempts,
                "unit_mastery": unit_mastery,
            }
        )

    @app.get("/api/student/<student_id>/diagnostic-results/<unit_id>")
    def api_student_diagnostic_results(student_id: str, unit_id: str):
        unit = load_unit(unit_id)
        if not unit:
            return jsonify({"error": "unit_not_found"}), 404

        diagnostic_quiz_id = unit.diagnostic_quiz_id
        attempts = [
            attempt
            for attempt in load_attempts(student_id)
            if attempt.quiz_type == "diagnostic" and attempt.unit_id == unit_id
        ]
        if not attempts:
            return jsonify(
                {
                    "has_attempt": False,
                    "unit": {"id": unit.id, "title": unit.title},
                }
            )

        attempt = max(attempts, key=lambda a: a.created_at or 0)
        quiz = load_quiz(diagnostic_quiz_id) if diagnostic_quiz_id else None
        questions_lookup = load_questions()

        questions_payload = []
        correct_count = 0
        for result in attempt.results:
            question = questions_lookup.get(result.question_id)
            is_correct = bool(result.correct)
            if is_correct:
                correct_count += 1
            questions_payload.append(
                {
                    "question_id": result.question_id,
                    "question_text": question.text if question else "",
                    "options": question.options if question and question.options else [],
                    "student_answer": result.chosen_answer,
                    "correct_answer": question.correct_answer if question else None,
                    "is_correct": is_correct,
                }
            )

        total_questions = len(questions_payload)
        percent_correct = (
            round((correct_count / total_questions) * 100)
            if total_questions
            else round(attempt.score_pct)
        )

        quiz_payload = {
            "id": diagnostic_quiz_id or attempt.quiz_id,
            "title": quiz.title if quiz else f"{unit.title} diagnostic",
            "unit_id": unit.id,
        }

        summary = {
            "total_questions": total_questions,
            "correct": correct_count,
            "percent_correct": percent_correct,
            "attempt_id": attempt.id,
            "score_pct": attempt.score_pct,
        }

        return jsonify(
            {
                "has_attempt": True,
                "unit": {"id": unit.id, "title": unit.title},
                "quiz": quiz_payload,
                "summary": summary,
                "questions": questions_payload,
            }
        )

    @app.post("/api/attempts")
    def api_create_attempt():
        payload = request.get_json(force=True) or {}
        try:
            attempt = Attempt(
                id=str(uuid.uuid4()),
                student_id=payload["student_id"],
                quiz_id=payload["quiz_id"],
                quiz_type=payload["quiz_type"],
                unit_id=payload["unit_id"],
                section_id=payload.get("section_id"),
                score_pct=float(payload["score_pct"]),
                results=[
                    AttemptQuestionResult(
                        question_id=r["question_id"],
                        correct=bool(r["correct"]),
                        chosen_answer=r["chosen_answer"],
                        time_sec=float(r.get("time_sec", 0)),
                        used_hint=bool(r.get("used_hint", False)),
                    )
                    for r in payload.get("results", [])
                ],
            )
        except KeyError as e:
            return jsonify({"error": f"missing_field_{e}"}), 400

        append_attempt(attempt)
        return jsonify(attempt.to_dict()), 201

    @app.post("/api/next-question")
    def api_next_question():
        payload = request.get_json(force=True) or {}
        student_id = payload.get("student_id")
        if not student_id:
            return jsonify({"error": "student_id_required"}), 400

        unit_id = payload.get("unit_id")
        section_id = payload.get("section_id")

        student = load_student(student_id)
        if not student:
            student = StudentState(student_id=student_id, name=f"Student {student_id}")
            save_student(student)

        q = pick_next_question(student, unit_id=unit_id, section_id=section_id)
        if not q:
            return jsonify({"error": "no_question_available"}), 404
        return jsonify(q.to_dict())

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
