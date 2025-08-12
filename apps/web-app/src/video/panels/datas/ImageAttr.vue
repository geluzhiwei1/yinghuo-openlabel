<template>
    <div>
        <el-row style="width: 100%">
            <el-col :span="8">No.</el-col>
            <el-col :span="16" style="text-align:left;"> {{ jobConfig.frame }}
            </el-col>
        </el-row>
        <el-row style="width: 100%">
            <el-col :span="8">ID.</el-col>
            <el-col :span="16" style="text-align:left;"> {{ jobConfig.frame }}
            </el-col>
        </el-row>
        <el-row style="width: 100%">
            <el-col :span="8">分辨率</el-col>
            <el-col :span="16" style="text-align:left;">{{ imageSize }}
            </el-col>
        </el-row>
        <el-row style="width: 100%">
            <el-col :span="8">Tags</el-col>
            <el-col :span="16" style="text-align:left;">
                <div class="flow gap-2">
                    <el-tag v-for="tag in dynamicTags" :key="tag" closable :disable-transitions="false"
                        @close="handleClose(tag)">
                        {{ tag }}
                    </el-tag>
                    <el-input v-if="inputVisible" ref="InputRef" v-model="inputValue" class="w-20" size="small"
                        @keyup.enter="handleInputConfirm" @blur="handleInputConfirm" />
                    <el-button v-else class="button-new-tag" size="small" @click="showInput">
                        + New Tag
                    </el-button>
                </div>
            </el-col>
        </el-row>
        <el-row style="width: 100%">
            <el-input v-model="imageDesc" @blur="saveAnno()" style="width: 100%" :rows="5" type="textarea" placeholder="图像描述" />
        </el-row>
    </div>

</template>
<script lang="tsx" setup>
import { nextTick, ref, watch } from 'vue'
import { ElButton, ElInput, ElCol, ElRow, ElMessage } from 'element-plus'
import { labelApi } from '@/api'
import { globalStates, messages } from '@/states'
import { jobConfig } from '@/states/job-config'
import { commonChannel } from '@/video/channel'
import { isArray } from 'radash'

const imageDesc = ref('')
const imageSize = ref('')
const inputValue = ref('')
const dynamicTags = ref([] as string[])
const inputVisible = ref(false)
const InputRef = ref<InstanceType<typeof ElInput>>()
const userEdited = ref(false)

const resetFields = () => {
    imageDesc.value = ''
    imageSize.value = ''
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
            ElMessage.success(res.statusText)
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

commonChannel.sub(commonChannel.Events.ImageLoaded, async (msg:any) => {
    if (msg.state) {
        await loadAnno()
        const {width, height} = globalStates.toolsets!.get('imageCanvas').imageSize()
        imageSize.value = `${width} x ${height}`
    }
})

watch(() => jobConfig.frame, () => {
    resetFields()
})

</script>