<template>
  <div id="mainPanelContainer" @contextmenu.prevent.capture :style="{height: canvaPanel.height_px + 'px'}">
    <el-row>
      <el-col :span="24">
        <Main />
      </el-col>
    </el-row>
  </div>
</template>

<script lang="tsx" setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElRow, ElCol, ElMessage, ElMessageBox } from 'element-plus'
import { ElLoading } from 'element-plus'
import { globalStates } from '@/states'
import { messages } from '@/states'
import { userAuth } from '@/states/UserState'
import { openImagesFromDir, pathBlobMap } from '@/states/LocalFiles'
import { jobConfig } from '@/states/job-config'
import { canvaPanel } from '@/states/UiState'
// import Home from "./pages/Home.vue";
import { uiState } from '@/states/UiState';
import Main from "./Main.vue";

const doChangeImage = (img_uri: string) => {
  const imgNode = new Image()
  const loadingInstance = ElLoading.service({
    lock: true,
    text: `Loading ${img_uri}`,
    background: 'rgba(0, 0, 0, 0.7)',
  })
  imgNode.addEventListener("load", () => {
    globalStates.toolsManager!.get('imageCanvas').setImage(imgNode)
    globalStates.toolsManager!.render()
    loadingInstance.close()
    // statusBar.info = `Width: ${imgNode.width} height: ${imgNode.height}`
    // statusBar.log = `Loaded ${img_uri}`
    commonChannel.pub(commonChannel.Events.ImageLoaded, {state: true})
    globalStates.image.imageDataLoaded += 1
  })

  imgNode.addEventListener("error", () => {
    commonChannel.pub(commonChannel.Events.ImageLoaded, {state: false})
    loadingInstance.close()
    messages.lastError = `加载如下图像时发生错误:${img_uri}`
    globalStates.image.imageDataLoaded -= 1
  })

  imgNode.crossOrigin = 'anonymous'
  if (jobConfig.data_source === 'localImage') {
    imgNode.src = URL.createObjectURL(pathBlobMap.get(img_uri))
  } else {
    imgNode.src = `${img_uri}?token=${userAuth.value.access_token}&uuid=${jobConfig.uuid}`
  }
  // statusBar.log = `Loading ${img_uri}`
}

watch([() => globalStates.toolsInited, 
  () => globalStates.current_data.image_uri], (newVal, oldVal) => {
    // 都初始化了，再加载数据
    if (newVal[0] && newVal[1]) {
      globalStates.doClearCanvas += 1
      // 检查是否本地文件
      if (jobConfig.data_source === 'localImage' &&
          !pathBlobMap.has(newVal[1])
      ) {
        ElMessageBox.alert(`本任务数据存储在本地，请选择与创建任务时相同的文件夹：${newVal[1]}。本操作不上传数据文件`, '提示', {
          confirmButtonText: '打开任务文件夹',
          callback: (action: Action) => {
            openImagesFromDir((imagePaths, imageBlobs) => {
              for (let i = 0; i < imagePaths.length; i++) {
                pathBlobMap.set(imagePaths[i], imageBlobs[i]);
              }
              // 加载图像
              doChangeImage(newVal[1])
              // 加载标注
              commonChannel.pub(commonChannel.Events.ButtonClicked, {data: 'load-annotation'})
            })
          },
        })
      } else {
        // 加载图像
        doChangeImage(newVal[1])
        // 加载标注
        commonChannel.pub(commonChannel.Events.ButtonClicked, {data: 'load-annotation'})
      }
    }
})

onUnmounted(() => {
})

onMounted(async () => {
  if (!document.getElementById('imageAnnoContainer')) {
      // throw new Error('container element not found')
      await nextTick()
  }

  uiState.mounted = true
})

</script>
