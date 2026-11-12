<template>
  <div class="app-shell">
    <div class="cosmic-aurora" aria-hidden="true"></div>
    <div class="cosmic-noise" aria-hidden="true"></div>
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>
