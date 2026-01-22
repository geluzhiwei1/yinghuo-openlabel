<template>
  <el-row>
    <el-col :span="24">
      <el-text style="text-align: center">{{ t('home.dashboard.welcome') }}，{{ userAuth.user.email ||
        userAuth.user.mobile_phone_no
      }},{{ t('home.dashboard.lastLogin') }}
        {{ formatUtc(userAuth.user.last_login) }}</el-text>
    </el-col>
  </el-row>
  <el-row>
    <el-col :span="24" style="text-align: center">
      {{ t('home.dashboard.welcome2')
      }}<el-link type="success" href="https://gitee.com/gerwee/yinghuo/issues" target="_blank">{{
        t('home.dashboard.feedback')
      }}</el-link>，{{ t('home.dashboard.byViewing') }}
      <el-link type="success" href="https://www.bilibili.com/video/BV1xoTvz2ES5?t=4.4" target="_blank">{{
        t('home.dashboard.videoTutorial') }}</el-link>{{ t('home.dashboard.quickStart') }}
    </el-col>
  </el-row>
  <el-row style="height: 300px; align-items: center">
    <el-col :span="6">
      <el-statistic :title="t('home.dashboard.myTasks')" :value="data.job.admin" />
    </el-col>
    <el-col :span="6">
      <el-statistic :title="t('home.dashboard.myCollaborations')" :value="data.job.collaborator" />
    </el-col>
    <el-col :span="6">
      <el-statistic :title="t('home.dashboard.myAnnotations')" :value="data.anno.total_count" />
    </el-col>
  </el-row>
</template>

<script setup lang="ts" name="dashboard">
/*
Copyright (C) 2025 格律至微

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { userAuth } from '@/states/UserState'
import { formatUtc } from '@/libs/datetime'
import { statisticsApi } from '@/api'

const { t } = useI18n()

const data = ref({
  job: {
    collaborator: 0,
    admin: 0
  },
  anno: {
    total_count: 0
  }
})

onMounted(async () => {
  statisticsApi.my({}).then((res: any) => {
    data.value.anno.total_count = res.data.anno.total_count
    data.value.job.collaborator = res.data.job.collaborator
    data.value.job.admin = res.data.job.admin
  })
})
</script>

<style scoped>
.el-col {
  text-align: center;
}
</style>
