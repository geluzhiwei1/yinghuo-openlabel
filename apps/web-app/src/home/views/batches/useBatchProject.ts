/**
 * Batch 管理面共享的项目选择器。
 *
 * 单独于 dashboard 的 useDashboardProject,避免 home SPA 中切换 tab 时
 * 看板和批次面互相影响。preferences 字段用 batches_last_project_id。
 */
import { ref, computed } from 'vue'
import { meApi, projectsApi } from '@/api'
import { userAuth } from '@/states/UserState'
import type { Project } from '@/types/api'

const projectId = ref<number | null>(null)
const projects = ref<Project[]>([])
const loading = ref(false)
const inited = ref(false)

export const useBatchProject = () => {
  const currentProject = computed<Project | null>(
    () => projects.value.find((p) => p.id === projectId.value) ?? null,
  )

  const loadProjects = async () => {
    loading.value = true
    try {
      const res = await projectsApi.list({ is_active: true })
      const list = (res?.items ?? res?.data ?? []) as Project[]
      projects.value = list
      const stillValid = list.find((p) => p.id === projectId.value)
      if (!stillValid) {
        projectId.value = list[0]?.id ?? null
      }
    } finally {
      loading.value = false
    }
  }

  const init = async () => {
    if (inited.value) return
    inited.value = true
    const fromPref =
      (userAuth.value.preferences?.batches_last_project_id as number | undefined) ?? null
    projectId.value = fromPref ?? null
    await loadProjects()
  }

  const selectProject = async (id: number | null) => {
    projectId.value = id
    if (id == null) return
    try {
      const merged = await meApi.updatePreferences({ batches_last_project_id: id })
      if (merged && typeof merged === 'object') {
        userAuth.value.preferences = merged
      }
    } catch {
      // 静默:不影响选择
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
