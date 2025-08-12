<template>
  <el-drawer title="选择模型" :size="'70%'" v-model="dnnModelSelectorState.dialogVisible">
    <div class="scrollbar-flex-content">
      <el-tabs v-model="activeModelType" type="border-card">
        <el-tab-pane label="模型(WebGPU)" name="builtin">
          <OnnxWebModels></OnnxWebModels>
        </el-tab-pane>
        <el-tab-pane label="模型(官网服务器)" name="private">
          <PrivateModels></PrivateModels>
        </el-tab-pane>
        <el-tab-pane label="模型(自有服务器)" name="my">
          <el-button disabled>添加</el-button>
        </el-tab-pane>
      </el-tabs>
    </div>
    <template #footer>
      <div style="text-align: center">
        <el-button
          @click="ok()"
          type="primary"
          v-loading.fullscreen.lock="fullscreenLoading"
          :element-loading-text="loadingLog"
          >确定</el-button
        >
        <el-button @click="cancel()">取消</el-button>
      </div>
    </template>
  </el-drawer>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton, ElTabs, ElTabPane } from 'element-plus'
import { dnnModelSelectorState } from './index'
import PrivateModels from './PrivateModels.vue'
import OnnxWebModels from './OnnxWebModels.vue'

import { get } from 'radash'
import { messages } from '@/states'
import { loadYoloV8Wasm } from '@/libs/plugin'

const fullscreenLoading = ref(false)
const activeModelType = ref('builtin')

const loadingLog = ref('加载模型...')

const loadOnnxWebModel = async () => {
  // const loadingInstance = ElLoading.service({ fullscreen: true, text: '加载模型...', lock: true })
  fullscreenLoading.value = true
  // const inferencers = await import("yinghuo-onnx-web-inferencer")
  const CLS = get(
    get(window, 'inferencers'),
    dnnModelSelectorState.selectedApi?.serv_info.inferencer,
    undefined
  )
  if (!CLS) {
    fullscreenLoading.value = false
    messages.lastException = '未找到模型加载器'
    return
  }
  const infer = new CLS()
  const modelConf = {
    logger: (args: any) => {
      if (args) {
        const { text, progress } = args
        // console.log( - ${progress}`)
        let msg = `${text}`
        if (progress) {
          msg = `${text} - ${progress}`
        }
        loadingLog.value = msg
      }
    },
    topk: 100,
    iouThreshold: 0.45,
    scoreThreshold: 0.25,
    modelInputShape: [1, 3, 640, 640],
    modelDef: dnnModelSelectorState.selectedApi
  }

  // dnnModelSelectorState.selectedApi.model_args.onnx_url
  // dnnModelSelectorState.selectedApi.model_args.onnx_nms_url

  infer
    .initialize(modelConf)
    .then(() => {
      if (infer.pipeline) {
        messages.lastSuccess = '模型加载成功'
        dnnModelSelectorState.selectedApi.infer = infer
        if (dnnModelSelectorState.onOk) {
          dnnModelSelectorState.onOk()
        }
      } else {
        messages.lastException = '模型加载失败'
      }
    })
    .catch((err) => {
      messages.lastException = `异常${err.message}`
    })
    .finally(() => {
      // loadingInstance.close()
      fullscreenLoading.value = false
    })
}

const ok = () => {
  if (activeModelType.value === 'builtin') {
    loadYoloV8Wasm().then(() => {
      loadOnnxWebModel().then(() => {
        dnnModelSelectorState.dialogVisible = false
      })
    })
  } else {
    if (dnnModelSelectorState.onOk) {
      dnnModelSelectorState.onOk()
    }
  }
}

const cancel = () => {
  if (dnnModelSelectorState.onCancel) {
    dnnModelSelectorState.onCancel()
  }
  dnnModelSelectorState.dialogVisible = false
}

onMounted(() => {})

const open = () => {
  dnnModelSelectorState.dialogVisible = true
}
defineExpose({ open })
</script>
<style scoped>
.scrollbar-flex-content {
  display: flex;
}

.el-tabs__content {
  padding: 32px;
  color: #6b778c;
  font-size: 32px;
  font-weight: 600;
}
</style>
