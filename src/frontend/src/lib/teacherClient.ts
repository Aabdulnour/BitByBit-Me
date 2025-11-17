import { apiGet } from "./apiClient";

export type TeacherStudentSummary = {
  student_id: string;
  name: string;
  overall_mastery: number;
  questions_answered: number;
  attempt_count: number;
  last_activity_at: string | null;
  hint_usage_rate?: number | null;
};

export type TeacherUnitSummary = {
  unit_id: string;
  unit_name: string;
  average_mastery: number;
  attempt_count: number;
  student_count: number;
  hint_usage_rate?: number | null;
};

export type TeacherOverviewSummary = {
  total_students: number;
  average_mastery: number;
  total_attempts: number;
  average_hint_usage: number | null;
};

export type DifficultyInsight = {
  question_id: string;
  question_text: string;
  difficulty: number;
  level?: string;
  p_correct?: number;
  n_attempts?: number;
};

export type SkillMasterySnapshotEntry = {
  skill_id: string;
  average_mastery: number;
  student_count: number;
};

export type TeacherOverviewResponse = {
  summary?: TeacherOverviewSummary | null;
  students: TeacherStudentSummary[];
  units: TeacherUnitSummary[];
  difficulty_insights?: DifficultyInsight[];
  skill_mastery_snapshot?: SkillMasterySnapshotEntry[];
};

export type TeacherUnitMasteryEntry = {
  unit_id: string;
  unit_name: string;
  mastery: number;
};

export type TeacherStudentDetailResponse = {
  student: {
    student_id: string;
    name: string;
    grade_level?: string;
    preferred_difficulty?: string;
    email?: string;
    skill_mastery?: Record<
      string,
      { p_mastery?: number; n_observations?: number; recent_correct?: number }
    >;
  };
  attempts: any[];
  unit_mastery: TeacherUnitMasteryEntry[];
};

export async function fetchTeacherOverview(): Promise<TeacherOverviewResponse> {
  return apiGet("/teacher/overview");
}

export async function fetchTeacherStudentDetail(
  studentId: string
): Promise<TeacherStudentDetailResponse> {
  return apiGet(`/teacher/students/${studentId}`);
}
