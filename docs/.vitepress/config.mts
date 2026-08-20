import { defineConfig } from 'vitepress';
import pkg from '../../package.json';
import { toAnchor } from '../../scripts/docs-slugger.mjs';
import { sidebar } from './sidebar.generated';

const siteBase = '/postplusplus/';

const withSiteBase = (path: string) => {
  if (!path.startsWith('/') || path.startsWith(siteBase) || path.startsWith('//')) {
    return path;
  }

  return `${siteBase.replace(/\/$/, '')}${path}`;
};

export default defineConfig({
  title: 'Post++ Internal Docs',
  description: 'Architecture, API, workflow, and repository internals for Post++ maintainers.',
  base: siteBase,
  appearance: 'force-dark',
  cleanUrls: true,
  vite: {
    publicDir: '.vitepress/static',
  },
  head: [
    ['link', { rel: 'icon', href: withSiteBase('/images/favicon.ico') }],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: withSiteBase('/images/favicon-16x16.png'),
      },
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: withSiteBase('/images/favicon-32x32.png'),
      },
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: withSiteBase('/images/apple-touch-icon.png'),
      },
    ],
  ],
  ignoreDeadLinks: [/^https?:\/\/localhost(?::\d+)?(?:\/|$)/],
  markdown: {
    anchor: {
      slugify: toAnchor,
    },
    config(md) {
      const defaultRender =
        md.renderer.rules.image ??
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const renderedImage = defaultRender(tokens, idx, options, env, self);
        const token = tokens[idx];
        const src = token.attrGet('src');
        const isAlreadyLinked =
          tokens[idx - 1]?.type === 'link_open' && tokens[idx + 1]?.type === 'link_close';

        if (!src || isAlreadyLinked) {
          return renderedImage;
        }

        return `<a class="vp-doc-image-link" href="${md.utils.escapeHtml(withSiteBase(src))}" target="_blank" rel="noopener noreferrer">${renderedImage}</a>`;
      };
    },
    gfmAlerts: true,
    languageAlias: {
      env: 'dotenv',
    },
  },
  themeConfig: {
    logo: {
      src: '/images/logo.png',
      alt: 'Post++ Internal Docs',
    },
    siteTitle: false,
    nav: [
      {
        text: `v${pkg.version}`,
        link: 'https://github.com/headzoo/postplusplus/releases',
      },
    ],
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/headzoo/postplusplus',
        ariaLabel: 'Post++ Internal Docs on GitHub',
      },
    ],
    sidebar,
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    search: {
      provider: 'local',
    },
  },
});
