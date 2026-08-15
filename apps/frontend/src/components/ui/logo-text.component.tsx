import React from 'react';
import clsx from 'clsx';

export const LogoTextComponent = ({ className }: { className?: string }) => {
  return (
    <img
      src="/logo.png"
      alt="Postiz"
      className={clsx('w-auto object-contain', className ?? 'h-[40px]')}
    />
  );
};
