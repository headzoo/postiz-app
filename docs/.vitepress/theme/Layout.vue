<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import SidebarBrand from './SidebarBrand.vue';

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #sidebar-nav-before>
      <SidebarBrand />
    </template>
  </Layout>
</template>
