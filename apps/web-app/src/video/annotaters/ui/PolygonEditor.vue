<template>
  <el-tooltip placement="bottom-start" raw-content :content="formatTooltipContent(toolConf)">
    <!-- 隐藏按钮 -->
    <el-button v-show="false">
      <Icon :icon="toolConf.icon" />
    </el-button>
  </el-tooltip>
  <Draggable v-slot="{ x, y }" class="fixed" :initial-value="{ x: canvaPanel.left_px, y: topBar.height_px + 5 }"
    :storage-key="'yh-vd-tool-pos-' + toolConf.id" storage-type="session" v-show="activated" :handle="dragHandle"
    :resizeable="false" :style="[topDivStyle]">
    <div ref="dragHandle" class="cursor-move">{{ toolConf.name }} (E)</div>
    <div>
      <!-- <el-button-group>
        <el-button @click="toolOptions.funcSetting.func = 'brush';PolygonEditor.instance.onCommand('brush', {})" round size="small"
            :type="toolOptions.funcSetting.func === 'brush' ? 'success' : ''"
            >
            描边(1)<Icon :icon="'tabler:brush'" />
          </el-button>
          <el-button round size="small" :type="toolOptions.funcSetting.func === 'erase' ? 'success' : ''"
            @click="toolOptions.funcSetting.func = 'erase';PolygonEditor.instance.onCommand('erase', {})">
            擦边(2)<Icon :icon="'tabler:brush-off'" />
          </el-button>
      </el-button-group> -->
      <el-button-group>
        <el-button size="small" @click="PolygonEditor.instance.setBrushType('brush')"
          :type="freeDrawOptions.brushType === 'brush' ? 'success' : ''">画刷(1)</el-button>
        <el-button size="small" @click="PolygonEditor.instance.setBrushType('eraser')"
          :type="freeDrawOptions.brushType === 'eraser' ? 'success' : ''">擦除(2)</el-button>
        <el-button size="small" @click="PolygonEditor.instance.setBrushType('')"
          :type="freeDrawOptions.brushType === '' ? 'success' : ''">鼠标(3)</el-button>
      </el-button-group>
      <div v-show="freeDrawOptions.brushType === 'brush'">
        <el-row style="width: 100%">
          <el-col :span="8">大小</el-col>
          <el-col :span="16">
            <el-slider size="small" v-model="freeDrawOptions.brush.width" :min="1" :max="100" />
          </el-col>
        </el-row>
        <el-row style="width: 100%">
          <el-col :span="8">颜色</el-col>
          <el-col :span="16">
            <el-color-picker v-model="freeDrawOptions.brush.color" show-alpha />
          </el-col>
        </el-row>
      </div>
      <div v-show="freeDrawOptions.brushType === 'eraser'">
        <el-row style="width: 100%">
          <el-col :span="8">大小</el-col>
          <el-col :span="16">
            <el-slider size="small" v-model="freeDrawOptions.eraser.width" :min="1" :max="100" />
          </el-col>
        </el-row>
        <el-row style="width: 100%">
          <el-col :span="8">颜色</el-col>
          <el-col :span="16">
            <el-color-picker v-model="freeDrawOptions.eraser.color" />
          </el-col>
        </el-row>
      </div>
      <el-row >
          <ol style="text-align: left;">
            <li>敲击1、2、3键，切换模式</li>
            <li>敲击Space或Enter键，完成</li>
            <li>敲击键盘A/D调整画笔大小</li>
          </ol>
      </el-row>

      <el-button-group>
        <el-button @click="toolOptions.funcSetting.func = 'smooth'" round size="small"
          :type="toolOptions.funcSetting.func === 'smooth' ? 'success' : ''">
          <Icon :icon="'material-symbols-light:line-curve-rounded'" />Smooth
        </el-button>
        <el-button @click="toolOptions.funcSetting.func = 'densify'" round size="small"
          :type="toolOptions.funcSetting.func === 'densify' ? 'success' : ''">
          <Icon :icon="'iconoir:curve-array'" />Densify
        </el-button>
        <el-button @click="toolOptions.funcSetting.func = 'simplify'" round size="small"
          :type="toolOptions.funcSetting.func === 'simplify' ? 'success' : ''">
          <Icon :icon="'la:chart-line'" />Simplify
        </el-button>
      </el-button-group>
      <el-button @click="toolOptions.funcSetting.func = 'remove_repeated'" round size="small"
        :type="toolOptions.funcSetting.func === 'remove_repeated' ? 'success' : ''">
        <Icon :icon="'gis:split-line'" />Remove Repeated Points
      </el-button>
      <div>
        <!-- <el-row class="row">
              <el-col :span="8">{{ toolConf.name }}</el-col>
              <el-col :span="8">快捷键：<el-tag>{{ toolConf.shortcut }}</el-tag></el-col>
              <el-col :span="8" style="text-align: right">
              </el-col>
            </el-row> -->
        <!-- <div v-show="toolOptions.funcSetting.func === 'brush'">
          描边
          <el-row style="width: 100%">
            <el-col :span="6">笔迹粗细</el-col>
            <el-col :span="18">
              <el-slider size="small" v-model="toolOptions.funcSetting.brush.width" show-input :min="1" :max="100" />
            </el-col>
          </el-row>
          <el-row>
            <ol style="text-align: left">
              <li>描绘图形边缘，拖动左键开始描绘</li>
              <li>按Esc键退出</li>
            </ol>
          </el-row>
        </div>
        <div v-show="toolOptions.funcSetting.func === 'erase'">
          擦边
          <el-row style="width: 100%">
            <el-col :span="6">笔迹粗细</el-col>
            <el-col :span="18">
              <el-slider size="small" v-model="toolOptions.funcSetting.erase.width" show-input :min="1" :max="100" />
            </el-col>
          </el-row>
          <ol style="text-align: left">
            <li>擦除图形边缘，拖动左键开始擦除</li>
            <li>按Esc键退出</li>
          </ol>
        </div> -->
        <div v-show="toolOptions.funcSetting.func === 'smooth'">
          平滑
          <el-row style="width: 100%">
            <el-col :span="8">迭代次数</el-col>
            <el-col :span="16">
              <el-slider size="small" v-model="toolOptions.funcSetting.smooth.iters" :min="1" :max="10" />
            </el-col>
          </el-row>
          <el-button @click="btnClick('smooth', {})">确定</el-button>
        </div>
        <div v-show="toolOptions.funcSetting.func === 'simplify'">
          简化曲线
          <el-row class="row" v-show="toolOptions.funcSetting.func === 'simplify'">
            <el-col :span="8">强度</el-col>
            <el-col :span="16"><el-slider size="small" v-model="toolOptions.funcSetting.simplify.epsilon" :min="1"
                :max="100" /></el-col>
          </el-row>
          <el-row class="row" v-show="toolOptions.funcSetting.func === 'simplify'">
            <el-col :span="8">算法</el-col>
            <el-col :span="16">
              <el-select v-model="toolOptions.funcSetting.simplify.algo" placeholder="" size="small">
                <el-option :label="'Ramer–Douglas–Peucker'" :value="'simplify'" />
                <el-option :label="'Visvalingam-Whyatt'" :value="'vw'" />
              </el-select>
            </el-col>
          </el-row>
          <el-button @click="btnClick('simplify', {})">确定</el-button>
        </div>
        <div v-show="toolOptions.funcSetting.func === 'densify'">
          密集化
          <el-row style="width: 100%">
            <el-col :span="8">最大距离</el-col>
            <el-col :span="16">
              <el-slider size="small" v-model="toolOptions.funcSetting.densify.max_distance" show-input :min="1"
                :max="10" :step="'0.5'" />
            </el-col>
          </el-row>
          <ol style="text-align: left">
            <li>值越小，点越密集</li>
          </ol>
          <el-button @click="btnClick('densify', {})">确定</el-button>
        </div>
        <div v-show="toolOptions.funcSetting.func === 'remove_repeated'">
          <ol style="text-align: left">
            <li>移除重复的点</li>
          </ol>
          <el-button
            @click="btnClick('remove_repeated', {})">确定</el-button>
        </div>
      </div>
    </div>
  </Draggable>
</template>
<script lang="tsx" setup>
import { computed, ref } from 'vue'
import { formatTooltipContent, toolButtonClick } from './utils'
import {
  toolOptions,
  toolConf,
  PolygonEditor,
} from '../polygonEditor'
import { ElRow, ElCol, ElButton, ElTooltip, ElPopover, ElForm, ElFormItem } from 'element-plus'
import { Icon } from '@iconify/vue'
import { globalStates } from '@/states'
import { toolSettingLayer, canvaPanel, topBar } from '@/states/UiState'
import { UseDraggable as Draggable } from '@/components/DraggableResizeableComponents'
import { freeDrawOptions } from '@/libs/free-draw'

const topDivStyle = ref({
  width: toolSettingLayer.width_px + 'px',
  zIndex: 1000,
  boxShadow: `var(--el-box-shadow-lighter)`
})
const dragHandle = ref<HTMLElement | null>(null)
const activated = computed(() => {
  return globalStates.subTool === toolConf.id
})
const btnClick = (cmd: string, data) => {
  // buttonLoading.value = true
  PolygonEditor.instance.onCommand(cmd, data)
  // buttonLoading.value = false
}
</script>
<style lang="css" scoped>
.row {
  width: 100%;
  text-align: center;
  align-items: center;
}
</style>
