import localFont from 'next/font/local';

export const jakartaSans = localFont({
  src: [
    {
      path: './fonts/plus-jakarta-sans-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/plus-jakarta-sans-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/plus-jakarta-sans-700.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/plus-jakarta-sans-500-italic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: './fonts/plus-jakarta-sans-600-italic.woff2',
      weight: '600',
      style: 'italic',
    },
    {
      path: './fonts/plus-jakarta-sans-700-italic.woff2',
      weight: '700',
      style: 'italic',
    },
  ],
  display: 'swap',
});
