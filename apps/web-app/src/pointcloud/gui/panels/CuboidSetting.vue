<template>
  <!-- <el-dialog
    v-model="dialogVisible"
    title="目标设置"
    :modal="false"
    :close-on-click-modal="false"
    :draggable="true"
    :show-close="false"
    modal-class="custom_dialog"
    size="small"
  > -->
  <el-form :model="formSetting" label-width="120px">
    <el-form-item label="颜色">
      <el-radio-group v-model="formSetting.thema" @change="handleThemaChange">
        <el-radio label="light">按类别</el-radio>
        <el-radio label="dark"> 按ID </el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item label="显示类别">
      <el-switch v-model="formSetting.delivery" />
      <el-input v-model="formSetting.name" />
    </el-form-item>
    <el-form-item label="显示">
      <el-checkbox-group v-model="formSetting.type">
        <el-checkbox label="显示box" name="type" />
        <el-checkbox label="显示类别" name="type" />
        <el-checkbox label="显示属性" name="type" />
        <el-checkbox label="显示ID" name="type" />
      </el-checkbox-group>
    </el-form-item>
    <el-form-item label="Activity form">
      <el-input v-model="formSetting.desc" type="textarea" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="onSubmit">保存</el-button>
      <el-button @click="dialogVisible = false">恢复默认</el-button>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </el-form-item>
  </el-form>
  <!-- </el-dialog> -->
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { pcUserSettings } from '@/pointcloud/states'
const props = defineProps({
  modelValue: {
    type: Boolean
  }
})
const emit = defineEmits(['update:modelValue'])
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => {
    emit('update:modelValue', val)
  }
})

// do not use same name with ref
const formSetting = ref({
  thema: 'dark',
  name: '',
  region: '',
  date1: '',
  date2: '',
  delivery: false,
  type: [],
  resource: '',
  desc: ''
})

const handleThemaChange = () => {
  const thema = formSetting.value.thema
  //   if ('dark' === thema) {
  //     document.documentElement.classList.add('dark')
  //     document.documentElement.classList.remove('light')
  //   } else {
  //     document.documentElement.classList.add('light')
  //     document.documentElement.classList.remove('dark')
  //   }
  document.documentElement.classList.remove('dark')
  document.documentElement.classList.remove('light')
  document.documentElement.classList.add(thema)
  if (pcUserSettings.value.setting) {
    pcUserSettings.value.setting.setItem('theme', thema)
  }
  if (window.editorPC) {
    let ele = document.getElementById('main-editor')
    if (ele) {
      ele.className = 'theme-' + thema
    }
    window.editorPC.viewManager.setColorScheme()
    window.editorPC.render()
    window.editorPC.boxEditorManager.render()
  }
}

const onSubmit = () => {
}
</script>
<style lang="less" scoped>
.custom_dialog {
  pointer-events: none;
}
</style>
