<template>
  <el-row id="panelBar2">
    <el-button-group>
      <el-button @click="handleClick('view:table')" size="small" round :type="'success'" :disabled="jobConfig.mission === Mission.VideoEvents">
        <Icon :icon="'uis:list-ul'"></Icon>
      </el-button>
      <!-- <el-button @click="handleClick('view:tag')" size="small" round >
        <Icon :icon="'grommet-icons:tag'"></Icon>
      </el-button> -->
      <el-button @click="handleClick('view:image')" size="small" round :disabled="jobConfig.mission === Mission.VideoEvents">
        <Icon :icon="'uis:image-v'"></Icon>
      </el-button>
      <!-- <el-button @click="handleClick('view:setting')" size="small" round
        :type="viewType === 'setting' ? 'success' : ''">
        <Icon :icon="'mdi:hide-outline'"></Icon>设置
      </el-button> -->
    </el-button-group>
    <el-button-group v-if="jobConfig.data_source === 'imageURLs'">
      <el-button @click="handleClick('editUrls')" size="small"  round :type="'success'">
        <Icon icon="lucide:plus" />
      </el-button>
    </el-button-group>
  </el-row>
  <!-- <el-scrollbar
    :max-height="dataPanel.panelTableHeight + 'px'"
    :max-width="dataPanel.value.panelWidth + 'px'"> -->
    <el-table-v2 :columns="tableColumns" :data="tableDataRef" :row-height="40"
      :height="dataPanel.panelTableHeight - 5"
      :width="dataPanel.panelWidth"
      ref="tableRef" fixed :row-class="rowClass" :row-event-handlers="{onClick: handleRowClick}"/>
  <!-- </el-scrollbar>  -->
   <SeqImageUrlsEditor ref="urieditor"></SeqImageUrlsEditor>
</template>

<script lang="tsx" setup generic="T extends object">
import { onMounted, computed, ref, watch, type Ref } from 'vue'
import { Icon } from '@iconify/vue'
import { jobConfig } from '@/states/job-config'
import * as _ from 'radash'
import type { Column, RowClassNameGetter } from 'element-plus'
import { dataSeqState } from '@/states/DataSeqState'
import { commonChannel } from '../../channel'
import { dataPanel } from '@/states/UiState'
import { statisticsApi } from '@/api'
import { userSettings } from '@/states/UserState'
import { Mission } from '@/constants'
import SeqImageUrlsEditor from './seq-image-urls-editor.vue'

const rowClass = ({ rowIndex }: Parameters<RowClassNameGetter<any>>[0]) => {
  if (rowIndex === jobConfig.frame) {
    return 'bg-blue-400'
  }
  return ''
}

// const curRow = computed(() => {
//   return tableDataRef.value[jobConfig.frame]
// })

const viewType = ref('table')
const tableDataRef = ref([])
const urieditor = ref()

// 创建动态列宽的 columns
const createColumns = (widths: { id: number; objectCount: number; name: number; uri: number; timestamp: number }): Column<any>[] => [
  {
    title: 'No.',
    key: 'id',
    dataKey: 'id',
    width: widths.id
  },
  {
    title: 'Count',
    key: 'objectCount',
    dataKey: 'objectCount',
    width: widths.objectCount
  },
  {
    title: '',
    key: 'name',
    dataKey: 'name',
    width: widths.name
  },
  {
    title: 'URI',
    key: 'uri',
    dataKey: 'uri',
    width: widths.uri
  },
  {
    title: '时间戳',
    key: 'timestamp',
    dataKey: 'timestamp',
    width: widths.timestamp
  },
]

const baseWidths = { id: 50, objectCount: 60, name: 100, uri: 120, timestamp: 100 }
const tableColumns = ref<Column<any>[]>(createColumns(baseWidths))

const updateColWidth = () => {
  const panelW = dataPanel.value.panelWidth || 300
  const total = Object.values(baseWidths).reduce((a, b) => a + b, 0)
  const ratio = Math.max(1, panelW / total)
  const widths = {
    id: Math.max(50, Math.floor(baseWidths.id * ratio)),
    objectCount: Math.max(50, Math.floor(baseWidths.objectCount * ratio)),
    name: Math.max(80, Math.floor(baseWidths.name * ratio)),
    uri: Math.max(80, Math.floor(baseWidths.uri * ratio)),
    timestamp: Math.max(80, Math.floor(baseWidths.timestamp * ratio)),
  }
  tableColumns.value = createColumns(widths)
}

// 监听面板宽度变化
watch(() => dataPanel.value.panelWidth, updateColWidth, { immediate: true })

const handleChangeFrame = (e) => {
  tryJumpFrame(_.toInt(e.currentTarget.value))
}

watch(() => dataSeqState.streamMeta, async (newVal) => {
  onDataReady(newVal.openlabel)
})

const onDataReady = (openlabel: any) => {
  let arr: any[] = []
  Object.entries(openlabel.frames).forEach(([key, streamObj], index) => {
    arr.push({
      id: key,
      timestamp: _.get(streamObj, 'frame_properties.timestamp', ''),
      name: _.get(streamObj, 'frame_properties.name', ''),
      uri: _.get(streamObj, 'frame_properties.uri', ''),
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
  if (userSettings.value.saveBeforeChangeFrame) {
    commonChannel.pub(commonChannel.Events.ButtonClicked, {data: 'save-annotation'})
  }

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

  // 
  // commonChannel.pub(commonChannel.Events.ChangedFrame, {})

  updateObjecCount()
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

const handleClick = (command: string) => {
  switch (command) {
    case 'view:table':
      viewType.value = 'table'
      onDataReady(dataSeqState.streamMeta.openlabel)
      break
    case 'view:image':
      viewType.value = 'image'
      commonChannel.pub(commonChannel.Events.UiImageWaterFall, {cmd: 'open', data: tableDataRef})
      break
    case 'editUrls':
      urieditor.value.open()
      break
    default:
      break
  }
}

commonChannel.sub(commonChannel.Events.UpdateObjectCounts, (msg) => {
  updateObjecCount()
})

const updateObjecCount = () => {
  const params = {
        seq: jobConfig.seq,
        stream: jobConfig.stream,
        frame: jobConfig.frame,
        current_mission: jobConfig.mission,
        statisticsType: 'objTypeCountByFrame',
        uuid:jobConfig.uuid
    }
    statisticsApi.seq(params).then(res => {
      for (let item of Object.values(res.data)) {
        const { frame, objectCount } = item
        tableDataRef.value[frame].objectCount = objectCount + ''
      }
    })
}

onMounted(() => {
  // onDataReady(dataSeqState.streamMeta.openlabel)
})

</script>
<style lang="scss" scoped>

</style>