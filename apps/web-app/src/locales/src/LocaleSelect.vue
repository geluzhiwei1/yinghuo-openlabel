<script setup lang="ts">
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'

const { locale } = useI18n()

const langMap = [
  {
    lang: 'zh-CN',
    name: '中文'
  },
  {
    lang: 'en',
    name: 'English'
  }
]

const changeLocale = (lang: string) => {
  localStorage.setItem('locale', lang)
  locale.value = lang
  location.reload()
}

defineProps({
  color: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <ElDropdown trigger="hover" @command="changeLocale">
    <el-button circle>
      <Icon icon="ion:language-sharp" :color="color" />
    </el-button>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem v-for="item in langMap" :key="item.lang" :command="item.lang">
          {{ item.name }}
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>
