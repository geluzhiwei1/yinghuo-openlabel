<template>
  <el-drawer v-model="dialogVisible" :size="'70%'" :destroy-on-close="true">
    <template #header>
      <h4>{{ dialogTitle }}</h4>
    </template>
    <template #default>
      <el-form ref="formRef" :model="form" :rules="rules" v-loading="formLoading" label-position="right"
        label-width="100px" style="max-width: 600px">
        <el-form-item label="数据源">
          <el-row>
            <el-radio-group v-model="form.label_spec.data.dataSource" @change="handleDataSourceChange"
              :disabled="formType === 'edit'">
              <el-radio value="localImage">我的计算机</el-radio>
              <el-radio value="imageURLs">互联网图像(HTTP)</el-radio>
              <el-radio value="serverLocalDir">服务器</el-radio>
            </el-radio-group>
          </el-row>
          <el-row v-show="form.label_spec.data.dataSource === 'localImage'">
            <el-text type="success">选择存储在您本地计算机上的数据文件，这些数据文件<span style="color: red;">不会上传</span></el-text>
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
              <el-tree-select v-model="form.label_spec.mission.key" :data="missions" :check-strictly="false"
                :render-after-expand="false" check-on-click-node show-checkbox />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item label="选择数据" v-if="form.label_spec.data.dataSource === 'serverLocalDir'" prop="serverLocalDir">
          <el-row style="width: 100%">
            <el-col :span="6">数据格式：</el-col>
            <el-col :span="18">
              <el-select v-model="form.label_spec.data.format" placeholder="数据格式" @change="handleFormatChange">
                <el-option v-for="item in dataFormats" :key="item.value" :label="item.label" :value="item.value"/>
              </el-select>
            </el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="6"></el-col>
            <el-col :span="18">
              <el-text type="info">{{ dataFormatDesc }}</el-text>
            </el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="6">数据根目录：</el-col>
            <el-col :span="18">
              <el-tree-select v-model="form.label_spec.data.seq" lazy :load="loadSeqNode"
                :cache-data="seqCacheData" node-key="value" check-strictly show-checkbox
                :props="treeProps" :render-content="renderSeqNode"
                @node-click="onSeqNodeClick"
                @change="handleSeqTreeSelectChange" />
            </el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="6">数据分组：</el-col>
            <el-col :span="18">
              <el-select v-model="form.label_spec.data.streams" multiple collapse-tags collapse-tags-tooltip
                placeholder="Select">
                <el-option v-for="item in seqStreams" :key="item.value" :label="item.label" :value="item.value" />
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
        <el-form-item label="填写数据" v-if="form.label_spec.data.dataSource === 'imageURLs'" prop="imageURLs">
          <el-row style="width: 100%">
            <el-col :span="12"><el-input v-model="form.label_spec.data.seq" maxlength="100" style="width: 100%"
                placeholder="数据段ID,如data-seq1" /></el-col>
            <el-col :span="12"><el-input v-model="tempForm.streams" maxlength="100" style="width: 100%"
                placeholder="数据名字,如camera1" /></el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="24">输入图像URL，每行一条，必须以http开头</el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="24"><el-input v-model="tempForm.imageURLs" maxlength="102400" style="width: 100%"
                show-word-limit type="textarea" /></el-col>
          </el-row>
        </el-form-item>
        <el-form-item label="标注规范" prop="label_spec.taxonomy">
          <el-row style="width: 100%">
            <el-col :span="24">
              <TaxonomySelectTable v-model:modelValue="form.label_spec.taxonomy"
                :options="{ btnLabel: '选择标注规范', inputVisible: true }" />
            </el-col>
          </el-row>
        </el-form-item>

        <!-- B3: 体数据任务可选预标注模型, 创建后后台逐帧推理(审核态可采纳/驳回) -->
        <el-form-item label="预标注" v-if="form.label_spec.mission.key === Mission.VolumeSegment3d">
          <el-row style="width: 100%">
            <el-col :span="24">
              <el-checkbox-group v-if="preAnnoModels && preAnnoModels.length" v-model="form.label_spec.data.pre_annotate">
                <el-checkbox v-for="m in preAnnoModels" :key="m.id" :value="m.id"
                  :disabled="m.requires.includes('pet') && !hasPetStream">
                  {{ m.label }}
                  <span v-if="m.requires.includes('pet')" class="pre-anno__req">（需 PET 流）</span>
                </el-checkbox>
              </el-checkbox-group>
              <el-text v-else type="info" size="small">推理服务不可用，创建后可手动 AI 分割</el-text>
            </el-col>
          </el-row>
        </el-form-item>

        <el-form-item label="任务数据" v-if="form.label_spec.data.dataSource === 'localImage'" prop="imageURLs">
          <el-row style="width: 100%">
            <el-col :span="24"><el-button @click="openDir()" :loading="dicomScan.scanning">点击选择数据文件夹</el-button> </el-col>
          </el-row>
          <el-row v-if="dicomScan.scanning" style="width: 100%; margin-top: 8px">
            <el-col :span="24">
              <el-progress :percentage="Math.round(dicomScan.read * 100 / Math.max(1, dicomScan.total))"
                :stroke-width="14" text-inside />
              <el-text size="small">正在解析 DICOM 头 {{ dicomScan.read }}/{{ dicomScan.total }} …</el-text>
            </el-col>
          </el-row>
          <el-row v-if="dicomSummary" style="width: 100%; margin-top: 8px">
            <el-col :span="24">
              <el-alert type="success" :closable="false">
                <div>DICOM 目录：{{ dicomSummary.patients }} 患者 / {{ dicomSummary.studies }} 检查 /
                  {{ dicomSummary.framesCount }} 帧（配对 {{ dicomSummary.pairs }}，未配对 {{ dicomSummary.singles }}），
                  数据流 {{ dicomSummary.streams.join(',') }}</div>
                <div v-for="r in dicomSummary.rejected" :key="r.name" class="dicom-rej">
                  剔除 {{ r.name }}：{{ r.reason }}</div>
              </el-alert>
            </el-col>
          </el-row>
          <el-row style="width: 100%">
            <el-col :span="12"><el-input v-model="form.label_spec.data.seq" maxlength="100" style="width: 100%"
                placeholder="数据段ID,如data-seq1" /></el-col>
            <el-col v-if="!dicomSummary" :span="12"><el-input v-model="tempForm.streams" maxlength="100" style="width: 100%"
                placeholder="数据名字,如camera1" /></el-col>
          </el-row>
          <el-row v-if="!dicomSummary" style="width: 100%">
            <el-col :span="24"><el-input v-model="tempForm.imageURLs" maxlength="102400" style="width: 100%"
              show-word-limit type="textarea" :rows="5" /></el-col>
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
          <el-input v-model="form.desc" maxlength="10240" style="width: 100%" placeholder="备注" show-word-limit
            type="textarea" />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <div style="text-align: center;">
        <el-button @click="submitForm(formRef)" type="primary" :disabled="!saveButtonEnable">确定</el-button>
        <!-- <el-button @click="dialogVisible = false">取消</el-button> -->
        <el-button @click="resetForm(formRef)">重置</el-button>
      </div>
    </template>
  </el-drawer>
</template>
<script setup lang="ts">
import { onMounted, ref, watch, computed, h } from 'vue'
import { ElMessage, ElTag, ElTooltip } from 'element-plus'
import { annoJobPerformApi, dataSeqApi, openlabelApi, volumeInferApi } from '@/api'
import TaxonomySelectTable from '@/components/AnnoSpecSelector.vue'
import PrioritySelect from '@/components/PrioritySelect.vue'
import { i18n } from '@/locales'
import { AnnoMissons, Mission } from '@/constants'
import { isEmpty, isObject, clone } from 'radash'
import { messages } from '@/states'
import { fileTypes, openFilesFromDir } from '@/states/LocalFiles'
import { cloneDeep } from 'lodash'
import { isDicomFile, readDicomInfo } from '@/nrrd/data/dicomIO'
import type { DicomInfo } from '@/nrrd/data/dicomIO'
import {
  STREAM_BY_MODALITY, buildVolumes, frameDisplayName, orderFrames, pairSeries,
} from '@/nrrd/data/dicomGroup'
import type { Study } from '@/nrrd/data/dicomGroup'

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formRef = ref() // 表单 Ref
const saveButtonEnable = ref(true) // 保存按钮是否可用

const seqStreams = ref<any[]>([])
const seqCacheData = ref<any[]>([])
const domains = ref<any[]>([])
const missions = AnnoMissons

const tempForm = ref({
  imageURLs: '',
  streams: ''
})

// 本地 DICOM 目录扫描状态(表单侧;魔数嗅探 → 读头 → 分组/配对 → dicomFrames 暂存)
const dicomScan = ref({ scanning: false, total: 0, read: 0 })
interface DicomSummary {
  patients: number; studies: number; pairs: number; singles: number
  framesCount: number; streams: string[]; rejected: { name: string; reason: string }[]
}
const dicomSummary = ref<DicomSummary | null>(null)

const dataFormats = [
  {label: 'directory', value: 'simple-directory', desc: '简单的目录结构：每个非空子文件夹视为一个数据流（stream），无需 meta.json。'},
  {label: 'openlabel', value: 'openlabel', desc: 'OpenLabel 格式：目录下需要 meta.json，按 OpenLabel 规范描述数据集与帧元信息。'},
]

const dataFormatDesc = computed(() => {
  const item = dataFormats.find((it) => it.value === form.value.label_spec.data.format)
  return item ? item.desc : ''
})

// 切换 format(目录 vs openlabel)时,旧路径可能不再合法,强制用户重新选目录与数据流
// 用 @change 显式触发(而非 watch)— 避免 watch 链式触发 form.streams 的下游更新
const handleFormatChange = (newFmt: string) => {
  form.value.label_spec.data.seq = ''
  form.value.label_spec.data.streams = []
  seqStreams.value = []
}

const handleSeqTreeSelectChange = (value, selectedData, selectedNodes) => {
  // console.log(value)
  // // 设置 format 格式
  // form.value.label_spec.data.format = 'openlabel'
  // seqStreams.value = ['b','a']
}

// el-tree-select 在 checkStrictly=true 时把 expandOnClickNode 强制改回 false,
// 点击只选中不展开。这里直接调 node.expand() 让点击同时展开节点。
// node 是 el-tree 的内部 Node 实例(node.mjs:212),expand 内部判断 isLeaf / loaded。
// 注意:禁用态不能拦截展开,否则用户看不到深层 openlabel 子目录。isSeqDisabled 只负责
// 视觉 + checkbox 选中拦截,展开要让用户能下钻到带 meta.json 的叶子节点。
const onSeqNodeClick = (data, node) => {
  if (!node || node.isLeaf || node.expanded) return
  node.expand()
}

// 给 el-tree-select 的内部 el-tree 提供 props.class,带 seq_meta 的节点加 .is-openlabel
// format=openlabel 时,把没有 seq_meta 的节点禁用——避免选到非 openlabel 目录
// el-tree 内部用 :disabled 函数判定 node.disabled(aria-disabled 走这个),
// 但节点只在创建时计算 disabled,format 变化不会重渲,需要 :key 强制重挂载
const isSeqDisabled = (data: any) =>
  form.value.label_spec.data.format === 'openlabel' && !data?.seq_meta
const treeProps = computed(() => ({
  class: (data: any) => (data?.seq_meta ? 'is-openlabel' : ''),
  disabled: isSeqDisabled,
}))

// 从后端塞进节点的 seq_meta (openlabel meta.json 解析结果) 抽出摘要用于 tooltip
const summarizeSeqMeta = (seqMeta: any) => {
  const ol = seqMeta?.openlabel ?? {}
  const streams: string[] = Object.keys(ol.streams ?? {})
  const frameCount = ol.frames ? Object.keys(ol.frames).length : 0
  const schemaVersion: string = ol.metadata?.schema_version ?? '-'
  return { streams, frameCount, schemaVersion }
}

// el-tree-select 自定义节点必须用 render-content (默认插槽会被 TreeSelectOption/el-option 吞掉)
// openlabel 节点在 label 后追加绿色 ElTag,并在右侧放一个 ⓘ 按钮;hover 显示 streams/帧数/schema。
// 非 openlabel 节点在 format=openlabel 时显示为禁用态(灰显 + 锁图标)
const renderSeqNode = (h, { data }: any) => {
  const isOpenlabel = !!data?.seq_meta
  const disabled = isSeqDisabled(data)
  const labelClass = ['seq-node__label', disabled ? 'seq-node__label--disabled' : '']
  const children: any[] = [h('span', { class: labelClass, title: disabled ? '该目录不是 openlabel 格式,无法在 openlabel 模式下选中' : '' }, data.label)]
  if (disabled) {
    children.push(h('span', { class: 'seq-node__lock' }, '🔒'))
  }
  if (!isOpenlabel) {
    return h('span', { class: 'seq-node' }, children)
  }
  const { streams, frameCount, schemaVersion } = summarizeSeqMeta(data.seq_meta)
  children.push(
    h(ElTag, { type: 'success', size: 'small', effect: 'light', class: 'seq-tag' }, () => 'openlabel'),
  )
  // el-tooltip 用作 hover popper;内容是 streams 列表 + 帧数 + schema version
  const tooltipContent = h('div', { class: 'seq-meta-pop' }, [
    h('div', { class: 'seq-meta-pop__row' }, [
      h('span', { class: 'seq-meta-pop__k' }, '数据流:'),
      h('span', { class: 'seq-meta-pop__v' }, streams.length ? streams.join(', ') : '(无)'),
    ]),
    h('div', { class: 'seq-meta-pop__row' }, [
      h('span', { class: 'seq-meta-pop__k' }, '帧数:'),
      h('span', { class: 'seq-meta-pop__v' }, String(frameCount)),
    ]),
    h('div', { class: 'seq-meta-pop__row' }, [
      h('span', { class: 'seq-meta-pop__k' }, 'schema:'),
      h('span', { class: 'seq-meta-pop__v' }, schemaVersion),
    ]),
  ])
  children.push(
    h(
      ElTooltip,
      {
        placement: 'right-start',
        effect: 'light',
        // tooltip 默认 append 到 body,在 tree dropdown 上层不会被遮挡
        showAfter: 200,
      },
      {
        default: () => [
          h(
            'span',
            { class: 'seq-node__info', title: `${streams.length} streams · ${frameCount} frames` },
            'ⓘ',
          ),
        ],
        // 丰富内容走 #content 插槽(默认插槽给 trigger)
        content: () => tooltipContent,
      },
    ),
  )
  return h('span', { class: 'seq-node seq-node--openlabel' }, children)
}

const rules = ref({
  'label_spec.domain.key': [
    { required: true, message: '选择标签行业', trigger: 'blur', type: 'string' }
  ],
  'label_spec.data.seq': [
    { required: true, message: '选择数据根目录', trigger: 'blur', type: 'string' }
  ],
  'label_spec.data.file_exts': [
    { required: true, message: '选择文件类型', trigger: 'blur' }
  ],
  'label_spec.taxonomy': [
    {
      trigger: 'blur', validator: (rule, value, callback) => {
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
        const isDicom = !!form.value.label_spec.data.dicomLocal
        if (isEmpty(form.value.label_spec.data.seq)) {
          callback(new Error('数据ID不可以为空。'))
          error = true
        }
        if (isEmpty(tempForm.value.streams) && isEmpty(form.value.label_spec.data.streams)) {
          callback(new Error('图像名不可以为空。'))
          error = true
        } else if (form.value.label_spec.mission.key === Mission.VolumeSegment3d
          && form.value.label_spec.data.dataSource === 'localImage' && !isDicom) {
          // 体数据本地任务支持逗号分隔多流(ct,pet → PET/CT 融合);DICOM 模式流来自分组结果
          form.value.label_spec.data.streams = tempForm.value.streams
            .split(/[,，\s]+/).map(s => s.trim()).filter(s => !isEmpty(s))
        } else if (!isDicom && !isEmpty(tempForm.value.streams)) {
          form.value.label_spec.data.streams = [tempForm.value.streams]
        }
        if (!isDicom && isEmpty(tempForm.value.imageURLs)) {
          callback(new Error('列表不可以为空。'))
          error = true
        } else if (!isDicom) {
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
      imageURLs: [] as string[],
      pre_annotate: [] as string[],
      dicomLocal: false,
      dicomFrames: undefined as any[] | undefined
    }
  }
}
const form = ref({ ...cloneDeep(formDefault) })

// B3 预标注: null=探测中/不可用; 选中写入 label_spec.data.pre_annotate(后端 DTO 透传)
// 注意必须放在 form 声明之后: watch 的 getter 在 setup 阶段立即求值, 提前会 TDZ 崩掉整个页面
const preAnnoModels = ref<Array<{ id: string; label: string; requires: string[] }> | null>(null)
const hasPetStream = computed(() => {
  if ((form.value.label_spec.data.streams || []).includes('pet')) return true
  return (tempForm.value.streams || '').split(/[,，\s]+/).includes('pet')
})
watch(() => form.value.label_spec.mission.key, async key => {
  if (key !== Mission.VolumeSegment3d) {
    form.value.label_spec.data.pre_annotate = []
    return
  }
  if (preAnnoModels.value === null) {
    preAnnoModels.value = await volumeInferApi.models()
  }
}, { immediate: true })
// pet 流取消后, 需要 pet 的模型自动退选
watch(hasPetStream, ok => {
  if (ok || !preAnnoModels.value) return
  form.value.label_spec.data.pre_annotate = form.value.label_spec.data.pre_annotate
    .filter(id => !preAnnoModels.value!.find(m => m.id === id)?.requires.includes('pet'))
})

/** 魔数嗅探 + 渐进读头(并发 8)。无 DICOM → null(走 .nrrd 流)。 */
async function scanDicomDir(blobs: any[]): Promise<DicomInfo[] | null> {
  const flags = await Promise.all(blobs.map((b: any) => isDicomFile(b)))
  const idx = flags.map((f, i) => (f ? i : -1)).filter(i => i >= 0)
  if (!idx.length) return null
  dicomScan.value = { scanning: true, total: idx.length, read: 0 }
  const infos: DicomInfo[] = []
  let failed = 0
  let next = 0
  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= idx.length) return
      try {
        infos.push(await readDicomInfo(blobs[idx[i]], blobs[idx[i]].webkitRelativePath || ''))
      } catch {
        failed++
      }
      dicomScan.value.read++
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, idx.length) }, worker))
  dicomScan.value.scanning = false
  if (failed) ElMessage.warning(`${failed} 个 DICOM 文件头解析失败,已跳过`)
  return infos
}

/** dicomFrames 构建(契约二): 与服务端 import_dicom / 工作台 DicomLocal 同规范。 */
function buildDicomJobData(infos: DicomInfo[]) {
  const { patients, kept, rejected } = buildVolumes(infos)
  const studies = new Map<string, Study>()
  for (const p of patients.values())
    for (const s of p.studies.values()) studies.set(s.meta.studyUid, s)
  const [pairs, unpairedCt, unpairedPet] = pairSeries(studies, kept)
  const frames = orderFrames(pairs, unpairedCt)
  if (!frames.length) {
    ElMessage.error('DICOM 目录中没有可用的体数据序列')
    return null
  }
  const entries = frames.map(f => {
    if (f.kind === 'pair') {
      const st = f.study.meta
      return {
        name: frameDisplayName(st.patientId, st.studyDate, 'CT', f.ct.meta.seriesDesc, f.ct.meta.seriesNumber),
        patient: st.patientId, patientName: f.ct.instances[0].patientName,
        studyDate: st.studyDate, studyUid: st.studyUid, studyDesc: st.studyDesc,
        seriesUid: f.ct.meta.uid, seriesDesc: f.ct.meta.seriesDesc,
        modality: 'CT', pairedModality: 'PT',
        streams: { ct: f.ct.meta.uid, pet: f.pet.meta.uid },
        instanceCounts: { ct: f.ct.instances.length, pet: f.pet.instances.length },
      }
    }
    const s = f.series
    const st = f.study.meta
    const stream = STREAM_BY_MODALITY[s.meta.modality] || 'ct'
    return {
      name: frameDisplayName(st.patientId, st.studyDate, s.meta.modality, s.meta.seriesDesc, s.meta.seriesNumber),
      patient: st.patientId, patientName: s.instances[0].patientName,
      studyDate: st.studyDate, studyUid: st.studyUid, studyDesc: st.studyDesc,
      seriesUid: s.meta.uid, seriesDesc: s.meta.seriesDesc,
      modality: s.meta.modality,
      streams: { [stream]: s.meta.uid },
      instanceCounts: { [stream]: s.instances.length },
    }
  })
  const streams = [...new Set(entries.flatMap(e => Object.keys(e.streams)))]
  const rejList = rejected.map(r => ({
    name: `${r.series.meta.modality} ${r.series.meta.seriesDesc || 's' + r.series.meta.seriesNumber}`,
    reason: r.reason,
  }))
  const summary: DicomSummary = {
    patients: patients.size,
    studies: studies.size,
    pairs: pairs.length,
    singles: frames.length - pairs.length,
    framesCount: frames.length,
    streams,
    rejected: rejList,
  }
  if (unpairedPet.length)
    summary.rejected.push(...unpairedPet.map(p => ({
      name: `PT ${p.meta.seriesDesc || 's' + p.meta.seriesNumber}`,
      reason: '无同 FrameOfReference 的 CT,未配对',
    })))
  return { entries, streams, summary, keptCount: kept.length }
}

const openDir = () => {
  const mission = form.value.label_spec.mission.key
  let fileExts: string[] = []
  if ([Mission.ObjectBBox3d, Mission.PcSemantic3d, Mission.PcPolyline3d].includes(mission)) {
    // 点云
    fileExts = fileTypes.pointcloud
  } else if (mission === Mission.VideoEvents) {
    fileExts = fileTypes.videos
  } else if (mission === Mission.VolumeSegment3d) {
    // 医学体数据: DICOM 靠魔数嗅探(无扩展名约定),先全收
    fileExts = []
  } else {
    fileExts = fileTypes.images
  }

  openFilesFromDir({ fileExts })
    .then(async (data) => {
      const { filePaths, blobs } = data
      if (mission === Mission.VolumeSegment3d) {
        const infos = await scanDicomDir(blobs)
        if (infos && infos.length) {
          const built = buildDicomJobData(infos)
          if (built) {
            form.value.label_spec.data.dicomLocal = true
            form.value.label_spec.data.dicomFrames = built.entries
            form.value.label_spec.data.imageURLs = []
            form.value.label_spec.data.streams = built.streams
            form.value.label_spec.data.file_exts = ['.dcm']
            tempForm.value.streams = built.streams.join(',')
            tempForm.value.imageURLs = ''
            dicomSummary.value = built.summary
          }
          return
        }
        // 非 DICOM: 清掉旧 DICOM 状态,走 .nrrd 流
        form.value.label_spec.data.dicomLocal = false
        form.value.label_spec.data.dicomFrames = undefined
        dicomSummary.value = null
        const volPaths = filePaths.filter(p => /\.(nrrd|nii|nii\.gz|gz)$/i.test(p))
        if (!volPaths.length) {
          ElMessage.warning('找不到 DICOM 或 ' + fileTypes.volumes.join(', ') + ' 文件, 请重新选择')
          return
        }
        tempForm.value.imageURLs = volPaths.join('\n')
        // 体数据: 按父目录分流(x/ct/a.nrrd + x/pet/b.nii.gz → ct,pet), 平铺/单目录取目录名
        const parents = [...new Set(volPaths.map(p => p.replace(/\\/g, '/').split('/').slice(-2, -1)[0]).filter(Boolean))]
        tempForm.value.streams = parents.length ? parents.join(',') : (volPaths[0].split('/')[0] || 'ct')
        return
      }
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
        tempForm.value.imageURLs = (form.value.label_spec.data.imageURLs || []).join('\n')
        tempForm.value.streams = (form.value.label_spec.data.streams || []).join(',')
        const dicomFrames = form.value.label_spec.data.dicomFrames
        if (form.value.label_spec.data.dicomLocal && dicomFrames?.length) {
          dicomSummary.value = {
            patients: new Set(dicomFrames.map((f: any) => f.patient)).size,
            studies: new Set(dicomFrames.map((f: any) => f.studyUid)).size,
            pairs: dicomFrames.filter((f: any) => f.pairedModality).length,
            singles: dicomFrames.filter((f: any) => !f.pairedModality).length,
            framesCount: dicomFrames.length,
            streams: form.value.label_spec.data.streams || [],
            rejected: [],
          }
        } else {
          dicomSummary.value = null
        }
        const seq = form.value.label_spec.data.seq
        seqCacheData.value = seq ? [{ value: seq, label: seq.split('/').pop() }] : []
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
      switch(form.value.label_spec.mission.key) {
        case Mission.ObjectBBox3d:
        case Mission.PcSemantic3d:
        case Mission.PcPolyline3d:
          fileExts = fileTypes.pointcloud
          break
        case Mission.VideoEvents:
          fileExts = fileTypes.videos
          break
        case Mission.VolumeSegment3d:
          fileExts = fileTypes.volumes
          break
        default:
          fileExts = fileTypes.images
          break
      }
      form.value.label_spec.data.file_exts = fileExts
      if (form.value.label_spec.data.dicomLocal) {
        form.value.label_spec.data.file_exts = ['.dcm']
      }
      // 设置name
      formLoading.value = true
      const formData = {
        ...form.value,
      }
      if (typeof form.value.label_spec.data.seq === 'string') {
        ;
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
        // 发送操作成功的事件(payload 供调用方定位新 job 实现跳转)
        emit('success', {
          formType: formType.value,
          name: formData.name,
          seq: typeof formData.label_spec?.data?.seq === 'string' ? formData.label_spec.data.seq : undefined,
        })
      } catch {
        // 错误提示已由请求层 notify 弹出,吞掉异常以保持弹窗打开
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
  if (formEl)  formEl.resetFields()
  
  form.value = { ...cloneDeep(formDefault) }
  tempForm.value = {
    imageURLs: '',
    streams: ''
  }
  dicomSummary.value = null
  dicomScan.value = { scanning: false, total: 0, read: 0 }
  // formRef.resetFields()
  if (form.value.label_spec.data.dataSource === 'serverLocalDir') {
    form.value.label_spec.data.seq = ''
  } else {
    form.value.label_spec.data.seq = `data-seq-${formattedDateTime()}`
  }
}

const loadSeqNode = async (node, resolve) => {
  const path = node.level === 0 ? '' : node.data.value
  try {
    const res = await dataSeqApi.queryDataSeq({ path })
    resolve(res?.data || [])
  } catch (err) {
    ElMessage.error('加载数据目录失败：' + err)
    resolve([])
  }
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
  saveButtonEnable.value = true
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

<style scoped>
.seq-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.seq-tag {
  margin-left: auto;
}
.pre-anno__req {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.dicom-rej {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}
/* 这两个类挂在 tree dropdown 内部(被 Teleport 到 body),
   scoped style 在 :deep() 里不会命中 — 用不带 scope 的全局规则 */
</style>
<style>
.seq-node__label--disabled {
  /* 用 --el-text-color-disabled(#D0D0CC / #484F58)而非 --el-color-info —
     info 色在当前主题下是 #6B7280/#8B949E,与正文对比度太小看不出禁用态 */
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
}
.seq-node__lock {
  font-size: 12px;
  color: var(--el-text-color-disabled);
}
/* format=openlabel 时,非 openlabel 节点被 disabled —
   el-tree 没有内置 is-disabled 视觉态,这里手动灰显 */
:deep(.el-tree-node__content[aria-disabled="true"]) {
  cursor: not-allowed;
  opacity: 0.45;
}
:deep(.el-tree-node__content[aria-disabled="true"]):hover {
  background-color: transparent;
}
:deep(.el-tree-node__content[aria-disabled="true"] .el-checkbox__input.is-disabled .el-checkbox__inner) {
  background-color: var(--el-checkbox-disabled-bg-color);
}
.seq-node__info {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 12px;
  color: var(--el-color-info);
  cursor: help;
  border-radius: 50%;
  flex-shrink: 0;
}
.seq-node__info:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.seq-meta-pop {
  font-size: 12px;
  line-height: 1.6;
  max-width: 360px;
  word-break: break-all;
}
.seq-meta-pop__row {
  display: flex;
  gap: 6px;
}
.seq-meta-pop__k {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.seq-meta-pop__v {
  color: var(--el-text-color-primary);
}
</style>
