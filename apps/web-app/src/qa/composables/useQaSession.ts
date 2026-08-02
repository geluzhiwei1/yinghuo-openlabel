/**
 * QA 工作台共享会话。
 *
 * 与 review 的差异:
 *  - 默认仅显示 current_stage 匹配 /sample_review|qa/ 的 instance(后端只支持单 stage 精确过滤,
 *    这里在前端按 stage 关键字二次筛选)
 *  - 顶部展示抽样覆盖率(调 /quality/sample-coverage)
 *
 * 复用 review 的 HelpOverlay / shortcuts,通过 SPA 边界隔离,各自维护单例。
 */
import { computed, ref } from 'vue'
import {
  workflowApi,
  labelsApi,
  projectsApi,
  meApi,
  qualityApi,
} from '@/api'
import { userAuth } from '@/states/UserState'
import type {
  Project,
  WorkflowInstance,
  UnitLabel,
} from '@/types/api'
import { ElMessage } from 'element-plus'

// QA 默认 stage 关键字:命中 sample_review 或 qa 视为终检阶段
const QA_STAGE_PATTERN = /sample_review|qa/i

const projectId = ref<number | null>(null)
const projects = ref<Project[]>([])

const statusFilter = ref<string>('in_progress')
const stageFilter = ref<string>('') // 用户精确输入的 stage code(可选)

const rawInstances = ref<WorkflowInstance[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loadingList = ref(false)

const currentInstance = ref<WorkflowInstance | null>(null)
const currentLabel = ref<UnitLabel | null>(null)
const loadingDetail = ref(false)

// 抽样覆盖率
const sampleCoverage = ref<any[]>([])
const loadingCoverage = ref(false)

const instances = computed<WorkflowInstance[]>(() => {
  // 若用户给了精确 stage,直接信任;否则按 QA 默认 pattern 过滤
  if (stageFilter.value) {
    return rawInstances.value.filter((i) => i.current_stage === stageFilter.value)
  }
  return rawInstances.value.filter((i) =>
    QA_STAGE_PATTERN.test(i.current_stage ?? ''),
  )
})

const selectedIndex = computed(() =>
  currentInstance.value
    ? instances.value.findIndex((i) => i.id === currentInstance.value!.id)
    : -1,
)

// 聚合覆盖率:取所有 sample_review stage 的均值
const aggregatedCoverage = computed(() => {
  if (sampleCoverage.value.length === 0) return null
  const tot = sampleCoverage.value.reduce(
    (s, r) => s + (r.entered ?? 0),
    0,
  )
  const sampled = sampleCoverage.value.reduce(
    (s, r) => s + (r.actually_sampled ?? 0),
    0,
  )
  if (tot === 0) return null
  return {
    entered: tot,
    sampled,
    rate: sampled / tot,
  }
})

export const useQaSession = () => {
  const currentProject = computed<Project | null>(
    () => projects.value.find((p) => p.id === projectId.value) ?? null,
  )

  const setProjectFromPreferences = () => {
    const fromPref =
      (userAuth.value.preferences?.qa_last_project_id as number | undefined) ??
      (userAuth.value.preferences?.review_last_project_id as number | undefined) ??
      (userAuth.value.preferences?.dashboard_last_project_id as number | undefined) ??
      null
    projectId.value = fromPref
  }

  const loadProjects = async () => {
    const res = await projectsApi.list({ is_active: true })
    projects.value = (res?.items ?? res?.data ?? []) as Project[]
    if (
      projectId.value == null ||
      !projects.value.find((p) => p.id === projectId.value)
    ) {
      projectId.value = projects.value[0]?.id ?? null
    }
  }

  const bootstrap = async () => {
    try {
      const me = await meApi.getProfile()
      userAuth.value.preferences = me.preferences ?? {}
    } catch {
      // 401 已重定向
    }
    setProjectFromPreferences()
    await loadProjects()
  }

  const selectProject = async (id: number | null) => {
    projectId.value = id
    page.value = 1
    currentInstance.value = null
    currentLabel.value = null
    rawInstances.value = []
    if (id == null) return
    try {
      const merged = await meApi.updatePreferences({ qa_last_project_id: id })
      if (merged && typeof merged === 'object') {
        userAuth.value.preferences = merged
      }
    } catch {
      // 偏好失败不阻塞
    }
    await Promise.all([loadInstances(), loadCoverage()])
  }

  const loadInstances = async () => {
    if (projectId.value == null) {
      rawInstances.value = []
      total.value = 0
      return
    }
    loadingList.value = true
    try {
      const params: any = {
        project_id: projectId.value,
        page: page.value,
        page_size: pageSize.value * 2, // 因为前端要二次过滤,多拉一些避免分页边角
      }
      if (stageFilter.value) params.current_stage = stageFilter.value
      if (statusFilter.value) params.current_status = statusFilter.value
      const res = await workflowApi.listInstances(params)
      rawInstances.value = (res?.items ?? []) as WorkflowInstance[]
      total.value = res?.total ?? 0
    } finally {
      loadingList.value = false
    }
  }

  const loadCoverage = async () => {
    if (projectId.value == null) {
      sampleCoverage.value = []
      return
    }
    loadingCoverage.value = true
    try {
      const res = await qualityApi.sampleCoverage({ project_id: projectId.value })
      sampleCoverage.value = res?.items ?? []
    } catch {
      sampleCoverage.value = []
    } finally {
      loadingCoverage.value = false
    }
  }

  const loadCurrentLabel = async () => {
    if (currentInstance.value == null) {
      currentLabel.value = null
      return
    }
    loadingDetail.value = true
    try {
      try {
        currentLabel.value = await labelsApi.getLatest(currentInstance.value.unit_id)
      } catch {
        currentLabel.value = null
      }
    } finally {
      loadingDetail.value = false
    }
  }

  const selectInstance = async (inst: WorkflowInstance | null) => {
    currentInstance.value = inst
    await loadCurrentLabel()
  }

  const moveBy = async (delta: number) => {
    if (instances.value.length === 0) return
    const cur = selectedIndex.value
    const next = Math.max(0, Math.min(instances.value.length - 1, cur + delta))
    if (next === cur) return
    await selectInstance(instances.value[next])
  }

  const next = () => moveBy(1)
  const prev = () => moveBy(-1)

  const approveCurrent = async () => {
    if (!currentInstance.value) {
      ElMessage.warning('未选中任何 unit')
      return
    }
    const id = currentInstance.value.id
    try {
      const updated = await workflowApi.submitInstance(id, {
        decision: 'approved',
        reason: null,
      })
      ElMessage.success(`已通过,推进到 ${(updated as any)?.current_stage ?? '下一阶段'}`)
      await refreshAfterSubmit(id)
    } catch {
      // req.ts 已提示
    }
  }

  const rejectCurrent = async (reason: {
    category: string
    severity: string
    note?: string
  }) => {
    if (!currentInstance.value) return null
    const id = currentInstance.value.id
    try {
      const updated = await workflowApi.submitInstance(id, {
        decision: 'rejected',
        reason,
      })
      ElMessage.success(`已驳回,下一步:${(updated as any)?.current_stage ?? '等待处理'}`)
      await refreshAfterSubmit(id)
      return updated
    } catch {
      return null
    }
  }

  const refreshAfterSubmit = async (justSubmittedId: number) => {
    const remaining = rawInstances.value.filter((i) => i.id !== justSubmittedId)
    if (remaining.length === 0) {
      await loadInstances()
      currentInstance.value = null
      currentLabel.value = null
      return
    }
    const nextInst =
      instances.value.find((_, idx) => idx >= Math.max(0, selectedIndex.value)) ??
      instances.value[0] ??
      null
    rawInstances.value = remaining
    await selectInstance(nextInst)
    // 提交后顺手刷新覆盖率,数字会动起来
    loadCoverage()
  }

  return {
    // state
    projectId,
    projects,
    currentProject,
    stageFilter,
    statusFilter,
    instances,
    total,
    page,
    pageSize,
    loadingList,
    currentInstance,
    currentLabel,
    loadingDetail,
    selectedIndex,
    sampleCoverage,
    aggregatedCoverage,
    loadingCoverage,
    // actions
    bootstrap,
    selectProject,
    loadInstances,
    loadCoverage,
    selectInstance,
    loadCurrentLabel,
    moveBy,
    next,
    prev,
    approveCurrent,
    rejectCurrent,
  }
}
