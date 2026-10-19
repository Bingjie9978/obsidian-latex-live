// Where a jump lands (locateWord, wordOf) and the line flash (flashLine).
import "./support/dom";
import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorState, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { FLASH_MS, flashLine, locateWord, revealFlash, wordOf } from "../src/editor/reveal";

const doc = Text.of([
  "\\section{Intro}",
  "",
  "The first sentence of a paragraph",
  "continues with a distinctive word here,",
  "and the paragraph ends.",
  "",
  "A distinctive word in another paragraph.",
  "数学公式与中文段落。",
]);

test("wordOf keeps the longest letter run of a PDF selection, ligatures unfolded", () => {
  assert.equal(wordOf(" distinctive, "), "distinctive");
  assert.equal(wordOf("ﬁrst"), "first");
  assert.equal(wordOf("a"), null);
  assert.equal(wordOf("—"), null);
  assert.equal(wordOf("中"), "中");
});

test("locateWord: SyncTeX's line first, then nearest lines within the paragraph", () => {
  assert.deepEqual(locateWord(doc, 4, "distinctive"), { line: 4, column: 17 });
  // SyncTeX often names the paragraph's last line; the word is two lines up.
  assert.deepEqual(locateWord(doc, 5, "first"), { line: 3, column: 4 });
  // Never across a blank line into another paragraph.
  assert.equal(locateWord(doc, 7, "sentence"), null);
  assert.deepEqual(locateWord(doc, 7, "distinctive"), { line: 7, column: 2 });
});

test("locateWord prefers a whole word anywhere over part of a word", () => {
  // SyncTeX's line 4 has no "the"; line 5 has it as a whole word (line 3's "The" differs in case).
  assert.deepEqual(locateWord(doc, 4, "the"), { line: 5, column: 4 });
  // A word hyphenated across PDF lines matches as a part.
  assert.deepEqual(locateWord(doc, 4, "distinc"), { line: 4, column: 17 });
  assert.deepEqual(locateWord(doc, 8, "中文"), { line: 8, column: 5 });
});

test("flashLine marks the target line, then clears it", async () => {
  const view = new EditorView({ state: EditorState.create({ doc: doc.toString(), extensions: revealFlash }), parent: document.body });
  try {
    flashLine(view, doc.line(4).from + 3);
    const flashed = [...view.contentDOM.querySelectorAll(".ll-reveal-flash")];
    assert.equal(flashed.length, 1);
    assert.equal(flashed[0].textContent, doc.line(4).text);
    await new Promise((r) => setTimeout(r, FLASH_MS + 50));
    assert.equal(view.contentDOM.querySelectorAll(".ll-reveal-flash").length, 0);
  } finally {
    view.destroy();
  }
});
