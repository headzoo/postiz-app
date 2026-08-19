import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const userId = args.find((arg) => !arg.startsWith('-'));
const unset = args.includes('--unset');

if (!userId || args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  pnpm run commands:users:set-super-admin <userId>
  pnpm run commands:users:set-super-admin <userId> --unset`);
  process.exit(userId ? 0 : 1);
}

try {
  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      isSuperAdmin: !unset,
    },
    select: {
      id: true,
      email: true,
      isSuperAdmin: true,
    },
  });

  console.log(
    `Updated ${user.email} (${user.id}): isSuperAdmin=${user.isSuperAdmin}`
  );
} catch (error) {
  if (error?.code === 'P2025') {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  throw error;
} finally {
  await prisma.$disconnect();
}
