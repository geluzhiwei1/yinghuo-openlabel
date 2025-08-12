<template>
    <el-drawer v-model="visible" :size="'50%'" destroy-on-close>
        <template #header>
            <h4>URL列表</h4>
        </template>
        <template #default>
            <el-text>
                编辑URL列表
            </el-text>
            <el-form :loading="loading">
                <el-form-item label="URLs：">
                    <el-input
                        v-model="formData.texts"
                        :autosize="{ minRows: 2, maxRows: 4 }"
                        type="textarea"
                        placeholder="Please input"
                        @blur="() => {
                            formData.urls = formData.texts
                                .split('\n')
                                .map((val) => val.trim())
                                .filter((val) => val.startsWith('http') || val.startsWith('https') || val.startsWith('ftp') || val.startsWith('ftps'))
                            formData.urls = Array.from(new Set(formData.urls))

                            formData.texts = formData.urls.join('\n')
                        }"
                    />
                </el-form-item>
                <el-form-item>
                <el-button type="primary" @click="submit()">
                    保存
                </el-button>
                </el-form-item>
            </el-form>
        </template>
    </el-drawer>
</template>

<script lang="ts" setup>
import { ref, watch, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { ElButton, ElDrawer } from 'element-plus'
import { isEmpty } from 'radash'
import { metaApi } from '@/api'
import { dataSeqState } from '@/states/DataSeqState'
import * as _ from 'radash'

const loading = ref(false)
const visible = ref(false)
const formData = reactive({
    texts: '',
    urls: [] as any[]
})

const submit = () => {
    if (isEmpty(formData.texts)) {
        ElMessage.warning('不允许为空!')
    } else {
        const uuid = dataSeqState.streamMeta?.openlabel.metadata.uuid 
        if (uuid) {
            loading.value = true
            metaApi.updateStreamUrils(uuid, formData.urls).then(() => {
                ElMessage.success('保存成功')
            }).finally(() => {
                loading.value = false
            })
        }
    }
}

const open = () => {
    visible.value = true
    const frames = dataSeqState.streamMeta?.openlabel?.frames
    if (frames) {
        let arr: any[] = []
        Object.entries(frames).forEach(([key, streamObj], index) => {
            arr.push(_.get(streamObj, 'frame_properties.uri', ''))
        })
        formData.texts = arr.join('\n')
    }
}
const close = () => {
    visible.value = false
}

defineExpose({ open, close })

</script>