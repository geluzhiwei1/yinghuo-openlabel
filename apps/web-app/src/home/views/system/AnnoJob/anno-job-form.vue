<template>
  <el-drawer v-model="dialogVisible" :size="'70%'" :destroy-on-close="true">
    <template #header>
      <h4>{{ dialogTitle }}</h4>
    </template>
    <template #default>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        v-loading="formLoading"
        label-position="right"
        label-width="auto"
        style="max-width: 600px"
      >
        <el-form-item label="数据源">
          <el-row>
            <el-radio-group
              v-model="form.label_spec.data.dataSource"
              @change="handleDataSourceChange"
              :disabled="formType === 'edit'"
            >
              <el-radio value="localImage">我的计算机</el-radio>
              <el-radio value="imageURLs">互联网图像(HTTP)</el-radio>
              <el-radio value="serverLocalDir">服务器</el-radio>
            </el-radio-group>
          </el-row>
          <el-row v-show="form.label_spec.data.dataSource === 'localImage'">
            <el-text type="success"
              >选择存储在您本地计算机上的数据文件，这些数据文件<span style="color: red"
                >不会上传</span
              ></el-text
            >
          </el-row>
          <el-row v-show="form.label_spec.data.dataSource === 'imageURLs'">
            <el-text type="success">数据可以通过HTTP直接访问到，可存在任意服务器</el-text>
          </el-row>
          <el-row v-show="form.label_spec.data.dataSource === 'serverLocalDir'">
            <el-text type="success">数据存储在官方服务器，适合大批量数据</el-text>
          </el-row>
        </el-form-item>
        <el-form-item label="任务类别" prop="label_spec.mission.key">
          <el-row style="width: 100%">
            <el-col :span="24">
              <el-tree-select
                v-model="form.label_spec.mission.key"
                :data="missions"
                :check-strictly="false"
                :render-after-expand="false"
                check-on-click-node
                show-checkbox
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item
          label="选择数据"
          v-if="form.label_spec.data.dataSource === 'serverLocalDir'"
          prop="serverLocalDir"
        >
          <el-row style="width: 100%">
            <el-col :span="6">数据根目录：</el-col>
            <el-col :span="18">
              <el-tree-select
                v-model="form.label_spec.data.seq"
                :data="dataClipIds"
                :render-after-expand="false"
                check-strictly
                show-checkbox
                @change="handleSeqTreeSelectChange"
              />
            </el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="6">数据分组：</el-col>
            <el-col :span="18">
              <el-select
                v-model="form.label_spec.data.streams"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="Select"
              >
                <el-option
                  v-for="item in seqStreams"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="6">数据格式：</el-col>
            <el-col :span="18">
              <el-select v-model="form.label_spec.data.format" placeholder="数据格式">
                <el-option
                  v-for="item in dataFormats"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-col>
          </el-row>
          <!-- <el-row style="width: 100%">
            <el-col :span="6">文件过滤：</el-col>
            <el-col :span="18">
              <el-select v-if="form.label_spec.mission.key.endsWith('3d')" v-model="form.label_spec.data.file_exts" placeholder="文件扩展名" multiple collapse-tags collapse-tags-tooltip>
                <el-option label=".pcd" value=".pcd" selected/>
              </el-select>
              <el-select v-else v-model="form.label_spec.data.file_exts" placeholder="文件扩展名" multiple collapse-tags collapse-tags-tooltip>
                <el-option label=".png" value=".png" selected/>
                <el-option label=".jpg" value=".jpg" selected/>
              </el-select>
            </el-col>
          </el-row> -->
        </el-form-item>
        <el-form-item
          label="填写数据"
          v-if="form.label_spec.data.dataSource === 'imageURLs'"
          prop="imageURLs"
        >
          <el-row style="width: 100%">
            <el-col :span="12"
              ><el-input
                v-model="form.label_spec.data.seq"
                maxlength="100"
                style="width: 100%"
                placeholder="数据段ID,如data-seq1"
            /></el-col>
            <el-col :span="12"
              ><el-input
                v-model="tempForm.streams"
                maxlength="100"
                style="width: 100%"
                placeholder="数据名字,如camera1"
            /></el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="24">输入图像URL，每行一条，必须以http开头</el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="24"
              ><el-input
                v-model="tempForm.imageURLs"
                maxlength="102400"
                style="width: 100%"
                show-word-limit
                type="textarea"
            /></el-col>
          </el-row>
        </el-form-item>
        <el-form-item label="标注规范" prop="label_spec.taxonomy">
          <el-row style="width: 100%">
            <el-col :span="24">
              <TaxonomySelectTable
                v-model:modelValue="form.label_spec.taxonomy"
                :options="{ btnLabel: '选择标注规范', inputVisible: true }"
              />
            </el-col>
          </el-row>
        </el-form-item>

        <el-form-item
          label="任务数据"
          v-if="form.label_spec.data.dataSource === 'localImage'"
          prop="imageURLs"
        >
          <el-row style="width: 100%">
            <el-col :span="24"
              ><el-button @click="openDir()">点击选择数据文件夹</el-button>
            </el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="12"
              ><el-input
                v-model="form.label_spec.data.seq"
                maxlength="100"
                style="width: 100%"
                placeholder="数据段ID,如data-seq1"
            /></el-col>
            <el-col :span="12"
              ><el-input
                v-model="tempForm.streams"
                maxlength="100"
                style="width: 100%"
                placeholder="数据名字,如camera1"
            /></el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="24"
              ><el-input
                v-model="tempForm.imageURLs"
                maxlength="102400"
                style="width: 100%"
                show-word-limit
                type="textarea"
                :rows="5"
            /></el-col>
          </el-row>
        </el-form-item>

        <!-- <el-form-item label="任务分类" prop="label_spec.mission.key">
        <el-row style="width: 100%">
          <el-col :span="24"><el-select v-model="form.label_spec.mission.key" collapse-tags collapse-tags-tooltip
              placeholder="Select">
              <el-option v-for="item in missions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select></el-col>
        </el-row>
      </el-form-item> -->
        <el-form-item label="任务优先级" prop="priority">
          <el-row style="width: 100%">
            <el-col :span="24">
              <PrioritySelect v-model:modelValue="form.priority" />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="备注" prop="desc">
          <el-input
            v-model="form.desc"
            maxlength="10240"
            style="width: 100%"
            placeholder="备注"
            show-word-limit
            type="textarea"
          />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <div style="text-align: center">
        <el-button @click="submitForm(formRef)" type="primary" :disabled="!saveButtonEnable"
          >确定</el-button
        >
        <!-- <el-button @click="dialogVisible = false">取消</el-button> -->
        <el-button @click="resetForm(formRef)">重置</el-button>
      </div>
    </template>
  </el-drawer>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { annoJobPerformApi, dataSeqApi, openlabelApi } from '@/api'
import TaxonomySelectTable from '@/components/AnnoSpecSelector.vue'
import PrioritySelect from '@/components/PrioritySelect.vue'
import { i18n } from '@/locales'
import { AnnoMissons, Mission } from '@/constants'
import { isEmpty, isObject, clone } from 'radash'
import { messages } from '@/states'
import { fileTypes, openFilesFromDir } from '@/states/LocalFiles'
import { ElMessage } from 'element-plus'
import { cloneDeep } from 'lodash'

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formRef = ref() // 表单 Ref
const saveButtonEnable = ref(true) // 保存按钮是否可用

const seqStreams = ref<any[]>([])
const dataClipIds = ref<any[]>([])
const domains = ref<any[]>([])
const missions = AnnoMissons

const tempForm = ref({
  imageURLs: '',
  streams: ''
})

const dataFormats = [
  { label: 'directory', value: 'simple-directory' },
  { label: 'openlabel', value: 'openlabel' }
]

const handleSeqTreeSelectChange = (value, selectedData, selectedNodes) => {
  // console.log(value)
  // // 设置 format 格式
  // form.value.label_spec.data.format = 'openlabel'
  // seqStreams.value = ['b','a']
}

const rules = ref({
  'label_spec.domain.key': [
    { required: true, message: '选择标签行业', trigger: 'blur', type: 'string' }
  ],
  'label_spec.data.seq': [
    { required: true, message: '选择数据根目录', trigger: 'blur', type: 'string' }
  ],
  'label_spec.data.file_exts': [{ required: true, message: '选择文件类型', trigger: 'blur' }],
  'label_spec.taxonomy': [
    {
      trigger: 'blur',
      validator: (rule, value, callback) => {
        if (!form.value.label_spec.taxonomy || !form.value.label_spec.taxonomy.key) {
          callback(new Error('请选择标注规范'))
        }
        saveButtonEnable.value = true
        callback()
      }
    }
  ],
  'label_spec.mission.key': [{ required: true, message: '选择任务分类' }],
  serverLocalDir: [
    {
      trigger: 'blur',
      validator: (rule, value, callback) => {
        if (isEmpty(form.value.label_spec.data.seq)) {
          callback(new Error('请选择 数据根目录'))
        } else if (isEmpty(form.value.label_spec.data.streams)) {
          callback(new Error('请选择 数据分组'))
        }
        saveButtonEnable.value = true
        callback()
      }
    }
  ],
  imageURLs: [
    {
      validator: (rule, value, callback) => {
        let error = false
        if (isEmpty(form.value.label_spec.data.seq)) {
          callback(new Error('数据ID不可以为空。'))
          error = true
        }
        if (isEmpty(tempForm.value.streams)) {
          callback(new Error('图像名不可以为空。'))
          error = true
        } else {
          form.value.label_spec.data.streams = [tempForm.value.streams]
        }
        if (isEmpty(tempForm.value.imageURLs)) {
          callback(new Error('列表不可以为空。'))
          error = true
        } else {
          const imgURLs = tempForm.value.imageURLs
            .split('\n')
            .map((item) => {
              return item.trim()
            })
            .filter((item) => !isEmpty(item))
          if (form.value.label_spec.data.dataSource === 'imageURLs') {
            for (let i = 0; i < imgURLs.length; i++) {
              if (!imgURLs[i].toLocaleLowerCase().startsWith('http')) {
                callback(new Error(`第${i}条图像URL必须以http开头。`))
                error = true
                break
              }
            }
          }
          form.value.label_spec.data.imageURLs = imgURLs
        }
        if (!error) {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
})

const formDefault = {
  id: 0,
  uuid: '',
  data_clip_id: 0,
  auto_job_id: 0,
  type: 0,
  taxonomy_key: '',
  priority: 1,
  version: '1.0.0',
  name: '',
  desc: '',
  label_spec: {
    domain: { key: '' },
    mission: { key: '' },
    taxonomy: { key: '' },
    data: {
      dataSource: 'imageURLs',
      format: 'simple-directory',
      file_exts: [],
      root_dir: '',
      seq: '',
      streams: [] as string[],
      clip_key: '',
      imageURLs: [] as string[]
    }
  }
}
const form = ref({ ...cloneDeep(formDefault) })

const openDir = () => {
  let fileExts = []
  if (
    [Mission.ObjectBBox3d, Mission.PcSemantic3d, Mission.PcPolyline3d].includes(
      form.value.label_spec.mission.key
    )
  ) {
    // 点云
    fileExts = fileTypes.pointcloud
  } else if (form.value.label_spec.mission.key === Mission.VideoEvents) {
    fileExts = fileTypes.videos
  } else {
    fileExts = fileTypes.images
  }

  openFilesFromDir({ fileExts })
    .then((data) => {
      const { filePaths, blobs } = data
      if (filePaths.length === 0) {
        ElMessage.warning('找不到文件: ' + fileExts.join(', ') + ', 请重新选择')
        return
      }
      tempForm.value.imageURLs = filePaths.join('\n')
      tempForm.value.streams = filePaths[0].split('/')[0]
    })
    .catch((err) => {
      ElMessage.error('异常：' + err)
    })
}

const open = async (type: string, params) => {
  const { uuid } = params

  if (uuid) {
    formLoading.value = true
    // load
    handleDataSourceChange(params.data.dataSource)

    form.value.uuid = uuid
    // 当前为修改状态
    try {
      const res = await annoJobPerformApi.query({
        uuid: uuid
      })
      if (res.data && res.data[0]) {
        form.value = res.data[0]
        tempForm.value.imageURLs = form.value.label_spec.data.imageURLs.join('\n')
        tempForm.value.streams = form.value.label_spec.data.streams[0]
      } else {
        ElMessage.error('查询数据失败')
      }
    } finally {
      formLoading.value = false
    }
  } else {
    formLoading.value = false
    resetForm(formRef.value)
  }

  dialogVisible.value = true
  dialogTitle.value = i18n.global.t('action.' + type)
  formType.value = type
}

const emit = defineEmits(['success'])
const submitForm = async (formEl) => {
  if (!formEl) return
  await formEl.validate(async (valid, fields) => {
    if (valid) {
      let fileExts = []
      switch (form.value.label_spec.mission.key) {
        case Mission.ObjectBBox3d:
        case Mission.PcSemantic3d:
        case Mission.PcPolyline3d:
          fileExts = fileTypes.pointcloud
          break
        case Mission.VideoEvents:
          fileExts = fileTypes.videos
          break
        default:
          fileExts = fileTypes.images
          break
      }
      form.value.label_spec.data.file_exts = fileExts
      // 设置name
      formLoading.value = true
      const formData = {
        ...form.value
      }
      if (typeof form.value.label_spec.data.seq === 'string') {
      } else if (typeof form.value.label_spec.data.seq === 'object') {
        formData.label_spec.data.seq = form.value.label_spec.data.seq.value // openlabel
      }
      try {
        if (formType.value === 'create') {
          await annoJobPerformApi.create(formData)
          messages.lastSuccess = '操作成功'
        } else {
          await annoJobPerformApi.update(formData)
          messages.lastSuccess = '操作成功'
        }
        dialogVisible.value = false
        // 发送操作成功的事件
        emit('success')
      } finally {
        formLoading.value = false
      }
    } else {
      console.log('error submit!!')
    }
  })
}

const formattedDateTime = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0') // 月份从0开始，所以要+1
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

const resetForm = (formEl: FormInstance | undefined) => {
  if (formEl) formEl.resetFields()

  form.value = { ...cloneDeep(formDefault) }
  tempForm.value = {
    imageURLs: '',
    streams: ''
  }
  // formRef.resetFields()
  if (form.value.label_spec.data.dataSource === 'serverLocalDir') {
    form.value.label_spec.data.seq = ''
  } else {
    form.value.label_spec.data.seq = `data-seq-${formattedDateTime()}`
  }
}

const loadDataClipIds = async () => {
  formLoading.value = true
  saveButtonEnable.value = false
  const res = await dataSeqApi.queryDataSeq()
  if (res && res.data.length > 0) {
    dataClipIds.value = res.data
    saveButtonEnable.value = true
  }
  formLoading.value = false
}

const loadDomains = async () => {
  openlabelApi.domains().then((res) => {
    domains.value = res.data.map((item) => {
      return { label: item.name, value: item.key }
    })
  })
}

const loadStreams = async (seq) => {
  const { data } = await dataSeqApi.queryDataSeqStreams({
    seq
  })

  const seqDatas = []
  for (let i = 0; i < data.length; i++) {
    seqDatas.push({ label: data[i], value: data[i] })
  }

  seqStreams.value = seqDatas
}
watch(
  () => form.value.label_spec.data.seq,
  (newVal, oldVal) => {
    if (newVal === oldVal) {
      return
    }
    if (newVal && form.value.label_spec.data.dataSource === 'serverLocalDir') {
      if (typeof newVal === 'string') {
        loadStreams(newVal)
      } else if (typeof newVal === 'object') {
        loadStreams(newVal.value)
      }
    }
  }
)

watch(
  [() => form.value.label_spec.data.seq, () => form.value.label_spec.mission.key],
  (newVal, oldVal) => {
    form.value.name = newVal[0] + '-' + newVal[1]
  }
)

const handleDataSourceChange = (val) => {
  if (val === 'serverLocalDir') {
    loadDataClipIds()
  } else {
    saveButtonEnable.value = true
  }
}

const loadData = () => {
  Promise.all([loadDomains()]).catch((err) => {
    messages.lastException = `删除出现异常${err.message}`
  })
}

onMounted(() => {
  loadData()
})

defineExpose({ open })
</script>
