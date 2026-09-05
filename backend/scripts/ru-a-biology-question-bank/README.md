# RU A Biology Question Bank Import Tools

Preview-only workflow for extracting Biology MCQs from `RU A Unit Question Bank.pdf`.

The scripts in this directory do not mutate the database unless an explicit future
import command is added and run after approval.

Pipeline:

1. Render PDF pages to images with Poppler.
2. OCR rendered pages with Tesseract Bengali + English.
3. Build `ru_a_biology_import_preview.json` and `ru_a_biology_import_preview.csv`.
4. Validate records and duplicate candidates.
5. Stop for manual approval.

