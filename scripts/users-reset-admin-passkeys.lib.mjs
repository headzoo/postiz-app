export const HELP_TEXT = `Usage:
  pnpm run commands:users:reset-admin-passkeys <userId> --confirm-email <email>

Operations-only recovery: deletes all admin passkey credentials and WebAuthn
challenges for the target super-admin, and revokes every active admin
verification session. The user remains isSuperAdmin=true and must enroll a new
passkey on next /admin access.

Recovery risk: after reset, anyone who controls that super-admin's normal login
can enroll a replacement passkey. Restrict shell/database access and retain ops
logs from this command's output.

Options:
  --confirm-email <email>  Required. Must exactly match the target user's email
                           (case-insensitive comparison).
  --help, -h               Show this help text.`;

/**
 * Normalize email for confirmation comparison: trim and lowercase.
 * @param {string} email
 */
export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * @param {string[]} argv
 */
export function parseResetAdminPasskeysArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { kind: 'help' };
  }

  const confirmEmailFlagIndex = argv.indexOf('--confirm-email');
  if (confirmEmailFlagIndex === -1) {
    return {
      kind: 'error',
      message: 'Missing required --confirm-email <email> argument.',
    };
  }

  const confirmEmail = argv[confirmEmailFlagIndex + 1];
  if (!confirmEmail || confirmEmail.startsWith('-')) {
    return {
      kind: 'error',
      message: 'Missing value for --confirm-email.',
    };
  }

  const positional = argv.filter(
    (arg, index) =>
      !arg.startsWith('-') &&
      index !== confirmEmailFlagIndex + 1 &&
      arg !== '--confirm-email'
  );

  if (positional.length === 0) {
    return {
      kind: 'error',
      message: 'Missing required <userId> argument.',
    };
  }

  if (positional.length > 1) {
    return {
      kind: 'error',
      message: 'Too many positional arguments. Expected exactly one <userId>.',
    };
  }

  const unknownFlags = argv.filter(
    (arg, index) =>
      arg.startsWith('-') &&
      arg !== '--confirm-email' &&
      !(index > 0 && argv[index - 1] === '--confirm-email')
  );

  if (unknownFlags.length > 0) {
    return {
      kind: 'error',
      message: `Unknown argument(s): ${unknownFlags.join(', ')}`,
    };
  }

  return {
    kind: 'run',
    userId: positional[0],
    confirmEmail,
  };
}

/**
 * @param {{ id: string; email: string; isSuperAdmin: boolean } | null} user
 * @param {string} confirmEmail
 */
export function validateResetTarget(user, confirmEmail) {
  if (!user) {
    return { ok: false, message: 'User not found.' };
  }

  if (user.isSuperAdmin !== true) {
    return {
      ok: false,
      message: `User ${user.id} is not a platform super-admin.`,
    };
  }

  if (normalizeEmail(user.email) !== normalizeEmail(confirmEmail)) {
    return {
      ok: false,
      message: 'Email confirmation does not match the target user.',
    };
  }

  return { ok: true };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} userId
 * @param {string} confirmEmail
 */
export async function executeAdminPasskeyReset(prisma, userId, confirmEmail) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
      },
    });

    const validation = validateResetTarget(user, confirmEmail);
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    const deletedCredentials = await tx.adminPasskeyCredential.deleteMany({
      where: { userId: user.id },
    });

    const deletedChallenges = await tx.adminWebAuthnChallenge.deleteMany({
      where: { userId: user.id },
    });

    const revokedSessions = await tx.adminVerificationSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return {
      userId: user.id,
      email: user.email,
      deletedCredentials: deletedCredentials.count,
      deletedChallenges: deletedChallenges.count,
      revokedSessions: revokedSessions.count,
    };
  });
}

/**
 * @param {{
 *   userId: string;
 *   email: string;
 *   deletedCredentials: number;
 *   deletedChallenges: number;
 *   revokedSessions: number;
 *   timestamp?: Date;
 * }} input
 */
export function formatResetResult(input) {
  const timestamp = (input.timestamp ?? new Date()).toISOString();

  return [
    `[${timestamp}] Admin passkey recovery reset completed`,
    `userId=${input.userId}`,
    `email=${input.email}`,
    'isSuperAdmin=true (unchanged)',
    `deletedCredentials=${input.deletedCredentials}`,
    `deletedChallenges=${input.deletedChallenges}`,
    `revokedSessions=${input.revokedSessions}`,
    'serverSideSessionsInvalidated=true',
  ].join('\n');
}
