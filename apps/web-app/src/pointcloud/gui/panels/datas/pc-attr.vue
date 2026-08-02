<template>
    <div class="attr-panel">
        <div class="attr-section">点云 · POINTCLOUD</div>
        <div class="attr-row" v-for="info in pcInfo" :key="info.label">
            <span class="attr-label">{{ info.label }}</span>
            <span class="attr-value">{{ info.value }}</span>
        </div>

        <div class="attr-section">标签 · TAGS</div>
        <div class="attr-row attr-row--wrap">
            <span class="attr-label">Tag</span>
            <div class="attr-value">
                <div class="flow gap-2">
                    <el-tag v-for="tag in dynamicTags" :key="tag" closable :disable-transitions="false"
                        @close="handleClose(tag)">
                        {{ tag }}
                    </el-tag>
                    <el-input v-if="inputVisible" ref="InputRef" v-model="inputValue" class="w-20" size="small"
                        @keyup.enter="handleInputConfirm" @blur="handleInputConfirm" />
                    <el-button v-else class="button-new-tag" size="small" @click="showInput">
                        + Tag
                    </el-button>
                </div>
            </div>
        </div>

        <div class="attr-section">备注 · NOTE</div>
        <el-input v-model="imageDesc" @blur="saveAnno()" style="width: 100%" :rows="5" type="textarea" placeholder="点云描述" />
    </div>
</template>
<script lang="tsx" setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { ElButton, ElInput, ElCol, ElRow, ElMessage } from 'element-plus'
import { labelApi } from '@/api'
import { messages } from '@/states'
import { jobConfig } from '@/states/job-config'
import { isArray } from 'radash'
import { glPcs } from '../../../render/gl-pcs'
import { eventBus } from '@/pointcloud/event/EventBus'

const imageDesc = ref('')
const inputValue = ref('')
const dynamicTags = ref([] as string[])
const inputVisible = ref(false)
const InputRef = ref<InstanceType<typeof ElInput>>()
const userEdited = ref(false)
const pcInfo = ref([] as any[])

const resetFields = () => {
    imageDesc.value = ''
    inputValue.value = ''
    dynamicTags.value = []
}

const handleClose = (tag: string) => {
    dynamicTags.value.splice(dynamicTags.value.indexOf(tag), 1)
    userEdited.value = true
}

const showInput = () => {
    inputVisible.value = true
    nextTick(() => {
        InputRef.value!.input!.focus()
    })
}

const handleInputConfirm = () => {
    if (inputValue.value) {
        dynamicTags.value.push(inputValue.value)
    }
    inputVisible.value = false
    inputValue.value = ''
    userEdited.value = true
}

const saveAnno = async () => {
    if (!userEdited.value) return
    const frame_labels = {
        user_tags: dynamicTags.value,
        desc: imageDesc.value,
    }
    labelApi.frame_save({
            frame_labels,
            jobConfig: jobConfig,
            current_mission: "imageLabel",
        })
        .then((res) => {
            // ElMessage.success(res.statusText)
            ;
        })
        .catch(() => {
            messages.lastException = ''
        })
    userEdited.value = false
}

const loadAnno = async () => {
    const params = {
        seq: jobConfig.seq,
        stream: jobConfig.stream,
        frame: jobConfig.frame,
        current_mission: "imageLabel",
        uuid: jobConfig.uuid,
    }

    labelApi.frame_load(params).then((res) => {
        const rtn = Array.from(res.data.values())
        if (!isArray(rtn) || rtn.length < 1) return
        const anno = rtn[0].frame_labels
        imageDesc.value = anno.desc
        dynamicTags.value = anno.user_tags || []
    })
}

watch(dynamicTags, async () => {
    await saveAnno()
}, {deep: true})


watch(() => jobConfig.frame, () => {
    resetFields()
})

onMounted(() => {
    eventBus.on(eventBus.SeqData.FrameChanged, () => {
        loadAnno()
    })
    eventBus.on(eventBus.PointCloud.MeshBuilded, () => {
        // const pointCount = glPcs.getMesh(jobConfig.stream, jobConfig.ts)?.userData.pcMeta.pointCount
        const header = glPcs.getCurrent(jobConfig.stream, jobConfig.ts)?.pcd?.header
        if (!header) return
        pcInfo.value = [
            {
                label: 'Frame No.',
                value: jobConfig.frame,
                rowspan: 1
            },
            {
                label: '时间戳',
                value: jobConfig.ts,
                rowspan: 1
            },
            {
                label: '格式',
                value: header.data,
                rowspan: 1
            },
            {
                label: '点数',
                value: header.width,
                rowspan: 1
            },
            {
                label: '字段',
                value: header.fields.join(','),
                rowspan: 2
            },
        ]
    })
})

</script>