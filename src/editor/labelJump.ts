import type { Extension, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CITE_COMMANDS } from "./latexHighlight";
import { literalAt } from "./latexScan";

/**
 * A click on a reference chip (`\ref`, `\eqref`, `\cref`, ...; with or without Cmd/Ctrl) jumps to
 * its `\label`, like an Obsidian link: in this document the cursor moves there and the view
 * scrolls; otherwise `elsewhere` opens the project file that has it. The handler runs on mousedown,
 * before CodeMirror places the cursor, and only for the chip itself: a click beside it, the arrow
 * keys or a Shift/Alt-click put the cursor at the chip and reveal its source.
 */
export function labelJump(elsewhere: (key: string) => void): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0 || event.shiftKey || event.altKey) return false;
      const chip = (event.target as HTMLElement | null)?.closest?.("[data-ll-ref-key]") as HTMLElement | null;
      const key = chip?.dataset.llRefKey;
      const command = chip?.dataset.llRefCommand ?? "";
      if (!chip || !key || CITE_COMMANDS.has(command) || command === "nocite") return false;
      event.preventDefault();
      const at = labelIn(view.state.doc, key);
      if (at === null) elsewhere(key);
      else {
        view.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: "center" }) });
        view.focus();
      }
      return true;
    },
  });
}

/** The position of `\label{key}` in `doc` outside comments and literal code, or null. */
export function labelIn(doc: Text, key: string): number | null {
  const text = doc.toString();
  const needle = `\\label{${key}}`;
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
    if (!literalAt(doc, i + 1)) return i;
  }
  return null;
}
