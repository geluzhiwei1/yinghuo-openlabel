<template>
    <span class="header-action" @click="toggleDark()">
        <Icon :icon="isDark ? 'lucide:moon' : 'lucide:sun'" width="18" />
    </span>
</template>
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark()
const toggleDark = useToggle(isDark)
</script>
