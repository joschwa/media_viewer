import { readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { ensureBaseDirs, incomingDir } from "../storage/paths.js";
import { ingestFile } from "./ingestFile.js";

export type ScanResult = {
  scanned: number;
  imported: number;
  duplicates: number;
  quarantined: number;
  errors: { file: string; reason: string }[];
};

const MAIN_USERNAME = "main";

export async function scanIncoming(): Promise<ScanResult> {
  await ensureBaseDirs();

  const mainUser = await prisma.user.findUnique({ where: { username: MAIN_USERNAME } });
  if (!mainUser) {
    throw new Error(`No '${MAIN_USERNAME}' account found — run "npm run seed-admin" first.`);
  }

  const entries = await readdir(incomingDir(), { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && !entry.name.startsWith("."));

  const result: ScanResult = { scanned: 0, imported: 0, duplicates: 0, quarantined: 0, errors: [] };

  for (const entry of files) {
    result.scanned += 1;
    const filePath = path.join(incomingDir(), entry.name);
    const outcome = await ingestFile(filePath, mainUser.id);

    if (outcome.status === "imported") {
      result.imported += 1;
    } else if (outcome.status === "duplicate") {
      result.duplicates += 1;
    } else {
      result.quarantined += 1;
      result.errors.push({ file: entry.name, reason: outcome.reason });
    }
  }

  return result;
}
