<template>
  <div id="attrPanelContainer">
    <el-row :style="{height: dataPanel.panelBarHeight + 'px'}">
      <el-button-group>
        <el-button size="default" @click="tabRef = 'view:seq'" :type="tabRef === 'view:seq'?'success':''">{{ $t('video.attrpanel.sequence') }}</el-button>
        <el-button size="default" @click="tabRef = 'view:image'" :type="tabRef === 'view:image'?'success':''" :disabled="jobConfig.mission === Mission.VideoEvents">{{ $t('video.attrpanel.image') }}</el-button>
        <el-button size="default" @click="tabRef = 'view:objet'" :type="tabRef === 'view:objet'?'success':''">{{ $t('video.attrpanel.object') }}</el-button>
      </el-button-group>
    </el-row>
    <el-row>
      <el-col :span="24">
        <el-scrollbar>
          <div style="padding-left: 5px; padding-right: 5px;" :style="{height: (dataPanel.panelHeight - dataPanel.panelBarHeight) + 'px'}">
            <!-- <AnnoToolAttr :toolName="globalStates.mainTool" :subToolName="globalStates.subTool" v-if="tabRef === 'view:objet'"></AnnoToolAttr> -->
             <div v-if="tabRef === 'view:objet'">
              <PolygonToolAttr v-if="currentGeometryType === OlTypeEnum.Poly2d || currentGeometryType === OlTypeEnum.Mask2dBase64"/>
              <RectAttributes v-else-if="(currentGeometryType === OlTypeEnum.BBox) || (currentGeometryType === OlTypeEnum.RBBox)"></RectAttributes>
              <VideoEventAttributes v-else-if="(currentGeometryType === 'Event') || (currentGeometryType === 'Action') || (currentGeometryType === 'Context')"></VideoEventAttributes>
             </div>
            <ImageAttr v-if="tabRef === 'view:image'"/>
            <SeqAttr v-if="tabRef === 'view:seq'"/>
          </div>
        </el-scrollbar>
      </el-col>
    </el-row>
  </div>
</template>

<script lang="tsx" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElScrollbar } from 'element-plus'
import { globalStates } from '@/states'
import SeqAttr from './datas/SeqAttr.vue'
import { dataPanel } from '@/states/UiState'
import { OlTypeEnum } from '@/openlabel'
import { Mission } from '@/constants'
import { jobConfig } from '@/states/job-config'
import PolygonToolAttr from '../panels/annos/PolygonToolAttrInfo.vue'
import RectAttributes from '../panels/annos/RectAttributes.vue'
import VideoEventAttributes from './annos/video-event-attributes.vue'
import ImageAttr from './datas/ImageAttr.vue'

const tabRef = ref('view:objet')

const currentGeometryType = computed(() => {
  return globalStates.mainAnnoater.getSelectedObject?.()?.userData.anno?.ol_type_
})

watch(currentGeometryType, () => {
  tabRef.value = 'view:objet'
})

</script>
<style lang="scss" scoped>

</style>
