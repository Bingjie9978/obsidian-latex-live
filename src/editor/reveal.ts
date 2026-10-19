import { Extension, StateEffect, StateField, Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

// Where a jump lands (inverse SyncTeX, problem list, outline) and the flash that shows it.
//   Flash     the target line gets `ll-reveal-flash` for FLASH_MS: the cursor alone, at column 0
//             of a long wrapped line or behind a rendered formula, is easy to miss.
//   Word      SyncTeX answers with a line only. A double-click in the PDF selects a word in its
//             text layer; that word places the column, and moves the line within the paragraph
//             when SyncTeX's line does not contain it (SyncTeX records one line per box, often
//             the paragraph's first or last).

export const FLASH_MS = 1500;
/** How far from SyncTeX's line a word is looked for, never across a blank line. */
const WORD_REACH = 8;

const flashEffect = StateEffect.define<number | null>({
  map: (pos, mapping) => (pos === null ? null : mapping.mapPos(pos)),
});
const flashMark = Decoration.line({ class: "ll-reveal-flash" });

const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(flashEffect)) continue;
      deco = e.value === null ? Decoration.none : Decoration.set(flashMark.range(tr.state.doc.lineAt(e.value).from));
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** The flash's state; part of the LaTeX editor's extensions. */
export const revealFlash: Extension = flashField;

const timers = new WeakMap<EditorView, number>();

/** Flash the line holding `pos` for FLASH_MS. */
export function flashLine(view: EditorView, pos: number): void {
  if (!view.state.field(flashField, false)) return;
  const win = view.dom.ownerDocument.defaultView ?? window;
  const old = timers.get(view);
  if (old !== undefined) win.clearTimeout(old);
  view.dispatch({ effects: flashEffect.of(pos) });
  timers.set(view, win.setTimeout(() => {
    timers.delete(view);
    view.dispatch({ effects: flashEffect.of(null) });
  }, FLASH_MS));
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** The longest letter/digit run of a PDF text selection (ligatures unfolded), or null. */
export function wordOf(selection: string): string | null {
  const runs = selection.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  const word = runs.reduce((a, b) => (b.length > a.length ? b : a), "");
  return word.length >= 2 || CJK.test(word) ? word : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The 1-based line and 0-based column of `word` nearest SyncTeX's `line`: that line first, then
 * the lines around it (nearest first, below before above) up to a blank line. A whole-word match
 * anywhere wins over a part of a word (a word hyphenated across PDF lines). Null when absent.
 */
export function locateWord(doc: Text, line: number, word: string): { line: number; column: number } | null {
  line = Math.min(Math.max(line, 1), doc.lines);
  const order = [line];
  let up = true, down = true;
  for (let d = 1; d <= WORD_REACH && (up || down); d++) {
    if (down && line + d <= doc.lines && doc.line(line + d).text.trim()) order.push(line + d); else down = false;
    if (up && line - d >= 1 && doc.line(line - d).text.trim()) order.push(line - d); else up = false;
  }
  const w = escapeRegExp(word);
  const patterns = CJK.test(word) ? [new RegExp(w, "u")] : [new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, "u"), new RegExp(w, "u")];
  for (const re of patterns) {
    for (const n of order) {
      const m = re.exec(doc.line(n).text);
      if (m) return { line: n, column: m.index };
    }
  }
  return null;
}
