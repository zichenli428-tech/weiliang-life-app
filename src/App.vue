<script setup lang="ts">
// 微量生活 - 根组件
// 使用 MainLayout（含 RouterView + TabBar）
// 通过 van-config-provider 注入深色极光琉璃主题变量
import MainLayout from '@/layouts/MainLayout.vue'
</script>

<template>
  <van-config-provider theme="dark">
    <MainLayout />
  </van-config-provider>
</template>
