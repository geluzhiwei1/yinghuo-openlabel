<template>
  <el-row id="panelBar2">
    <el-button-group class="panel-tabs">
      <el-button @click="handleClick('view:table')" size="small"
        :type="viewType === 'view:table' ? 'primary' : ''">
        <Icon :icon="'uis:list-ul'"></Icon>
      </el-button>
      <el-button @click="handleClick('view:image')" size="small"
        :type="viewType === 'view:image' ? 'primary' : ''">
        <Icon :icon="'uis:image-v'"></Icon>
      </el-button>
    </el-button-group>
  </el-row>

  <el-table-v2 :columns="tableColumns" :data="tableDataRef" :row-height="40" :height="dataPanel.panelTableHeight - 5"
    :width="dataPanel.panelWidth" ref="tableRef" fixed :row-class="rowClass"
    v-show="viewType === 'view:table'" />

  <div v-show="viewType === 'view:image'" :style="{height: (dataPanel.panelTableHeight - 5) + 'px', width:dataPanel.panelWidth + 'px'}"
      class="demo-image__lazy">
    <div v-for="({uri, stream}, index) in frameImageUriObjects" :key="uri" >
      <span class="demonstration">{{ stream }}</span>
      <el-image :src="frameImageUris[index]" fit="fill" :preview-src-list="frameImageUris" :initial-index="index" lazy/>
    </div>
  </div>
</template>

<script lang="tsx" setup generic="T extends object">
import { onMounted, computed, ref, watch, type Ref } from 'vue'
import { _api, Icon } from '@iconify/vue'
import { jobConfig } from '@/states/job-config'
import { ElText, ElInputNumber, ElTableV2, ElScrollbar } from 'element-plus'
import type { Column, RowClassNameGetter } from 'element-plus'
import { dataSeqState } from '@/states/DataSeqState'
import { commonChannel } from '../../../channel'
import { dataPanel } from '@/states/UiState'
import { statisticsApi } from '@/api'
import {pySeqData} from '../../../api'
import { userSettings } from '@/states/UserState'
import * as _ from 'radash'
import { userAuth } from '@/states/UserState'
import { mainAnnoStates } from '../../../states'
import { globalStates } from '@/states'
import { i18n } from '@/locales'

const t = (key: string) => i18n.global.t(key)


const rowClass = ({ rowIndex }: Parameters<RowClassNameGetter<any>>[0]) => {
  if (rowIndex === jobConfig.frame) {
    return 'bg-blue-400'
  }
  return ''
}

const viewType = ref('view:table')

const tableDataRef = ref([])
const frameImageUriObjects = ref([])
const frameImageUris = ref([])


const tableColumns: Column<any>[] = [
  {
    title: 'No.',
    key: 'id',
    dataKey: 'id',
    width: 50
  },
  {
    title: 'Count',
    key: 'objectCount',
    dataKey: 'objectCount',
    width: 50
  },
  {
    title: '操作',
    key: 'operations',
    cellRenderer: ({ rowIndex, rowData }) => {
      const handleChangeVis = (value) => {
        const frame = parseInt(rowData.frame)
        if (mainAnnoStates.auxiliaryFrames.includes(frame)) {
          mainAnnoStates.auxiliaryFrames.splice(mainAnnoStates.auxiliaryFrames.indexOf(frame), 1)
        } else {
          mainAnnoStates.auxiliaryFrames.push(frame)
        }
      }
      const handleChangeFrame = () => {
        const frame = parseInt(rowData.frame)
        mainAnnoStates.auxiliaryFrames.push(frame)
        tryJumpFrame(frame)
      }
      return <div class="obj-actions">
        <el-tooltip placement="bottom-start" content={'标注当前帧'}>
          <button class="obj-action" value={rowIndex} onClick={handleChangeFrame} aria-label={t('aria.focusRow')}>
            <Icon icon={'lucide:focus'}></Icon>
          </button>
        </el-tooltip>
        <button class="obj-action" value={rowData.frame} onClick={handleChangeVis} aria-label={t('aria.toggleVisibility')}>
          <Icon icon={mainAnnoStates.auxiliaryFrames.includes(parseInt(rowData.frame)) ? 'mdi:show-outline' : 'mdi:hide-outline'}></Icon>
        </button>
      </div>
    },
    width: 80,
    align: 'center'
  },
  {
    title: '',
    key: 'name',
    dataKey: 'name',
    width: 150
  },
  {
    title: 'URI',
    key: 'uri',
    dataKey: 'uri',
    width: 150
  },
  {
    title: '时间戳',
    key: 'timestamp',
    dataKey: 'timestamp',
    width: 150
  },
]

watch(() => dataSeqState.streamMeta, async (newVal) => {
  onDataReady(newVal.openlabel)
})

const onDataReady = (openlabel: any) => {
  let arr: any[] = []
  Object.entries(openlabel.frames).forEach(([key, streamObj], index) => {
    arr.push({
      id: key,
      frame: key,
      timestamp: _.get(streamObj, 'frame_properties.timestamp', ''),
      name: _.get(streamObj, 'frame_properties.name', ''),
      uri: _.get(streamObj, 'frame_properties.uri', ''),
      type: _.get(streamObj, 'frame_properties.type', ''),
      objectCount: '',
      tags: []
    })
  })
  tableDataRef.value = arr

  let frame_id = _.toInt(jobConfig.frame)
  if (!frame_id) {
    frame_id = 0
  }
  if (frame_id >= arr.length) {
    frame_id = arr.length - 1
  }
  updateObjecCount()
}

const tryJumpFrame = (nextIndex: number) => {
  // 切换帧的时候，自动保存
  // if (userSettings.value.saveBeforeChangeFrame) {
  //   commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'save-annotation' })
  // }

  if (nextIndex <= 0) {
    jobConfig.frame = 0
  } else if (nextIndex >= tableDataRef.value.length - 1) {
    jobConfig.frame = tableDataRef.value.length - 1
  } else {
    jobConfig.frame = nextIndex
  }

  const currentUrl = new URL(window.location.href)
  const searchParams = new URLSearchParams(currentUrl.search)
  searchParams.set('frame', `${jobConfig.frame}`)
  currentUrl.search = searchParams.toString()
  history.pushState({}, '', currentUrl.toString())

  updateObjecCount()
  updateImageUri()
}

commonChannel.sub(commonChannel.Events.ButtonClicked, (msg) => {
  if (msg.type && msg.type === 'image-op') {
    switch (msg.data) {
      case 'image-next':
        tryJumpFrame(jobConfig.frame + 1)
        break
      case 'image-last':
        tryJumpFrame(tableDataRef.value.length - 1)
        break
      case 'image-previous':
        tryJumpFrame(jobConfig.frame - 1)
        break
      case 'image-first':
        tryJumpFrame(0)
        break
      default:
        break
    }
  }
})

commonChannel.sub(commonChannel.Events.ChangingFrame, (msg) => {
  const frame = _.toInt(msg.data.id, 0)
  tryJumpFrame(frame)
})

const handleRowClick = (e: any) => {
  tryJumpFrame(_.toInt(e.rowData.id))
}

const updateImageUri = () => {
  pySeqData.get_frame_uris({
    ...jobConfig,
    ts: jobConfig.ts
  }).then((res) => {
    frameImageUriObjects.value = _.get(res.data, "uris")
    frameImageUris.value = _.get(res.data, "uris").map((item: any) => {
      return `${item.uri}?token=${userAuth.value.access_token}&uuid=${jobConfig.uuid}`
    })
  })
}

const handleClick = (command: string) => {
  switch (command) {
    case 'view:table':
      viewType.value = 'view:table'
      break
    case 'view:image':
      viewType.value = 'view:image'
      updateImageUri()
      break
    default:
      break
  }
}


watch(() => globalStates.anno.annoDataLoaded, (newVal) => {
  updateObjecCount()
})

const updateObjecCount = () => {
  const params = {
    seq: jobConfig.seq,
    stream: jobConfig.stream,
    frame: jobConfig.frame,
    current_mission: jobConfig.mission,
    statisticsType: 'objTypeCountByFrame',
    uuid: jobConfig.uuid
  }
  statisticsApi.seq(params).then(res => {
    for (let item of Object.values(res.data)) {
      const { frame, objectCount } = item
      tableDataRef.value[frame].objectCount = objectCount + ''
    }
  })
}

onMounted(() => {

})

</script>
<style scoped>
.demo-image__lazy {
  overflow-y: auto;
}
.demo-image__lazy .el-image {
  display: block;
  min-height: 200px;
  min-width: 200px;
  margin-bottom: 10px;
}
.demo-image__lazy .el-image:last-child {
  margin-bottom: 0;
}
</style>