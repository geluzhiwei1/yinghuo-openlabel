/**
 * 审核工作台共享会话状态。
 *
 * 职责:
 *  - 当前项目(从 preferences 复原,切换时持久化)
 *  - 实例列表(过滤 current_stage / current_status / assignee)
 *  - 当前选中的 instance + 对应 unit + 最新 label
 *
 * 实例来自 /workflows/instances,unit_id 通过 instance.unit_id 拿到后,
 * 用 /labels/units/{unit_id} 拉 label,workflow.submitInstance 推进。
 */
import { computed, ref } from 'vue'
import {
  workflowApi,
  labelsApi,
  projectsApi,
  meApi,
} from '@/api'
import { userAuth } from '@/states/UserState'
import type {
  Project,
  WorkflowInstance,
  UnitLabel,
} from '@/types/api'
import { ElMessage } from 'element-plus'

// ===== 单例状态(模块级 ref,SPA 内单例) =====

const projectId = ref<number | null>(null)
const projects = ref<Project[]>([])

const stageFilter = ref<string>('') // 空 = 全部 stage
const statusFilter = ref<string>('in_progress') // 默认只看待推进
const assigneeFilter = ref<number | null>(null)

const instances = ref<WorkflowInstance[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loadingList = ref(false)

const currentInstance = ref<WorkflowInstance | null>(null)
const currentLabel = ref<UnitLabel | null>(null)
const loadingDetail = ref(false)

const selectedIndex = computed(() =>
  currentInstance.value
    ? instances.value.findIndex((i) => i.id === currentInstance.value!.id)
        : -1,
)

export const useReviewSession = () => {
  const currentProject = computed<Project | null>(
    () => projects.value.find((p) => p.id === projectId.value) ?? null,
  )

  const setProjectFromPreferences = () => {
    const fromPref =
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

  /** 拉一次 /me + 项目列表,首屏 onMounted 调用 */
  const bootstrap = async () => {
    try {
      const me = await meApi.getProfile()
      userAuth.value.preferences = me.preferences ?? {}
    } catch {
      // 401 已重定向,其它错误静默
    }
    setProjectFromPreferences()
    await loadProjects()
  }

  const selectProject = async (id: number | null) => {
    projectId.value = id
    page.value = 1
    currentInstance.value = null
    currentLabel.value = null
    instances.value = []
    if (id == null) return
    try {
      const merged = await meApi.updatePreferences({ review_last_project_id: id })
      if (merged && typeof merged === 'object') {
        userAuth.value.preferences = merged
      }
    } catch {
      // 偏好失败不阻塞
    }
    await loadInstances()
  }

  const loadInstances = async () => {
    if (projectId.value == null) {
      instances.value = []
      total.value = 0
      return
    }
    loadingList.value = true
    try {
      const params: any = {
        project_id: projectId.value,
        page: page.value,
        page_size: pageSize.value,
      }
      if (stageFilter.value) params.current_stage = stageFilter.value
      if (statusFilter.value) params.current_status = statusFilter.value
      const res = await workflowApi.listInstances(params)
      instances.value = (res?.items ?? []) as WorkflowInstance[]
      total.value = res?.total ?? 0
    } finally {
      loadingList.value = false
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

  /** 通过当前 instance */
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
    } catch (e: any) {
      // req.ts 已经 ElMessage.error,这里 swallow
    }
  }

  /** 驳回当前 instance,带 RejectReason */
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

  /** 提交后:刷新列表 + 跳到下一个 instance */
  const refreshAfterSubmit = async (justSubmittedId: number) => {
    const remaining = instances.value.filter((i) => i.id !== justSubmittedId)
    if (remaining.length === 0) {
      await loadInstances()
      currentInstance.value = null
      currentLabel.value = null
      return
    }
    // 乐观更新:本地移除,选下一个
    const nextInst =
      remaining.find((_, idx) => idx >= Math.max(0, selectedIndex.value)) ??
      remaining[0]
    instances.value = remaining
    await selectInstance(nextInst)
  }

  return {
    // state
    projectId,
    projects,
    currentProject,
    stageFilter,
    statusFilter,
    assigneeFilter,
    instances,
    total,
    page,
    pageSize,
    loadingList,
    currentInstance,
    currentLabel,
    loadingDetail,
    selectedIndex,
    // actions
    bootstrap,
    selectProject,
    loadInstances,
    selectInstance,
    loadCurrentLabel,
    moveBy,
    next,
    prev,
    approveCurrent,
    rejectCurrent,
  }
}
