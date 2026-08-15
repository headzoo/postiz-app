import React from 'react';
import clsx from 'clsx';

export const LogoTextComponent = ({
  className,
  src = '/logo-40.png',
}: {
  className?: string;
  src?: string;
}) => {
  return (
    <img
      src={src}
      alt="P++"
      className={clsx('w-auto object-contain', className ?? 'h-[40px]')}
    />
  );
};
