<template>
    <div id="box-float-view" v-show="visible">
        <el-row>
            <el-col :span="2">
                地面
            </el-col>
            <el-col :span="22">
                法向量xyz
                <el-input v-model="settingForm.plane.normal.x" style="width: 80px;">
                </el-input>
                <el-input v-model="settingForm.plane.normal.y" style="width: 80px;">
                </el-input>
                <el-input v-model="settingForm.plane.normal.z" style="width: 80px;">
                </el-input>
                常数项<el-input v-model="settingForm.plane.constant" style="width: 80px;">
                </el-input>
                <el-checkbox v-model="settingForm.plane.visible" label="显示" />
                颜色<el-color-picker v-model="settingForm.plane.color" />
            </el-col>
        </el-row>
        <el-row>
            <el-col :span="2">
                高亮点
            </el-col>
            <el-col :span="22">
                <el-select v-model="settingForm.highlight.coordinateSystem" style="width: 100px;" placeholder="坐标">
                    <el-option label="世界坐标" value="world" />
                    <el-option label="本地坐标" value="local" />
                </el-select>
                点坐标
                <el-input v-model="settingForm.highlight.currentPoint.x" style="width: 80px;">
                </el-input>
                <el-input v-model="settingForm.highlight.currentPoint.y" style="width: 80px;">
                </el-input>
                <el-input v-model="settingForm.highlight.currentPoint.z" style="width: 80px;">
                </el-input>
                <el-button>选择</el-button>
            </el-col>
        </el-row>
        <el-row>
            <el-col :span="2">
            </el-col>
            <el-col :span="22">
                <el-checkbox v-model="settingForm.highlight.toPlane" label="贴近地面" />
                <el-input v-model="settingForm.highlight.threshold" style="width: 150px;">
                    <template #prepend>threshold</template>
                </el-input>
                <el-input v-model="settingForm.highlight.pointCount" style="width: 150px;">
                    <template #prepend>count</template>
                </el-input>
                <el-color-picker v-model="settingForm.highlight.color" />
            </el-col>
        </el-row>
        <el-row>
            <el-col :span="2">
                当前点
            </el-col>
            <el-col :span="22">
                <el-select v-model="settingForm.highlight.coordinateSystem" style="width: 100px;" placeholder="坐标">
                    <el-option label="世界坐标" value="world" />
                    <el-option label="本地坐标" value="local" />
                </el-select>
                <el-input v-model="settingForm.selected.point.x" style="width: 80px;">
                </el-input>
                <el-input v-model="settingForm.selected.point.y" style="width: 80px;">
                </el-input>
                <el-input v-model="settingForm.selected.point.z" style="width: 80px;">
                </el-input>
                <el-button>删除</el-button>
            </el-col>
        </el-row>
        <el-row class="justify-center">
            <el-button-group>
                <el-button>恢复默认值</el-button>
                
            </el-button-group>
        </el-row>
    </div>
</template>
  
<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import * as THREE from 'three'
import { eventBus } from '../../event/EventBus'


const visible = ref(true)

const settingForm = ref({
    plane: {
        normal: {
            x: 0,
            y: 0,
            z: 0,
        },
        normalStr: '',
        constant: 0,
        visible: false,
        color: '#ff0000',
    },
    highlight: {
        toPlane: true,
        color: '#ff0000',
        threshold: 0.1,
        pointCount: 1,
        coordinateSystem: 'local',
        currentPoint: {
            x: 0,
            y: 0,
            z: 0,
        }
    },
    selected: {
        coordinateSystem: 'local',
        point: {
            x: 0,
            y: 0,
            z: 0,
        }
    }
})
let settingFormDefault = {}
const inputSize = ref('small')

eventBus.on(eventBus.ToolBar.Command, async (params) => {
    // if (!params) {
    //     visible.value = false
    //     return
    // }
    const { toolName, command } = params
    if (toolName !== 'pointTool') {
        return
    }

    switch (command) {
        case 'activate':
            visible.value = true
            break
        case 'deactivate':
            visible.value = false
            break
        default:
            break
    }
})

onMounted(() => {
    // copy default value
    settingFormDefault = { ...settingForm.value }
})

</script>