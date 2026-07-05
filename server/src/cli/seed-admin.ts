import bcrypt from "bcrypt";
import { prisma } from "../db/prisma.js";

const USERNAME = "main";

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const password = parseArg("--password") ?? process.env.MAIN_PASSWORD;
  if (!password) {
    console.error('Usage: npm run seed-admin -- --password <password>  (or set MAIN_PASSWORD env var)');
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username: USERNAME } });
  if (existing) {
    console.log(`'${USERNAME}' account already exists (id=${existing.id}), nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username: USERNAME, passwordHash, role: "admin" },
  });
  console.log(`Created admin account '${user.username}' (id=${user.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
