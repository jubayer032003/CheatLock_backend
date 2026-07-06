import { useEffect, useMemo, useState } from "react";
import {
  clearSubmissions,
  fetchIntegrityReport,
  fetchSubmissions,
  fetchTeacherExams,
  resetSession,
  updateIntegrityReview,
} from "../lib/api";
import type {
  Exam,
  ExamSubmission,
  IntegrityDecision,
  IntegrityReportResponse,
  IntegrityStudentReport,
} from "../types";
import { ShieldCheck } from "lucide-react";

export function ReportsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [report, setReport] = useState<IntegrityReportResponse | null>(null);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingStudentId, setSavingStudentId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchTeacherExams()
      .then((items) => {
        setExams(items);
        setSelectedExamId((current) => current || items[0]?.id || "");
      })
      .catch(() => setMessage("Could not load exams."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    loadReport(selectedExamId).catch(() => setMessage("Could not load integrity report."));
  }, [selectedExamId]);

  async function loadReport(examId: string) {
    setMessage("");
    const [nextReport, nextSubmissions] = await Promise.all([
      fetchIntegrityReport(examId),
      fetchSubmissions(),
    ]);
    setReport(nextReport);
    setSubmissions(nextSubmissions);
    setNotesDraft(
      Object.fromEntries(
        nextReport.students.map((student) => [student.studentId, student.review.notes || ""])
      )
    );
  }

  async function saveDecision(student: IntegrityStudentReport, decision: IntegrityDecision) {
    if (!report) return;
    setSavingStudentId(student.studentId);
    setMessage("");
    try {
      await updateIntegrityReview(
        report.exam.id,
        student.studentId,
        decision,
        notesDraft[student.studentId] || ""
      );
      await loadReport(report.exam.id);
      setMessage("Integrity decision saved.");
    } catch {
      setMessage("Could not save integrity decision.");
    } finally {
      setSavingStudentId("");
    }
  }

  async function handleReset(student: IntegrityStudentReport) {
    if (!report) return;
    await resetSession(student.studentId, report.exam.id);
    await loadReport(report.exam.id);
  }

  async function handleClear() {
    await clearSubmissions();
    setSubmissions([]);
  }

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId),
    [exams, selectedExamId]
  );

  // 1. Average Integrity Score
  const averageScore = useMemo(() => {
    if (!report || report.students.length === 0) return 0;
    const sum = report.students.reduce((acc, s) => acc + s.finalRiskScore, 0);
    return Math.round(sum / report.students.length);
  }, [report]);

  // 2. Aggregated violation statistics
  const violationSummary = useMemo(() => {
    if (!report) return { appSwitches: 0, faceMissing: 0, offline: 0, highSeverity: 0, wasLocked: 0 };
    let appSwitches = 0;
    let faceMissing = 0;
    let offline = 0;
    let highSeverity = 0;
    let wasLocked = 0;
    report.students.forEach((s) => {
      appSwitches += s.breakdown?.appSwitchCount || 0;
      faceMissing += s.breakdown?.faceMissingCount || 0;
      offline += s.breakdown?.offlineEventCount || 0;
      highSeverity += s.breakdown?.highSeverityCount || 0;
      if (s.breakdown?.wasLocked) wasLocked++;
    });
    return { appSwitches, faceMissing, offline, highSeverity, wasLocked };
  }, [report]);

  // 3. Most common violation type
  const mostPrevalentViolation = useMemo(() => {
    const { appSwitches, faceMissing, offline, highSeverity } = violationSummary;
    const violations = [
      { name: "App Focus Switches", count: appSwitches },
      { name: "Face Missing from Camera", count: faceMissing },
      { name: "Offline States", count: offline },
      { name: "Severe Warnings", count: highSeverity },
    ];
    violations.sort((a, b) => b.count - a.count);
    return violations[0].count > 0 ? violations[0] : { name: "None Detected", count: 0 };
  }, [violationSummary]);

  // 4. Cohort ratios
  const cohortStats = useMemo(() => {
    if (!report || report.students.length === 0) return { safePct: 0, warningPct: 0, suspiciousPct: 0 };
    const total = report.students.length;
    const safePct = Math.round((report.summary.safeStudents / total) * 100);
    const warningPct = Math.round((report.summary.warningStudents / total) * 100);
    const suspiciousPct = Math.round((report.summary.suspiciousStudents / total) * 100);
    return { safePct, warningPct, suspiciousPct };
  }, [report]);

  const ANALYSIS_PROCESS_TEXT = "The CheatLock AI Proctoring engine analyzes real-time events captured during the examination session. Features evaluated include: (1) Face Presence Detection: monitors if the student leaves the camera view; (2) Application Switch Logging: tracks active window focus changes to identify potential external assistance; (3) Offline Monitoring: detects deliberate network disconnection attempts; and (4) System Lockdown Violations. A composite, severity-weighted Risk Index (0 - 100) is automatically calculated, categorizing students into Clean (0-29), Warning (30-69), or Suspicious (70+) tiers. The final integrity decision remains subject to instructor validation.";

  function downloadCsvReport() {
    if (!report) return;

    const headers = [
      "Student ID",
      "Student Name",
      "Session Status",
      "Risk Score",
      "Risk Level",
      "Recommendation",
      "Teacher Verdict",
      "Face Missing Warnings",
      "App Focus Switches",
      "Offline Events",
      "High Severity Warnings",
      "Teacher Comments",
    ];

    const rows = report.students.map((student) => [
      student.studentId,
      student.studentName || "",
      student.status,
      student.finalRiskScore,
      student.riskLevel,
      recommendationLabel(student.recommendation),
      decisionLabel(student.review.decision),
      student.breakdown.faceMissingCount,
      student.breakdown.appSwitchCount,
      student.breakdown.offlineEventCount,
      student.breakdown.highSeverityCount,
      student.review.notes || "",
    ]);

    const formatField = (field: any) => {
      const stringified = String(field);
      if (stringified.includes(",") || stringified.includes('"') || stringified.includes("\n")) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(formatField).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `CheatLock_Integrity_Report_${report.exam.title.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadPdfReport() {
    if (!report) return;

    setIsDownloadingPdf(true);

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
      const element = document.getElementById("cheatlock-print-report");
      if (!element) {
        setIsDownloadingPdf(false);
        return;
      }

      // Create a hidden wrapper container in the DOM flow to allow html2canvas rendering
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.top = "0px";
      wrapper.style.left = "0px";
      wrapper.style.width = "720px";
      wrapper.style.height = "1px";
      wrapper.style.overflow = "hidden";
      wrapper.style.zIndex = "-1000";

      const clone = element.cloneNode(true) as HTMLElement;
      clone.classList.remove("hidden");
      clone.classList.remove("print:block");
      clone.style.display = "block";
      clone.style.width = "720px";
      clone.style.backgroundColor = "#ffffff";

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const options = {
        margin: [0.3, 0.3],
        filename: `CheatLock_Integrity_Report_${report.exam.title.replace(/[^a-z0-9]/gi, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ['avoid-all', 'css'] }
      };

      // @ts-ignore
      window.html2pdf()
        .set(options)
        .from(clone)
        .save()
        .then(() => {
          document.body.removeChild(wrapper);
          setIsDownloadingPdf(false);
        })
        .catch(() => {
          setIsDownloadingPdf(false);
          setMessage("Failed to generate PDF download.");
        });
    };

    loadScriptAndRun();
  }

  return (
    <>
      {/* On-screen Dashboard View */}
      <div className="space-y-6 print:hidden">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Exam Integrity Report</p>
              <h2 className="mt-1 text-2xl font-semibold">
                {report?.exam.title || selectedExam?.title || "Select an exam"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Auto risk summary, teacher decision, notes, and PDF-ready report.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="block min-w-64">
                <span className="field-label">Exam</span>
                <select
                  className="field-input"
                  value={selectedExamId}
                  onChange={(event) => setSelectedExamId(event.target.value)}
                >
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </select>
              </label>

              <button className="secondary-button" type="button" onClick={() => selectedExamId && loadReport(selectedExamId)}>
                Refresh
              </button>
              <button className="secondary-button" type="button" onClick={() => window.print()} disabled={!report || isDownloadingPdf}>
                Print
              </button>
              <button 
                className="primary-button" 
                type="button" 
                onClick={downloadPdfReport} 
                disabled={!report || isDownloadingPdf}
              >
                {isDownloadingPdf ? "Downloading..." : "Download PDF"}
              </button>
            </div>
          </div>
        </section>

        {report && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <ReportStat label="Total students" value={report.summary.totalStudents} />
              <ReportStat label="Safe" value={report.summary.safeStudents} />
              <ReportStat label="Warning" value={report.summary.warningStudents} />
              <ReportStat label="Suspicious" value={report.summary.suspiciousStudents} />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold">Highest Risk Moments</h3>
              <div className="mt-3 space-y-2">
                {report.summary.highestRiskMoments.map((moment) => (
                  <div className="flex flex-col gap-1 rounded-md bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" key={`${moment.studentId}-${moment.alert}`}>
                    <span className="font-medium">{moment.studentName || moment.studentId}</span>
                    <span className="text-slate-600">{moment.alert}</span>
                    <span className="font-semibold">{moment.score}/100</span>
                  </div>
                ))}
                {report.summary.highestRiskMoments.length === 0 && (
                  <p className="text-sm text-slate-500">No suspicious moments recorded yet.</p>
                )}
              </div>
            </section>

            <section className="space-y-4">
              {report.students.map((student) => (
                <IntegrityStudentCard
                  key={student.studentId}
                  student={student}
                  notes={notesDraft[student.studentId] || ""}
                  saving={savingStudentId === student.studentId}
                  onNotesChange={(notes) =>
                    setNotesDraft((current) => ({ ...current, [student.studentId]: notes }))
                  }
                  onSaveDecision={(decision) => saveDecision(student, decision)}
                  onReset={() => handleReset(student)}
                />
              ))}
            </section>
          </>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Submission Reports</h2>
              <p className="text-sm text-slate-500">Submitted answers and warning totals.</p>
            </div>
            <button className="secondary-button" disabled={submissions.length === 0} type="button" onClick={handleClear}>
              Clear Reports
            </button>
          </div>
          <div className="space-y-3">
            {submissions.map((submission) => (
              <article className="rounded-lg border border-slate-200 p-4" key={`${submission.studentId}-${submission.submittedAt}`}>
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold">{submission.studentId}</p>
                  <p className="text-sm text-slate-500">{formatDate(submission.submittedAt)}</p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-4">
                  <p>Risk: {submission.riskLevel}</p>
                  <p>App switches: {submission.appSwitchWarnings}</p>
                  <p>Face missing: {submission.faceMissingWarnings}</p>
                  <p>Total: {submission.totalWarnings}</p>
                </div>
              </article>
            ))}
            {submissions.length === 0 && <p className="py-6 text-sm text-slate-500">No submissions yet.</p>}
          </div>
        </section>

        {loading && <p className="text-sm text-slate-500">Loading reports...</p>}
        {message && <p className="text-sm text-rose-600">{message}</p>}
      </div>

      {/* Professional print layout (hidden on screen, visible during printing) */}
      {report && (
        <div id="cheatlock-print-report" className="hidden print:block bg-white text-slate-900">
          <style>{`
            * {
              box-sizing: border-box;
            }
            .report-pdf {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #0f172a !important;
              background: #ffffff !important;
              padding: 24px;
              width: 720px;
              margin: 0 auto;
            }
            
            /* Enforce dark text contrast on all text elements in both light and dark display modes */
            html.dark #cheatlock-print-report,
            html.dark #cheatlock-print-report .report-pdf {
              background-color: #ffffff !important;
              color: #0f172a !important;
            }
            #cheatlock-print-report th,
            #cheatlock-print-report td,
            #cheatlock-print-report h1,
            #cheatlock-print-report h2,
            #cheatlock-print-report h3,
            #cheatlock-print-report h4,
            #cheatlock-print-report h5,
            #cheatlock-print-report p,
            #cheatlock-print-report span,
            #cheatlock-print-report div {
              color: #0f172a !important;
            }

            /* Header Section */
            .pdf-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px solid #7c3aed !important;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .pdf-logo {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .pdf-logo-icon {
              background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%) !important;
              color: #ffffff !important;
              border-radius: 8px;
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
            }
            .pdf-logo-icon svg {
              width: 22px;
              height: 22px;
              stroke: #ffffff !important;
              fill: none !important;
            }
            .pdf-logo-text h1 {
              font-size: 20px;
              font-weight: 800;
              margin: 0;
              color: #0f172a !important;
              letter-spacing: -0.02em;
            }
            .pdf-logo-text p {
              font-size: 9px;
              font-weight: 700;
              margin: 1px 0 0 0;
              color: #7c3aed !important;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .pdf-badge-audit {
              background: #f5f3ff !important;
              border: 1px solid #ddd6fe !important;
              color: #6d28d9 !important;
              font-size: 10px;
              font-weight: 800;
              padding: 5px 14px;
              border-radius: 9999px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }

            /* Meta Information Grid */
            .pdf-meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 12px;
              padding: 18px;
              margin-bottom: 24px;
            }
            .pdf-meta-item {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e2e8f0 !important;
              font-size: 12px;
            }
            .pdf-meta-item:last-child {
              border-bottom: none !important;
            }
            .pdf-meta-label {
              color: #64748b !important;
              font-weight: 600;
            }
            .pdf-meta-val {
              color: #0f172a !important;
              font-weight: 700;
            }

            /* Methodology Panel */
            .pdf-methodology {
              border-left: 4px solid #7c3aed !important;
              background: #f5f3ff !important;
              border-top: 1px solid #e9e3ff !important;
              border-right: 1px solid #e9e3ff !important;
              border-bottom: 1px solid #e9e3ff !important;
              border-radius: 8px;
              padding: 14px 16px;
              margin-bottom: 24px;
              font-size: 11px;
              line-height: 1.5;
            }
            .pdf-methodology h3 {
              margin: 0 0 6px 0;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #6d28d9 !important;
            }
            .pdf-methodology p {
              color: #4c1d95 !important;
            }

            /* Stats Columns */
            .pdf-stats-grid {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 20px;
              margin-bottom: 24px;
            }
            .pdf-card {
              background: #ffffff !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 12px;
              padding: 20px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
              page-break-inside: avoid !important;
            }
            .pdf-card-title {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #475569 !important;
              margin-bottom: 14px;
              border-bottom: 1px solid #f1f5f9 !important;
              padding-bottom: 8px;
            }
            .pdf-cohort-bar {
              margin-bottom: 12px;
            }
            .pdf-cohort-bar:last-child {
              margin-bottom: 0;
            }
            .pdf-cohort-label {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              font-weight: 600;
              color: #475569 !important;
              margin-bottom: 4px;
            }
            .pdf-progress-track {
              background: #f1f5f9 !important;
              height: 8px;
              border-radius: 9999px;
              overflow: hidden;
            }
            .pdf-progress-bar {
              height: 100%;
              border-radius: 9999px;
            }
            .pdf-bg-safe { background: linear-gradient(90deg, #10b981 0%, #059669 100%) !important; }
            .pdf-bg-warning { background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%) !important; }
            .pdf-bg-suspicious { background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%) !important; }

            /* KPI Widget Cards */
            .pdf-kpi-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            .pdf-kpi-box {
              background: #f8fafc !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 8px;
              padding: 12px;
              text-align: center;
            }
            .pdf-kpi-num {
              font-size: 18px;
              font-weight: 800;
              margin: 4px 0 0 0;
            }
            .pdf-kpi-lbl {
              font-size: 8.5px;
              font-weight: 700;
              color: #64748b !important;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }

            /* Log Table Section */
            .pdf-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11.5px;
            }
            .pdf-table th {
              background: #f8fafc !important;
              border-bottom: 2px solid #e2e8f0 !important;
              padding: 10px 14px;
              font-weight: 700;
              color: #475569 !important;
              text-align: left;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.05em;
            }
            .pdf-table tr {
              page-break-inside: avoid !important;
            }
            .pdf-table td {
              padding: 12px 14px;
              border-bottom: 1px solid #f1f5f9 !important;
              color: #1e293b !important;
            }
            .pdf-table tr:last-child td {
              border-bottom: none !important;
            }
            .pdf-table-row:nth-child(even) {
              background: #fafbfc !important;
            }

            /* Student Profile Cards (Page 2) */
            .pdf-student-card {
              border-left: 6px solid !important;
              background: #ffffff !important;
              border-top: 1px solid #e2e8f0 !important;
              border-right: 1px solid #e2e8f0 !important;
              border-bottom: 1px solid #e2e8f0 !important;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 24px;
              page-break-inside: avoid !important;
            }
            .border-safe { border-left-color: #10b981 !important; }
            .border-warning { border-left-color: #f59e0b !important; }
            .border-suspicious { border-left-color: #ef4444; }

            .pdf-student-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #f1f5f9 !important;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .pdf-student-info h4 {
              font-size: 15px;
              font-weight: 800;
              margin: 0;
              color: #0f172a !important;
            }
            .pdf-student-info p {
              font-size: 10.5px;
              color: #64748b !important;
              margin: 3px 0 0 0;
              font-family: monospace;
            }
            .pdf-student-risk {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .pdf-risk-pill {
              font-size: 9px;
              font-weight: 800;
              padding: 4px 10px;
              border-radius: 9999px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .pill-safe { background: #d1fae5 !important; color: #065f46 !important; border: 1px solid #a7f3d0 !important; }
            .pill-warning { background: #fef3c7 !important; color: #92400e !important; border: 1px solid #fde68a !important; }
            .pill-suspicious { background: #ffe4e6 !important; color: #9f1239 !important; border: 1px solid #fecdd3 !important; }

            .pdf-risk-circle {
              width: 42px;
              height: 42px;
              border-radius: 50%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              box-shadow: 0 2px 6px rgba(0,0,0,0.05);
            }
            .circle-safe { background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color: #ffffff !important; }
            .circle-warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important; color: #ffffff !important; }
            .circle-suspicious { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important; color: #ffffff !important; }

            .pdf-student-body {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 20px;
            }
            .pdf-matrix-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
            }
            .pdf-matrix-box {
              background: #f8fafc !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 8px;
              padding: 10px;
              text-align: center;
            }
            .pdf-matrix-box.active {
              background: #fff1f2 !important;
              border-color: #fca5a5 !important;
            }
            .pdf-matrix-box.active .pdf-matrix-lbl,
            .pdf-matrix-box.active .pdf-matrix-val {
              color: #991b1b !important;
            }
            .pdf-matrix-box.warning-active {
              background: #fffbeb !important;
              border-color: #fde68a !important;
            }
            .pdf-matrix-box.warning-active .pdf-matrix-lbl,
            .pdf-matrix-box.warning-active .pdf-matrix-val {
              color: #92400e !important;
            }
            .pdf-matrix-lbl {
              font-size: 8.5px;
              font-weight: 700;
              color: #64748b !important;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }
            .pdf-matrix-val {
              font-size: 14px;
              font-weight: 800;
              margin: 3px 0 0 0;
              color: #0f172a !important;
            }
            .pdf-eval-panel {
              background: #f8fafc !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 10px;
              padding: 16px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .pdf-verdict-line {
              font-size: 11px;
              font-weight: 700;
              color: #475569 !important;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
            }
            .pdf-verdict-pill {
              font-size: 9px;
              font-weight: 800;
              padding: 3px 8px;
              border-radius: 6px;
              margin-left: 6px;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }
            .verdict-clean { background: #d1fae5 !important; color: #065f46 !important; border: 1px solid #a7f3d0 !important; }
            .verdict-review { background: #fef3c7 !important; color: #92400e !important; border: 1px solid #fde68a !important; }
            .verdict-disq { background: #ffe4e6 !important; color: #9f1239 !important; border: 1px solid #fecdd3 !important; }
            .verdict-pending { background: #f1f5f9 !important; color: #475569 !important; border: 1px solid #cbd5e1 !important; }

            .pdf-comments {
              background: #ffffff !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 6px;
              padding: 10px;
              font-style: italic;
              font-size: 10.5px;
              min-height: 48px;
              color: #334155 !important;
              margin: 4px 0 0 0;
              line-height: 1.4;
            }
            .pdf-footer {
              margin-top: 32px;
              border-top: 2px solid #e2e8f0 !important;
              padding-top: 14px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 9.5px;
              color: #64748b !important;
            }
            .pdf-signature {
              border-bottom: 1.5px solid #94a3b8 !important;
              width: 180px;
              text-align: center;
              padding-bottom: 4px;
              font-weight: 600;
              color: #475569 !important;
            }
            .pdf-score-danger {
              color: #ef4444 !important;
            }
          `}</style>
          <div className="report-pdf">
            {/* Executive Summary Cover Page (Page 1) */}
            <div className="pdf-header">
              <div className="pdf-logo">
                <div className="pdf-logo-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 11 2 2 4-4"/>
                  </svg>
                </div>
                <div className="pdf-logo-text">
                  <h1>CheatLock Security Audit</h1>
                  <p>AI Exam Monitoring & Integrity Suite</p>
                </div>
              </div>
              <div>
                <span className="pdf-badge-audit">Official Security Record</span>
                <p style={{ fontSize: "9px", color: "#64748b", margin: "4px 0 0 0", textAlign: "right" }}>Generated: {formatDate(report.generatedAt)}</p>
              </div>
            </div>

            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: "0 0 16px 0", borderLeft: "4px solid #7c3aed", paddingLeft: "10px", lineHeight: "1.2" }}>
              EXAM INTEGRITY REPORT
            </h2>

            <div className="pdf-meta-grid">
              <div>
                <div className="pdf-meta-item">
                  <span className="pdf-meta-label">Exam Title</span>
                  <span className="pdf-meta-val">{report.exam.title}</span>
                </div>
                <div className="pdf-meta-item">
                  <span className="pdf-meta-label">Access Code</span>
                  <span className="pdf-meta-val" style={{ fontFamily: "monospace" }}>{report.exam.accessCode || "N/A"}</span>
                </div>
                <div className="pdf-meta-item">
                  <span className="pdf-meta-label">Duration Limit</span>
                  <span className="pdf-meta-val">{report.exam.durationMinutes} Minutes</span>
                </div>
              </div>
              <div>
                <div className="pdf-meta-item">
                  <span className="pdf-meta-label">Students Monitored</span>
                  <span className="pdf-meta-val">{report.summary.totalStudents} Enrolled</span>
                </div>
                <div className="pdf-meta-item">
                  <span className="pdf-meta-label">AI Guard Coverage</span>
                  <span className="pdf-meta-val" style={{ color: "#10b981" }}>100% Active Guard</span>
                </div>
                <div className="pdf-meta-item">
                  <span className="pdf-meta-label">Security Protocol</span>
                  <span className="pdf-meta-val">Lockscreen & Keystroke</span>
                </div>
              </div>
            </div>

            <div className="pdf-methodology">
              <h3>CheatLock Proctoring Analysis Process</h3>
              <p style={{ margin: "0", fontSize: "11px", lineHeight: "1.5" }}>{ANALYSIS_PROCESS_TEXT}</p>
            </div>

            <div className="pdf-stats-grid">
              <div className="pdf-card">
                <h3 className="pdf-card-title">Compliance Cohorts</h3>
                <div className="pdf-cohort-bar">
                  <div className="pdf-cohort-label">
                    <span>Clean (Risk &lt; 30)</span>
                    <span>{report.summary.safeStudents} ({cohortStats.safePct}%)</span>
                  </div>
                  <div className="pdf-progress-track">
                    <div className="pdf-progress-bar pdf-bg-safe" style={{ width: `${cohortStats.safePct}%` }} />
                  </div>
                </div>
                <div className="pdf-cohort-bar">
                  <div className="pdf-cohort-label">
                    <span>Warning (Risk 30-69)</span>
                    <span>{report.summary.warningStudents} ({cohortStats.warningPct}%)</span>
                  </div>
                  <div className="pdf-progress-track">
                    <div className="pdf-progress-bar pdf-bg-warning" style={{ width: `${cohortStats.warningPct}%` }} />
                  </div>
                </div>
                <div className="pdf-cohort-bar">
                  <div className="pdf-cohort-label">
                    <span>Suspicious (Risk &ge; 70)</span>
                    <span>{report.summary.suspiciousStudents} ({cohortStats.suspiciousPct}%)</span>
                  </div>
                  <div className="pdf-progress-track">
                    <div className="pdf-progress-bar pdf-bg-suspicious" style={{ width: `${cohortStats.suspiciousPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="pdf-card">
                <h3 className="pdf-card-title">Security KPI Metrics</h3>
                <div className="pdf-kpi-grid">
                  <div className="pdf-kpi-box">
                    <span className="pdf-kpi-lbl">Avg Risk Index</span>
                    <h4 className="pdf-kpi-num" style={{ color: "#7c3aed" }}>{averageScore}/100</h4>
                  </div>
                  <div className="pdf-kpi-box">
                    <span className="pdf-kpi-lbl">Key Violation</span>
                    <h4 className="pdf-kpi-num" style={{ fontSize: "9px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={mostPrevalentViolation.name}>
                      {mostPrevalentViolation.name}
                    </h4>
                  </div>
                  <div className="pdf-kpi-box">
                    <span className="pdf-kpi-lbl">Total Lockouts</span>
                    <h4 className="pdf-kpi-num" style={{ color: "#ef4444" }}>{violationSummary.wasLocked}</h4>
                  </div>
                  <div className="pdf-kpi-box">
                    <span className="pdf-kpi-lbl">Compliance Rate</span>
                    <h4 className="pdf-kpi-num" style={{ color: "#10b981" }}>{cohortStats.safePct}%</h4>
                  </div>
                </div>
              </div>
            </div>

            <div className="pdf-card" style={{ marginBottom: "20px" }}>
              <h3 className="pdf-card-title">Critical Risk Moments Logs</h3>
              <table className="pdf-table">
                <thead>
                  <tr>
                    <th>Student Name / ID</th>
                    <th>Alert Indicator Description</th>
                    <th style={{ textAlign: "right" }}>Risk Score</th>
                  </tr>
                </thead>
                <tbody>
                  {report.summary.highestRiskMoments.map((moment, idx) => (
                    <tr key={idx} className="pdf-table-row">
                      <td style={{ fontWeight: "600" }}>{moment.studentName || moment.studentId}</td>
                      <td>{moment.alert}</td>
                      <td className="pdf-score-danger" style={{ fontWeight: "800", textAlign: "right" }}>{moment.score}/100</td>
                    </tr>
                  ))}
                  {report.summary.highestRiskMoments.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", color: "#64748b", fontStyle: "italic", padding: "16px 0" }}>
                        No critical alerts or suspicious moments registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pdf-footer" style={{ borderTop: "2px solid #e2e8f0", paddingTop: "15px" }}>
              <div>
                <strong>CheatLock Security Division</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "8px" }}>This audit document holds verified proctoring data.</p>
              </div>
              <div className="pdf-signature">Auditing Instructor Signature</div>
              <div>Date: __________________</div>
            </div>

            {/* Student Report Cards (Start on Page 2) */}
            <div style={{ pageBreakBefore: "always", paddingTop: "20px" }}>
              <div className="pdf-header" style={{ marginBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
                <div className="pdf-logo">
                  <div className="pdf-logo-icon" style={{ width: "32px", height: "32px" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      <path d="m9 11 2 2 4-4"/>
                    </svg>
                  </div>
                  <h2 style={{ fontSize: "13px", fontWeight: "800", margin: "0" }}>Student Compliance Profiles</h2>
                </div>
                <span style={{ fontSize: "9px", color: "#64748b" }}>{report.exam.title}</span>
              </div>

              <div className="space-y-6">
                {report.students.map((student) => {
                  const risk = student.riskLevel;
                  const riskClass = risk === "SUSPICIOUS" ? "border-suspicious" : risk === "WARNING" ? "border-warning" : "border-safe";
                  const pillClass = risk === "SUSPICIOUS" ? "pill-suspicious" : risk === "WARNING" ? "pill-warning" : "pill-safe";
                  const circleClass = risk === "SUSPICIOUS" ? "circle-suspicious" : risk === "WARNING" ? "circle-warning" : "circle-safe";
                  const verdictClass = student.review.decision === "CLEAN" ? "verdict-clean" : student.review.decision === "REVIEW_NEEDED" ? "verdict-review" : student.review.decision === "DISQUALIFIED" ? "verdict-disq" : "verdict-pending";
                  const decisionText = student.review.decision === "CLEAN" ? "Verified Clean" : student.review.decision === "REVIEW_NEEDED" ? "Review Needed" : student.review.decision === "DISQUALIFIED" ? "Disqualified" : "Pending Review";

                  return (
                    <div key={student.studentId} className={`pdf-student-card ${riskClass}`}>
                      <div className="pdf-student-header">
                        <div className="pdf-student-info">
                          <h4>{student.studentName || student.studentId}</h4>
                          <p>ID: {student.studentId} | Status: {student.status}</p>
                        </div>
                        <div className="pdf-student-risk">
                          <span className={`pdf-risk-pill ${pillClass}`}>{risk} risk</span>
                          <div className={`pdf-risk-circle ${circleClass}`}>
                            <span style={{ fontSize: "6px", fontWeight: "750", opacity: "0.8" }}>RISK</span>
                            <span style={{ fontSize: "14px", fontWeight: "900", lineHeight: "1" }}>{student.finalRiskScore}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pdf-student-body">
                        <div>
                          <h5 style={{ margin: "0 0 6px 0", fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em" }}>
                            AI Integrity Breakdown
                          </h5>
                          <div className="pdf-matrix-grid">
                            <div className={`pdf-matrix-box ${student.breakdown.faceMissingCount > 0 ? "active" : ""}`}>
                              <span className="pdf-matrix-lbl">Face Missing</span>
                              <p className="pdf-matrix-val">{student.breakdown.faceMissingCount}</p>
                            </div>
                            <div className={`pdf-matrix-box ${student.breakdown.appSwitchCount > 0 ? "warning-active" : ""}`}>
                              <span className="pdf-matrix-lbl">App Switches</span>
                              <p className="pdf-matrix-val">{student.breakdown.appSwitchCount}</p>
                            </div>
                            <div className={`pdf-matrix-box ${student.breakdown.suspiciousAlertCount > 0 ? "active" : ""}`}>
                              <span className="pdf-matrix-lbl">Suspicious Events</span>
                              <p className="pdf-matrix-val">{student.breakdown.suspiciousAlertCount}</p>
                            </div>
                            <div className={`pdf-matrix-box ${student.breakdown.highSeverityCount > 0 ? "active" : ""}`}>
                              <span className="pdf-matrix-lbl">High Severity</span>
                              <p className="pdf-matrix-val">{student.breakdown.highSeverityCount}</p>
                            </div>
                            <div className={`pdf-matrix-box ${student.breakdown.offlineEventCount > 0 ? "active" : ""}`}>
                              <span className="pdf-matrix-lbl">Offline Events</span>
                              <p className="pdf-matrix-val">{student.breakdown.offlineEventCount}</p>
                            </div>
                            <div className={`pdf-matrix-box ${student.breakdown.wasLocked ? "active" : ""}`}>
                              <span className="pdf-matrix-lbl">Session Locked</span>
                              <p className="pdf-matrix-val" style={{ fontSize: "10px" }}>{student.breakdown.wasLocked ? "YES" : "NO"}</p>
                            </div>
                          </div>
                        </div>

                        <div className="pdf-eval-panel">
                          <div>
                            <div className="pdf-verdict-line">
                              Evaluation: <span className={`pdf-verdict-pill ${verdictClass}`}>{decisionText}</span>
                            </div>
                            <span style={{ fontSize: "8px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Instructor Comments</span>
                            <div className="pdf-comments">
                              {student.review.notes || "No custom comment registered by the proctoring instructor."}
                            </div>
                          </div>
                          <div className="pdf-footer" style={{ marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "6px" }}>
                            <span>Sign: ___________________</span>
                            <span>Date: _________</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

function IntegrityStudentCard({
  student,
  notes,
  saving,
  onNotesChange,
  onSaveDecision,
  onReset,
}: {
  student: IntegrityStudentReport;
  notes: string;
  saving: boolean;
  onNotesChange: (notes: string) => void;
  onSaveDecision: (decision: IntegrityDecision) => void;
  onReset: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div>
          <p className="text-sm font-semibold text-slate-500">Student</p>
          <h3 className="mt-1 text-xl font-semibold">{student.studentName || student.studentId}</h3>
          <p className="text-sm text-slate-500">{student.studentId}</p>

          <div className={`mt-4 rounded-lg p-4 ${riskClass(student.riskLevel)}`}>
            <p className="text-sm font-semibold">Final risk score</p>
            <p className="mt-1 text-3xl font-semibold">{student.finalRiskScore}/100</p>
            <p className="mt-1 text-sm">{student.riskLevel}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <MiniStat label="Face missing" value={student.breakdown.faceMissingCount} />
            <MiniStat label="App switches" value={student.breakdown.appSwitchCount} />
            <MiniStat label="Suspicious events" value={student.breakdown.suspiciousAlertCount} />
            <MiniStat label="High severity" value={student.breakdown.highSeverityCount} />
            <MiniStat label="Preview snapshots" value={student.breakdown.previewEventCount} />
            <MiniStat label="Offline events" value={student.breakdown.offlineEventCount} />
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">Teacher decision</p>
                <p className="text-sm text-slate-500">
                  Current: {decisionLabel(student.review.decision)} / Recommendation: {recommendationLabel(student.recommendation)}
                </p>
              </div>
              <button className="secondary-button print:hidden" type="button" onClick={onReset} disabled={student.status === "IN_PROGRESS"}>
                Reset Attempt
              </button>
            </div>

            <textarea
              className="field-input mt-3 min-h-24 py-3 print:hidden"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Add teacher notes for this student..."
            />
            {student.review.notes && (
              <p className="mt-3 hidden rounded-md bg-slate-50 p-3 text-sm print:block">{student.review.notes}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <button className="secondary-button" disabled={saving} type="button" onClick={() => onSaveDecision("CLEAN")}>
                Mark Clean
              </button>
              <button className="secondary-button" disabled={saving} type="button" onClick={() => onSaveDecision("REVIEW_NEEDED")}>
                Review Needed
              </button>
              <button className="secondary-button" disabled={saving} type="button" onClick={() => onSaveDecision("DISQUALIFIED")}>
                Disqualified
              </button>
            </div>
          </div>

          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Latest alert: {student.latestAlert || "No alert recorded."}
          </p>
        </div>
      </div>
    </article>
  );
}

function ReportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function riskClass(level: IntegrityStudentReport["riskLevel"]) {
  if (level === "SUSPICIOUS") return "bg-rose-50 text-rose-800";
  if (level === "WARNING") return "bg-amber-50 text-amber-800";
  return "bg-emerald-50 text-emerald-800";
}

function decisionLabel(decision: IntegrityDecision) {
  if (decision === "CLEAN") return "Clean";
  if (decision === "REVIEW_NEEDED") return "Review Needed";
  if (decision === "DISQUALIFIED") return "Disqualified";
  return "Pending";
}

function recommendationLabel(recommendation: IntegrityStudentReport["recommendation"]) {
  if (recommendation === "DISQUALIFY_RECOMMENDED") return "Disqualify recommended";
  if (recommendation === "REVIEW_RECOMMENDED") return "Review recommended";
  return "Clean recommended";
}

function formatDate(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}
