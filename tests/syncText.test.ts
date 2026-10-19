// Forward SyncTeX corrected by the PDF's text (placeLine, lineWords).
import assert from "node:assert/strict";
import { test } from "node:test";
import { lineWords, placeLine, PageText } from "../src/preview/syncText";

/** One run per line of text, 20 pt apart, 10 pt high, 6 pt per character. */
function page(page: number, ...lines: string[]): PageText {
  return { page, runs: lines.map((str, i) => ({ str, x: 50, y: 40 + 20 * i, width: 6 * str.length, height: 10 })) };
}

const box = (page: number, y = 40) => ({ page, x: 50, y, width: 100, height: 10 });

// The beamer fixture's pages (\pause hides the later items: their text is not in the PDF).
const SLIDES = [
  page(1, "One", "First frame text."),
  page(2, "Two", "▶ Alpha item"),
  page(3, "Two", "▶ Alpha item", "▶ Beta item"),
  page(4, "Two", "▶ Alpha item", "▶ Beta item", "▶ Gamma item"),
  page(5, "Three", "Third frame text."),
];

test("lineWords: what of a source line can be in the PDF", () => {
  assert.deepEqual(lineWords("\\item Alpha \\textbf{item} % note"), ["alpha", "item"]);
  assert.deepEqual(lineWords("\\begin{frame}{Two}"), ["two"]);
  assert.deepEqual(lineWords("\\end{frame} \\label{eq:a} see \\cref{eq:a}, \\citep[p.~2]{knuth}"), ["see"]);
  assert.deepEqual(lineWords("ﬁrst 中文LaTeX"), ["first", "中", "文", "latex"]);
});

test("placeLine moves beamer's page-before record to the frame, an overlay's line to its first page", () => {
  // SyncTeX put the first \item of frame 2 on page 1.
  assert.deepEqual(placeLine(SLIDES, ["alpha", "item"], box(1)), { page: 2, x: 50, y: 60, width: 72, height: 10 });
  // "Beta item" is covered on page 2, where SyncTeX's first record is.
  assert.equal(placeLine(SLIDES, ["beta", "item"], box(2))?.page, 3);
  assert.equal(placeLine(SLIDES, ["gamma", "item"], box(2))?.page, 4);
  // SyncTeX's page keeps the line when it shows it.
  assert.equal(placeLine(SLIDES, ["alpha", "item"], box(3))?.page, 3);
  assert.equal(placeLine(SLIDES, ["third", "frame", "text"], box(5))?.page, 5);
});

test("placeLine: the line within a page, partial lines, nothing found", () => {
  const doc = [page(1, "We prove the estimate for the linear", "problem first. Then the nonlinear", "problem follows from a fixed point")];
  // A source line split over two PDF lines; the box covers both runs.
  const p = placeLine(doc, lineWords("problem first. Then the \\emph{nonlinear} problem follows"), box(1, 40))!;
  assert.deepEqual([p.y, p.height], [60, 30]);
  // Too few of the line's words: SyncTeX's box stays.
  assert.equal(placeLine(doc, lineWords("Then something else entirely different here"), box(1)), null);
  assert.equal(placeLine(doc, lineWords("\\begin{itemize}"), box(1)), null);
  assert.equal(placeLine(doc, [], box(1)), null);
});
