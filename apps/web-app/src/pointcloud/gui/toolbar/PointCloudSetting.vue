<template>
  <el-tabs v-model="activeTab" type="border-card">
    <el-tab-pane label="点云" name="tab1">
      <!-- <el-form-item label="显示点云">
          <el-switch v-model="glObjectState.layers.pc.visible" />
        </el-form-item> -->
      <el-form label-width="100px">
        <el-form-item label="点大小">
          <el-slider v-model="pcUserSettings.setting.pointSize" show-input :min="0" :max="50" :step="0.5" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-radio-group v-model="pcUserSettings.setting.colorPoints">
            <el-radio label="mono">白色</el-radio>
            <el-radio label="colorMapping">映射：用反射值等字段映射颜色</el-radio>
            <el-radio label="RGB">RGB字段（如果点云中包含该字段）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="pcUserSettings.setting.colorPoints === 'colorMapping'">
          <el-row style="width:100%">
            <el-col :span="6">字段</el-col>
            <el-col :span="18">
              <el-select v-model="pcUserSettings.setting.colorPointsSetting.field" placeholder="Select">
                <el-option key="intensity" label="intensity" value="intensity" />
                <el-option key="x" label="x" value="x" />
                <el-option key="y" label="y" value="y" />
                <el-option key="z" label="z" value="z" />
              </el-select>
            </el-col>
          </el-row>
          <el-row style="width:100%">
            <el-col :span="6">颜色映射</el-col>
            <el-col :span="18">
              <el-select v-model="pcUserSettings.setting.colorPointsSetting.colorMap" placeholder="Select">
                <el-option v-for="item in colorMapOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-col>
          </el-row>
          <el-row style="width:100%">
            <el-col :span="6">显示范围</el-col>
            <el-col :span="18"><el-slider :min="0.0" :max="1.0" :step="0.05"
                v-model="pcUserSettings.setting.colorPointsSetting.range" range :marks="intensityMarks" /></el-col>
          </el-row>
        </el-form-item>
        <el-form-item label="点亮度" v-if="pcUserSettings.setting.colorPoints === 'mono'">
          <el-slider v-model="pcUserSettings.setting.pointBrightness" show-input :min="0" :max="1" :step="0.1" />
        </el-form-item>
      </el-form>
    </el-tab-pane>
    <el-tab-pane label="对象" name="tab2">
      <el-form>
        <el-form-item label="显示对象标签">
          <el-switch v-model="glObjectState.layers.objLabel.visible" />
        </el-form-item>
        <el-form-item label="从文件加载地图">
          <el-switch v-model="glObjectState.layers.map.visible" />
        </el-form-item>
        <el-form-item label="加载3DBox">
          <el-switch v-model="glObjectState.layers.box3d.visible" />
        </el-form-item>
      </el-form>
    </el-tab-pane>
    <el-tab-pane label="辅助" name="tab3">
      <el-form label-width="100px">
        <el-form-item label="显示圆">
          <div v-for="(item, index) in pcUserSettings.setting.circleRanges" :key="index">
            <el-row>圆{{ index }}<el-switch v-model="item.enabled" /></el-row>
            <el-row>半径：<el-input-number v-model="item.radius" :min='0' step:="1" placeholder="输入半径" /></el-row>
          </div>
        </el-form-item>
        <el-form-item label="显示框">
          <div v-for="(item, index) in pcUserSettings.setting.rectRanges" :key="index">
            <el-row>框{{ index }}<el-switch v-model="item.enabled" /></el-row>
            <el-row>x：<el-input-number v-model="item.dims[0]" :min='0.1' step:="1" placeholder="输入长" /></el-row>
            <el-row>y：<el-input-number v-model="item.dims[1]" :min='0.1' step:="1" placeholder="输入宽" /></el-row>
            <el-row>z：<el-input-number v-model="item.dims[2]" :min='0.1' step:="1" placeholder="输入高" /></el-row>
          </div>
        </el-form-item>
        <el-form-item label="显示Grid">
          <el-switch v-model="pcUserSettings.setting.grid.visible" />
        </el-form-item>
      </el-form>
    </el-tab-pane>
  </el-tabs>

</template>
<script lang="tsx" setup>
import { onMounted, watch, reactive, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { pcUserSettings } from '@/pointcloud/states'
import { glObjectState } from '../../states'

const activeTab = ref('tab1')

interface Mark {
  style: CSSProperties
  label: string
}
type Marks = Record<number, Mark | string>
const intensityMarks = reactive<Marks>({
  0: '0',
  0.5: {
    style: {
      color: '#1989FA',
    },
    label: '0.5',
  },
  1: '1',
})

const colorMapOptions = ['flag', 'prism', 'ocean', 'gist_earth', 'terrain',
  'gist_stern', 'gnuplot', 'gnuplot2', 'CMRmap',
  'cubehelix', 'brg', 'gist_rainbow', 'rainbow', 'jet',
  'turbo', 'nipy_spectral', 'gist_ncar']


onMounted(() => {
})

</script>
