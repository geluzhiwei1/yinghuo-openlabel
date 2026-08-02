/**
 * Stage 9 共享类型(对接 Stage 4-8 后端)。
 *
 * 仅声明后续页面真正消费的字段;后端返回的额外字段一律不收紧,
 * 老 endpoint 也保持 untyped 兜底,避免 retrofit 老代码。
 */

// ===== Stage 4: Projects / Taxonomies / Orgs =====

export interface Project {
  id: number
  tenant_id: string
  name: string
  slug?: string
  mission: string
  taxonomy_id?: number | null
  default_workflow_id?: number | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
  [k: string]: any
}

export interface Taxonomy {
  id: number
  tenant_id: string
  name: string
  version?: string
  classes?: any[]
  is_current?: boolean
  [k: string]: any
}

export interface OrgUnit {
  id: number
  tenant_id: string
  name: string
  parent_id?: number | null
  path?: string
  [k: string]: any
}

export interface ProjectTemplate {
  id: number
  name: string
  mission?: string
  default_taxonomy?: any
  default_workflow?: any
  [k: string]: any
}

// ===== Stage 5: Workflow =====

export type StageKind =
  | 'annotate'
  | 'review'
  | 'sample_review'
  | 'arbitrate'
  | 'accept'
export type Decision = 'approved' | 'rejected'
export type PassMode = 'any' | 'majority' | 'all'
export type RejectAction = 'hold' | 'escalate' | `to_stage:${string}`
export type SamplePolicy = 'full' | 'random' | 'stratified' | 'adaptive'
export type InstanceStatus =
  | 'pending'
  | 'in_progress'
  | 'arbitrate'
  | 'approved'
  | 'rejected'
export type UnitStageStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'rejected'

export interface PassCondition {
  mode: PassMode
  quorum?: number
}

export interface StageSpec {
  code: string
  kind: StageKind
  name?: string
  pass_condition: PassCondition
  reject_action?: RejectAction
  next_stage_on_approve?: string | null
  sample_policy?: SamplePolicy | null
  sample_rate?: number
  [k: string]: any
}

export interface WorkflowTemplate {
  id: number
  name: string
  code?: string
  mission?: string
  is_builtin?: boolean
  tenant_id?: string | null
  stages: StageSpec[]
  created_at?: string
  updated_at?: string
  [k: string]: any
}

export interface RejectReason {
  category: string
  severity: string
  note?: string
}

export interface StageRun {
  stage_code: string
  actor_id: number
  started_at?: string
  finished_at?: string
  decision: Decision
  reject_reason?: RejectReason | null
}

export interface WorkflowInstance {
  id: number
  tenant_id: string
  project_id: number
  unit_id: number
  workflow_id: number
  current_stage: string
  current_status: InstanceStatus
  stage_history?: StageRun[]
  sample_skipped?: boolean
  created_at?: string
  updated_at?: string
  [k: string]: any
}

export interface InstanceDiff {
  instance_id: number
  unit_id: number
  from_version: number
  to_version: number
  added: any[]
  modified: any[]
  removed: any[]
  [k: string]: any
}

// ===== Stage 5: Quality =====

export interface QualityOverview {
  project_id: number
  total_units: number
  completed_units: number
  first_pass_rate: number
  severe_error_rate: number
  trend?: Array<{
    date: string
    first_pass_rate: number
    reject_rate: number
  }>
  [k: string]: any
}

export interface QualityByAssigneeRow {
  assignee_id: number
  assignee_name?: string
  assigned: number
  completed: number
  first_pass_approved: number
  rejected: number
  reject_rate: number
  [k: string]: any
}

export interface QualityByReviewerRow {
  reviewer_id: number
  reviewer_name?: string
  reviewed: number
  approved: number
  rejected: number
  reject_rate: number
  [k: string]: any
}

export interface QualityRejectRow {
  category: string
  severity: string
  count: number
  [k: string]: any
}

export interface SampleCoverage {
  project_id: number
  total: number
  sampled: number
  rate: number
  [k: string]: any
}

// ===== Stage 6: Label =====

export interface UnitLabel {
  unit_id: number
  version: number
  mission: string
  data: any
  author_id?: number
  created_at?: string
  [k: string]: any
}

// ===== Stage 7: Batch + Unit =====

export type AssigneeStrategy = 'manual' | 'round_robin' | 'load_aware'

export interface BatchFrameRange {
  streams?: string[]
  start?: number
  end?: number
  step?: number
}

export interface Batch {
  id: number
  tenant_id: string
  project_id: number
  name: string
  slug: string
  mission: string
  seq_uuid: string
  assignee_strategy: AssigneeStrategy
  assignees: number[]
  reviewers?: number[]
  qa_pool?: number[]
  frame_range?: BatchFrameRange
  sampling_rate: number
  status: string
  unit_count?: number
  created_at?: string
  updated_at?: string
  [k: string]: any
}

export interface Unit {
  id: number
  tenant_id: string
  project_id: number
  batch_id?: number | null
  mission: string
  seq: string
  stream: string
  frame_start: number
  frame_end: number
  assignee_id?: number | null
  reviewer_id?: number | null
  current_stage?: string
  stage_status?: UnitStageStatus
  sample_skipped?: boolean
  created_at?: string
  updated_at?: string
  [k: string]: any
}

// ===== Stage 8: Me / Notification / Export / DataSeqs =====

export interface UserProfile {
  id: number
  email?: string
  mobile_phone_no?: string
  is_active?: boolean
  is_superuser?: boolean
  last_login?: string
  password_changed_at?: string
  avatar?: string
  note?: string
  preferences?: Record<string, any>
  roles?: Array<{ id: number; name: string; scope: string }>
  orgs?: Array<{ org_unit_id: number; role: string }>
  [k: string]: any
}

export interface Notification {
  audit_id: string
  action: string
  actor_id?: number
  actor_name?: string
  resource_type?: string
  resource_id?: string
  detail?: Record<string, any>
  created_at: string
  is_read: boolean
  summary?: string
  [k: string]: any
}

export interface ExportIn {
  project_id?: number
  batch_id?: number
  unit_ids?: number[]
  mission?: string
  [k: string]: any
}

export interface DataSeqItem {
  uuid: string
  seq: string
  stream_count: number
  created_time?: string
}

export interface DataSeqStream {
  name: string
  frame_count: number
}

export interface DataSeqDetail {
  uuid: string
  seq: string
  created_time?: string
  streams: DataSeqStream[]
}

export interface DataSeqFrame {
  frame_idx: number | string
  uri?: string
  name?: string
  timestamp?: string
}

// ===== Misc =====

export interface Paginated<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}
