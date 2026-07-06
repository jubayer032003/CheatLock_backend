import {
  Activity,
  AlertTriangle,
  Camera,
  Eye,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AssignStudentsToExamPanel } from "../components/AssignStudentsToExamPanel";
import { fetchLiveProctoring, fetchTeacherExam, sendProctoringTestEvent } from "../lib/api";
import { createProctoringSocket } from "../lib/socket";
import { StatusBadge, statusFromScore } from "../components/StatusBadge";
import {
  Badge,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  MetricCard,
  PageHeader,
  ProgressMeter,
  SkeletonBlock,
  cn,
} from "../components/ui";
import type {
  Exam,
  LiveProctoringResponse,
  LiveStudent,
  LiveStudentListEvent,
  ProctoringTestEventName,
  StudentStatus,
} from "../types";

type FilterState = "ALL" | StudentStatus;

export function LiveProctoringPage() {
  const { examId = "" } = useParams();
  const [data, setData] = useState<LiveProctoringResponse | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<LiveStudent | null>(null);
  const [fullscreenStudent, setFullscreenStudent] = useState<LiveStudent | null>(null);
  const [socketState, setSocketState] = useState("Connecting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterState>("ALL");
  const [search, setSearch] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [alertFeed, setAlertFeed] = useState<Array<{ id: string; student: string; alert: string; score: number; time: Date }>>([]);
  const [testStudentId, setTestStudentId] = useState("");
  const [testStudentName, setTestStudentName] = useState("");
  const [testScore, setTestScore] = useState(0);
  const [testAlert, setTestAlert] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  const loadLiveData = useCallback(async () => {
    if (!examId) return;
    setError("");
    const [liveData, examDetails] = await Promise.all([
      fetchLiveProctoring(examId),
      fetchTeacherExam(examId),
    ]);
    setData(liveData);
    setExam(examDetails);
    setLastSyncedAt(new Date());
    setSelectedStudent((current) => {
      if (!current) return liveData.activeStudents[0] || null;
      return liveData.activeStudents.find((student) => student.studentId === current.studentId) || current;
    });
  }, [examId]);

  useEffect(() => {
    setLoading(true);
    loadLiveData()
      .catch((err) => setError(readErrorMessage(err, "Could not load live proctoring.")))
      .finally(() => setLoading(false));
  }, [loadLiveData]);

  useEffect(() => {
    if (!examId) return;

    const socket = createProctoringSocket();
    const syncStudentList = (event: LiveStudentListEvent) => {
      setData((current) => (current ? { ...current, activeStudents: event.students } : current));
      setLastSyncedAt(new Date());
      setSelectedStudent((current) => {
        if (!current) return event.students[0] || null;
        return event.students.find((student) => student.studentId === current.studentId) || current;
      });
    };

    const mergeStudentUpdate = (student: LiveStudent) => {
      if (student.latestAlert === "camera_preview_updated" || !student.latestAlert) {
         // This is a bit of a hack to detect the specific event if latestAlert isn't set to the event name
      }
      console.log(`[Step 10] Teacher Dashboard: Received event. Event: camera_preview_updated (inferred), studentId: ${student.studentId}, payload size (base64): ${student.previewBase64?.length || 0}. Timestamp: ${Date.now()}`);

      setData((current) => {
        if (!current) return current;
        const exists = current.activeStudents.some((item) => item.studentId === student.studentId);
        return {
          ...current,
          activeStudents: exists
            ? current.activeStudents.map((item) => (item.studentId === student.studentId ? { ...item, ...student } : item))
            : [student, ...current.activeStudents],
        };
      });
      setSelectedStudent((current) => (current?.studentId === student.studentId ? { ...current, ...student } : current));
      setFullscreenStudent((current) => (current?.studentId === student.studentId ? { ...current, ...student } : current));
      setLastSyncedAt(new Date());
      if (student.latestAlert) {
        setAlertFeed((current) => [
          { id: `${student.studentId}-${Date.now()}`, student: student.studentName || student.studentId, alert: student.latestAlert, score: student.suspicionScore, time: new Date() },
          ...current,
        ].slice(0, 16));
      }
    };

    socket.on("connect", () => {
      setSocketState("Live");
      socket.emit("join_exam_room", { examId });
    });
    socket.on("disconnect", () => setSocketState("Disconnected"));
    socket.on("connect_error", () => setSocketState("Reconnect pending"));
    socket.on("live_student_list", syncStudentList);
    socket.on("student_joined_exam", mergeStudentUpdate);
    socket.on("student_left_exam", mergeStudentUpdate);
    socket.on("suspicion_score_updated", mergeStudentUpdate);
    socket.on("ai_alert_created", mergeStudentUpdate);
    socket.on("camera_preview_updated", mergeStudentUpdate);

    return () => {
      socket.disconnect();
    };
  }, [examId]);

  const students = data?.activeStudents || [];
  const analytics = useMemo(() => {
    const suspicious = students.filter((student) => statusFromScore(student.suspicionScore) === "SUSPICIOUS").length;
    const warning = students.filter((student) => statusFromScore(student.suspicionScore) === "WARNING").length;
    const average = students.length ? Math.round(students.reduce((sum, student) => sum + student.suspicionScore, 0) / students.length) : 0;
    const online = students.filter((student) => student.onlineStatus === "ONLINE").length;
    const integrity = Math.max(0, Math.round(100 - average * 0.55 - suspicious * 4));
    return { suspicious, warning, average, online, integrity, alertsPerMinute: alertFeed.slice(0, 6).length };
  }, [alertFeed, students]);

  const visibleStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...students]
      .sort((first, second) => second.suspicionScore - first.suspicionScore)
      .filter((student) => filter === "ALL" || statusFromScore(student.suspicionScore) === filter)
      .filter((student) => {
        if (!term) return true;
        return [student.studentName, student.rollId, student.studentId].some((value) => value?.toLowerCase().includes(term));
      });
  }, [filter, search, students]);

  const chartData = useMemo(
    () =>
      students
        .slice()
        .sort((first, second) => second.suspicionScore - first.suspicionScore)
        .slice(0, 10)
        .map((student) => ({ name: shortName(student.studentName || student.studentId), score: student.suspicionScore })),
    [students]
  );

  async function runTestEvent(eventName: ProctoringTestEventName) {
    if (!examId) return;
    setTestBusy(true);
    setError("");
    try {
      await sendProctoringTestEvent(examId, {
        eventName,
        studentId: testStudentId,
        studentName: testStudentName,
        suspicionScore: testScore,
        latestAlert: testAlert,
      });
    } catch (err) {
      setError(readErrorMessage(err, "Could not send test event."));
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-2"><Radio size={16} /> {socketState}</span>}
        title={data?.exam.title || "Live Proctoring"}
        description={`AI alert stream, camera grid, and student risk triage. Last synced: ${lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : "pending"}.`}
        actions={<button className="secondary-button" type="button" onClick={() => loadLiveData()}><RefreshCw size={17} />Refresh</button>}
      />

      {error && <ErrorState message={error} onRetry={loadLiveData} />}

      {exam && <AssignStudentsToExamPanel exam={exam} onExamUpdated={setExam} />}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={Users} label="Active students" value={students.length} helper={`${analytics.online} online`} tone="primary" />
        <MetricCard icon={AlertTriangle} label="Suspicious" value={analytics.suspicious} helper={`${analytics.warning} warnings`} tone="danger" />
        <MetricCard icon={Activity} label="Avg suspicion" value={`${analytics.average}/100`} helper="Live student mean" tone={analytics.average >= 70 ? "danger" : analytics.average >= 40 ? "warning" : "success"} />
        <MetricCard icon={Radio} label="Alerts/min" value={analytics.alertsPerMinute} helper="Recent feed velocity" tone="warning" />
        <MetricCard icon={ShieldCheck} label="Integrity" value={`${analytics.integrity}%`} helper="AI confidence weighted" tone="success" />
        <MetricCard icon={AlertTriangle} label="Offline" value={students.length - analytics.online} helper="Needs attention" tone="neutral" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-4 dark:border-white/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Student Camera Grid</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Suspicious students are pinned first by score.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Eye className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input className="field-input pl-9 sm:w-64" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or roll" />
                </div>
                <div className="inline-flex rounded-md border border-slate-300 bg-white p-1 dark:border-white/10 dark:bg-white/5">
                  {(["ALL", "SAFE", "WARNING", "SUSPICIOUS"] as FilterState[]).map((item) => (
                    <button
                      className={cn("rounded px-3 py-2 text-xs font-semibold transition", filter === item ? "bg-cyan-500 text-slate-950 dark:bg-cyan-400" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10")}
                      key={item}
                      type="button"
                      onClick={() => setFilter(item)}
                    >
                      {item === "ALL" ? "All" : item.charAt(0) + item.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid max-h-[760px] gap-3 overflow-auto p-4 md:grid-cols-2 2xl:grid-cols-3">
            {loading && Array.from({ length: 6 }).map((_, index) => <SkeletonBlock className="h-40" key={index} />)}
            {!loading && visibleStudents.map((student) => (
              <StudentTile
                key={student.studentId}
                student={student}
                selected={selectedStudent?.studentId === student.studentId}
                onSelect={setSelectedStudent}
                onOpen={setFullscreenStudent}
              />
            ))}
            {!loading && visibleStudents.length === 0 && (
              <div className="col-span-full">
                <EmptyState icon={UserRound} title="No students match this view" description="Try another status filter or wait for students to join the exam." />
              </div>
            )}
          </div>
        </Card>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Risk Distribution</h2>
            <div className="mt-4 h-52">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="risk" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" tickLine={false} axisLine={false} width={30} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #cbd5e1" }} />
                    <Area dataKey="score" stroke="#f43f5e" fill="url(#risk)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={Activity} title="No scores yet" description="Risk scores appear as students stream telemetry." />
              )}
            </div>
          </Card>

          <StudentDetail student={selectedStudent} onOpen={setFullscreenStudent} />

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">AI Alert Feed</h2>
              <Badge tone="warning">Confidence labels</Badge>
            </div>
            <div className="max-h-72 space-y-3 overflow-auto">
              {alertFeed.map((item) => (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-400/20 dark:bg-amber-400/10" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">{item.student}</p>
                    <span className="text-xs text-amber-700 dark:text-amber-200">{item.time.toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1 text-amber-800 dark:text-amber-100">{item.alert}</p>
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">AI confidence: {confidenceFromScore(item.score)}</p>
                </div>
              ))}
              {alertFeed.length === 0 && <p className="py-4 text-sm text-slate-500 dark:text-slate-400">No live AI alerts in this browser session yet.</p>}
            </div>
          </Card>
        </aside>
      </section>

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Live Test Controls</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Teacher-only test events for validating backend event handling in the live room.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block"><span className="field-label">Student ID</span><input className="field-input" value={testStudentId} onChange={(event) => setTestStudentId(event.target.value)} /></label>
          <label className="block"><span className="field-label">Student name</span><input className="field-input" value={testStudentName} onChange={(event) => setTestStudentName(event.target.value)} /></label>
          <label className="block"><span className="field-label">Suspicion score</span><input className="field-input" max={100} min={0} type="number" value={testScore} onChange={(event) => setTestScore(Number(event.target.value))} /></label>
          <label className="block"><span className="field-label">Alert</span><input className="field-input" value={testAlert} onChange={(event) => setTestAlert(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="secondary-button" disabled={testBusy} type="button" onClick={() => runTestEvent("student_joined_exam")}>Simulate joined</button>
          <button className="secondary-button" disabled={testBusy} type="button" onClick={() => runTestEvent("suspicion_score_updated")}>Set score</button>
          <button className="secondary-button" disabled={testBusy} type="button" onClick={() => runTestEvent("ai_alert_created")}>Create alert</button>
          <button className="secondary-button" disabled={testBusy} type="button" onClick={() => runTestEvent("student_left_exam")}>Set offline</button>
        </div>
      </Card>

      <Dialog open={Boolean(fullscreenStudent)} onClose={() => setFullscreenStudent(null)} title={fullscreenStudent?.studentName || "Student monitor"}>
        {fullscreenStudent && <FullscreenStudent student={fullscreenStudent} />}
      </Dialog>
    </div>
  );
}

function StudentTile({ student, selected, onSelect, onOpen }: { student: LiveStudent; selected: boolean; onSelect: (student: LiveStudent) => void; onOpen: (student: LiveStudent) => void }) {
  const status = statusFromScore(student.suspicionScore);
  const previewSrc = student.previewUrl || student.previewBase64;
  const tone = status === "SUSPICIOUS" ? "danger" : status === "WARNING" ? "warning" : "success";

  return (
    <button type="button" onClick={() => onSelect(student)} className={cn("student-card flex-col", selected && "student-card-selected")}>
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-slate-100 dark:bg-command-950">
        {previewSrc ? <img className="h-full w-full object-cover" src={previewSrc} alt={`${student.studentName} camera preview`} /> : <div className="grid h-full place-items-center text-slate-400"><Camera size={32} /></div>}
        <div className="absolute left-2 top-2"><StatusBadge status={status} /></div>
        <button className="icon-button absolute right-2 top-2 h-8 w-8" type="button" title="Fullscreen monitor" onClick={(event) => { event.stopPropagation(); onOpen(student); }}>
          <Eye size={15} />
        </button>
      </div>
      <div className="w-full">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{student.studentName || "Unknown student"}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{student.rollId || student.studentId}</p>
          </div>
          <span className={cn("mt-0.5 h-2.5 w-2.5 rounded-full", student.onlineStatus === "ONLINE" ? "bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" : "bg-slate-400")} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1"><ProgressMeter value={student.suspicionScore} tone={tone} /></div>
          <span className="w-9 text-right text-sm font-semibold text-slate-900 dark:text-white">{student.suspicionScore}</span>
        </div>
        <p className="mt-3 truncate text-xs text-slate-500 dark:text-slate-400">{student.latestAlert || "No alerts yet"}</p>
      </div>
    </button>
  );
}

function StudentDetail({ student, onOpen }: { student: LiveStudent | null; onOpen: (student: LiveStudent) => void }) {
  if (!student) {
    return <Card className="p-5"><EmptyState icon={UserRound} title="Select a student" description="Open any camera tile to inspect details and AI confidence." /></Card>;
  }
  const status = statusFromScore(student.suspicionScore);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{student.studentName}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{student.rollId || student.studentId}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 space-y-3">
        <DetailRow label="Suspicion score" value={`${student.suspicionScore}/100`} />
        <DetailRow label="Online status" value={student.onlineStatus} />
        <DetailRow label="AI confidence" value={confidenceFromScore(student.suspicionScore)} />
        <DetailRow label="Last updated" value={formatLastSeen(student.lastUpdatedAt)} />
        <DetailRow label="Last seen" value={formatLastSeen(student.lastSeenAt)} />
      </div>
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
        {student.latestAlert || "No alert recorded."}
      </div>
      <button className="primary-button mt-4 w-full" type="button" onClick={() => onOpen(student)}>
        <Eye size={17} /> Fullscreen monitor
      </button>
    </Card>
  );
}

function FullscreenStudent({ student }: { student: LiveStudent }) {
  const previewSrc = student.previewUrl || student.previewBase64;
  const status = statusFromScore(student.suspicionScore);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="aspect-video overflow-hidden rounded-lg bg-slate-100 dark:bg-command-950">
        {previewSrc ? <img className="h-full w-full object-cover" src={previewSrc} alt={`${student.studentName} camera preview`} /> : <div className="grid h-full place-items-center text-slate-400"><Camera size={56} /></div>}
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{student.studentName}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{student.rollId || student.studentId}</p>
        </div>
        <StatusBadge status={status} />
        <ProgressMeter value={student.suspicionScore} tone={status === "SUSPICIOUS" ? "danger" : status === "WARNING" ? "warning" : "success"} />
        <DetailRow label="Suspicion score" value={`${student.suspicionScore}/100`} />
        <DetailRow label="Online status" value={student.onlineStatus} />
        <DetailRow label="AI confidence" value={confidenceFromScore(student.suspicionScore)} />
        <DetailRow label="Latest alert" value={student.latestAlert || "No alert recorded"} />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm dark:border-white/10">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function shortName(value: string) {
  return value.split(" ").map((part) => part[0]).join("").slice(0, 3).toUpperCase() || "ST";
}

function confidenceFromScore(score: number) {
  if (score >= 80) return "High confidence";
  if (score >= 45) return "Medium confidence";
  return "Low risk confidence";
}

function formatLastSeen(value: LiveStudent["lastSeenAt"]) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || (error instanceof Error ? error.message : fallback);
}
