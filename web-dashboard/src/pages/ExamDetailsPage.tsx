import { Activity, BookOpen, ClipboardList, Copy, History } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AssignStudentsToExamPanel } from "../components/AssignStudentsToExamPanel";
import { fetchTeacherExam, updateExamLifecycle } from "../lib/api";
import { QrCode } from "../components/QrCode";
import { Badge, Card, EmptyState, ErrorState, PageHeader, SkeletonBlock } from "../components/ui";
import type { Exam } from "../types";

export function ExamDetailsPage() {
  const { examId } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");

  useEffect(() => {
    if (!examId) return;
    fetchTeacherExam(examId)
      .then(setExam)
      .finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => {
    if (!exam) return;
    setScheduledStartAt(toLocalInputValue(exam.scheduledStartAt));
    setScheduledEndAt(toLocalInputValue(exam.scheduledEndAt));
  }, [exam]);

  async function refreshExams() {
    if (!examId) return;
    setExam(await fetchTeacherExam(examId));
  }

  async function runLifecycle(action: "DRAFT" | "SCHEDULE" | "START" | "END" | "ARCHIVE") {
    if (!exam?.id) return;
    setSaving(true);
    setMessage("");
    try {
      await updateExamLifecycle(exam.id, {
        action,
        scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : undefined,
        scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : undefined,
      });
      await refreshExams();
      setMessage("Exam lifecycle updated.");
    } catch (error) {
      setMessage(readErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SkeletonBlock className="h-64" />;
  }

  if (!exam) {
    return <ErrorState message="Exam not found." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exam Details"
        title={exam.title}
        description={`${exam.durationMinutes} minutes, ${exam.questions.length} questions, ${exam.assignedStudents.length} assigned students.`}
        actions={
          <>
          <Link className="primary-button" to={`/exams/${exam.id}/live`}>
            <Activity size={18} />
            Live Proctoring
          </Link>
          <Link className="secondary-button" to={`/exams/${exam.id}/attendance`}>
            <ClipboardList size={18} />
            Attendance
          </Link>
          <Link className="secondary-button" to={`/exams/${exam.id}/replay`}>
            <History size={18} />
            Replay Timeline
          </Link>
          </>
        }
      />

      <Card className="p-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">Exam Control Room</h3>
            <Badge tone={exam.status === "LIVE" ? "success" : exam.status === "ENDED" ? "danger" : "neutral"}>
              {exam.status || "DRAFT"}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Students can enter only while the exam status is Live.</p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="field-label">Scheduled start</span>
            <input
              className="field-input"
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(event) => setScheduledStartAt(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">Scheduled end</span>
            <input
              className="field-input"
              type="datetime-local"
              value={scheduledEndAt}
              onChange={(event) => setScheduledEndAt(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="secondary-button" disabled={saving} type="button" onClick={() => runLifecycle("SCHEDULE")}>
            Schedule
          </button>
          <button className="primary-button" disabled={saving} type="button" onClick={() => runLifecycle("START")}>
            Start Exam
          </button>
          <button className="secondary-button" disabled={saving} type="button" onClick={() => runLifecycle("END")}>
            End Exam
          </button>
          <button className="secondary-button" disabled={saving} type="button" onClick={() => runLifecycle("DRAFT")}>
            Back to Draft
          </button>
          <button className="secondary-button" disabled={saving} type="button" onClick={() => runLifecycle("ARCHIVE")}>
            Archive
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </Card>

      <AssignStudentsToExamPanel exam={exam} onExamUpdated={setExam} />

      <section className="grid gap-4 md:grid-cols-2">
        <InfoBlock label="Exam code" value={exam.accessCode || "Pending"} />
        <InfoBlock label="Exam link" value={exam.accessLink || "Pending"} copyable />
      </section>

      {exam.accessLink && (
        <Card className="p-5">
          <h3 className="mb-3 text-lg font-bold tracking-tight text-slate-950 dark:text-white">Exam QR Code</h3>
          <QrCode value={exam.accessLink} />
        </Card>
      )}

      <Card className="p-5">
        <h3 className="mb-4 text-lg font-bold tracking-tight text-slate-950 dark:text-white">Questions</h3>
        <div className="space-y-3">
          {exam.questions.map((question, index) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]" key={`${question.text}-${index}`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">Question {index + 1}</p>
                <Badge tone={question.type === "MCQ" ? "primary" : "neutral"}>{question.type || "CQ"}</Badge>
              </div>
              <p className="text-sm text-slate-800 dark:text-slate-200">{question.text}</p>
              {question.options && question.options.length > 0 && (
                <ul className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  {question.options.map((option) => (
                    <li className="rounded-md bg-slate-50 px-3 py-2 dark:bg-white/10" key={option}>
                      {option}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
          {exam.questions.length === 0 && <EmptyState icon={BookOpen} title="No questions" description="This exam has no questions yet." />}
        </div>
      </Card>
    </div>
  );
}

function toLocalInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function readErrorMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || (error instanceof Error ? error.message : "Could not update exam lifecycle.");
}

function InfoBlock({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="break-all font-mono text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
        {copyable && (
          <button
            className="icon-button"
            type="button"
            title="Copy"
            onClick={() => navigator.clipboard.writeText(value)}
          >
            <Copy size={17} />
          </button>
        )}
      </div>
    </Card>
  );
}
