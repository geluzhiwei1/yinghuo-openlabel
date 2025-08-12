<template>
  <el-dialog style="width: 800px" :title="dialogTitle" v-model="dialogVisible">
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      v-loading="formLoading"
      label-position="right"
      label-width="auto"
      style="max-width: 500px"
    >
      <el-form-item label="选择数据段" prop="data_clip_id">
        <el-select
          v-model="form.label_spec.data.seq"
          collapse-tags
          collapse-tags-tooltip
          placeholder="Select"
        >
          <el-option
            v-for="item in dataClipIds"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <!-- <el-form-item label="选择数据" prop="streams">
        <el-select
          v-model="form.label_spec.data.streams"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="Select"
          style="width: 240px"
        >
          <el-option
            v-for="item in seqStreams"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item> -->

      <el-form-item label="选择领域" prop="domain">
        <el-select
          v-model="form.label_spec.domain.key"
          collapse-tags
          collapse-tags-tooltip
          placeholder="Select"
        >
          <el-option
            v-for="item in domains"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="选择任务" prop="mission">
        <el-select
          v-model="form.label_spec.mission.key"
          collapse-tags
          collapse-tags-tooltip
          placeholder="Select"
        >
          <el-option
            v-for="item in missions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="标注规范" prop="taxonomy_key">
        <TaxonomySelectTable v-model:data="form.label_spec.taxonomy.key" />
      </el-form-item>
      <el-form-item label="优先级" prop="priority">
        <PrioritySelect v-model:modelValue="form.priority" />
      </el-form-item>
      <el-form-item label="备注" prop="priority">
        <el-input
          v-model="form.desc"
          maxlength="1024"
          style="width: 100%"
          placeholder="Please input"
          show-word-limit
          type="textarea"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="submitForm(formRef)" type="primary" :disabled="formLoading"
          >确定</el-button
        >
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button @click="resetForm()">重置</el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElButton, ElForm, ElFormItem, ElSelect, ElOption, ElDialog, ElInput } from 'element-plus'
import { annoJobPerformApi } from '@ui-common/api'
import TaxonomySelectTable from './TaxonomySelectTable.vue'
import PrioritySelect from '@ui-common/components/PrioritySelect.vue'
import { messages } from '@/states'
// import { useMessage } from '@ui-lib/hooks/web/useMessage'

// const { t } = useI18n()
// const message = useMessage()

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formRef = ref() // 表单 Ref

const seqStreams = ref<any[]>([])
const dataClipIds = ref<any[]>([])
const domains = ref<any[]>([
  { value: 'common-object', label: '通用目标（coco等)' },
  { value: 'intelligent-driving', label: '智能驾驶' },
  { value: 'industrial-robot', label: '工业机器人' },
  { value: 'human-robot', label: '人形机器人' },
  { value: 'medical-image', label: 'Medical Image' }
])
const missions = ref<any[]>([
  { value: 'objectDet2d', label: '目标检测' },
  { value: 'semantic2d', label: '语义分割' }
  // { value: 'trafficLine2d', label: '交通标线' },
  // { value: 'parkingSlot2d', label: '停车场/车位' },
  // { value: 'trafficSignal2d', label: '信号灯' },
  // { value: 'trafficSign2d', label: '交通标识' },
])

const rules = ref({
  batch_key: [{ required: true, message: '选择标注批次', min: 1 }],
  dataFormat: [{ required: true, message: '选择数据格式' }],
  'serverLocalDir.dataDir': [
    {
      validator: (rule, value, callback) => {
        if ('serverLocalDir' === form.value.dataSource) {
          // serverLocalDir时，dataDir不可以为空
          if (value) {
            callback()
          } else {
            callback(new Error('目录不可以为空。'))
          }
        } else {
          callback()
        }
      },
      triggle: 'blur'
    },
    { min: 1, max: 1024, message: '长度为1-1024', triggle: 'blur' }
  ]
})

const formDefault = {
  id: 0,
  data_clip_id: 0,
  auto_job_id: 0,
  type: 0,
  taxonomy_key: '',
  priority: 1,
  version: '1.0.0',
  name: 'demo-data-1-objectDet2d',
  desc: 'demo job',
  label_spec: {
    domain: { key: 'intelligent-driving' },
    mission: { key: 'objectDet2d' },
    taxonomy: { key: 'road_objects_simple_1.0.0_zh-CN' },
    data: {
      format: 'simple-directory',
      root_dir: 'xxx',
      seq: 'demo-data-1',
      streams: [],
      clip_key: ''
    }
  }
}
const form = ref({ ...formDefault })

const open = async (type: string, params) => {
  const { id } = params

  dialogVisible.value = true
  dialogTitle.value = 'action.' + type
  formType.value = type
  if (id) {
    // 当前为修改状态
    formLoading.value = true
    try {
      const { data } = await annoJobPerformApi.query({
        uuid: id
      })
      form.value = data
    } finally {
      formLoading.value = false
    }
  }
}

const emit = defineEmits(['success'])
const submitForm = async (formEl) => {
  if (!formEl) return
  await formEl.validate(async (valid) => {
    if (valid) {
      // 设置name
      form.value.name = form.value.label_spec.data.seq + '-' + form.value.label_spec.mission.key
      formLoading.value = true
      try {
        if (formType.value === 'create') {
          await annoJobPerformApi.create(form.value)
          messages.lastSuccess = t('common.createSuccess')
        } else {
          await annoJobPerformApi.update(form.value)
          messages.lastSuccess = t('common.updateSuccess')
        }
        dialogVisible.value = false
        // 发送操作成功的事件
        emit('success')
      } finally {
        formLoading.value = false
      }
    } else {
      // do nothing
    }
  })
}
const resetForm = () => {
  form.value = formDefault
}

const loadDataClipIds = async () => {
  // TODO
  dataClipIds.value = [
    { label: 'demo-data-1', value: 0 },
    { label: 'demo-data-2', value: 1 }
  ]
}
const loadStreams = async () => {
  // TODO
  seqStreams.value = [
    { label: 'back_cam', value: 0 },
    { label: 'front_cam', value: 1 }
  ]
}
watch(
  () => form.value.data_clip_id,
  (newVal, oldVal) => {
    if (newVal === oldVal) {
      return
    }
    loadStreams().then(() => {
      form.value.label_spec.data.streams = []
    })
  }
)

const loadData = () => {
  Promise.all([loadDataClipIds()]).catch((error) => {
    messages.lastException = `异常${error.message}`
  })
}

onMounted(() => {
  loadData()
})

defineExpose({ open })
</script>
