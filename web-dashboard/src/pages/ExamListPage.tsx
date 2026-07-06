import { Activity, BookOpen, Eye, Plus, Trash2, Users } from "lucide-react";
import { AssignStudentsToExamPanel } from "../components/AssignStudentsToExamPanel";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QrCode } from "../components/QrCode";
import { Badge, Card, EmptyState, ErrorState, PageHeader, SkeletonBlock, cn } from "../components/ui";
import { createExam, deleteExam, fetchClasses, fetchTeacherExams } from "../lib/api";
import type { Exam, ExamQuestion, QuestionType, TeacherClass } from "../types";

export function ExamListPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [createdExam, setCreatedExam] = useState<Exam | null>(null);
  const [error, setError] = useState("");

  async function loadExams() {
    setError("");
    setLoading(true);
    try {
      setExams(await fetchTeacherExams());
    } catch (err) {
      setError(readErrorMessage(err, "Could not load exams."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExams();
  }, []);

  async function handleCreate(exam: Exam) {
    const created = await createExam(exam);
    setCreatedExam(created);
    setExams(await fetchTeacherExams());
  }

  async function handleDelete(examId: string, examTitle: string) {
    if (!window.confirm(`Delete exam "${examTitle}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteExam(examId);
      setExams((prev) => prev.filter((exam) => exam.id !== examId));
    } catch (err) {
      setError(readErrorMessage(err, "Could not delete exam."));
    }
  }

  const stats = useMemo(() => {
    const live = exams.filter((exam) => exam.status === "LIVE").length;
    const scheduled = exams.filter((exam) => exam.status === "SCHEDULED").length;
    const students = exams.reduce((sum, exam) => sum + exam.assignedStudents.length, 0);
    return { live, scheduled, students };
  }, [exams]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exam operations"
        title="Create and Manage Exams"
        description="Build CQ/MCQ exams, assign students, and share secure access through code, link, and QR. The Android teacher dashboard keeps using the same backend records."
        actions={<a className="secondary-button" href="#exam-creator"><Plus size={17} />New exam</a>}
      />

      {error && <ErrorState message={error} onRetry={loadExams} />}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total exams</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{exams.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Live / Scheduled</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{stats.live} / {stats.scheduled}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned students</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{stats.students}</p>
        </Card>
      </section>

      <ExamCreator onCreated={handleCreate} createdExam={createdExam} />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5 dark:border-white/10">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">Exam List</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Only exams owned by the logged-in teacher are shown.</p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <SkeletonBlock className="h-40" key={index} />)}
          </div>
        ) : exams.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={BookOpen} title="No exams found" description="Create your first exam to generate access code, link, and QR." />
          </div>
        ) : (
          <div className="grid gap-4 p-5 xl:grid-cols-2">
            {exams.map((exam) => (
              <ExamListCard
                exam={exam}
                key={exam.id || exam.title}
                onDelete={handleDelete}
                onExamUpdated={(updatedExam) => {
                  setExams((current) =>
                    current.map((item) => (item.id === updatedExam.id ? updatedExam : item))
                  );
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ExamListCard({
  exam,
  onDelete,
  onExamUpdated,
}: {
  exam: Exam;
  onDelete: (examId: string, examTitle: string) => void;
  onExamUpdated: (exam: Exam) => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold tracking-tight text-slate-950 dark:text-white">{exam.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>{exam.durationMinutes} min</span>
            <span className="inline-flex items-center gap-1"><Users size={15} />{exam.assignedStudents.length} students</span>
            <span className="inline-flex items-center gap-1"><BookOpen size={15} />{exam.questions.length} questions</span>
          </div>
        </div>
        <Badge tone={exam.status === "LIVE" ? "success" : exam.status === "ENDED" ? "danger" : "neutral"}>
          {exam.status || "DRAFT"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoChip label="Exam code" value={exam.accessCode || "Pending"} />
        <InfoChip label="Community" value={exam.useCommunity ? "Enabled" : "Manual only"} />
      </div>

      {exam.id && (
        <>
          <AssignStudentsToExamPanel
            className="mt-4 border-0 bg-slate-50 p-4 shadow-none dark:bg-white/[0.02]"
            exam={exam}
            onExamUpdated={onExamUpdated}
          />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link className="secondary-button" to={`/exams/${exam.id}`}><Eye size={17} />Details</Link>
            <Link className="primary-button" to={`/exams/${exam.id}/live`}><Activity size={17} />Live</Link>
            <button
              className="secondary-button text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              type="button"
              onClick={() => onDelete(exam.id!, exam.title)}
              title="Delete exam"
            >
              <Trash2 size={17} />
              Delete
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function ExamCreator({ onCreated, createdExam }: { onCreated: (exam: Exam) => Promise<void>; createdExam: Exam | null }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("10");
  const [assignedStudents, setAssignedStudents] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("CQ");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [lockAnswers, setLockAnswers] = useState(true);
  const [useCommunity, setUseCommunity] = useState(true);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  function addQuestion() {
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!questionText.trim()) return setMessage("Write the question first.");
    if (questionType === "MCQ" && cleanOptions.length < 2) return setMessage("MCQ needs at least two options.");

    setQuestions((current) => [...current, { type: questionType, text: questionText.trim(), options: questionType === "MCQ" ? cleanOptions : [] }]);
    setQuestionText("");
    setOptions(["", "", "", ""]);
    setMessage("Question added.");
  }

  async function handleSubmit() {
    const students = assignedStudents.split(",").map((student) => student.trim().toLowerCase()).filter(Boolean);
    const durationMinutes = Number(duration) || 10;

    if (!title.trim()) return setMessage("Add an exam title.");
    if (durationMinutes <= 0) return setMessage("Duration must be at least 1 minute.");
    if (questions.length === 0) return setMessage("Add at least one question.");
    if (students.length === 0 && !useCommunity && selectedClassIds.length === 0) {
      return setMessage("Assign at least one student, class, or teacher community.");
    }

    setCreating(true);
    setMessage("");
    try {
      await onCreated({ title: title.trim(), durationMinutes, lockAnswers, questions, assignedStudents: students, useCommunity, classIds: selectedClassIds });
      setTitle("");
      setAssignedStudents("");
      setSelectedClassIds([]);
      setQuestions([]);
      setMessage("Exam created successfully.");
    } catch (error) {
      setMessage(readErrorMessage(error, "Could not create exam."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="p-5" id="exam-creator">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">Create Exam</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Build questions, assign students, then share the generated code, link, or QR.</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_260px]">
        <label className="block">
          <span className="field-label">Exam title</span>
          <input className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Midterm ICT secure assessment" />
        </label>
        <label className="block">
          <span className="field-label">Duration minutes</span>
          <input className="field-input" value={duration} onChange={(event) => setDuration(event.target.value.replace(/\D/g, ""))} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["10", "20", "30"].map((minute) => (
          <button className={cn("secondary-button", duration === minute && "border-cyan-300 bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200")} key={minute} type="button" onClick={() => setDuration(minute)}>
            {minute} min
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="field-label">Specific student IDs or emails</span>
        <input className="field-input" value={assignedStudents} onChange={(event) => setAssignedStudents(event.target.value)} placeholder="student.id@school.edu, cadet.id@school.edu" />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Separate multiple students with commas.</span>
      </label>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex flex-col gap-1">
          <h3 className="font-bold tracking-tight text-slate-950 dark:text-white">Assign Classes</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Selected class rosters are added to this exam automatically.</p>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {classes.map((item) => (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-command-950/40" key={item.id}>
              <input
                className="mt-1 h-4 w-4 accent-cyan-500"
                type="checkbox"
                checked={selectedClassIds.includes(item.id)}
                onChange={(event) => {
                  setSelectedClassIds((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((classId) => classId !== item.id)
                  );
                }}
              />
              <span>
                <span className="block font-semibold text-slate-900 dark:text-white">{item.name}{item.section ? ` / ${item.section}` : ""}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{item.subject || "No subject"} / {item.students.length} students</span>
              </span>
            </label>
          ))}
          {classes.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No classes yet. Create classes from the Classes page.</p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.025]">
        <div className="flex flex-col gap-1">
          <h3 className="font-bold tracking-tight text-slate-950 dark:text-white">Question Builder</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Choose CQ for written answers or MCQ for options.</p>
        </div>

        <div className="mt-4 inline-flex rounded-md border border-slate-300 bg-white p-1 dark:border-white/10 dark:bg-command-950/70">
          {(["CQ", "MCQ"] as QuestionType[]).map((type) => (
            <button className={cn("rounded px-4 py-2 text-sm font-semibold transition", questionType === type ? "bg-cyan-500 text-slate-950 dark:bg-cyan-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10")} key={type} type="button" onClick={() => setQuestionType(type)}>
              {type}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="field-label">{questionType === "MCQ" ? "MCQ question" : "CQ question"}</span>
          <textarea className="field-input min-h-24 py-3" value={questionText} onChange={(event) => setQuestionText(event.target.value)} />
        </label>

        {questionType === "MCQ" && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {options.map((option, index) => (
              <label className="block" key={index}>
                <span className="field-label">Option {String.fromCharCode(65 + index)}</span>
                <input className="field-input" value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
              </label>
            ))}
          </div>
        )}

        <button className="secondary-button mt-4" type="button" onClick={addQuestion}><Plus size={17} />Add Question</button>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold tracking-tight text-slate-950 dark:text-white">Questions ({questions.length})</h3>
          {questions.length > 0 && <button className="secondary-button" type="button" onClick={() => setQuestions([])}>Clear all</button>}
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {questions.map((question, index) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]" key={`${question.text}-${index}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Question {index + 1} / {question.type || "CQ"}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{question.text}</p>
                  {question.options && question.options.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {question.options.map((option) => <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300" key={option}>{option}</span>)}
                    </div>
                  )}
                </div>
                <button className="icon-button" title="Remove question" type="button" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={17} /></button>
              </div>
            </article>
          ))}
          {questions.length === 0 && <EmptyState icon={BookOpen} title="No questions yet" description="Add at least one CQ or MCQ question." />}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ToggleCard title="Lock answer after save" checked={lockAnswers} onChange={setLockAnswers} />
        <ToggleCard title="Assign teacher community" checked={useCommunity} onChange={setUseCommunity} />
      </div>

      <button className="primary-button mt-5" disabled={creating} type="button" onClick={handleSubmit}>
        {creating ? "Creating..." : "Create Exam"}
      </button>
      {message && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p>}

      {createdExam && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
          <h3 className="font-bold text-emerald-900 dark:text-emerald-100">Student Access</h3>
          <p className="mt-2 text-sm dark:text-emerald-100">Exam: {createdExam.title}</p>
          <p className="text-sm dark:text-emerald-100">Code: <span className="font-mono font-bold">{createdExam.accessCode || "Pending"}</span></p>
          <p className="break-all text-sm dark:text-emerald-100">Link: {createdExam.accessLink || "Pending"}</p>
          {createdExam.accessLink && <div className="mt-3"><QrCode value={createdExam.accessLink} /></div>}
        </div>
      )}
    </Card>
  );
}

function ToggleCard({ title, checked, onChange }: { title: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-100">
      <span className="inline-flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", checked ? "bg-emerald-500" : "bg-slate-400")} />
        {title}
      </span>
      <input className="h-5 w-5 accent-cyan-500" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function readErrorMessage(error: unknown, fallback = "Something went wrong.") {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || (error instanceof Error ? error.message : fallback);
}
