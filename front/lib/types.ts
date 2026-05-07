// 用户类型
export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  phone?: string
  status: 'active' | 'inactive' | 'locked'
  roles: string[]
  permissions: string[]
  createdAt: string
  lastLogin?: string
}

// 角色类型
export interface Role {
  id: string
  name: string
  code: string
  description?: string
  permissions: string[]
  userCount: number
  status: 'active' | 'inactive'
  createdAt: string
}

// 权限类型
export interface Permission {
  id: string
  name: string
  code: string
  module: string
  description?: string
  type: 'menu' | 'button' | 'api'
}

// 权限模块
export interface PermissionModule {
  module: string
  moduleName: string
  permissions: Permission[]
}

// 登录响应
export interface LoginResponse {
  success: boolean
  message: string
  token?: string
  user?: User
}

// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
  total: number
}

// 表格数据
export interface TableData<T> {
  data: T[]
  pagination: PaginationParams
}

// 导航菜单项
export interface NavItem {
  title: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string | number
  children?: NavItem[]
}

// 知识库文档类型
export interface KnowledgeDocument {
  id: string
  filename: string
  originalName: string
  format: 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'pptx' | 'ppt' | 'txt' | 'text' | 'png' | 'jpg' | 'jpeg' | 'webp' | 'gif' | 'bmp'
  size: number
  status: 'uploading' | 'parsing' | 'extracting' | 'completed' | 'failed'
  progress?: number
  content?: string
  markdownContent?: string
  summary?: string
  uploadedAt: string
  parsedAt?: string
  errorMessage?: string
  source_type?: 'file' | 'text'
}

// 实体来源
export interface EntitySource {
  doc_id?: number
  doc_name?: string
  excerpt: string
  addedAt: string
}

// 知识图谱节点类型（实体）
export interface GraphNode {
  id: string
  label: string
  summary: string
  // 类型：13种实体类型
  type: 'document' | 'agent' | 'object' | 'concept' | 'event' | 'activity' | 'rule' | 'metric' | 'time' | 'location' | 'statement' | 'issue' | 'image'
  subtype?: string
  sources: EntitySource[]
  confidence: number
  // D3 力导向图位置
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

// 关系边类型（25种）
export type EdgeRelationType =
  | 'mentions'
  | 'defines'
  | 'describes'
  | 'part_of'
  | 'contains'
  | 'belongs_to'
  | 'responsible_for'
  | 'performs'
  | 'uses'
  | 'creates'
  | 'requires'
  | 'prohibits'
  | 'permits'
  | 'depends_on'
  | 'causes'
  | 'affects'
  | 'mitigates'
  | 'measures'
  | 'attribute'
  | 'evidence_for'
  | 'contradicts'
  | 'derived_from'

// 知识图谱边类型
export interface GraphEdge {
  id: string
  source: string
  target: string
  relationship: EdgeRelationType
  relationshipLabel: string // 用于显示的中文标签
  weight: number
  confidence: number
}

// 证据级别
export type EvidenceLevel = 'full_text' | 'paragraph' | 'summary'

// 证据项
export interface Evidence {
  doc_id: number
  doc_name: string
  level: EvidenceLevel
  content: string
  entity_id?: string
}

// 知识图谱数据
export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// 合并候选组（同类型重复实体）
export interface MergeGroup {
  entities: GraphNode[]
  merged_label: string
  merged_summary: string
  reason: string
  confidence: number
}

// 合并预览
export interface MergePreview {
  entities: GraphNode[]
  merged_label: string
  merged_summary: string
  entity_type: string
  all_sources: EntitySource[]
  relations_to_migrate: Array<{
    from_id: string
    to_id: string
    rel_type: string
    direction: string
    weight: number
    confidence: number
  }>
  conflicts: Array<{ type: string; rel_type: string }>
}

// 合并结果
export interface MergeResult {
  new_entity: GraphNode
  absorbed_ids: string[]
  relations_migrated: number
  relations_deleted: number
}
