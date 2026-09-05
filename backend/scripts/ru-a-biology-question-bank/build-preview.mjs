import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const DEFAULT_PAGE_TEXT_DIR = resolve("tmp/ru_a_ocr_text");
const DEFAULT_OUTPUT_DIR = resolve("backend/scripts/ru-a-biology-question-bank/output");

const TARGET = {
  classId: "8119aa72-e278-4bbd-a2df-efbc3544f09d",
  className: "Admission",
  subjectId: "f41d353a-f7fd-49fc-a51f-5bcfcdf03431",
  subjectName: "RU A",
  chapterId: "6b9d1abb-a8f7-4d36-b07a-2aeb7ad193fb",
  chapterName: "Biology",
};

const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const ALLOWED_STATUSES = new Set(["draft", "active"]);
const BIOLOGY_TERMS = [
  "জীববিজ্ঞান",
  "প্রাণী",
  "উদ্ভিদ",
  "কোষ",
  "ক্রোমোজোম",
  "জিন",
  "ডিএনএ",
  "রক্ত",
  "হরমোন",
  "এনজাইম",
  "শ্বাস",
  "সালোকসংশ্লেষ",
  "মাইটোকন্ড্রিয়া",
  "ক্লোরোপ্লাস্ট",
  "ব্যাকটেরিয়া",
  "ভাইরাস",
  "অঙ্গ",
  "মাছ",
  "ফুল",
  "মূল",
  "পাতা",
  "জাইগোট",
  "নিষেক",
  "taxonomy",
  "ginkgo",
  "cycas",
  "riccia",
  "pteris",
  "oryza",
  "anthoceros",
  "anabus",
  "latimaria",
];
const NON_BIOLOGY_TERMS = [
  "ম্যাট্রিক্স",
  "সরলরেখা",
  "উপবৃত্ত",
  "সমীকরণ",
  "বল",
  "x",
  "y",
  "tan",
  "cos",
  "ln",
];

async function main() {
  const pageTextDir = resolve(process.argv[2] || DEFAULT_PAGE_TEXT_DIR);
  const outputDir = resolve(process.argv[3] || DEFAULT_OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });

  const pages = [];
  for (let page = 1; page <= 208; page += 1) {
    const path = join(pageTextDir, `page-${String(page).padStart(3, "0")}.txt`);
    if (!existsSync(path)) continue;
    const text = await readFile(path, "utf8");
    pages.push({ page, text });
  }

  const manifest = pages
    .map((page) => discoverPage(page))
    .filter((entry) => entry.hasBiologySignal || entry.hasAnswerSignal);

  const records = [];
  for (const page of pages) {
    records.push(...extractQuestionCandidates(page));
  }

  const normalizedRecords = records.map((record) => normalizeRecord(record));
  const duplicateGroups = findDuplicateGroups(normalizedRecords);
  const validation = normalizedRecords.map(validateRecord);

  const preview = {
    generated_at: new Date().toISOString(),
    source_pdf: "C:/Users/scs/Downloads/RU A Unit Question Bank.pdf",
    warning: "Preview only. No database mutations have been performed.",
    target: TARGET,
    database_mapping: databaseMapping(),
    source_discovery: manifest,
    totals: summarize(normalizedRecords, validation, duplicateGroups),
    duplicate_groups: duplicateGroups,
    manual_review_candidates: validation.filter((item) => item.issues.length > 0),
    questions: normalizedRecords,
  };

  const jsonPath = join(outputDir, "ru_a_biology_import_preview.json");
  const csvPath = join(outputDir, "ru_a_biology_import_preview.csv");
  await writeFile(jsonPath, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  await writeFile(csvPath, toCsv(normalizedRecords, validation), "utf8");

  console.log(JSON.stringify({
    jsonPath,
    csvPath,
    pagesRead: pages.length,
    manifestEntries: manifest.length,
    questionCandidates: normalizedRecords.length,
    activeCandidates: normalizedRecords.filter((item) => item.status === "active").length,
    draftCandidates: normalizedRecords.filter((item) => item.status === "draft").length,
    duplicateGroups: duplicateGroups.length,
  }, null, 2));
}

function discoverPage({ page, text }) {
  const normalized = normalizeForSearch(text);
  const questionNumbers = [...normalized.matchAll(/(?:^|\s)(\d{1,3})[.)।]/g)]
    .map((match) => Number(match[1]))
    .filter((number) => Number.isSafeInteger(number));
  const hasBiologySignal = BIOLOGY_TERMS.some((term) => normalized.includes(normalizeForSearch(term)));
  const hasAnswerSignal = /উত্তর|answer|solution|সমাধান/i.test(text);
  const session = inferSession(text);
  const modelTest = inferModelTest(text);
  return {
    source_name: session ? `RU ${session}` : modelTest ? `Model Test ${modelTest}` : "RU A Unit Question Bank",
    source_page: page,
    session,
    model_test: modelTest,
    headings: extractLikelyHeadings(text),
    biology_question_numbers: hasBiologySignal ? [...new Set(questionNumbers)].sort((a, b) => a - b) : [],
    biology_mcq_count_estimate: hasBiologySignal ? [...new Set(questionNumbers)].length : 0,
    answer_key_location: hasAnswerSignal ? `PDF page ${page}` : null,
    hasBiologySignal,
    hasAnswerSignal,
  };
}

function extractQuestionCandidates({ page, text }) {
  if (!isLikelyBiologyText(text)) return [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = [];
  let current = null;
  for (const line of lines) {
    const start = line.match(/^(\d{1,3})[.)।]\s*(.+)$/);
    if (start) {
      if (current) candidates.push(current);
      current = {
        source_page: page,
        source_question_number: Number(start[1]),
        raw_lines: [start[2]],
      };
      continue;
    }
    if (current) current.raw_lines.push(line);
  }
  if (current) candidates.push(current);
  return candidates.filter((candidate) => isLikelyBiologyText(candidate.raw_lines.join(" ")));
}

function normalizeRecord(candidate) {
  const raw = candidate.raw_lines.join(" ").replace(/\s+/g, " ").trim();
  const options = extractOptions(raw);
  const questionText = removeOptions(raw).trim();
  const readable = questionText.length >= 8 && options.length >= 4 && options.every((option) => option.text.length > 0);
  const answer = inferAnswerFromText(raw, options);
  const status = readable && answer.correctOption && answer.answerSource !== "needs_review" ? "active" : "draft";
  return {
    idempotency_key: createHash("sha256").update(normalizeComparable(`${candidate.source_page}:${candidate.source_question_number}:${questionText}`)).digest("hex"),
    source_type: inferModelTest(raw) ? "model_test" : "previous_year",
    source: "RU A",
    institution: "Rajshahi University",
    subject: "Biology",
    session: inferSession(raw),
    model_test: inferModelTest(raw),
    source_page: candidate.source_page,
    source_question_number: candidate.source_question_number,
    question_text: questionText,
    options,
    correct_option: answer.correctOption,
    answer_source: answer.answerSource,
    difficulty: classifyDifficulty(questionText),
    topic_tags: classifyTags(questionText),
    status,
    explanation: null,
    flags: [
      ...(readable ? [] : ["ocr-review-required"]),
      ...(answer.answerSource === "needs_review" ? ["answer-needs-review"] : []),
      ...(isDiagramDependent(questionText) ? ["requires-image"] : []),
    ],
    intended_database_fields: {
      class_id: TARGET.classId,
      subject_id: TARGET.subjectId,
      chapter_id: TARGET.chapterId,
      question_type: "mcq",
      question_text: questionText,
      difficulty: classifyDifficulty(questionText),
      marks: 1,
      explanation: null,
      source: buildSourceString(candidate, raw),
      status,
      options: options.map((option, index) => ({
        option_text: option.text,
        is_correct: option.label === answer.correctOption,
        display_order: index,
      })),
    },
  };
}

function extractOptions(raw) {
  const optionRegex = /[(（]?\s*([a-dA-Dঅআইঈকখগঘ])\s*[)）.]\s*/g;
  const matches = [...raw.matchAll(optionRegex)];
  const normalized = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const start = match.index + match[0].length;
    const end = next ? next.index : raw.length;
    const text = raw.slice(start, end).trim();
    const label = normalizeOptionLabel(match[1]);
    if (label && text) normalized.push({ label, text });
  }
  const byLabel = new Map();
  for (const option of normalized) {
    if (!byLabel.has(option.label)) byLabel.set(option.label, option);
  }
  return [...byLabel.values()].slice(0, 4);
}

function removeOptions(raw) {
  const firstOption = raw.search(/[(（]?\s*([a-dA-Dঅআইঈকখগঘ])\s*[)）.]\s*/);
  return firstOption >= 0 ? raw.slice(0, firstOption) : raw;
}

function normalizeOptionLabel(value) {
  const label = String(value || "").toLowerCase();
  return ({ "a": "a", "b": "b", "c": "c", "d": "d", "অ": "a", "ক": "a", "আ": "b", "খ": "b", "ই": "c", "গ": "c", "ঈ": "d", "ঘ": "d" })[label] || null;
}

function inferAnswerFromText() {
  return { correctOption: null, answerSource: "needs_review" };
}

function classifyDifficulty(text) {
  const normalized = normalizeForSearch(text);
  const hardSignals = ["জিন", "ডিএনএ", "ক্রোমোজোম", "মিয়োসিস", "মিউটেশন", "বংশগতি", "পরীক্ষা", "অনুপাত"];
  const mediumSignals = ["কোন ধরনের", "কোন পর্ব", "কোথায়", "কারণ", "প্রক্রিয়া", "রূপান্তরিত"];
  if (hardSignals.some((signal) => normalized.includes(normalizeForSearch(signal)))) return "hard";
  if (mediumSignals.some((signal) => normalized.includes(normalizeForSearch(signal)))) return "medium";
  return "easy";
}

function classifyTags(text) {
  const normalized = normalizeForSearch(text);
  const pairs = [
    ["genetics", ["জিন", "বংশগতি", "ক্রোমোজোম", "ডিএনএ", "rna", "dna"]],
    ["cell-biology", ["কোষ", "মাইটোকন্ড্রিয়া", "ক্লোরোপ্লাস্ট"]],
    ["cell-division", ["মাইটোসিস", "মিয়োসিস", "meiosis", "mitosis"]],
    ["botany", ["উদ্ভিদ", "পাতা", "মূল", "ফুল", "ginkgo", "cycas", "oryza", "riccia", "pteris"]],
    ["plant-physiology", ["সালোকসংশ্লেষ", "শ্বসন", "হাইডাথোড", "এন্ডোস্পার্ম"]],
    ["zoology", ["প্রাণী", "মাছ", "শামুক", "ঘাসফড়িং", "anabus", "latimaria"]],
    ["human-physiology", ["রক্ত", "হরমোন", "পরিপাক", "হৃৎপিণ্ড", "রেচন"]],
    ["taxonomy", ["শ্রেণিবিন্যাস", "taxonomy"]],
    ["microbiology", ["ব্যাকটেরিয়া", "ভাইরাস", "ফাংগাস"]],
  ];
  const tags = [];
  for (const [tag, terms] of pairs) {
    if (terms.some((term) => normalized.includes(normalizeForSearch(term)))) tags.push(tag);
  }
  return tags.slice(0, 4);
}

function isDiagramDependent(text) {
  return /চিত্র|figure|diagram|নিচের\s+চিত্র|উদ্দীপক/i.test(text);
}

function isLikelyBiologyText(text) {
  const normalized = normalizeForSearch(text);
  const bioScore = BIOLOGY_TERMS.filter((term) => normalized.includes(normalizeForSearch(term))).length;
  const nonBioScore = NON_BIOLOGY_TERMS.filter((term) => normalized.includes(normalizeForSearch(term))).length;
  return bioScore > 0 && bioScore >= nonBioScore;
}

function inferSession(text) {
  const match = text.match(/20\d{2}\s*[-–—]\s*\d{2}/);
  return match ? match[0].replace(/\s+/g, "") : null;
}

function inferModelTest(text) {
  const match = text.match(/model\s*test\s*[-:]?\s*(\d{1,2})|মডেল\s*টেস্ট\s*[-:]?\s*(\d{1,2})/i);
  return match ? String(match[1] || match[2]).padStart(2, "0") : null;
}

function extractLikelyHeadings(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /জীববিজ্ঞান|Biology|উত্তর|সমাধান|Model|মডেল|20\d{2}/i.test(line))
    .slice(0, 8);
}

function buildSourceString(candidate, raw) {
  const parts = ["Rajshahi University", "RU A", "Biology"];
  const session = inferSession(raw);
  const modelTest = inferModelTest(raw);
  if (session) parts.push(`session:${session}`);
  if (modelTest) parts.push(`model-test:${modelTest}`);
  parts.push(`pdf-page:${candidate.source_page}`, `source-q:${candidate.source_question_number}`);
  return parts.join(" | ");
}

function validateRecord(record) {
  const issues = [];
  if (!record.question_text) issues.push("missing-question-text");
  if (record.options.length < 4) issues.push("missing-or-unreadable-options");
  if (!record.correct_option) issues.push("missing-correct-answer");
  if (!ALLOWED_DIFFICULTIES.has(record.difficulty)) issues.push("invalid-difficulty");
  if (!ALLOWED_STATUSES.has(record.status)) issues.push("invalid-status");
  if (record.correct_option && !record.options.some((option) => option.label === record.correct_option)) issues.push("correct-answer-not-in-options");
  for (const flag of record.flags) issues.push(flag);
  return {
    idempotency_key: record.idempotency_key,
    source_page: record.source_page,
    source_question_number: record.source_question_number,
    status: record.status,
    issues: [...new Set(issues)],
  };
}

function findDuplicateGroups(records) {
  const groups = new Map();
  for (const record of records) {
    const key = normalizeComparable(record.question_text);
    if (!key) continue;
    const bucket = groups.get(key) || [];
    bucket.push({
      idempotency_key: record.idempotency_key,
      source_page: record.source_page,
      source_question_number: record.source_question_number,
      question_text: record.question_text,
    });
    groups.set(key, bucket);
  }
  return [...groups.values()].filter((items) => items.length > 1);
}

function summarize(records, validation, duplicateGroups) {
  return {
    total_biology_mcqs_discovered: records.length,
    active_candidates: records.filter((item) => item.status === "active").length,
    draft_candidates: records.filter((item) => item.status === "draft").length,
    answer_key_sourced: records.filter((item) => item.answer_source === "source_answer_key").length,
    source_solution_sourced: records.filter((item) => item.answer_source === "source_solution").length,
    inferred_answers: records.filter((item) => item.answer_source === "inferred_high_confidence").length,
    needs_review: records.filter((item) => item.answer_source === "needs_review").length,
    diagram_dependent_questions: records.filter((item) => item.flags.includes("requires-image")).length,
    duplicate_candidate_groups: duplicateGroups.length,
    validation_issue_records: validation.filter((item) => item.issues.length > 0).length,
    difficulty: {
      easy: records.filter((item) => item.difficulty === "easy").length,
      medium: records.filter((item) => item.difficulty === "medium").length,
      hard: records.filter((item) => item.difficulty === "hard").length,
    },
  };
}

function databaseMapping() {
  return {
    "Admission": "question_bank_classes.name/slug, id stored on question_bank_questions.class_id",
    "RU A": "question_bank_subjects.name/slug, id stored on question_bank_questions.subject_id",
    "Biology": "question_bank_chapters.name/slug, id stored on question_bank_questions.chapter_id",
    "Question text": "question_bank_questions.question_text",
    "Question type": "question_bank_questions.question_type = 'mcq'",
    "Difficulty": "question_bank_questions.difficulty",
    "Marks": "question_bank_questions.marks",
    "Status": "question_bank_questions.status",
    "Explanation": "question_bank_questions.explanation",
    "Source metadata": "question_bank_questions.source",
    "Options": "question_bank_question_options.option_text",
    "Correct option": "question_bank_question_options.is_correct",
    "Option order": "question_bank_question_options.display_order",
    "Tags": "question_bank_question_tags + question_bank_question_tag_map; current service does not write them",
  };
}

function normalizeForSearch(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

function normalizeComparable(value) {
  return normalizeForSearch(value)
    .replace(/[।,.;:!?'"“”‘’()[\]{}]/g, "")
    .replace(/\b[a-d]\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toCsv(records, validation) {
  const issueMap = new Map(validation.map((item) => [item.idempotency_key, item.issues.join("|")]));
  const rows = [[
    "source_type",
    "session",
    "model_test",
    "source_page",
    "source_question_number",
    "status",
    "difficulty",
    "answer_source",
    "correct_option",
    "topic_tags",
    "validation_issues",
    "question_text",
    "options_json",
  ]];
  for (const record of records) {
    rows.push([
      record.source_type,
      record.session || "",
      record.model_test || "",
      record.source_page,
      record.source_question_number,
      record.status,
      record.difficulty,
      record.answer_source,
      record.correct_option || "",
      record.topic_tags.join("|"),
      issueMap.get(record.idempotency_key) || "",
      record.question_text,
      JSON.stringify(record.options),
    ]);
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
