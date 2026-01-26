<template>
  <el-dropdown style="margin-right: 5px">
    <el-button circle>
      <Icon icon="flowbite:user-settings-solid"></Icon>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <!-- <el-dropdown-item @click="toMainPage()">主页</el-dropdown-item> -->
        <el-dropdown-item @click="modifyPassword()">账号信息</el-dropdown-item>
        <el-dropdown-item divided @click="logout()">退出登录</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
  <el-tag effect="plain" type="success">{{ appVersion }}</el-tag>
  <UserProfilePanel ref="userProfilePanelRef" />
</template>
<script lang="tsx" setup>
import {
  ElDropdown,
  ElButton,
  ElDropdownItem,
  ElDropdownMenu,
  ElTag,
  ElMessage
} from 'element-plus'
import { Icon } from '@iconify/vue'
import UserProfilePanel from '@/home/views/system/user/UserProfilePanel.vue'
import { watch, ref } from 'vue'
import { messages } from '@/states'
import { isEmpty } from 'radash'
import { cleanLoginfo } from '@/states/UserState'

interface UserProfilePanelRef {
  open: () => void
  close: () => void
}

const userProfilePanelRef = ref<InstanceType<typeof UserProfilePanel> | null>(null)
const appVersion = import.meta.env.VITE_APP_VERSION

const modifyPassword = () => {
  userProfilePanelRef.value?.open()
}

const logout = () => {
  cleanLoginfo()
  localStorage.clear()
  sessionStorage.clear()
  window.location.href = 'login.html'
}

watch(
  () => messages.lastFailed,
  (newVal) => {
    if (isEmpty(newVal)) {
      return
    }
    ElMessage({
      message: newVal,
      type: 'warning'
    })
    messages.lastFailed = ''
  }
)

watch(
  () => messages.lastException,
  (newVal) => {
    if (isEmpty(newVal)) {
      return
    }
    ElMessage({
      message: newVal,
      type: 'error'
    })
  }
)

watch(
  () => messages.lastError,
  (newVal) => {
    if (isEmpty(newVal)) {
      return
    }
    ElMessage({
      message: newVal,
      type: 'error'
    })
  }
)

watch(
  () => messages.lastSuccess,
  (newVal) => {
    if (isEmpty(newVal)) {
      return
    }
    ElMessage({
      message: newVal,
      type: 'success'
    })
    messages.lastSuccess = ''
  }
)
</script>
