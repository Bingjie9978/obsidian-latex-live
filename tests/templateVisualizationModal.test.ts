import "./support/dom";
import assert from "node:assert/strict";
import { test } from "node:test";
import { TemplateVisualizationModal, type TemplateVisualizationHost } from "../src/editor/templateVisualizationModal";
import { parseTemplateProfiles } from "../src/editor/templateVisualization";

const button = (m: TemplateVisualizationModal, name: string) => [...m.contentEl.querySelectorAll("button")].find(b => b.textContent === name)!;
const input = (m: TemplateVisualizationModal, name: string, value: string) => {
  const e = m.contentEl.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
  e.value = value; e.dispatchEvent(new Event("input", { bubbles: true }));
};

test("template dialog keeps a draft, validates before applying, and cancel preserves saved profiles", () => {
  const profiles = parseTemplateProfiles([{ id: "existing", name: "Existing", environments: [{ environment: "thm", color: "#123456" }] }]);
  let saves = 0;
  const m = new TemplateVisualizationModal({ app: {} as never, profiles, selected: "existing", project: "math/main.tex", save: async () => { saves++; } });
  m.open();
  input(m, "Heading", "Another name"); input(m, "Color (#RRGGBB)", "red");
  button(m, "Save and use selected profile").click();
  assert.equal(saves, 0); assert.match(m.contentEl.textContent!, /#RRGGBB/);
  button(m, "Cancel").click();
  assert.equal(profiles[0].environments[0].name, undefined);
  assert.equal(profiles[0].environments[0].color, "#123456");
});

test("template dialog blocks IME saves, shows failed writes, and saves a valid selected profile", async () => {
  let attempts = 0, failed = true, persisted: unknown, closed = 0;
  const host: TemplateVisualizationHost = { app: {} as never, profiles: [], selected: "auto", project: "math/main.tex", save: async (profiles, selected) => {
    attempts++; if (failed) throw new Error("write failed"); persisted = { profiles, selected };
  }, closed: () => { closed++; } };
  const m = new TemplateVisualizationModal(host); m.open();
  button(m, "New profile").click();
  input(m, "Profile name", "我的数学模板"); input(m, "Color (#RRGGBB)", "#445566");
  m.contentEl.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  button(m, "Save and use selected profile").click(); assert.equal(attempts, 0);
  m.contentEl.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  button(m, "Save and use selected profile").click(); await new Promise(r => setTimeout(r, 0));
  assert.match(m.contentEl.textContent!, /write failed/); assert.equal(closed, 0);
  assert.equal(button(m, "Save and use selected profile").disabled, false);
  failed = false; button(m, "Save and use selected profile").click(); await new Promise(r => setTimeout(r, 0));
  assert.equal(closed, 1); assert.equal(attempts, 2);
  const saved = persisted as { profiles: { id: string; name: string; environments: { color: string }[] }[]; selected: string };
  assert.equal(saved.profiles[0].name, "我的数学模板");
  assert.equal(saved.profiles[0].environments[0].color, "#445566");
  assert.equal(saved.selected, saved.profiles[0].id);
});

test("JSON import rejects invalid configuration and creates a separate draft profile", () => {
  let saves = 0;
  const m = new TemplateVisualizationModal({ app: {} as never, profiles: [], selected: "auto", project: null, save: async () => { saves++; } }); m.open();
  button(m, "New profile").click();
  const text = m.contentEl.querySelector<HTMLTextAreaElement>("textarea")!;
  text.value = "{bad"; button(m, "Import as a new profile").click();
  assert.equal(m.contentEl.querySelector<HTMLSelectElement>("select")!.options.length, 2);
  text.value = " ".repeat(200001); button(m, "Import as a new profile").click();
  assert.match(m.contentEl.textContent!, /200,000/);
  text.value = JSON.stringify({ id: "imported", name: "Imported", environments: [{ environment: "defn", name: "Definition", arguments: "o" }] });
  button(m, "Import as a new profile").click();
  const select = m.contentEl.querySelector<HTMLSelectElement>("select")!;
  assert.equal(select.options.length, 3); assert.notEqual(select.value, "imported");
  assert.equal(m.contentEl.querySelector<HTMLInputElement>('input[aria-label="Environment"]')!.value, "defn");
  assert.equal(saves, 0); m.close();
});
