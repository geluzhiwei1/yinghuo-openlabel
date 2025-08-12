<template>
  <el-button @click="toggleDark()" circle>
    <Icon :icon="isDark ? 'carbon-moon' : 'carbon-sun'" />
  </el-button>
</template>
<script setup lang="tsx">
import { ElButton } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark()
const toggleDark = useToggle(isDark)
</script>
