import { prisma } from "../db/prisma.js";
import { scanIncoming } from "../ingest/scanIncoming.js";

async function main() {
  const result = await scanIncoming();
  console.log(`Scanned:     ${result.scanned}`);
  console.log(`Imported:    ${result.imported}`);
  console.log(`Duplicates:  ${result.duplicates}`);
  console.log(`Quarantined: ${result.quarantined}`);
  if (result.errors.length > 0) {
    console.log("Errors:");
    for (const { file, reason } of result.errors) {
      console.log(`  - ${file}: ${reason}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
