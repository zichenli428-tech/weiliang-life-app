<script setup lang="ts">
// 微量生活 - 根组件
// 使用 MainLayout（含 RouterView + TabBar）
// 浅色模式为默认，通过 apple-tokens.css 自动跟随系统深色模式
import MainLayout from '@/layouts/MainLayout.vue'
</script>

<template>
  <van-config-provider>
    <MainLayout />
  </van-config-provider>
</template>
