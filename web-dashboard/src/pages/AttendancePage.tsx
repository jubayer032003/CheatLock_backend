import { Activity, BookOpen, Eye, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchExamAttendanceOverview,
  fetchExamSubmissions,
  fetchTeacherExam,
  gradeSubmission,
} from "../lib/api";
import { Badge, Card, EmptyState, ErrorState, PageHeader, SkeletonBlock } from "../components/ui";
import type { Exam, ExamAttendanceStudent, ExamSubmission } from "../types";

function studentLabel(student: { studentName?: string; studentId: string }) {
  return student.studentName || student.studentId;
}

function normalizeStudentId(studentId: string) {
  return studentId.trim().toLowerCase();
}

type StudentRow = ExamAttendanceStudent & {
  submission?: ExamSubmission;
};

export function AttendancePage() {
  const { examId = "" } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchExamAttendanceOverview>> | null>(null);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [gradeDraft, setGradeDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadAttendance = useCallback(async () => {
    if (!examId) return;

    const [examData, overviewData, examSubmissions] = await Promise.all([
      fetchTeacherExam(examId),
      fetchExamAttendanceOverview(examId),
      fetchExamSubmissions(examId),
    ]);

    setExam(examData);
    setOverview(overviewData);
    setSubmissions(examSubmissions);

    const firstStudent =
      overviewData.students.find((student) => student.submitted)?.studentId ||
      overviewData.students[0]?.studentId ||
      examSubmissions[0]?.studentId ||
      "";

    setSelectedStudentId((current) => current || firstStudent);
  }, [examId]);

  useEffect(() => {
    if (!examId) return;

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        await loadAttendance();
      } catch (error) {
        console.error("Attendance load failed", error);
        setMessage("Could not load attendance information. Check that the exam exists and you are logged in as the teacher.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [examId, loadAttendance]);

  const submissionMap = useMemo(() => {
    const map = new Map<string, ExamSubmission>();
    submissions.forEach((submission) => {
      map.set(normalizeStudentId(submission.studentId), submission);
    });
    return map;
  }, [submissions]);

  const studentList = useMemo<StudentRow[]>(() => {
    if (!overview) return [];

    return overview.students
      .map((student) => ({
        ...student,
        submission: submissionMap.get(normalizeStudentId(student.studentId)),
      }))
      .sort((first, second) => {
        if (first.submitted !== second.submitted) {
          return first.submitted ? -1 : 1;
        }
        if (first.attended !== second.attended) {
          return first.attended ? -1 : 1;
        }
        return studentLabel(first).localeCompare(studentLabel(second));
      });
  }, [overview, submissionMap]);

  useEffect(() => {
    if (!selectedStudentId && studentList.length) {
      setSelectedStudentId(studentList[0].studentId);
    }
  }, [studentList, selectedStudentId]);

  const selectedStudent = useMemo(
    () => studentList.find((student) => student.studentId === selectedStudentId) || null,
    [selectedStudentId, studentList]
  );

  const selectedSubmission = selectedStudent?.submission;

  useEffect(() => {
    if (!selectedSubmission) {
      setGradeDraft("");
      setFeedbackDraft("");
      return;
    }
    setGradeDraft(
      selectedSubmission.grade != null ? String(selectedSubmission.grade) : ""
    );
    setFeedbackDraft(selectedSubmission.feedback || "");
  }, [selectedStudentId, selectedSubmission]);

  const presentCount = overview?.summary.attended ?? 0;
  const submittedCount = overview?.summary.submitted ?? submissions.length;
  const gradedCount = overview?.summary.graded ?? 0;

  async function handleRefresh() {
    if (!examId) return;
    setRefreshing(true);
    setMessage("");
    try {
      await loadAttendance();
    } catch (error) {
      console.error("Attendance refresh failed", error);
      setMessage("Could not refresh attendance.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSaveGrade() {
    if (!examId || !selectedStudent) {
      setMessage("Select a student before saving a grade.");
      return;
    }

    if (!selectedStudent.submitted) {
      setMessage("This student has not submitted answers yet.");
      return;
    }

    const score = Number(gradeDraft);
    if (Number.isNaN(score) || score < 0) {
      setMessage("Enter a valid numeric grade.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await gradeSubmission(examId, selectedStudent.studentId, score, feedbackDraft.trim());
      await loadAttendance();
      setMessage("Grade saved and student notified.");
    } catch (error) {
      console.error("Grade save failed", error);
      setMessage("Could not save grade.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SkeletonBlock className="h-64" />;
  }

  if (!overview && message) {
    return (
      <div className="space-y-4">
        <ErrorState message={message} onRetry={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attendance & grading"
        title={exam?.title || overview?.exam.title || "Exam attendance"}
        description="View assigned students, attendance, submitted answers, and assign marks to notify students."
        actions={
          <>
            <button
              className="secondary-button"
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <Link className="primary-button" to={`/exams/${examId}/live`}>
              <Eye size={18} />
              Live Proctoring
            </Link>
          </>
        }
      />

      {message && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {message}
        </p>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Students</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Assigned roster, live attendance, and submission status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="primary">Attended {presentCount}</Badge>
              <Badge tone="info">Submitted {submittedCount}</Badge>
              <Badge tone="success">Graded {gradedCount}</Badge>
              <Badge tone="neutral">Assigned {overview?.summary.totalAssigned ?? 0}</Badge>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {studentList.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No students yet"
                description="Assign students to this exam or share the exam code so they can join and submit."
              />
            ) : (
              studentList.map((student) => (
                <button
                  key={student.studentId}
                  type="button"
                  onClick={() => setSelectedStudentId(student.studentId)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selectedStudentId === student.studentId
                      ? "border-cyan-300 bg-cyan-50 dark:bg-cyan-500/10"
                      : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.025]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950 dark:text-white">{studentLabel(student)}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{student.studentId}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge tone={student.attended ? "primary" : "neutral"}>
                        {student.attended ? "Attended" : "Not attended"}
                      </Badge>
                      <Badge tone={student.submitted ? "success" : "warning"}>
                        {student.submitted ? "Submitted" : "No submission"}
                      </Badge>
                      {student.onlineStatus && (
                        <Badge tone={student.onlineStatus === "ONLINE" ? "info" : "neutral"}>
                          {student.onlineStatus.toLowerCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Session: {String(student.sessionStatus).replaceAll("_", " ").toLowerCase()}
                  </p>
                  {student.grade != null && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Grade: {student.grade}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Student submission</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Inspect answers and assign a mark.</p>
            </div>
            <Badge tone="primary">{selectedStudent ? studentLabel(selectedStudent) : "No selection"}</Badge>
          </div>

          {!selectedStudent ? (
            <div className="mt-6">
              <EmptyState icon={BookOpen} title="Select a student" description="Choose a student to review answers and grade them." />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Student</p>
                  <p className="mt-2 font-semibold text-slate-950 dark:text-white">{studentLabel(selectedStudent)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Submission status</p>
                  <p className="mt-2 font-semibold text-slate-950 dark:text-white">
                    {selectedStudent.submitted ? "Submitted" : "Pending"}
                  </p>
                </div>
              </div>

              {selectedSubmission?.answers?.length ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Submitted answers</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Review each question and response.</p>
                      </div>
                      <Badge tone="info">{selectedSubmission.riskLevel}</Badge>
                    </div>

                    <div className="mt-4 space-y-3">
                      {selectedSubmission.answers.map((answer, index) => (
                        <div
                          key={`${answer.questionText}-${index}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
                        >
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            Q{index + 1}. {answer.questionText}
                          </p>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            {answer.answerText?.trim() ? answer.answerText : "(No answer provided)"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <label className="block">
                      <span className="field-label">Grade</span>
                      <input
                        className="field-input"
                        type="number"
                        min={0}
                        max={100}
                        value={gradeDraft}
                        onChange={(event) => setGradeDraft(event.target.value)}
                        placeholder="Enter numeric grade"
                      />
                    </label>
                    <label className="block">
                      <span className="field-label">Feedback</span>
                      <textarea
                        className="field-input min-h-24 py-3"
                        value={feedbackDraft}
                        onChange={(event) => setFeedbackDraft(event.target.value)}
                        placeholder="Provide review comments for the student."
                      />
                    </label>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={handleSaveGrade}
                      disabled={saving || !selectedStudent.submitted}
                    >
                      {saving ? "Saving grade..." : "Save grade and notify student"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  {selectedStudent.submitted
                    ? "Submission was recorded but answer text is not available yet. Try Refresh."
                    : "No submitted answers are available for this student yet."}
                </div>
              )}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
