<template>
  <el-row>
    <el-col :span="ui_datas.span1">object_uuid</el-col>
    <el-col :span="ui_datas.span2"><el-input v-model="ui_datas.entity.object_uuid" placeholder="全局唯一编码，如UUID" readonly /></el-col>
  </el-row>
  <el-row>
    <el-col :span="ui_datas.span1">object_id</el-col>
    <el-col :span="ui_datas.span2"><el-input v-model="ui_datas.entity.object_id" placeholder="跟踪id，在本数据序列内唯一" /></el-col>
  </el-row>
  <el-row>
    <el-col :span="ui_datas.span1">类别</el-col>
    <el-col :span="ui_datas.span2">
      <EntityTaxonomySelecter :selectedValue="ui_datas.entity.object_type" />
    </el-col>
  </el-row>
  <el-divider />
  <el-row justify="end">
    <el-col :span="ui_datas.span1" style="text-align: right"><el-button
        @click.stop="handleClose">关闭</el-button></el-col><el-col :span="ui_datas.span2"><el-button
        @click.stop="handleSave">保存</el-button></el-col></el-row>
</template>

<script lang="ts" setup>
import { ref, toRaw } from 'vue'
import { ElDivider, ElInput, ElButton, ElCol, ElRow } from 'element-plus'
import EntityTaxonomySelecter from '../parts/EntityTaxonomySelecter.vue'
import { entityChannel } from '@/pointcloud/event/channel'
import type { BBox3d } from '@/openlabel'

const ui_datas = ref({
  span1: 8,
  span2: 16,
  entity: {} as BBox3d
})

// 事件定义
const emit = defineEmits(['buttonClick'])

// 监听和触发
const handleClose = () => {
  emit('buttonClick', { command: 'close' })
}
const handleSave = () => {
  emit('buttonClick', { command: 'save', data: toRaw(ui_datas.value.entity) })
}

entityChannel.sub(entityChannel.Events.SelectedBoxChanged, function (box_psr: BBox3d) {
  if (box_psr) {
    ui_datas.value.entity = box_psr
  } else {
    ui_datas.value.entity = {} as BBox3d
  }
})
</script>
