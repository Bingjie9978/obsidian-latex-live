import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("source, tooling, documentation and fixture names can be checked out on Windows", () => {
  const reserved = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;
  function check(folder: string) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      assert.equal(reserved.test(entry.name), false, `Windows reserved name: ${join(folder, entry.name)}`);
      assert.equal(/[<>:"\\|?*\u0000-\u001f]|[. ]$/.test(entry.name), false, `Windows invalid name: ${join(folder, entry.name)}`);
      if (entry.isDirectory()) check(join(folder, entry.name));
    }
  }
  for (const folder of ["src", "tests", "scripts", "docs", "licenses", ".github"]) check(folder);
});
