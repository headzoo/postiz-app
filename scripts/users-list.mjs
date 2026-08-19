import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const headers = {
  id: 'id',
  email: 'email',
  name: 'name',
  isSuperAdmin: 'isSuperAdmin',
  activated: 'activated',
  createdAt: 'createdAt',
};

const columns = Object.keys(headers);

try {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isSuperAdmin: true,
      activated: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!users.length) {
    console.log('No users found.');
    process.exit(0);
  }

  const rows = users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name || '-',
    isSuperAdmin: String(user.isSuperAdmin),
    activated: String(user.activated),
    createdAt: user.createdAt.toISOString(),
  }));

  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.max(
        headers[column].length,
        ...rows.map((row) => row[column].length)
      ),
    ])
  );

  const formatRow = (row) =>
    columns.map((column) => row[column].padEnd(widths[column])).join('  ');

  console.log(formatRow(headers));
  console.log(columns.map((column) => '-'.repeat(widths[column])).join('  '));

  for (const row of rows) {
    console.log(formatRow(row));
  }
} finally {
  await prisma.$disconnect();
}
