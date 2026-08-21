'use client';
import { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

export const MenuItem: FC<{
  label: string;
  icon: ReactNode;
  path: string;
  onClick?: () => void;
  onNavigate?: () => void;
}> = ({ label, icon, path, onClick, onNavigate }) => {
  const currentPath = usePathname();
  const isActive = currentPath.indexOf(path) === 0;

  const className = clsx(
    'group w-full minCustom:h-[54px] custom:h-[44px] py-[8px] px-[6px] minCustom:gap-[4px] custom:gap-[2px] flex flex-col font-[600] items-center justify-center rounded-[12px] transition-colors',
    isActive
      ? 'text-white bg-btnPrimary hover:opacity-90'
      : 'text-textItemBlur hover:text-white hover:bg-btnPrimary'
  );

  const inner = (
    <>
      <div className="custom:scale-90 transition-transform">{icon}</div>
      <div className="custom:text-[9px] minCustom:text-[10px] leading-[1.1] text-center">
        {label}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={() => {
          onClick();
          onNavigate?.();
        }}
        title={label}
        className={className}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      prefetch={true}
      href={path}
      title={label}
      onClick={onNavigate}
      {...(path.indexOf('http') === 0 && { target: '_blank' })}
      className={className}
    >
      {inner}
    </Link>
  );
};
