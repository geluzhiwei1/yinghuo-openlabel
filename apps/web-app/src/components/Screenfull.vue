<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useFullscreen } from '@vueuse/core'

const { toggle, isFullscreen } = useFullscreen()

const toggleFullscreen = () => {
  toggle()
}
</script>

<template>
  <span class="header-action" @click="toggleFullscreen">
    <Icon :icon="isFullscreen ? 'lucide:minimize' : 'lucide:maximize'" width="18" />
  </span>
</template>
