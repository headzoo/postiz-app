import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Layout from './Layout.vue';
import './custom.css';

const syncDocImageLinks = () => {
  document.querySelectorAll<HTMLAnchorElement>('.vp-doc-image-link').forEach((link) => {
    const image = link.querySelector<HTMLImageElement>('img');
    const resolvedSrc = image?.currentSrc || image?.src;

    if (resolvedSrc) {
      link.href = resolvedSrc;
    }
  });
};

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp(ctx) {
    DefaultTheme.enhanceApp?.(ctx);

    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(syncDocImageLinks);

    ctx.router.onAfterRouteChanged = () => {
      window.requestAnimationFrame(syncDocImageLinks);
    };
  },
} satisfies Theme;
