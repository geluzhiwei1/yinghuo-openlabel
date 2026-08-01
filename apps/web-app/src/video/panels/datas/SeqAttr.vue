<template>
  <div class="attr-panel">
    <div class="attr-section">序列 · SEQ</div>
    <div class="attr-row">
      <span class="attr-label">序列</span>
      <span class="attr-value">{{ jobConfig.seq }} · {{ jobConfig.stream }}</span>
    </div>
    <div class="attr-row">
      <span class="attr-label">总帧数</span>
      <span class="attr-value">{{ dataSeqState.tsToFrame.size }}</span>
    </div>

    <template v-if="taxonomyState.seqAnnoSchema">
      <div class="attr-section">扩展属性 · ATTRS</div>
      <el-row style="width: 100%">
        <VueForm
          label-width="auto"
          v-model="seqAnnoForm"
          :schema="taxonomyState.seqAnnoSchema.schema"
          :formProps="{ labelPosition: 'top', layoutColumn: 1 }"
          :formFooter="{ show: false }"
          size="small"
        />
      </el-row>
    </template>

    <div class="attr-section">标签 · TAGS</div>
    <div class="attr-row attr-row--wrap">
      <span class="attr-label">Tag</span>
      <div class="attr-value">
        <div class="flow gap-2">
          <el-tag
            v-for="tag in dynamicTags"
            :key="tag"
            closable
            :disable-transitions="false"
            @close="handleClose(tag)"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-if="inputVisible"
            ref="InputRef"
            v-model="inputValue"
            class="w-20"
            size="small"
            @keyup.enter="handleInputConfirm"
            @blur="handleInputConfirm"
          />
          <el-button v-else class="button-new-tag" size="small" @click="showInput">
            + New Tag
          </el-button>
        </div>
      </div>
    </div>

    <div class="attr-section">备注 · NOTE</div>
    <el-input
      v-model="seqDesc"
      style="width: 100%"
      :rows="5"
      type="textarea"
      placeholder="备注"
    />

    <div style="margin-top: 12px;">
      <el-button :loading="loading" type="primary" @click="submitForm()" style="width: 100%;">
        保存 · SAVE
      </el-button>
    </div>
  </div>
</template>
<script lang="tsx" setup>
import { nextTick, ref, watch, onMounted } from 'vue'
import { ElButton, ElInput, ElCol, ElRow, ElMessage } from 'element-plus'
import { labelApi } from '@/api'
import { messages } from '@/states'
import { jobConfig } from '@/states/job-config'
import { isArray } from 'radash'
import { dataSeqState } from '@/states/DataSeqState'
import VueForm from '@lljj/vue3-form-element'
import { taxonomyState } from '@/states/TaxonomyState'
import { commonChannel } from '@/video/channel'

const seqDesc = ref('')
const imageSize = ref('')
const inputValue = ref('')
const dynamicTags = ref([] as string[])
const inputVisible = ref(false)
const InputRef = ref<InstanceType<typeof ElInput>>()
const userEdited = ref(false)
const loading = ref(false)

const annoFormData = ref()
const seqAnnoForm = ref()
const annoUISchema = {
  schema: {
    type: 'object',
    required: ['framesAnno'],
    'ui:order': ['*'],
    definitions: {
      framesAnno: {
        type: 'object',
        properties: {
          framesRange: {
            title: '帧范围',
            type: 'string',
            default: ''
          },
          annoText: {
            title: 'annoText',
            type: 'string',
            default: ''
          }
        }
      }
    },
    properties: {
      framesAnno: {
        type: 'array',
        title: '帧标注',
        items: {
          $ref: '#/definitions/framesAnno'
        },
        'ui:options': {
          showIndexNumber: true
        }
      }
    }
  }
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
  const frame_labels = {
    seqAnno: seqAnnoForm.value,
    framesAnno: annoFormData.value,
    user_tags: dynamicTags.value,
    desc: seqDesc.value
  }
  labelApi
    .seq_save({
      frame_labels,
      jobConfig: jobConfig,
      current_mission: 'seqLabel'
    })
    .then((res) => {
      ElMessage.success("保存成功!")
    })
    .catch(() => {
      messages.lastException = ''
    })
  userEdited.value = false
}


const resetFields = () => {
  seqDesc.value = ""
  dynamicTags.value = []
  annoFormData.value = []
  seqAnnoForm.value = {}
}

const loadAnno = async () => {

  resetFields()

  const params = {
    ...jobConfig,
    current_mission: 'seqLabel',
  }

  labelApi.seq_load(params).then((res) => {
    const rtn = Array.from(res.data.values())
    if (!isArray(rtn) || rtn.length < 1) return
    const anno = rtn[0].frame_labels
    seqDesc.value = anno.desc
    dynamicTags.value = anno.user_tags || []
    annoFormData.value = anno.framesAnno || []
    seqAnnoForm.value = anno.seqAnno || {}
  })
}

const submitForm = () => {
    // 提交数据
    loading.value = true

    saveAnno().finally(() => {
      loading.value = false
    })
}

commonChannel.sub(commonChannel.Events.VideoLoaded, async (msg:any) => {
      if (msg.state) {
          await loadAnno()
      }
  })

onMounted(() => {
  loadAnno()
})

</script>
