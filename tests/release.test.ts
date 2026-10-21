import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("release validation accepts complete CRLF/LF notices and rejects altered attribution", () => {
  const dir = mkdtempSync(join(tmpdir(), "latex-live-release-"));
  try {
    mkdirSync(join(dir, "scripts"));
    for (const file of ["manifest.json", "versions.json", "package.json", "package-lock.json", "README.md", "README_zh-CN.md", "THIRD_PARTY_NOTICES.md"]) copyFileSync(file, join(dir, file));
    copyFileSync("scripts/check-release.mjs", join(dir, "scripts", "check-release.mjs"));
    const notice = readFileSync("LICENSE", "utf8").replace(/\r\n/g, "\n").trim();
    const check = () => spawnSync(process.execPath, ["scripts/check-release.mjs", "--assets"], { cwd: dir, encoding: "utf8" });
    for (const endings of ["\n", "\r\n"]) {
      writeFileSync(join(dir, "LICENSE"), notice.replace(/\n/g, endings));
      writeFileSync(join(dir, "main.js"), `/*! SPDX-License-Identifier: MIT.\n${notice}\nDOMPurify TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION */`);
      writeFileSync(join(dir, "styles.css"), `/* ${notice.replace(/\n/g, endings === "\n" ? "\r\n" : "\n")} */`);
      const result = check();
      assert.equal(result.status, 0, result.stderr);
    }
    writeFileSync(join(dir, "styles.css"), notice.replace(/Copyright[^\n]*/, "Copyright omitted"));
    assert.notEqual(check().status, 0, "altering attribution must fail even with valid line endings");
    writeFileSync(join(dir, "styles.css"), notice);
    writeFileSync(join(dir, "main.js"), `/*! SPDX-License-Identifier: MIT.\n${notice}\nDOMPurify TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION */\n//# sourceMappingURL=main.js.map`);
    assert.notEqual(check().status, 0, "release assets must exclude development sourcemaps");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
