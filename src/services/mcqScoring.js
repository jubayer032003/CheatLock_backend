const clean = value => typeof value === "string" ? value.trim().normalize("NFC") : "";
const round = value => Math.round(value * 10000) / 10000;
const amount = (value, fallback) => value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;

function correctIndex(question) {
  const options = (question.options || []).map(clean);
  const key = clean(question.correctAnswer);
  if (!key || options.length < 2 || options.some(option => !option) || new Set(options).size !== options.length) return -1;
  if (/^(0|[1-9]\d*)$/.test(key) && Number(key) < options.length) return Number(key);
  return options.indexOf(key);
}

export function mcqQuestionSet(questions = []) {
  const scorable = [], missingKeyQuestions = [];
  let mcqCount = 0;
  questions.forEach((question, index) => {
    if (question.type !== "MCQ") return;
    mcqCount++;
    const keyIndex = correctIndex(question);
    if (keyIndex < 0) { missingKeyQuestions.push(index + 1); return; }
    scorable.push({ index, options: question.options.map(clean), keyIndex,
      marks: amount(question.marks, 1), negativeMarking: amount(question.negativeMarking, 0) });
  });
  return { scorable, mcqCount, writtenCount: questions.length - mcqCount, missingKeyQuestions,
    maxMarks: round(scorable.reduce((total, question) => total + question.marks, 0)) };
}

export function scoreMcqSubmission(questions, answers = [], definition = mcqQuestionSet(questions)) {
  const byIndex = new Map(), ambiguous = new Set();
  for (const answer of answers) {
    let index = answer?.questionIndex;
    // Legacy records can be matched only when the saved prompt is unique.
    if (index === undefined || index === null) {
      const matches = questions.flatMap((question, i) => clean(question.text) === clean(answer?.questionText) ? [i] : []);
      if (matches.length !== 1) continue;
      index = matches[0];
    }
    if (!Number.isInteger(index) || index < 0 || index >= questions.length) continue;
    if (byIndex.has(index)) ambiguous.add(index);
    else byIndex.set(index, clean(answer?.answerText));
  }
  let correct = 0, incorrect = 0, unanswered = 0, marks = 0;
  for (const question of definition.scorable) {
    const answer = ambiguous.has(question.index) ? "" : byIndex.get(question.index) || "";
    if (!answer) { unanswered++; continue; }
    // Android submits option text. Match it before interpreting older index answers,
    // so an option whose text is "1" is not accidentally treated as index one.
    let selected = question.options.indexOf(answer);
    if (selected < 0 && /^(0|[1-9]\d*)$/.test(answer) && Number(answer) < question.options.length) selected = Number(answer);
    if (selected === question.keyIndex) { correct++; marks += question.marks; }
    else { incorrect++; marks -= question.negativeMarking; }
  }
  return { correct, incorrect, unanswered, marks: round(marks), maxMarks: definition.maxMarks,
    percentage: definition.maxMarks > 0 ? round(marks / definition.maxMarks * 100) : null };
}

export function rankMcqSubmissions(exam, submissions, sessions, names = new Map()) {
  const definition = mcqQuestionSet(exam.questions || []);
  const identity = value => String(value || "").trim().toLowerCase();
  const sessionMap = new Map(sessions.map(session => [identity(session.studentId), session]));
  const latest = new Map();
  for (const submission of submissions) {
    const studentId = identity(submission.studentId), session = sessionMap.get(studentId);
    const submittedAt = Number(submission.submittedAt);
    if (!studentId || session?.status !== "SUBMITTED" || !Number.isFinite(submittedAt) || submittedAt <= 0 || submittedAt < Number(session.startedAt || 0)) continue;
    if (!latest.has(studentId) || submittedAt > Number(latest.get(studentId).submittedAt)) latest.set(studentId, submission);
  }
  const rows = [...latest.entries()].map(([studentId, submission]) => ({
    studentId, studentName: names.get(studentId) || sessionMap.get(studentId)?.studentName || studentId,
    submittedAt: Number(submission.submittedAt),
    ...scoreMcqSubmission(exam.questions || [], submission.answers || [], definition),
  }));
  rows.sort((a, b) => b.marks - a.marks || a.studentId.localeCompare(b.studentId, "en"));
  let rank = 0;
  const students = rows.map((row, index) => {
    if (index === 0 || row.marks !== rows[index - 1].marks) rank = index + 1;
    return { ...row, rank: definition.scorable.length ? rank : null };
  });
  const participants = new Set([...(exam.assignedStudents || []), ...sessions.map(session => session.studentId)].map(identity).filter(Boolean)).size;
  return { students, summary: { participants, submitted: students.length, notSubmitted: Math.max(0, participants - students.length),
    mcqCount: definition.mcqCount, scoredQuestions: definition.scorable.length, writtenCount: definition.writtenCount,
    missingKeyQuestions: definition.missingKeyQuestions, maxMarks: definition.maxMarks,
    averageMarks: students.length ? round(students.reduce((sum, row) => sum + row.marks, 0) / students.length) : null,
    highestMarks: students.length ? students[0].marks : null } };
}
