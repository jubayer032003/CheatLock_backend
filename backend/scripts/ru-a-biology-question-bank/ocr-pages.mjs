import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createWorker } = require("tesseract.js");

const imageDir = resolve(process.argv[2] || "tmp/ru_a_pdf_pages_110");
const outputDir = resolve(process.argv[3] || "tmp/ru_a_ocr_text");
const language = process.argv[4] || "ben+eng";
const startPage = Number(process.argv[5] || 1);
const endPage = Number(process.argv[6] || Number.MAX_SAFE_INTEGER);

await mkdir(outputDir, { recursive: true });

const files = (await readdir(imageDir))
  .filter((file) => /^page-\d+\.png$/i.test(file))
  .filter((file) => {
    const page = pageNumber(file);
    return page >= startPage && page <= endPage;
  })
  .sort((a, b) => a.localeCompare(b));

const worker = await createWorker(language);
try {
  let processed = 0;
  for (const file of files) {
    const imagePath = join(imageDir, file);
    const outputPath = join(outputDir, `${basename(file, ".png")}.txt`);
    if (await hasText(outputPath)) {
      processed += 1;
      console.log(JSON.stringify({
        page: file,
        output: outputPath,
        skipped: true,
        processed,
        total: files.length,
      }));
      continue;
    }
    const started = Date.now();
    const result = await worker.recognize(imagePath);
    await writeFile(outputPath, result.data.text, "utf8");
    processed += 1;
    console.log(JSON.stringify({
      page: file,
      output: outputPath,
      ms: Date.now() - started,
      confidence: Math.round(result.data.confidence),
      processed,
      total: files.length,
    }));
  }
} finally {
  await worker.terminate();
}

function pageNumber(file) {
  const match = file.match(/page-(\d+)\.png/i);
  return match ? Number(match[1]) : 0;
}

async function hasText(path) {
  try {
    const info = await stat(path);
    return info.size > 20;
  } catch {
    return false;
  }
}
