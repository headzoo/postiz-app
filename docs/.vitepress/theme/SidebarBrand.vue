<script setup lang="ts">
import { withBase } from 'vitepress';

const SITE_TITLE = 'Post++ Internal Docs';
const homeHref = withBase('/');
const logoSrc = withBase('/images/orange-robot.png');
</script>

<template>
  <a class="docs-sidebar-brand" :href="homeHref" :aria-label="SITE_TITLE">
    <img
      :src="logoSrc"
      :alt="SITE_TITLE"
      width="120"
      height="120"
      decoding="async"
    />
  </a>
</template>
