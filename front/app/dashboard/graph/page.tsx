'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  X,
  Maximize2,
  FileText,
  ChevronRight,
  BookOpen,
  Layers,
  Link2,
  Quote,
  Clock,
  TrendingUp,
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  User,
  Box,
  Zap,
  Activity,
  Shield,
  BarChart3,
  MapPin,
  AlertTriangle,
  Eye,
  Merge,
  ArrowRight,
  Check,
  SkipForward,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { graphApi, searchApi } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { GraphNode, GraphEdge, EdgeRelationType, MergeGroup, MergePreview } from '@/lib/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ForceGraph3D: any = null
if (typeof window !== 'undefined') {
  ForceGraph3D = require('react-force-graph-3d').default
}

// 自定义 markdown 组件：过滤空 src 图片
const markdownComponents = {
  img: ({ src, ...props }: any) => {
    if (!src) return null
    return <img src={src} {...props} />
  },
}

// 节点类型筛选组件
function TypeFilter({
  activeTypes,
  onToggle,
  nodeTypeConfig,
}: {
  activeTypes: Set<string>
  onToggle: (type: string) => void
  nodeTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }>
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {Object.entries(nodeTypeConfig).map(([type, config]) => {
        const Icon = config.icon
        const isActive = activeTypes.has(type)
        return (
          <Button
            key={type}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggle(type)}
            className={cn(
              'gap-1.5 transition-all text-xs',
              isActive && 'shadow-md'
            )}
            style={{
              backgroundColor: isActive ? config.color : undefined,
              borderColor: isActive ? config.color : undefined,
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {config.label}
          </Button>
        )
      })}
    </div>
  )
}

// 节点详情侧边栏
function NodeDetailSidebar({
  node,
  nodes,
  edges,
  onClose,
  onNodeSelect,
  nodeTypeConfig,
  edgeTypeConfig,
  t,
}: {
  node: GraphNode | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  onClose: () => void
  onNodeSelect: (nodeId: string) => void
  nodeTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }>
  edgeTypeConfig: Record<string, { color: string; label: string; dashArray?: string }>
  t: (key: string) => string
}) {
  if (!node) return null

  const config = nodeTypeConfig[node.type]
  const Icon = config.icon

  // 获取关联的边
  const relatedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  )

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute right-0 top-0 h-full w-96 bg-card border-l border-border shadow-xl z-20 overflow-hidden"
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">{node.label}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: config.color, color: config.color }}
                >
                  {config.label}
                </Badge>
                {node.subtype && (
                  <Badge variant="secondary" className="text-xs">
                    {node.subtype}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100%-88px)]">
        <div className="p-4 space-y-6">
          {/* 费曼总结 */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Quote className="w-4 h-4" />
              {t('graph.feynmanSummary')}
            </h4>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4 overflow-hidden">
                {node.type === 'rule' && (() => {
                  try {
                    const parsed = JSON.parse(node.summary)
                    return (
                      <pre className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words bg-muted/50 p-3 rounded-md overflow-x-auto max-h-96 overflow-y-auto font-mono">
                        {JSON.stringify(parsed, null, 2)}
                      </pre>
                    )
                  } catch {
                    return <p className="text-sm leading-relaxed text-foreground break-words">{node.summary}</p>
                  }
                })()}
                {node.type === 'image' && (() => {
                  try {
                    const parsed = JSON.parse(node.summary)
                    const openPreview = () => {
                      if (!parsed.image_url) return
                      window.open(parsed.image_url, '_blank')
                    }
                    return (
                      <div className="space-y-2 text-xs">
                        {parsed.caption && <p className="text-foreground break-words">{parsed.caption}</p>}
                        {parsed.image_url && (
                          <div className="space-y-2">
                            <div className="bg-muted/50 p-2 rounded overflow-x-auto">
                              <img
                                src={parsed.image_url}
                                alt={parsed.caption || ''}
                                className="max-w-full max-h-48 rounded"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            </div>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={openPreview}>
                              <Eye className="w-3.5 h-3.5" />
                              {t('graph.previewImage')}
                            </Button>
                          </div>
                        )}
                        <div className="text-muted-foreground break-all">
                          {parsed.doc_id && <span>文档#{parsed.doc_id}</span>}
                        </div>
                      </div>
                    )
                  } catch {
                    return <p className="text-sm leading-relaxed text-foreground break-words">{node.summary}</p>
                  }
                })()}
                {node.type !== 'rule' && node.type !== 'image' && (
                  <p className="text-sm leading-relaxed text-foreground break-words">{node.summary}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 属性指标 */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="col-span-2">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs flex-shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {t('graph.confidence')}
                  </div>
                  <Progress value={node.confidence} className="flex-1 h-2" />
                  <span className="text-sm font-medium flex-shrink-0">{node.confidence}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 关联关系 */}
          {relatedEdges.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                {t('graph.relations')} ({relatedEdges.length})
              </h4>
              <div className="space-y-2">
                {relatedEdges.map((edge) => {
                  const isSource = edge.source === node.id
                  const otherNodeId = isSource ? edge.target : edge.source
                  const otherNode = nodes.find((n) => n.id === otherNodeId)
                  if (!otherNode) return null

                  const otherConfig = nodeTypeConfig[otherNode.type]
                  const OtherIcon = otherConfig.icon
                  const edgeConfig = edgeTypeConfig[edge.relationship]

                  return (
                    <Card
                      key={edge.id}
                      className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => onNodeSelect(otherNodeId)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${otherConfig.color}20` }}
                          >
                            <OtherIcon className="w-4 h-4" style={{ color: otherConfig.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{otherNode.label}</div>
                            <div
                              className="text-xs flex items-center gap-1 mt-0.5"
                              style={{ color: edgeConfig.color }}
                            >
                              {isSource ? (
                                <>
                                  <ChevronRight className="w-3 h-3" />
                                  {edgeConfig.label}
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="w-3 h-3 rotate-180" />
                                  {edgeConfig.label}
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(edge.weight * 100)}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* 来源列表 */}
          {node.sources.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('graph.sourceDocuments')} ({node.sources.length})
              </h4>
              <div className="space-y-3">
                {node.sources.map((source, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-primary break-all line-clamp-1">
                          {source.doc_name || `文档#${source.doc_id}`}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded break-words overflow-hidden [&_img]:max-w-full [&_img]:max-h-32 [&_img]:rounded [&_pre]:overflow-x-auto [&_pre]:max-h-32 [&_table]:text-xs [&_table]:w-full [&_table]:overflow-x-auto [&_td]:px-1 [&_td]:py-0.5 [&_td]:border [&_td]:border-border/30 [&_th]:px-1 [&_th]:py-0.5 [&_th]:border [&_th]:border-border/30 [&_th]:bg-muted">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                          {source.excerpt || ''}
                        </ReactMarkdown>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {source.addedAt}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  )
}

export default function GraphPage() {
  const { t } = useI18n()
  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(['document', 'agent', 'object', 'concept', 'event', 'activity', 'rule', 'metric', 'time', 'location', 'statement', 'issue', 'image'])
  )

  const nodeTypeConfig: Record<GraphNode['type'], { icon: React.ElementType; color: string; label: string }> = {
    document:  { icon: FileText,      color: '#3b82f6', label: t('nodeType.document') },
    agent:     { icon: User,          color: '#ef4444', label: t('nodeType.agent') },
    object:    { icon: Box,           color: '#8b5cf6', label: t('nodeType.object') },
    concept:   { icon: BookOpen,      color: '#a855f7', label: t('nodeType.concept') },
    event:     { icon: Zap,           color: '#f59e0b', label: t('nodeType.event') },
    activity:  { icon: Activity,      color: '#10b981', label: t('nodeType.activity') },
    rule:      { icon: Shield,        color: '#6366f1', label: t('nodeType.rule') },
    metric:    { icon: BarChart3,     color: '#ec4899', label: t('nodeType.metric') },
    time:      { icon: Clock,         color: '#14b8a6', label: t('nodeType.time') },
    location:  { icon: MapPin,        color: '#f97316', label: t('nodeType.location') },
    statement: { icon: MessageSquare, color: '#06b6d4', label: t('nodeType.statement') },
    issue:     { icon: AlertTriangle, color: '#ef4444', label: t('nodeType.issue') },
    image:     { icon: FileText,      color: '#8b5cf6', label: t('nodeType.image') },
  }

  const edgeTypeConfig: Record<EdgeRelationType, { color: string; label: string; dashArray?: string }> = {
    mentions:        { color: '#3b82f6', label: t('edgeType.mentions') },
    defines:         { color: '#2563eb', label: t('edgeType.defines') },
    describes:       { color: '#1d4ed8', label: t('edgeType.describes') },
    part_of:         { color: '#8b5cf6', label: t('edgeType.part_of') },
    contains:        { color: '#7c3aed', label: t('edgeType.contains') },
    belongs_to:      { color: '#6d28d9', label: t('edgeType.belongs_to') },
    responsible_for: { color: '#10b981', label: t('edgeType.responsible_for') },
    performs:        { color: '#059669', label: t('edgeType.performs') },
    uses:            { color: '#047857', label: t('edgeType.uses') },
    creates:         { color: '#065f46', label: t('edgeType.creates') },
    requires:        { color: '#f59e0b', label: t('edgeType.requires') },
    prohibits:       { color: '#d97706', label: t('edgeType.prohibits'), dashArray: '3,3' },
    permits:         { color: '#b45309', label: t('edgeType.permits') },
    depends_on:      { color: '#92400e', label: t('edgeType.depends_on') },
    causes:          { color: '#ef4444', label: t('edgeType.causes') },
    affects:         { color: '#dc2626', label: t('edgeType.affects') },
    mitigates:       { color: '#f97316', label: t('edgeType.mitigates') },
    measures:        { color: '#ec4899', label: t('edgeType.measures') },
    attribute:       { color: '#14b8a6', label: t('edgeType.attribute') },
    evidence_for:    { color: '#06b6d4', label: t('edgeType.evidence_for') },
    contradicts:     { color: '#0891b2', label: t('edgeType.contradicts'), dashArray: '4,2' },
    derived_from:    { color: '#0e7490', label: t('edgeType.derived_from') },
  }

  const [mounted, setMounted] = useState(false)
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] })
  const [graphLoadError, setGraphLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { setMounted(true) }, [])

  // 检索测试状态
  const [retrievalOpen, setRetrievalOpen] = useState(false)
  const [retrievalQuery, setRetrievalQuery] = useState('')
  const [retrievalLoading, setRetrievalLoading] = useState(false)
  const [retrievalError, setRetrievalError] = useState<string | null>(null)
  const [retrievalResult, setRetrievalResult] = useState<{
    answer: string
    problem_archetype: string
    entities: Array<{ id: string; label: string; type: string; summary: string }>
    evidences: Array<{ doc_id: number; doc_name: string; level: string; content: string; entity_id?: string }>
  } | null>(null)

  const handleRetrieval = async () => {
    if (!retrievalQuery.trim()) return
    setRetrievalLoading(true)
    setRetrievalResult(null)
    setRetrievalError(null)
    try {
      const result = await searchApi.query(retrievalQuery)
      setRetrievalResult(result)
    } catch (e: any) {
      console.error('Retrieval failed:', e)
      setRetrievalError(e?.message || t('error.retrievalFailed'))
    } finally {
      setRetrievalLoading(false)
    }
  }

  // 合并扫描状态
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeScanning, setMergeScanning] = useState(false)
  const [mergeCandidates, setMergeCandidates] = useState<MergeGroup[]>([])
  const [mergeCandidateIndex, setMergeCandidateIndex] = useState(0)
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null)
  const [mergePreviewLoading, setMergePreviewLoading] = useState(false)
  const [mergeExecuting, setMergeExecuting] = useState(false)
  const [mergedLabel, setMergedLabel] = useState('')
  const [mergedSummary, setMergedSummary] = useState('')
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])

  // 跳过的合并组（持久化到 localStorage）
  const [skippedGroups, setSkippedGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem('hbrain_merge_skipped')
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  })

  const saveSkipped = (ids: string[]) => {
    setSkippedGroups(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      try { localStorage.setItem('hbrain_merge_skipped', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const clearSkipped = () => {
    setSkippedGroups(new Set())
    try { localStorage.removeItem('hbrain_merge_skipped') } catch {}
  }

  // 判断一个候选组是否已被跳过
  const isGroupSkipped = (group: MergeGroup) => {
    const ids = group.entities.map(e => e.id).sort()
    return ids.every(id => skippedGroups.has(id))
  }

  const handleMergeScan = async () => {
    setMergeScanning(true)
    setMergeCandidates([])
    setMergeCandidateIndex(0)
    setMergePreview(null)
    try {
      const result = await graphApi.mergeScan()
      const all = result.candidates || []
      // 过滤掉已跳过的组
      const filtered = all.filter((g: MergeGroup) => !isGroupSkipped(g))
      setMergeCandidates(filtered)
    } catch (e: any) {
      console.error('Merge scan failed:', e)
      toast.error(t('graph.mergeFailed'), { description: e?.message })
    } finally {
      setMergeScanning(false)
    }
  }

  const handleMergePreview = async (entityIds: string[], label: string, summary: string) => {
    setMergePreviewLoading(true)
    setMergePreview(null)
    try {
      const result = await graphApi.mergePreview(entityIds, label, summary)
      setMergePreview(result)
    } catch (e: any) {
      console.error('Merge preview failed:', e)
      toast.error(t('graph.mergeFailed'), { description: e?.message })
    } finally {
      setMergePreviewLoading(false)
    }
  }

  const handleMergeExecute = async () => {
    if (!currentCandidate) return
    const idsToMerge = selectedEntityIds.length >= 2 ? selectedEntityIds : currentCandidate.entities.map(e => e.id)
    if (idsToMerge.length < 2) return
    setMergeExecuting(true)
    try {
      const result = await graphApi.mergeExecute(idsToMerge, mergedLabel, mergedSummary)
      toast.success(t('graph.mergeSuccess', { relations: result.relations_migrated }))
      // Remove merged candidate and move to next
      const newCandidates = [...mergeCandidates]
      newCandidates.splice(mergeCandidateIndex, 1)
      setMergeCandidates(newCandidates)
      setMergePreview(null)
      if (mergeCandidateIndex >= newCandidates.length && newCandidates.length > 0) {
        setMergeCandidateIndex(newCandidates.length - 1)
      }
      // Refresh graph data
      graphApi.getGraphData().then(setGraphData).catch(() => {})
    } catch (e: any) {
      console.error('Merge execute failed:', e)
      toast.error(t('graph.mergeFailed'), { description: e?.message })
    } finally {
      setMergeExecuting(false)
    }
  }

  const handleMergeSkip = () => {
    if (!currentCandidate) return
    // 保存到跳过列表
    saveSkipped(currentCandidate.entities.map(e => e.id))
    const newCandidates = [...mergeCandidates]
    newCandidates.splice(mergeCandidateIndex, 1)
    setMergeCandidates(newCandidates)
    setMergePreview(null)
    if (mergeCandidateIndex >= newCandidates.length && newCandidates.length > 0) {
      setMergeCandidateIndex(newCandidates.length - 1)
    }
  }

  // 显示已跳过的组
  const handleShowSkipped = async () => {
    if (skippedGroups.size === 0) return
    clearSkipped()
    // 重新扫描
    await handleMergeScan()
  }

  const currentCandidate = mergeCandidates[mergeCandidateIndex] || null

  // 当切换候选时，初始化合并标签、总结和选中实体
  useEffect(() => {
    if (currentCandidate) {
      setMergedLabel(currentCandidate.merged_label)
      setMergedSummary(currentCandidate.merged_summary)
      setSelectedEntityIds(currentCandidate.entities.map(e => e.id))
      setMergePreview(null)
    }
  }, [mergeCandidateIndex, currentCandidate])

  // 加载图谱数据（搜索或初始加载）
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setGraphLoadError(null)

    if (!searchQuery) {
      graphApi.getGraphData({ signal: controller.signal })
        .then((data) => { if (!controller.signal.aborted) setGraphData(data) })
        .catch((e) => {
          if (e.name === 'AbortError') return
          if (!controller.signal.aborted) {
            console.error('Failed to load graph data:', e)
            setGraphLoadError(e?.message || t('error.loadGraphFailed'))
          }
        })
        .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
      return () => controller.abort()
    }

    const timer = setTimeout(() => {
      graphApi.searchGraph(searchQuery, { signal: controller.signal })
        .then((data) => { if (!controller.signal.aborted) setGraphData(data) })
        .catch((e) => {
          if (e.name === 'AbortError') return
          if (!controller.signal.aborted) {
            console.error('Failed to search graph:', e)
            setGraphLoadError(e?.message || t('error.searchGraphFailed'))
          }
        })
        .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    }, 300)

    return () => { clearTimeout(timer); controller.abort() }
  }, [searchQuery])

  // 筛选节点和边（按类型）
  const filteredData = useMemo(() => {
    const nodes = graphData.nodes.filter((node) => activeTypes.has(node.type))
    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = graphData.edges.filter(
      (edge) => nodeIds.has(edge.source as string) && nodeIds.has(edge.target as string)
    )
    return { nodes, edges }
  }, [
    graphData.nodes.length,
    graphData.edges.length,
    graphData.nodes.map(n => n.id).join(','),
    activeTypes.size,
    [...activeTypes].sort().join(','),
  ])

  // Stable key for graphData3D — only recalculate when node/edge IDs actually change
  const graphDataKey = useMemo(
    () => filteredData.nodes.map(n => n.id).join(',') + '|' + filteredData.edges.map(e => e.id).join(','),
    [filteredData]
  )

  // 转换为 3D graph 数据格式
  const graphData3D = useMemo(() => ({
    nodes: filteredData.nodes.map(n => ({
      ...n,
      x: n.x ?? 0,
      y: n.y ?? 0,
    })),
    links: filteredData.edges.map(e => ({
      ...e,
      source: e.source as string,
      target: e.target as string,
    })),
  }) as any, [graphDataKey])

  // 切换类型筛选
  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  // 选择节点
  const handleNodeSelect = useCallback((nodeId: string) => {
    const node = graphData.nodes.find(n => n.id === nodeId)
    if (node) {
      setSelectedNode(node)
    }
  }, [graphData.nodes])

  // 处理容器尺寸
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // 重置视图
  const handleReset = useCallback(() => {
    const fg = graphRef.current
    if (!fg) return
    fg.zoomToFit(400, 50)
  }, [])

  // 统计数据
  const stats = useMemo(() => ({
    nodes: filteredData.nodes.length,
    edges: filteredData.edges.length,
    types: activeTypes.size,
  }), [filteredData, activeTypes])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-[calc(100vh-120px)] flex flex-col"
    >
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('graph.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('graph.subtitle', { nodes: stats.nodes, edges: stats.edges })}
          </p>
        </div>
      </div>

      {/* 主内容区 */}
      <Card className="flex-1 overflow-hidden relative">
        {/* 悬浮工具栏 */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <Card className="shadow-lg bg-card/95 backdrop-blur-sm">
            <CardContent className="py-3 px-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* 搜索 */}
                <div className="relative flex-shrink-0 w-full lg:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t('search.graphPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* 类型筛选 */}
                <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
                  <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <TypeFilter activeTypes={activeTypes} onToggle={toggleType} nodeTypeConfig={nodeTypeConfig} />
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="icon" onClick={handleReset}>
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6 mx-1" />
                  <Button
                    variant={mergeOpen ? 'default' : 'outline'}
                    onClick={() => {
                      setMergeOpen(!mergeOpen)
                      if (!mergeOpen && mergeCandidates.length === 0) {
                        handleMergeScan()
                      }
                    }}
                    className="gap-1.5"
                  >
                    <Merge className="w-4 h-4" />
                    {t('graph.mergeScan')}
                  </Button>
                  <Button
                    variant={retrievalOpen ? 'default' : 'outline'}
                    onClick={() => setRetrievalOpen(!retrievalOpen)}
                    className="gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {t('graph.retrievalTest')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 图例 */}
        <div className="absolute bottom-4 left-4 z-10">
          <Card className="shadow-lg bg-card/95 backdrop-blur-sm max-w-md">
            <CardContent className="p-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('graph.relationTypes')}</h4>
              <ScrollArea className="max-h-48">
                <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                  {Object.entries(edgeTypeConfig).map(([type, config]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-0.5 flex-shrink-0"
                        style={{
                          backgroundColor: config.color,
                          borderStyle: config.dashArray ? 'dashed' : 'solid'
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground truncate">{config.label}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* 3D 画布 */}
        <div
          ref={containerRef}
          className="w-full h-full bg-gradient-to-br from-background via-background to-primary/5 relative"
        >
          {isLoading && !graphData.nodes.length ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-10 h-10 animate-spin opacity-50" />
                <span className="text-sm">{t('action.loading') || '加载中...'}</span>
              </div>
            </div>
          ) : mounted && ForceGraph3D && filteredData.nodes.length > 0 ? (
            <ForceGraph3D
              ref={graphRef}
              graphData={graphData3D}
              nodeId="id"
              nodeVal={(node: any) => (node?.confidence ?? 50) / 10 + 5}
              nodeColor={(node: any) => (nodeTypeConfig as any)[node?.type]?.color || '#6b7280'}
              nodeLabel={(node: any) => node ? `${node.label}\n${(nodeTypeConfig as any)[node.type]?.label || node.type} | ${node.confidence}%` : ''}
              nodeOpacity={0.9}
              nodeResolution={16}
              linkColor={(link: any) => (edgeTypeConfig as any)[link?.relationship]?.color || '#999'}
              linkWidth={(link: any) => Math.max(1, Math.sqrt((link?.weight ?? 0.5)) * 2)}
              linkOpacity={0.6}
              linkDirectionalArrowLength={6}
              linkDirectionalArrowRelPos={1}
              linkDirectionalParticles={(link: any) => (link?.weight ?? 0) > 0.7 ? 2 : 0}
              linkDirectionalParticleSpeed={0.005}
              linkLabel={(link: any) => (edgeTypeConfig as any)[link?.relationship]?.label || link?.relationship || ''}
              onNodeClick={(node: any) => { if (node) setSelectedNode(node) }}
              onBackgroundClick={() => setSelectedNode(null)}
              backgroundColor="rgba(0,0,0,0)"
              showNavInfo={false}
              controlType="trackball"
              d3VelocityDecay={0.3}
              warmupTicks={50}
              cooldownTicks={200}
              width={dimensions.width}
              height={dimensions.height}
            />
          ) : (
            !graphLoadError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Layers className="w-10 h-10 opacity-30" />
                  <span className="text-sm">{t('graph.emptyGraph')}</span>
                </div>
              </div>
            )
          )}
          {graphLoadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-3 text-destructive">
                <AlertTriangle className="w-8 h-8" />
                <span className="text-sm font-medium">{graphLoadError}</span>
                <Button variant="outline" size="sm" onClick={() => {
                  setGraphLoadError(null)
                  setIsLoading(true)
                  graphApi.getGraphData()
                    .then(setGraphData)
                    .catch((e: any) => setGraphLoadError(e?.message || t('error.loadFailed')))
                    .finally(() => setIsLoading(false))
                }}>
                  {t('action.retry')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 节点详情侧边栏 */}
        <AnimatePresence>
          {selectedNode && (
            <NodeDetailSidebar
              node={selectedNode}
              nodes={filteredData.nodes}
              edges={filteredData.edges}
              onClose={() => setSelectedNode(null)}
              onNodeSelect={handleNodeSelect}
              nodeTypeConfig={nodeTypeConfig}
              edgeTypeConfig={edgeTypeConfig}
              t={t}
            />
          )}
        </AnimatePresence>

        {/* 合并扫描面板 */}
        <AnimatePresence>
          {mergeOpen && (
            <motion.div
              initial={{ x: -420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -420, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute left-0 top-0 h-full w-[400px] bg-card border-r border-border shadow-xl z-20 flex flex-col overflow-hidden"
            >
              {/* 头部 */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Merge className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t('graph.mergeCandidates')}</h3>
                  {mergeCandidates.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {mergeCandidateIndex + 1}/{mergeCandidates.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={handleMergeScan} disabled={mergeScanning}>
                    <RotateCcw className={cn('w-4 h-4', mergeScanning && 'animate-spin')} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setMergeOpen(false); setMergePreview(null) }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* 内容区 */}
              <ScrollArea className="flex-1 min-h-0">
                {mergeScanning ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Loader2 className="w-10 h-10 mb-3 animate-spin text-primary" />
                    <p className="text-sm">{t('graph.mergeScanning')}</p>
                  </div>
                ) : mergeCandidates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                    <Merge className="w-10 h-10 opacity-30" />
                    <p className="text-sm">{t('graph.mergeNoCandidates')}</p>
                    {skippedGroups.size > 0 && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShowSkipped}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t('graph.mergeClearSkipped')} ({skippedGroups.size})
                      </Button>
                    )}
                  </div>
                ) : currentCandidate ? (
                  <div className="p-4 space-y-4">
                    {/* 组内实体列表 */}
                    <div className="space-y-2">
                      {currentCandidate.entities.length > 3 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{t('graph.mergeSelected', { selected: selectedEntityIds.length, total: currentCandidate.entities.length })}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setSelectedEntityIds(
                              selectedEntityIds.length === currentCandidate.entities.length
                                ? []
                                : currentCandidate.entities.map(e => e.id)
                            )}
                          >
                            {selectedEntityIds.length === currentCandidate.entities.length ? '全不选' : '全选'}
                          </Button>
                        </div>
                      )}
                      {currentCandidate.entities.map((entity) => {
                        const config = (nodeTypeConfig as any)[entity.type]
                        const Icon = config?.icon || BookOpen
                        const color = config?.color || '#6b7280'
                        const canDeselect = currentCandidate.entities.length > 3
                        const isSelected = selectedEntityIds.includes(entity.id)
                        return (
                          <Card
                            key={entity.id}
                            className={cn(
                              'overflow-hidden transition-all',
                              canDeselect && !isSelected && 'opacity-40'
                            )}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                {canDeselect && (
                                  <button
                                    className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                                    style={{
                                      borderColor: isSelected ? color : 'hsl(var(--border))',
                                      backgroundColor: isSelected ? color : 'transparent',
                                    }}
                                    onClick={() => setSelectedEntityIds(prev =>
                                      isSelected ? prev.filter(id => id !== entity.id) : [...prev, entity.id]
                                    )}
                                  >
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                )}
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: `${color}20` }}
                                >
                                  <Icon className="w-4 h-4" style={{ color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">{entity.label}</span>
                                    <Badge variant="outline" className="text-xs" style={{ borderColor: color, color }}>
                                      {config?.label || entity.type}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2 break-words mt-1">
                                    {entity.summary}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>

                    {/* 判定原因 */}
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="font-medium">{t('graph.mergeReason')}</span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            {t('graph.mergeConfidence')}: {Math.round(currentCandidate.confidence * 100)}%
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground">{currentCandidate.reason}</p>
                      </CardContent>
                    </Card>

                    {/* 合并后内容（可编辑） */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('graph.mergeMergedLabel')}</h4>
                        <Input
                          value={mergedLabel}
                          onChange={(e) => setMergedLabel(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('graph.mergeMergedSummary')}</h4>
                        <Textarea
                          value={mergedSummary}
                          onChange={(e) => setMergedSummary(e.target.value)}
                          rows={4}
                          className="text-sm resize-none"
                        />
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={handleMergeSkip}
                      >
                        <SkipForward className="w-4 h-4" />
                        {t('graph.mergeReject')}
                      </Button>
                      <Button
                        className="flex-1 gap-1.5"
                        disabled={selectedEntityIds.length < 2}
                        onClick={() => {
                          handleMergePreview(selectedEntityIds, mergedLabel, mergedSummary)
                        }}
                      >
                        <ArrowRight className="w-4 h-4" />
                        {t('graph.mergePreview')}
                      </Button>
                    </div>

                    {/* 合并预览 */}
                    {mergePreviewLoading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    )}

                    {mergePreview && (
                      <div className="space-y-3">
                        <Separator />

                        {/* 来源文档数 */}
                        {mergePreview.all_sources.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <FileText className="w-3.5 h-3.5" />
                            {t('graph.sourceDocuments')}: {mergePreview.all_sources.length}
                          </div>
                        )}

                        {/* 待迁移关系 */}
                        {mergePreview.relations_to_migrate.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-2">
                              {t('graph.mergeRelationsToMigrate')} ({mergePreview.relations_to_migrate.length})
                            </h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {mergePreview.relations_to_migrate.map((rel, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Link2 className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{rel.rel_type}</span>
                                  <Badge variant="outline" className="text-[10px] px-1">
                                    {rel.direction}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 冲突 */}
                        {mergePreview.conflicts.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-2">
                              {t('graph.mergeConflicts')} ({mergePreview.conflicts.length})
                            </h4>
                            <div className="space-y-1">
                              {mergePreview.conflicts.map((c, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs text-amber-600">
                                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                  {t('graph.mergeSelfLoop')} ({c.rel_type})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 确认合并 */}
                        <Button
                          className="w-full gap-1.5"
                          onClick={handleMergeExecute}
                          disabled={mergeExecuting}
                        >
                          {mergeExecuting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {t('graph.mergeConfirm')}
                        </Button>
                      </div>
                    )}

                    {/* 导航 */}
                    {mergeCandidates.length > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={mergeCandidateIndex === 0}
                          onClick={() => {
                            setMergeCandidateIndex(mergeCandidateIndex - 1)
                            setMergePreview(null)
                          }}
                        >
                          {t('action.prev')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={mergeCandidateIndex >= mergeCandidates.length - 1}
                          onClick={() => {
                            setMergeCandidateIndex(mergeCandidateIndex + 1)
                            setMergePreview(null)
                          }}
                        >
                          {t('action.next')}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 检索测试面板 */}
        <AnimatePresence>
          {retrievalOpen && (
            <motion.div
              initial={{ x: 520, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 520, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 h-full w-[480px] bg-card border-l border-border shadow-xl z-20 flex flex-col overflow-hidden"
            >
              {/* 头部 */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t('graph.retrievalTest')}</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => {
                  setRetrievalOpen(false)
                  setRetrievalResult(null)
                  setRetrievalError(null)
                  setRetrievalQuery('')
                }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* 输入区 */}
              <div className="p-4 border-b border-border">
                <div className="flex gap-2">
                  <Textarea
                    placeholder={t('graph.inputQuestionPlaceholder')}
                    value={retrievalQuery}
                    onChange={(e) => setRetrievalQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleRetrieval()
                      }
                    }}
                    rows={2}
                    className="resize-none flex-1"
                  />
                  <Button
                    onClick={handleRetrieval}
                    disabled={retrievalLoading || !retrievalQuery.trim()}
                    className="self-end"
                  >
                    {retrievalLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* 结果区 */}
              <ScrollArea className="flex-1 min-h-0">
                {retrievalError ? (
                  <div className="p-4">
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {retrievalError}
                    </div>
                  </div>
                ) : retrievalResult ? (
                  <div className="p-4 space-y-5">
                    {/* 问题原型 */}
                    {retrievalResult.problem_archetype && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {t('graph.problemArchetype')}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {retrievalResult.problem_archetype}
                        </span>
                      </div>
                    )}

                    {/* 回答 */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        {t('graph.answer')}
                      </h4>
                      <Card className="bg-primary/5 border-primary/20 overflow-hidden min-w-0">
                        <CardContent className="pt-4 overflow-hidden">
                          <div className="text-sm leading-relaxed text-foreground overflow-hidden break-words [&_img]:max-w-full [&_img]:rounded [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:break-all [&_table]:text-xs [&_table]:overflow-x-auto [&_table]:w-full [&_a]:break-all">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                              {retrievalResult.answer}
                            </ReactMarkdown>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* 匹配实体 */}
                    {retrievalResult.entities.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          {t('graph.matchedEntities')} ({retrievalResult.entities.length})
                        </h4>
                        <div className="space-y-2">
                          {retrievalResult.entities.map((entity) => {
                            const config = nodeTypeConfig[entity.type as GraphNode['type']]
                            const Icon = config?.icon || BookOpen
                            const color = config?.color || '#6b7280'
                            return (
                              <Card key={entity.id} className="overflow-hidden">
                                <CardContent className="p-3">
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                      style={{ backgroundColor: `${color}20` }}
                                    >
                                      <Icon className="w-4 h-4" style={{ color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{entity.label}</span>
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                          style={{ borderColor: color, color }}
                                        >
                                          {config?.label || entity.type}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1 break-words overflow-hidden [&_pre]:overflow-x-auto [&_pre]:max-h-24 [&_table]:text-xs [&_table]:overflow-x-auto">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                                          {entity.summary}
                                        </ReactMarkdown>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 证据 */}
                    {retrievalResult.evidences.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {t('graph.relatedEvidence')} ({retrievalResult.evidences.length})
                        </h4>
                        <div className="space-y-2">
                          {retrievalResult.evidences.map((ev, idx) => {
                            const levelConfig: Record<string, { color: string; bg: string; label: string }> = {
                              full_text: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: t('graph.evidenceFullText') },
                              paragraph: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: t('graph.evidenceParagraph') },
                              summary: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: t('graph.evidenceSummary') },
                            }
                            const lc = levelConfig[ev.level] || levelConfig.summary
                            return (
                              <Card key={idx} className="overflow-hidden">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className={cn('text-xs border', lc.bg, lc.color)}>
                                      {lc.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {ev.doc_name}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded leading-relaxed break-words overflow-hidden [&_img]:max-w-full [&_img]:max-h-32 [&_img]:rounded [&_pre]:overflow-x-auto [&_pre]:max-h-32 [&_table]:text-xs [&_table]:overflow-x-auto">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                                      {ev.content || ''}
                                    </ReactMarkdown>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">{t('graph.emptyRetrieval')}</p>
                    <p className="text-xs mt-1">{t('graph.emptyRetrievalDesc')}</p>
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}
