import { describe, expect, it } from "vitest";
import { relativeStoragePath } from "./paths.js";

describe("relativeStoragePath", () => {
  it("buckets by captured year/month and a 2-char hash prefix", () => {
    const capturedAt = new Date(Date.UTC(2026, 6, 5)); // July 2026
    const result = relativeStoragePath("originals", capturedAt, "abcd1234", ".jpg");
    expect(result).toBe("storage/originals/2026/07/ab/abcd1234.jpg");
  });
});
