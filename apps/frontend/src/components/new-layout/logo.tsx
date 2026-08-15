'use client';

import Link from 'next/link';

export const Logo = ({
  sidebar = false,
}: {
  sidebar?: boolean;
}) => {
  return (
    <Link
      href="/"
      aria-label="Dashboard"
      className={
        sidebar
          ? 'mt-[8px] flex w-full items-center justify-center'
          : 'mt-[8px] min-w-[60px] min-h-[60px]'
      }
    >
      <img
        src={sidebar ? '/orange-robot.png' : '/logo-60.png'}
        alt="Post++"
        className={
          sidebar
            ? 'relative top-[10px] h-[60px] w-[60px] object-contain'
            : 'h-[60px] w-[60px] object-contain'
        }
      />
    </Link>
  );
};
