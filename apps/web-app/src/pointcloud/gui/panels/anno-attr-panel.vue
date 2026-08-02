<template>
  <div id="attrPanelContainer">
    <el-row :style="{height: dataPanel.panelBarHeight + 'px'}">
      <el-button-group class="panel-tabs">
        <el-button size="default" @click="tabRef = 'view:seq'" :type="tabRef === 'view:seq'?'primary':''">序列属性</el-button>
        <el-button size="default" @click="tabRef = 'view:image'" :type="tabRef === 'view:image'?'primary':''">点云属性</el-button>
        <el-button size="default" @click="tabRef = 'view:objet'" :type="tabRef === 'view:objet'?'primary':''">目标属性</el-button>
      </el-button-group>
    </el-row>
    <el-row>
      <el-col :span="24">
        <el-scrollbar>
          <div class="attr-panel-scroll" :style="{height: (dataPanel.panelHeight - dataPanel.panelBarHeight) + 'px'}">
             <div v-show="tabRef === 'view:objet'">
              <Object3DAttr v-if="mainAnnoStates.selected && mainAnnoStates.selected.ol_type_ === OlTypeEnum.BBox3d"/>
              <Polyline3DAttr v-else-if="mainAnnoStates.selected && mainAnnoStates.selected.ol_type_ === OlTypeEnum.Polyline3d"/>
              <Point3DAttr v-else-if="mainAnnoStates.selected && mainAnnoStates.selected.ol_type_ === OlTypeEnum.Point3d"/>
              <div v-else>未选择</div>
             </div>
            <PcAttr v-show="tabRef === 'view:image'"/>
            <SeqAttr v-show="tabRef === 'view:seq'"/>
          </div>
        </el-scrollbar>
      </el-col>
    </el-row>
  </div>
</template>

<script lang="tsx" setup>
// import { layer } from 'vue3-layer'
import { onUnmounted, ref, watch } from 'vue'
import { ElScrollbar } from 'element-plus'
import Object3DAttr from './annos/object3d-attributes.vue'
import Polyline3DAttr from './annos/polyline3d-attributes.vue'
import Point3DAttr from './annos/point3d-attributes.vue'
import PcAttr from './datas/pc-attr.vue'
import { dataPanel } from '@/states/UiState'
import { OlTypeEnum } from '@/openlabel'
import { mainAnnoStates } from '../../states'
import SeqAttr from './datas/seq-attr.vue'

const tabRef = ref('view:objet')

</script>
<style lang="scss" scoped>
.attr-panel-scroll {
  padding: 0 8px;
}
</style>
