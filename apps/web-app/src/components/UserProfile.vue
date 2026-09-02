<template>
  <el-dropdown :teleported="true" popper-class="y-toolbar-popper">
    <span class="header-action">
      <Icon icon="lucide:user" width="18" />
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <!-- <el-dropdown-item @click="toMainPage()">主页</el-dropdown-item> -->
        <el-dropdown-item @click="toUserInfo()">账号信息</el-dropdown-item>
        <el-dropdown-item divided @click="logout()">退出登录</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
<script lang="tsx" setup>
import { ElDropdown, ElDropdownItem, ElDropdownMenu, ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { messages } from '@/states'
import { isEmpty } from 'radash'
import { cleanLoginfo } from '@/states/UserState'

const router = useRouter()

const toMainPage = () => {
  window.location.href = 'dashboard'
}

const toUserInfo = () => {
  router.push('/user-info')
}

const logout = () => {
  cleanLoginfo();
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = 'auth.html'
}


watch(() => messages.lastFailed, (newVal, oldVal) => {
    if (isEmpty(newVal)) {
        return
    }
    ElMessage({
        message: newVal,
        type: 'warning',
    })
    messages.lastFailed = ''
})

watch(() => messages.lastException, (newVal, oldVal) => {
    if (isEmpty(newVal)) {
        return
    }
    ElMessage({
        message: newVal,
        type: 'error',
    })
})

watch(() => messages.lastError, (newVal, oldVal) => {
    if (isEmpty(newVal)) {
        return
    }
    ElMessage({
        message: newVal,
        type: 'error',
    })
})

watch(() => messages.lastSuccess, (newVal, oldVal) => {
    if (isEmpty(newVal)) {
        return
    }
    ElMessage({
        message: newVal,
        type: 'success',
    })
    messages.lastSuccess=''
})


</script>
