import { Activity, AlertTriangle, BookOpen, ClipboardList, Radio, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchTeacherExams } from "../lib/api";
import { getAuthUser } from "../lib/auth";
import type { Exam } from "../types";
import { Badge, Card, EmptyState, MetricCard, PageHeader, SkeletonBlock } from "../components/ui";

const quickActions = [
  { to: "/exams", label: "Manage exams", description: "Create or edit exam details.", icon: BookOpen, tone: "primary" },
  { to: "/reports", label: "Review reports", description: "Inspect integrity and student risk.", icon: ClipboardList, tone: "info" },
  { to: "/classes", label: "Manage classes", description: "Keep class rosters up to date.", icon: Users, tone: "success" },
  { to: "/community", label: "Community roster", description: "Update shared student groups.", icon: ShieldCheck, tone: "warning" },
];

export function TeacherHomePage() {
  const user = getAuthUser();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeacherExams()
      .then(setExams)
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  const assignedCount = useMemo(() => exams.reduce((sum, exam) => sum + exam.assignedStudents.length, 0), [exams]);
  const liveCount = useMemo(() => exams.filter((exam) => exam.status === "LIVE").length, [exams]);
  const scheduledCount = useMemo(() => exams.filter((exam) => exam.status === "SCHEDULED").length, [exams]);
  const integrityScore = Math.max(82, 99 - liveCount * 4);
  const chartData = useMemo(
    () => exams.slice(0, 8).map((exam, index) => ({
      name: exam.title.length > 12 ? `Exam ${index + 1}` : exam.title,
      students: exam.assignedStudents.length + (exam.communityStudents?.length || 0),
      questions: exam.questions.length,
    })),
    [exams]
  );

  return (
    <div className="space-y-6">
      {/* ---------- HEADER ---------- */}
      <PageHeader
        eyebrow="Teacher command center"
        title={`Hello, ${user?.name || "Teacher"}`}
        description="A clean and intuitive teacher dashboard for managing exams, attendance, grading, reports, and student rosters."
        actions={
          <Link className="primary-button" to="/exams">
            <Activity size={18} />
            Create exam
          </Link>
        }
      />

      {/* ---------- METRICS ROW ---------- */}
      <section className="grid gap-4 xl:grid-cols-5">
        <MetricCard icon={BookOpen} label="Exams" value={exams.length} helper="All owned exams" tone="primary" />
        <MetricCard icon={Radio} label="Live now" value={liveCount} helper="Active proctoring sessions" tone={liveCount ? "success" : "neutral"} />
        <MetricCard icon={Users} label="Assigned students" value={assignedCount} helper="Students linked to exams" tone="info" />
        <MetricCard icon={ClipboardList} label="Scheduled" value={scheduledCount} helper="Upcoming exams" tone="warning" />
        <MetricCard icon={ShieldCheck} label="Integrity readiness" value={`${integrityScore}%`} helper="Command readiness" tone="success" />
      </section>

      {/* ---------- QUICK ACTIONS ---------- */}
      <section className="grid gap-4 xl:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-700"
            >
              {/* Background glow */}
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-cyan-50 to-blue-50 opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-cyan-900/20 dark:to-blue-900/20" />

              <div className="relative z-10 flex flex-col items-center text-center gap-4">
                {/* Icon circle */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-sm ring-1 ring-slate-200/60 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md group-hover:ring-cyan-300 dark:from-white/10 dark:to-white/5 dark:ring-white/10 dark:group-hover:ring-cyan-600">
                  <Icon size={28} className="text-slate-600 transition-colors group-hover:text-cyan-600 dark:text-slate-300 dark:group-hover:text-cyan-300" />
                </div>

                {/* Label + subtle description */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {action.label}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {action.description}
                  </p>
                </div>

                {/* Arrow indicator */}
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all duration-300 group-hover:bg-cyan-500 group-hover:text-white dark:bg-white/10 dark:text-slate-500 dark:group-hover:bg-cyan-500 dark:group-hover:text-white">
                  <span aria-hidden="true" className="text-sm font-bold">→</span>
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      {/* ---------- MAIN CONTENT + SIDEBAR ---------- */}
      <section className="grid gap-6 xl:grid-cols-[1.33fr_0.67fr]">
        {/* Left: Exam activity + Chart */}
        <Card className="overflow-hidden p-0">
          {/* Card header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Recent exam activity</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">Jump directly into the latest exams</p>
              </div>
            </div>
            <Badge tone="primary">Most recent</Badge>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="p-5">
              <SkeletonBlock className="h-72" />
            </div>
          ) : exams.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={BookOpen} title="No exams yet" description="Create an exam to get started." />
            </div>
          ) : (
            <>
              {/* Exam list */}
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {exams.slice(0, 6).map((exam) => (
                  <article
                    key={exam.id}
                    className="group/exam flex flex-col gap-4 p-5 transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Left: Icon + Info */}
                    <div className="flex items-start gap-4 min-w-0">
                      {/* Status indicator dot + icon */}
                      <div className="relative flex-shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover/exam:bg-cyan-50 dark:bg-white/5 dark:group-hover/exam:bg-cyan-900/20">
                          <BookOpen size={20} className="text-slate-500 transition-colors group-hover/exam:text-cyan-600 dark:text-slate-400 dark:group-hover/exam:text-cyan-300" />
                        </div>
                        {/* Live indicator dot */}
                        {exam.status === "LIVE" && (
                          <span className="absolute -right-1 -top-1 flex h-4 w-4">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex h-4 w-4 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900" />
                          </span>
                        )}
                      </div>

                      {/* Title + meta */}
                      <div className="min-w-0">
                        <h4 className="truncate text-base font-bold text-slate-950 dark:text-white">
                          {exam.title}
                        </h4>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                            {exam.durationMinutes} min
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 dark:bg-amber-600" />
                            {exam.questions.length} questions
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-300 dark:bg-blue-600" />
                            {exam.assignedStudents.length} students
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Badge + Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge tone={exam.status === "LIVE" ? "success" : exam.status === "SCHEDULED" ? "warning" : exam.status === "ENDED" ? "danger" : "neutral"}>
                        {exam.status || "DRAFT"}
                      </Badge>

                      {/* Action buttons - icon only on small, text on larger */}
                      <div className="flex gap-1">
                        <Link
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                          to={`/exams/${exam.id}/attendance`}
                          title="Attendance"
                        >
                          <ClipboardList size={14} />
                          <span className="hidden sm:inline">Attendance</span>
                        </Link>
                        <Link
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                          to={`/exams/${exam.id}/live`}
                          title="Live"
                        >
                          <Activity size={14} />
                          <span className="hidden sm:inline">Live</span>
                        </Link>
                        <Link
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                          to={`/exams/${exam.id}/replay`}
                          title="Replay"
                        >
                          <Radio size={14} />
                          <span className="hidden sm:inline">Replay</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="border-t border-slate-100 p-5 dark:border-white/5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                      <Activity size={14} />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Student & Question Distribution
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="studentsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="questionsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                          fontSize: '13px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="students"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="url(#studentsGradient)"
                        name="Students"
                      />
                      <Area
                        type="monotone"
                        dataKey="questions"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#questionsGradient)"
                        name="Questions"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Right: Getting started + visual guide */}
        <Card className="overflow-hidden p-0">
          {/* Card header */}
          <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Getting started</h3>
              <p className="text-sm text-slate-400 dark:text-slate-500">Follow the steps below</p>
            </div>
          </div>

          {/* Visual step cards */}
          <div className="p-5 space-y-4">
            {/* Step 1 */}
            <div className="group/step flex items-start gap-4 rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-4 transition-all hover:border-cyan-200 hover:shadow-md dark:border-white/5 dark:from-white/[0.02] dark:to-transparent dark:hover:border-cyan-700">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-lg shadow-cyan-200/50 dark:shadow-cyan-900/30">
                <BookOpen size={22} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Create & assign exams</h4>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  Build exams and assign students from the Exams section
                </p>
              </div>
              <span className="flex-shrink-0 self-center text-2xl font-light text-slate-200 dark:text-slate-700">01</span>
            </div>

            {/* Step 2 */}
            <div className="group/step flex items-start gap-4 rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-4 transition-all hover:border-amber-200 hover:shadow-md dark:border-white/5 dark:from-white/[0.02] dark:to-transparent dark:hover:border-amber-700">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30">
                <ClipboardList size={22} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Review attendance</h4>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  Open Attendance to see who is present and inspect answers
                </p>
              </div>
              <span className="flex-shrink-0 self-center text-2xl font-light text-slate-200 dark:text-slate-700">02</span>
            </div>

            {/* Step 3 */}
            <div className="group/step flex items-start gap-4 rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-4 transition-all hover:border-green-200 hover:shadow-md dark:border-white/5 dark:from-white/[0.02] dark:to-transparent dark:hover:border-green-700">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg shadow-green-200/50 dark:shadow-green-900/30">
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Grade & send feedback</h4>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  Grade submissions and send feedback directly to students
                </p>
              </div>
              <span className="flex-shrink-0 self-center text-2xl font-light text-slate-200 dark:text-slate-700">03</span>
            </div>
          </div>

          {/* Bottom tip */}
          <div className="border-t border-slate-100 p-5 dark:border-white/5">
            <div className="flex items-center gap-3 rounded-xl bg-cyan-50/50 p-3 dark:bg-cyan-900/10">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                <Radio size={14} />
              </div>
              <p className="text-xs font-medium text-cyan-800 dark:text-cyan-200">
                Pro tip: Use <strong>Live</strong> mode to monitor exams in real time and ensure academic integrity.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}