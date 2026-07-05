import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashFile } from "./hash.js";

describe("hashFile", () => {
  it("matches a plain sha256 digest of the file contents", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "hash-test-"));
    const filePath = path.join(dir, "sample.txt");
    const contents = "hello media viewer";
    await writeFile(filePath, contents);

    const expected = createHash("sha256").update(contents).digest("hex");
    await expect(hashFile(filePath)).resolves.toBe(expected);
  });
});
