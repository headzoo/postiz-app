<script setup lang="ts">
import { withBase } from 'vitepress';

const LOGO_URL = 'https://github.com/user-attachments/assets/f0d30d70-dddb-4142-8876-e9aa6ed1cb99';
const SITE_TITLE = 'Post++ Internal Docs';
const homeHref = withBase('/');
</script>

<template>
  <a class="docs-sidebar-brand" :href="homeHref" :aria-label="SITE_TITLE">
    <img :src="LOGO_URL" :alt="SITE_TITLE" width="500" height="191" decoding="async" />
  </a>
</template>
