import { Download, Image, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchProctoringTimeline, fetchSessions, fetchTeacherExam } from "../lib/api";
import type { ExamSessionStatus, ProctoringTimelineResponse, TimelineEvent } from "../types";

type ReplayFilter = "all" | "suspicious" | "high";
type ReplayStudent = {
  studentId: string;
  studentName?: string;
  status: ExamSessionStatus | "NOT_STARTED";
  suspicionScore?: number;
  examId?: string;
};

export function ReplayTimelinePage() {
  const { examId = "" } = useParams();
  const [students, setStudents] = useState<ReplayStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [timeline, setTimeline] = useState<ProctoringTimelineResponse | null>(null);
  const [filter, setFilter] = useState<ReplayFilter>("all");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([fetchTeacherExam(examId), fetchSessions()])
      .then(([exam, items]) => {
        const examSessions = items.filter((session) => String(session.examId || "") === examId);
        const sessionMap = new Map(examSessions.map((session) => [session.studentId, session]));
        const studentIds = new Set<string>([
          ...(exam.assignedStudents || []),
          ...(exam.communityStudents || []),
          ...examSessions.map((session) => session.studentId),
        ]);
        const mergedStudents = [...studentIds]
          .filter(Boolean)
          .map((studentId) => {
            const session = sessionMap.get(studentId);
            return {
              studentId,
              studentName: session?.studentName || studentId,
              status: session?.status || "NOT_STARTED",
              suspicionScore: session?.suspicionScore || 0,
              examId,
            };
          })
          .sort((first, second) => (second.suspicionScore || 0) - (first.suspicionScore || 0));
        setStudents(mergedStudents);
        setSelectedStudentId(mergedStudents[0]?.studentId || "");
      })
      .catch(() => setMessage("Could not load students."));
  }, [examId]);

  useEffect(() => {
    if (!examId || !selectedStudentId) {
      setTimeline(null);
      return;
    }
    fetchProctoringTimeline(examId, selectedStudentId)
      .then(setTimeline)
      .catch(() => setMessage("Could not load replay timeline."));
  }, [examId, selectedStudentId]);

  const filteredEvents = useMemo(() => {
    const events = timeline?.timelineEvents || [];
    if (filter === "high") return events.filter((event) => event.severity === "high");
    if (filter === "suspicious") {
      return events.filter((event) => event.suspicionScore >= 40 || event.severity !== "low");
    }
    return events;
  }, [filter, timeline?.timelineEvents]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-emerald-700">Exam Replay Timeline</p>
        <h2 className="mt-1 text-2xl font-semibold">{timeline?.exam.title || "Replay Timeline"}</h2>
        <p className="mt-2 text-sm text-slate-500">Review each student's proctoring history after an exam.</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h3 className="font-semibold">Students</h3>
            <p className="text-sm text-slate-500">Final score and status</p>
          </div>
          <div className="divide-y divide-slate-100">
            {students.map((session) => (
              <button
                className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                  selectedStudentId === session.studentId ? "bg-emerald-50" : ""
                }`}
                key={`${session.studentId}-${session.examId || ""}`}
                onClick={() => setSelectedStudentId(session.studentId)}
                type="button"
              >
                <p className="font-medium">{session.studentName || session.studentId}</p>
                <p className="text-sm text-slate-500">
                  Score {session.suspicionScore || 0}, {session.status}
                </p>
              </button>
            ))}
            {students.length === 0 && <p className="p-4 text-sm text-slate-500">No students found for this exam yet.</p>}
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">
                  {timeline?.student.studentName || selectedStudentId || "Select student"}
                </h3>
                <p className="text-sm text-slate-500">
                  Final suspicion score: {timeline?.finalSuspicionScore || 0}/100
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="secondary-button"
                  disabled={!timeline}
                  type="button"
                  onClick={() => timeline && exportStudentPdf(timeline, filteredEvents, false)}
                >
                  Print
                </button>
                <button
                  className="primary-button"
                  disabled={!timeline}
                  type="button"
                  onClick={() => timeline && exportStudentPdf(timeline, filteredEvents, true)}
                >
                  <Download size={17} />
                  Download PDF
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal size={18} />
              <h3 className="font-semibold">Filters</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterButton active={filter === "all"} label="All events" onClick={() => setFilter("all")} />
              <FilterButton active={filter === "suspicious"} label="Only suspicious" onClick={() => setFilter("suspicious")} />
              <FilterButton active={filter === "high"} label="Only high severity" onClick={() => setFilter("high")} />
            </div>
          </section>

          <ScoreChart events={filteredEvents} />
          <Timeline events={filteredEvents} />
        </main>
      </section>

      {message && <p className="text-sm text-rose-600">{message}</p>}
    </div>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={active ? "primary-button" : "secondary-button"} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function ScoreChart({ events }: { events: TimelineEvent[] }) {
  const points = events.filter((event) => event.eventType === "suspicion_score_updated" || event.suspicionScore > 0);
  const data = points.map((event, index) => ({
    name: `${index + 1}`,
    score: event.suspicionScore,
  }));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-4 font-semibold">Suspicion Score Over Time</h3>
      <div className="h-56 rounded-lg bg-slate-50 p-3">
        {points.length === 0 && <p className="self-center text-sm text-slate-500">No score events yet.</p>}
        {points.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="replayScore" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" tickLine={false} axisLine={false} width={34} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #cbd5e1" }} />
              <Area dataKey="score" stroke="#06b6d4" fill="url(#replayScore)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-4 font-semibold">Alert Timeline</h3>
      <div className="space-y-3">
        {events.map((event) => (
          <article className="rounded-lg border border-slate-200 p-4" key={event.id}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold">{formatEventName(event.eventType)}</p>
                <p className="text-sm text-slate-500">{new Date(event.timestamp).toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityClass(event.severity)}`}>
                {event.severity}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-700">{event.alertMessage || "No alert message."}</p>
            <p className="mt-1 text-sm text-slate-500">Score: {event.suspicionScore}/100</p>
            {(event.previewUrl || event.previewBase64) && (
              <div className="mt-3 flex items-center gap-3">
                <Image size={18} className="text-slate-500" />
                <img
                  className="h-28 w-40 rounded-md object-cover"
                  src={event.previewUrl || event.previewBase64}
                  alt="Camera preview snapshot"
                />
              </div>
            )}
          </article>
        ))}
        {events.length === 0 && <p className="py-6 text-sm text-slate-500">No events match this filter.</p>}
      </div>
    </section>
  );
}

function severityClass(severity: string) {
  if (severity === "high") return "bg-rose-100 text-rose-800";
  if (severity === "medium") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function formatEventName(eventType: string) {
  return eventType.split("_").join(" ");
}

function exportStudentPdf(timeline: ProctoringTimelineResponse, events: TimelineEvent[], isDownload: boolean = false) {
  const score = timeline.finalSuspicionScore;
  const riskLevel = score >= 70 ? "SUSPICIOUS" : score >= 30 ? "WARNING" : "SAFE";
  
  let gaugeClass = "gauge-safe";
  let badgeClass = "gauge-safe-badge";
  if (riskLevel === "SUSPICIOUS") {
    gaugeClass = "gauge-suspicious";
    badgeClass = "gauge-suspicious-badge";
  } else if (riskLevel === "WARNING") {
    gaugeClass = "gauge-warning";
    badgeClass = "gauge-warning-badge";
  }

  const analysisMethodologyText = "The CheatLock AI monitoring engine records student exam sessions by continuously checking face tracking patterns, browser focus app-switching metrics, tab switching, and network disconnections. Severity weights are compiled automatically to compute a composite suspicion rating (0-100). Higher metrics indicate a higher probability of non-compliance. Instructors review the logged events to make final determination.";

  const htmlContent = `
    <html>
      <head>
        <title>CheatLock Replay Report - ${escapeHtml(timeline.student.studentName || timeline.student.studentId)}</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #0f172a !important;
            background-color: #ffffff !important;
            padding: 24px;
            width: 720px;
            margin: 0 auto;
            line-height: 1.45;
          }
          
          /* Enforce light background and dark text under both display modes */
          html.dark body {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          html.dark th,
          html.dark td,
          html.dark h1,
          html.dark h2,
          html.dark h3,
          html.dark h4,
          html.dark h5,
          html.dark p,
          html.dark span:not(.event-badge):not(.gauge-status):not(.kpi-card-value):not(.gauge-score),
          html.dark div:not(.logo-icon):not(.gauge):not(.summary-kpi-card):not(.event-image-container) {
            color: #1e293b !important;
          }

          /* Force light backgrounds for containers */
          .meta-box {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
            border: 1px solid #e2e8f0 !important;
          }
          .gauge-box {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
          }
          .method-box {
            border-left: 4px solid #7c3aed !important;
            background: #f5f3ff !important;
            border-top: 1px solid #e9e3ff !important;
            border-right: 1px solid #e9e3ff !important;
            border-bottom: 1px solid #e9e3ff !important;
          }
          .summary-kpi-card {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
          }
          .event-card {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            page-break-inside: avoid !important;
          }
          
          /* Badges explicit colors */
          .badge-low { background: #d1fae5 !important; color: #065f46 !important; border: 1px solid #a7f3d0 !important; }
          .badge-medium { background: #fef3c7 !important; color: #92400e !important; border: 1px solid #fde68a !important; }
          .badge-high { background: #ffe4e6 !important; color: #9f1239 !important; border: 1px solid #fecdd3 !important; }
          
          .gauge-safe { background: #ecfdf5 !important; border-color: #10b981 !important; color: #047857 !important; }
          .gauge-safe-badge { background: #d1fae5 !important; color: #065f46 !important; border: 1px solid #a7f3d0 !important; }
          .gauge-warning { background: #fffbeb !important; border-color: #f59e0b !important; color: #b45309 !important; }
          .gauge-warning-badge { background: #fef3c7 !important; color: #92400e !important; border: 1px solid #fde68a !important; }
          .gauge-suspicious { background: #fff1f2 !important; border-color: #ef4444 !important; color: #be123c !important; }
          .gauge-suspicious-badge { background: #ffe4e6 !important; color: #9f1239 !important; border: 1px solid #fecdd3 !important; }
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #7c3aed;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .logo-area {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-icon {
            background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
            color: #ffffff;
            border-radius: 8px;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
          }
          .logo-icon svg {
            width: 22px;
            height: 22px;
            stroke: currentColor;
          }
          .logo-text h1 {
            font-size: 20px;
            font-weight: 800;
            margin: 0;
            color: #0f172a;
            letter-spacing: -0.02em;
          }
          .logo-text p {
            font-size: 9px;
            font-weight: 700;
            margin: 1px 0 0 0;
            color: #7c3aed;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .badge-audit {
            background: #f5f3ff;
            border: 1px solid #ddd6fe;
            color: #6d28d9;
            font-size: 10px;
            font-weight: 800;
            padding: 5px 14px;
            border-radius: 9999px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
          }
          .meta-box {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px;
          }
          .meta-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
            font-size: 12px;
          }
          .meta-item:last-child {
            border-bottom: none;
          }
          .meta-label {
            color: #64748b;
            font-weight: 600;
          }
          .meta-val {
            color: #0f172a;
            font-weight: 700;
          }
          .gauge-box {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .gauge {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
            border: 4px solid;
          }
          .gauge-score {
            font-size: 18px;
            font-weight: 900;
            line-height: 1;
          }
          .gauge-lbl {
            font-size: 7px;
            font-weight: 800;
            letter-spacing: 0.05em;
          }
          .gauge-status {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 3px 10px;
            border-radius: 9999px;
          }
          .gauge-safe {
            background: #ecfdf5;
            border-color: #10b981;
            color: #047857;
          }
          .gauge-safe-badge {
            background: #d1fae5;
            color: #065f46;
            border: 1px solid #a7f3d0;
          }
          .gauge-warning {
            background: #fffbeb;
            border-color: #f59e0b;
            color: #b45309;
          }
          .gauge-warning-badge {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
          }
          .gauge-suspicious {
            background: #fff1f2;
            border-color: #ef4444;
            color: #be123c;
          }
          .gauge-suspicious-badge {
            background: #ffe4e6;
            color: #9f1239;
            border: 1px solid #fecdd3;
          }
          .method-box {
            border-left: 4px solid #7c3aed;
            background: #f5f3ff;
            border-top: 1px solid #e9e3ff;
            border-right: 1px solid #e9e3ff;
            border-bottom: 1px solid #e9e3ff;
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 24px;
            font-size: 11px;
            color: #4c1d95;
            line-height: 1.5;
          }
          .method-box strong {
            color: #6d28d9;
            display: block;
            margin-bottom: 4px;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.05em;
          }
          .stats-summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
          }
          .summary-kpi-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 8px;
            text-align: center;
          }
          .kpi-card-title {
            font-size: 8.5px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            margin-bottom: 4px;
          }
          .kpi-card-value {
            font-size: 18px;
            font-weight: 800;
          }
          .events-section-title {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #475569;
            margin-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .timeline-container {
            position: relative;
            padding-left: 28px;
            margin-left: 8px;
            border-left: 2px solid #e2e8f0;
          }
          .timeline-item {
            position: relative;
            margin-bottom: 20px;
          }
          .timeline-item:last-child {
            margin-bottom: 0;
          }
          .timeline-node {
            position: absolute;
            left: -37px;
            top: 14px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #ffffff;
            border: 3.5px solid #cbd5e1;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            z-index: 10;
          }
          .node-low { border-color: #10b981; background: #d1fae5; }
          .node-medium { border-color: #f59e0b; background: #fef3c7; }
          .node-high { border-color: #ef4444; background: #ffe4e6; }
          .event-card {
            border-radius: 10px;
            padding: 16px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .event-card-low { border-left: 4px solid #10b981; }
          .event-card-medium { border-left: 4px solid #f59e0b; }
          .event-card-high { border-left: 4px solid #ef4444; }
          .event-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 6px;
          }
          .event-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: capitalize;
            color: #0f172a;
          }
          .event-time {
            font-size: 10.5px;
            color: #64748b;
            font-weight: 500;
          }
          .event-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
          }
          .event-badge {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 4px;
            letter-spacing: 0.03em;
          }
          .badge-low { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
          .badge-medium { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .badge-high { background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3; }
          .event-score-tag {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
          }
          .event-body {
            font-size: 11.5px;
            color: #334155;
            margin: 8px 0 0 0;
            line-height: 1.45;
          }
          .event-image-container {
            margin-top: 12px;
            display: inline-block;
          }
          .event-image {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            max-height: 140px;
            max-width: 240px;
            object-fit: cover;
            display: block;
            box-shadow: 0 2px 6px rgba(0,0,0,0.05);
          }
          .footer-sign {
            margin-top: 32px;
            border-top: 2px solid #e2e8f0;
            padding-top: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 9.5px;
            color: #64748b;
          }
          .sign-line {
            border-bottom: 1.5px solid #94a3b8;
            width: 180px;
            text-align: center;
            padding-bottom: 4px;
            font-weight: 600;
            color: #475569;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="logo-area">
            <div class="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 11 2 2 4-4"/>
              </svg>
            </div>
            <div class="logo-text">
              <h1>CheatLock Replay Report</h1>
              <p>AI Automated Proctoring System</p>
            </div>
          </div>
          <div>
            <span class="badge-audit">Official Replay Audit</span>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-box">
            <div class="meta-item">
              <span class="meta-label">Exam Title:</span>
              <span class="meta-val">${escapeHtml(timeline.exam.title)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Student Name:</span>
              <span class="meta-val">${escapeHtml(timeline.student.studentName || timeline.student.studentId)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Student ID:</span>
              <span class="meta-val font-mono">${escapeHtml(timeline.student.studentId)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Session Status:</span>
              <span class="meta-val">${escapeHtml(timeline.student.status)}</span>
            </div>
          </div>

          <div class="gauge-box">
            <div class="gauge ${gaugeClass}">
              <span class="gauge-lbl">SCORE</span>
              <span class="gauge-score">${score}</span>
            </div>
            <span class="gauge-status ${badgeClass}">${riskLevel}</span>
          </div>
        </div>

        <div class="method-box">
          <strong>Proctoring Integrity Methodology</strong>
          ${analysisMethodologyText}
        </div>

        <div class="stats-summary-grid">
          <div class="summary-kpi-card">
            <div class="kpi-card-title">Total Logged Events</div>
            <div class="kpi-card-value" style="color: #7c3aed;">${events.length}</div>
          </div>
          <div class="summary-kpi-card">
            <div class="kpi-card-title">High Severity Alerts</div>
            <div class="kpi-card-value" style="color: #ef4444;">${events.filter(e => e.severity === 'high').length}</div>
          </div>
          <div class="summary-kpi-card">
            <div class="kpi-card-title">Medium Severity Alerts</div>
            <div class="kpi-card-value" style="color: #f59e0b;">${events.filter(e => e.severity === 'medium').length}</div>
          </div>
          <div class="summary-kpi-card">
            <div class="kpi-card-title">Compliance Verdict</div>
            <div class="kpi-card-value" style="color: ${riskLevel === 'SUSPICIOUS' ? '#ef4444' : riskLevel === 'WARNING' ? '#f59e0b' : '#10b981'};">
              ${riskLevel === 'SUSPICIOUS' ? 'Suspicious' : riskLevel === 'WARNING' ? 'Warning' : 'Clean'}
            </div>
          </div>
        </div>

        <div class="events-section-title">Timeline Events Logs (${events.length})</div>
        
        <div class="timeline-container">
          ${events
            .map((event) => {
              let cardClass = "event-card-low";
              let badgeColor = "badge-low";
              let nodeColor = "node-low";
              if (event.severity === "high") {
                cardClass = "event-card-high";
                badgeColor = "badge-high";
                nodeColor = "node-high";
              } else if (event.severity === "medium") {
                cardClass = "event-card-medium";
                badgeColor = "badge-medium";
                nodeColor = "node-medium";
              }

              return `
                <div class="timeline-item">
                  <div class="timeline-node ${nodeColor}"></div>
                  <div class="event-card ${cardClass}">
                    <div class="event-header">
                      <div>
                        <span class="event-title">${escapeHtml(formatEventName(event.eventType))}</span>
                        <div class="event-meta">
                          <span class="event-badge ${badgeColor}">${event.severity}</span>
                          <span class="event-score-tag">Risk Index: ${event.suspicionScore}/100</span>
                        </div>
                      </div>
                      <span class="event-time">${new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                    <p class="event-body">${escapeHtml(event.alertMessage || "No alert message recorded.")}</p>
                    ${
                      event.previewUrl || event.previewBase64
                        ? `<div class="event-image-container">
                             <img class="event-image" src="${event.previewUrl || event.previewBase64}" alt="Camera Preview Snapshot" />
                           </div>`
                        : ""
                    }
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>

        <div class="footer-sign">
          <div>
            <strong>CheatLock AI Replay Audit</strong><br/>
            This document is a certified record of the proctoring logs.
          </div>
          <div>
            <div class="sign-line">Instructor Signature</div>
          </div>
          <div>
            <div class="sign-line">Date</div>
          </div>
        </div>
      </body>
    </html>
  `;

  if (isDownload) {
    const loadScriptAndRun = () => {
      // @ts-ignore
      if (window.html2pdf) {
        generatePdf();
      } else {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => generatePdf();
        document.body.appendChild(script);
      }
    };

    const generatePdf = () => {
      const container = document.createElement("div");
      container.innerHTML = htmlContent;

      const bodyContent = container.querySelector("body") || container;

      // Create a hidden wrapper container in the DOM flow to allow html2canvas rendering
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.top = "0px";
      wrapper.style.left = "0px";
      wrapper.style.width = "720px";
      wrapper.style.height = "1px";
      wrapper.style.overflow = "hidden";
      wrapper.style.zIndex = "-1000";

      const content = bodyContent.cloneNode(true) as HTMLElement;
      content.style.display = "block";
      content.style.width = "720px";
      content.style.backgroundColor = "#ffffff";
      content.style.padding = "24px";
      content.className = "font-sans text-slate-800";

      wrapper.appendChild(content);
      document.body.appendChild(wrapper);

      const options = {
        margin: [0.3, 0.3],
        filename: `CheatLock_Replay_Report_${(timeline.student.studentName || timeline.student.studentId).replace(/[^a-z0-9]/gi, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ['avoid-all', 'css'] }
      };

      // @ts-ignore
      window.html2pdf()
        .set(options)
        .from(content)
        .save()
        .then(() => {
          document.body.removeChild(wrapper);
        })
        .catch((err: any) => {
          console.error("PDF generation failed", err);
          document.body.removeChild(wrapper);
        });
    };

    loadScriptAndRun();
  } else {
    const report = window.open("", "_blank", "width=900,height=700");
    if (!report) return;
    report.document.write(htmlContent);
    report.document.write(`
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
      </body>
      </html>
    `);
    report.document.close();
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
