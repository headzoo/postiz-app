import { PrismaClient } from '@prisma/client';
import {
  HELP_TEXT,
  executeAdminPasskeyReset,
  formatResetResult,
  parseResetAdminPasskeysArgs,
} from './users-reset-admin-passkeys.lib.mjs';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const parsed = parseResetAdminPasskeysArgs(args);

if (parsed.kind === 'help') {
  console.log(HELP_TEXT);
  process.exit(0);
}

if (parsed.kind === 'error') {
  console.error(parsed.message);
  console.error('');
  console.error(HELP_TEXT);
  process.exit(1);
}

try {
  const result = await executeAdminPasskeyReset(
    prisma,
    parsed.userId,
    parsed.confirmEmail
  );

  console.log(formatResetResult(result));
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Admin passkey reset failed.'
  );
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
