<template>
  <el-dialog :title="dialogTitle" v-model="dialogVisible" :draggable="true" :width="totalWidth" :overflow="true">
      <ImageWaterfall ref='waterfallRef' :totalWidth="totalWidth" :totalHeight="totalHeight"/>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElDialog } from 'element-plus'
import ImageWaterfall from './ImageWaterfall.vue'
import { commonChannel } from '@/video/channel'

const waterfallRef = ref<HTMLElement | null>(null)
const dialogVisible = ref(false)
const dialogTitle = ref('') // 弹窗的标题

const totalWidth = computed(() => {
  return Math.round(document.documentElement.clientWidth * 0.85)
})
const totalHeight = computed(() => {
  return Math.round(document.documentElement.clientHeight * 0.65)
})

const open = () => {
  dialogVisible.value = true
}

commonChannel.sub(commonChannel.Events.UiImageWaterFall, (msg) => {
  switch(msg.cmd) {
    case 'open':
      open()
      break;
    default:
      break
  }
})

</script>
