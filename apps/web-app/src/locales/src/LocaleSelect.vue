<script setup lang="ts">
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import { useI18n } from "vue-i18n"
import { Icon } from '@iconify/vue'

const { locale } = useI18n()

const langMap = [
  {
    lang: 'zh-CN',
    name: '简体中文'
  },
  // {
  //   lang: 'en',
  //   name: 'English'
  // }
]

const changeLocale = (lang) => {
  locale.value = lang
}
</script>

<template>
  <ElDropdown trigger="hover" :teleported="true" popper-class="y-toolbar-popper" @command="changeLocale">
    <span class="header-action">
      <Icon icon="lucide:languages" width="18" />
    </span>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem v-for="item in langMap" :key="item.lang" :command="item.lang">
          {{ item.name }}
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>
