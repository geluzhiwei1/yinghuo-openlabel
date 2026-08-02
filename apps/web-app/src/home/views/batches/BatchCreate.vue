<template>
  <div class="batch-create">
    <div class="batch-create__header">
      <el-button  link @click="$router.back()"><Icon icon="lucide:arrow-left" />返回</el-button>
      <div class="batch-create__title">
        <Icon icon="lucide:layers" :width="22" />
        <span>新建批次</span>
      </div>
    </div>

    <el-card shadow="never" class="batch-create__card" v-loading="initialLoading">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120"
        label-position="right"
        style="max-width: 720px"
      >
        <el-form-item label="所属项目" prop="project_id">
          <el-select
            v-model="form.project_id"
            placeholder="选择项目"
            style="width: 100%"
            :loading="projectLoading"
            @change="onProjectChange"
          >
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="批次名称" prop="name">
          <el-input v-model="form.name" placeholder="如:第1期-东城路采" maxlength="128" show-word-limit />
        </el-form-item>

        <el-form-item label="Slug" prop="slug">
          <el-input
            v-model="form.slug"
            placeholder="小写字母数字短横线,项目内唯一,如:east-rd-round-1"
            maxlength="64"
          />
        </el-form-item>

        <el-form-item label="Mission" prop="mission">
          <el-select
            v-model="form.mission"
            placeholder="选择标注任务类型"
            filterable
            style="width: 100%"
          >
            <el-option v-for="m in missionOptions" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="数据序列" prop="seq_uuid">
          <el-select
            v-model="form.seq_uuid"
            placeholder="选择数据序列"
            filterable
            remote
            :remote-method="searchSeqs"
            :loading="seqLoading"
            style="width: 100%"
            @change="onSeqChange"
          >
            <el-option
              v-for="s in seqs"
              :key="s.uuid"
              :label="`${s.seq || s.uuid}${s.stream_count != null ? ` (${s.stream_count} streams)` : ''}`"
              :value="s.uuid"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="streamOptions.length > 0" label="Spawn Streams">
          <el-select
            v-model="form.streams"
            multiple
            placeholder="留空 = 全部 streams"
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%"
          >
            <el-option v-for="s in streamOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>

        <el-form-item label="分派策略" prop="assignee_strategy">
          <el-radio-group v-model="form.assignee_strategy" @change="onStrategyChange">
            <el-radio-button value="manual">手动认领</el-radio-button>
            <el-radio-button value="round_robin">轮转</el-radio-button>
            <el-radio-button value="load_aware">负载均衡</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.assignee_strategy !== 'manual'" label="标注员池" prop="assignees">
          <el-select
            v-model="form.assignees"
            multiple
            filterable
            placeholder="标注员 user_id 列表"
            style="width: 100%"
          >
            <el-option v-for="u in assigneeOptions" :key="u.id" :label="`#${u.id} ${u.name || u.email || ''}`" :value="u.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="审核员池">
          <el-select v-model="form.reviewers" multiple filterable placeholder="可选" style="width: 100%">
            <el-option v-for="u in assigneeOptions" :key="u.id" :label="`#${u.id} ${u.name || u.email || ''}`" :value="u.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="QA 池">
          <el-select v-model="form.qa_pool" multiple filterable placeholder="可选" style="width: 100%">
            <el-option v-for="u in assigneeOptions" :key="u.id" :label="`#${u.id} ${u.name || u.email || ''}`" :value="u.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="帧范围">
          <div class="batch-create__frame-range">
            <el-input-number v-model="frameStart" :min="0" placeholder="起点" />
            <span class="batch-create__range-sep">~</span>
            <el-input-number v-model="frameEnd" :min="0" placeholder="终点" />
            <span class="batch-create__range-sep">step</span>
            <el-input-number v-model="frameStep" :min="1" :step="1" />
          </div>
          <div class="batch-create__hint">留空 = 覆盖整个序列</div>
        </el-form-item>

        <el-form-item label="采样率">
          <el-slider v-model="samplingPct" :min="1" :max="100" :step="1" show-input style="max-width: 480px" />
          <div class="batch-create__hint">1.0 = 全帧;0.5 = 隔帧</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="onSubmit">创建</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Icon } from '@iconify/vue'
import { batchesApi, dataSeqsApi, orgsApi } from '@/api'
import { Mission } from '@/constants'
import { useBatchProject } from './useBatchProject'

const route = useRoute()
const router = useRouter()
const { projects, loading: projectLoading, init: initProject, selectProject } = useBatchProject()

const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)
const initialLoading = ref(false)
const seqLoading = ref(false)
const seqs = ref<any[]>([])
const streamOptions = ref<string[]>([])
const assigneeOptions = ref<any[]>([])

const frameStart = ref<number | undefined>(undefined)
const frameEnd = ref<number | undefined>(undefined)
const frameStep = ref<number | undefined>(undefined)
const samplingPct = ref(100)

const form = reactive({
  project_id: null as number | null,
  name: '',
  slug: '',
  mission: '',
  seq_uuid: '',
  streams: [] as string[],
  assignee_strategy: 'manual',
  assignees: [] as number[],
  reviewers: [] as number[],
  qa_pool: [] as number[],
})

const missionOptions = Object.entries(Mission).map(([k, v]) => ({ label: k, value: v as string }))

const rules: FormRules = {
  project_id: [{ required: true, message: '请选择项目', trigger: 'change' }],
  name: [{ required: true, message: '请输入批次名称', trigger: 'blur' }],
  slug: [
    { required: true, message: '请输入 slug', trigger: 'blur' },
    {
      pattern: /^[a-z0-9][a-z0-9-]*$/,
      message: '小写字母数字短横线,字母数字开头',
      trigger: 'blur',
    },
  ],
  mission: [{ required: true, message: '请选择 mission', trigger: 'change' }],
  seq_uuid: [{ required: true, message: '请选择数据序列', trigger: 'change' }],
  assignees: [
    {
      validator: (_r, value, cb) => {
        if (form.assignee_strategy !== 'manual' && (!value || value.length === 0)) {
          cb(new Error('非 manual 策略必须配置标注员池'))
        } else {
          cb()
        }
      },
      trigger: 'change',
    },
  ],
}

const samplingRate = computed(() => samplingPct.value / 100)

const onProjectChange = async (pid: number | null) => {
  if (pid == null) return
  await selectProject(pid)
  loadAssignees(pid)
}

const onStrategyChange = () => {
  if (form.assignee_strategy === 'manual') {
    form.assignees = []
  }
}

const onSeqChange = async (uuid: string) => {
  streamOptions.value = []
  form.streams = []
  if (!uuid) return
  try {
    const res = await dataSeqsApi.get(uuid)
    const meta = res?.meta ?? res ?? {}
    // 兼容两种返回:DataSeqDetail.streams 数组,或老 openlabel dict
    const arr = Array.isArray(meta?.streams) ? meta.streams : null
    if (arr) {
      streamOptions.value = arr.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
    } else {
      const dict = meta?.datas?.openlabel?.streams ?? (meta?.streams && typeof meta.streams === 'object' ? meta.streams : {})
      streamOptions.value = Object.keys(dict)
    }
  } catch {
    // 老接口可能不返 streams,容忍
  }
}

const searchSeqs = async (kw: string) => {
  seqLoading.value = true
  try {
    const res = await dataSeqsApi.list({ kw, page: 1, page_size: 30 })
    seqs.value = res?.items ?? res?.data ?? []
  } finally {
    seqLoading.value = false
  }
}

const loadAssignees = async (pid: number) => {
  // TODO: 替换为项目成员 API;当前借用 orgsApi 列出当前组织成员
  try {
    const res = await orgsApi.list({ project_id: pid })
    const orgs = res?.items ?? res?.data ?? []
    const first = orgs[0]
    if (!first?.id) return
    const mr = await orgsApi.listMembers(first.id)
    assigneeOptions.value = mr?.items ?? mr?.data ?? mr ?? []
  } catch {
    // 静默
  }
}

const onSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  const frame_range: Record<string, number> = {}
  if (frameStart.value != null) frame_range.start = frameStart.value
  if (frameEnd.value != null) frame_range.end = frameEnd.value
  if (frameStep.value != null) frame_range.step = frameStep.value

  const payload: any = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    mission: form.mission,
    seq_uuid: form.seq_uuid,
    assignee_strategy: form.assignee_strategy,
    assignees: form.assignees,
    reviewers: form.reviewers,
    qa_pool: form.qa_pool,
    frame_range: Object.keys(frame_range).length > 0 ? frame_range : {},
    sampling_rate: samplingRate.value,
  }

  submitting.value = true
  try {
    const rec = await batchesApi.createBatch(form.project_id as number, payload)
    ElMessage.success(`已创建批次 #${rec.id}`)
    // 若选了 streams,后续 spawn 才会用到;这里直接跳转详情
    router.push({ name: 'batches-detail', params: { id: rec.id } })
  } finally {
    submitting.value = false
  }
}

watch(
  () => route.query.project_id,
  (v) => {
    if (v != null && !form.project_id) {
      form.project_id = Number(v)
    }
  },
  { immediate: true },
)

onMounted(async () => {
  initialLoading.value = true
  try {
    await initProject()
    if (route.query.project_id) {
      form.project_id = Number(route.query.project_id)
      await loadAssignees(form.project_id as number)
    }
    await searchSeqs('')
  } finally {
    initialLoading.value = false
  }
})
</script>

<style scoped>
.batch-create {
  padding: 16px 24px;
}

.batch-create__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.batch-create__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.batch-create__card {
  border: 1px solid var(--y-color-divider);
}

.batch-create__frame-range {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.batch-create__range-sep {
  color: var(--el-text-color-secondary);
}

.batch-create__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.5;
}
</style>
