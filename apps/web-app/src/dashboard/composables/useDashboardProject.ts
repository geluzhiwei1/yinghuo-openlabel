/**
 * 当前看板选中的项目,跨视图共享。
 *
 * 持久化逻辑:
 *  - 首次进入:GET /me → preferences.dashboard_last_project_id
 *  - 用户切换项目:PATCH /me/preferences 增量写入
 *  - preferences 同步进 userAuth.preferences,便于其它 SPA 消费
 */
import { ref, computed } from 'vue'
import { meApi, projectsApi } from '@/api'
import { userAuth } from '@/states/UserState'
import type { Project } from '@/types/api'

const projectId = ref<number | null>(null)
const projects = ref<Project[]>([])
const loading = ref(false)

const setFromPreferences = () => {
  const fromPref =
    (userAuth.value.preferences?.dashboard_last_project_id as number | undefined) ?? null
  projectId.value = fromPref
}

export const useDashboardProject = () => {
  const currentProject = computed<Project | null>(
    () => projects.value.find((p) => p.id === projectId.value) ?? null,
  )

  const loadProjects = async () => {
    loading.value = true
    try {
      const res = await projectsApi.list({ is_active: true })
      projects.value = (res?.items ?? res?.data ?? []) as Project[]
      // 若 preferences 里的 project 已失效,自动选第一个
      if (projectId.value == null || !projects.value.find((p) => p.id === projectId.value)) {
        projectId.value = projects.value[0]?.id ?? null
      }
    } finally {
      loading.value = false
    }
  }

  /** 拉一次 /me 合并 preferences,再加载项目列表 */
  const init = async () => {
    try {
      const me = await meApi.getProfile()
      userAuth.value.preferences = me.preferences ?? {}
    } catch {
      // 401 已经在 req.ts 处理重定向,这里 swallow 其它错误
    }
    setFromPreferences()
    await loadProjects()
  }

  const selectProject = async (id: number | null) => {
    projectId.value = id
    if (id == null) return
    // 异步写回 preferences,不阻塞 UI
    try {
      const merged = await meApi.updatePreferences({ dashboard_last_project_id: id })
      if (merged && typeof merged === 'object') {
        userAuth.value.preferences = merged
      }
    } catch {
      // 偏好写入失败不影响使用,静默
    }
  }

  return {
    projectId,
    projects,
    currentProject,
    loading,
    init,
    loadProjects,
    selectProject,
  }
}
