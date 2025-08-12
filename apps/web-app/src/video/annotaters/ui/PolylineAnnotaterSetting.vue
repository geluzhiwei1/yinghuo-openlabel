<template>
  <el-popover placement="bottom" width="450" trigger="hover">
    <template #reference>
    <el-button :type="activated ? 'success' : 'primary'" :style="toolBarConf.style"
      @click="toolButtonClick(toolBarConf.id)">
      <Icon :icon="toolBarConf.icon" />
    </el-button>
  </template>
    <div>
      <el-tabs v-model="activePane">
        <el-tab-pane label="样式" name="commonTool"><VueForm id="propertyForm" ref="propertyForm" label-width="auto"
            :formProps="{ labelPosition: 'right', layoutColumn: 1 }" v-model="polylineAnnotaterSetting.formData1"
            :schema="settingUISchema.schema" :formFooter="{ show: false }" />
          </el-tab-pane>
          <el-tab-pane label="显示" name="commonUi">
            <VueForm size="small" label-width="auto" 
                v-model="commonAnnotaterSetting.settingFormData" :schema="commonUi.schema"
                :formProps="{ labelPosition: 'left', layoutColumn: 1 }" :formFooter="{ show: false }" />
          </el-tab-pane>
      </el-tabs>
    </div>
  </el-popover>
  <Teleport to="#imageAnnoContainer">
    <div v-show="hotBarOptions.visible" :style="[hotBarOptions.style]" style="z-index: 99;">
      <el-button-group>
        <el-tooltip placement="top" effect="dark" raw-content content="拷贝本对象到上一帧">
          <el-button round size="small" type="primary" @click="hotbtnClick('copyToLast', {})">
            &lt;拷贝
          </el-button>
        </el-tooltip>
        <el-tooltip placement="top" effect="dark" raw-content content="拷贝本对象到下一帧">
          <el-button round size="small" type="primary" @click="hotbtnClick('copyToNext', {})">
            拷贝&gt;
          </el-button>
        </el-tooltip>
        <!-- <el-tooltip placement="top" effect="dark" raw-content content="编辑曲线">
          <el-button round size="small" type="primary" @click="hotbtnClick('polygonEdit', {})">
            编辑
          </el-button>
        </el-tooltip> -->
        <!-- <el-popover :width="500">
          <template #reference> -->
            <el-button v-show="hotBarOptions.polygonEditBtn.visible" round size="small" type="primary" @click="hotbtnClick('polygonEdit', {})">
              编辑
            </el-button>
            <el-button v-show="hotBarOptions.maskEditBtn.visible" round size="small" type="primary" @click="hotbtnClick('maskEdit', {})">
              编辑
            </el-button>
        <el-tooltip placement="top" effect="dark" raw-content content="删除选中的对象">
          <el-button round size="small" type="primary" @click="hotbtnClick('remove', {})">
            删除
          </el-button>
        </el-tooltip>
        <el-dropdown @command="handleCommand">
          <el-button size="small" type="primary">
            ...
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit2" :disabled="!hotBarOptions.pointsEditBtn.enabled">编辑（点）</el-dropdown-item>
              <el-dropdown-item command="interpolate">插值</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-button-group>
    </div>
  </Teleport>
</template>
<script lang="tsx" setup>
import { ref, computed, watch, toRef } from 'vue'
import { globalStates } from '@/states'
import { formatTooltipContent, toolButtonClick } from './utils'
import VueForm from '@lljj/vue3-form-element'
import { Icon } from '@iconify/vue'
import { PolylineAnnotater, toolBarConf, polylineAnnotaterSetting, settingUISchema, hotBarOptions } from '../polylineAnnotater'
import { toolOptions, toolConf, PolygonEditor } from '../polygonEditor'
import { commonAnnotaterSetting, settingUISchema as commonUi } from '../common-annotater-settings'
import { InpterpolateObject, toolStates as interpolateObjectStates } from '../../../tools/inpterpolate-object'
import { jobConfig } from '@/states/job-config'

const activePane = ref('commonUi')

const handleCommand = (command: string | number | object) => {
  switch (command) {
    case 'edit2':
        hotbtnClick('edit2', {})
        break
    case 'interpolate':
      inpterClick()
      break
    default:
      break
  }
}

// const hotBarVisible = toRef(hotPolyBarOptions.visible)
const activated = computed(() => {
  return globalStates.subTool === toolBarConf.id
})

const inpterClick = () => {
  const obj = {
    ...globalStates.mainAnnoater.getSelectedObject().userData.anno
  }
  delete obj.attributes.__oldObj
  InpterpolateObject.instance().addGeometryAndActivate(obj, jobConfig.frame)
}

const btnClick = (cmd: string) => {
  globalStates.subTool = PolygonEditor.name
  // toolOptions.funcSetting.func = cmd
  // if (cmd === 'erase' || cmd === 'brush') {
  //   PolygonEditor.instance.onCommand(cmd, {})
  // }
}

const hotbtnClick = (cmd: string, data) => {
  switch (cmd) {
    case 'copyToLast':
    case 'copyToNext':
      PolylineAnnotater.instance.copyTo(cmd)
      break
    case 'remove':
      globalStates.mainAnnoater.removeSelected()
      break
    case 'polygonEdit':
      toolButtonClick('polygonEditor')
      break
    case 'maskEdit':
      toolButtonClick('maskBrush')
      break
    case 'edit2':
      PolylineAnnotater.instance.editCurrentObject()
      break
    default:
      break
  }
}

// watch([() => PolygonEditor.instance?.activated, 
//     () => hotPolyBarOptions.enabled, 
//     () => hotPolyBarOptions.visible], () => {
//   hotBarVisible.value = PolygonEditor.instance?.activated && hotPolyBarOptions.enabled && hotPolyBarOptions.visible
// })

</script>