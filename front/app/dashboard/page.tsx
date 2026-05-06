'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Network,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ResponsivePie } from '@nivo/pie'
import { knowledgeApi, graphApi } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { KnowledgeDocument, GraphNode, GraphEdge } from '@/lib/types'

const FORMAT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6']
const NODE_COLORS = ['#3b82f6', '#ef4444', '#8b5cf6', '#a855f7', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#ef4444', '#8b5cf6']

export default function DashboardPage() {
  const { t } = useI18n()
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] })

  const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    completed: { label: t('status.completed'), color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2 },
    failed: { label: t('status.failed'), color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
    parsing: { label: t('status.parsing'), color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Loader2 },
    extracting: { label: t('status.extracting'), color: 'text-purple-600 bg-purple-50 border-purple-200', icon: Loader2 },
    uploading: { label: t('status.uploading'), color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Loader2 },
  }

  const nodeTypeLabels: Record<string, string> = {
    document: t('nodeType.document'), agent: t('nodeType.agent'), object: t('nodeType.object'), concept: t('nodeType.concept'),
    event: t('nodeType.event'), activity: t('nodeType.activity'), rule: t('nodeType.rule'), metric: t('nodeType.metric'),
    time: t('nodeType.time'), location: t('nodeType.location'), statement: t('nodeType.statement'), issue: t('nodeType.issue'), image: t('nodeType.image'),
  }

  useEffect(() => {
    knowledgeApi.listDocuments().then(setDocuments).catch(() => {})
    graphApi.getGraphData().then(setGraphData).catch(() => {})
  }, [])

  // Document stats
  const docStats = {
    total: documents.length,
    completed: documents.filter(d => d.status === 'completed').length,
    processing: documents.filter(d => ['parsing', 'extracting', 'uploading'].includes(d.status)).length,
    failed: documents.filter(d => d.status === 'failed').length,
  }

  const formatChartData = useMemo(() => {
    const formatCounts = documents.reduce((acc, doc) => {
      const fmt = doc.format?.toLowerCase() || 'unknown'
      acc[fmt] = (acc[fmt] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(formatCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        id: name.toUpperCase(),
        label: name.toUpperCase(),
        value,
        color: FORMAT_COLORS[index % FORMAT_COLORS.length],
      }))
  }, [documents])

  // Graph stats
  const nodeChartData = useMemo(() => {
    const nodeTypeCounts = graphData.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(nodeTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, value], index) => ({
        id: nodeTypeLabels[type] || type,
        label: nodeTypeLabels[type] || type,
        value,
        color: NODE_COLORS[index % NODE_COLORS.length],
      }))
  }, [graphData.nodes])

  const recentDocs = documents
    .filter(d => ['parsing', 'extracting', 'uploading'].includes(d.status))
    .slice(0, 5)

  const failedDocs = documents.filter(d => d.status === 'failed').slice(0, 3)

  const nivoTheme = {
    labels: {
      text: {
        fontSize: 12,
        fill: 'var(--foreground)',
      },
    },
    legends: {
      text: {
        fontSize: 12,
        fill: 'var(--muted-foreground)',
      },
    },
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ staggerChildren: 0.1 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t('dashboard.docOverview')}
            </CardTitle>
            <CardDescription>{t('dashboard.docOverviewDesc', { count: documents.length, completed: docStats.completed })}</CardDescription>
          </CardHeader>
          <CardContent>
            {formatChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">{t('dashboard.noDocuments')}</p>
            ) : (
              <div className="h-[280px]">
                <ResponsivePie
                  data={formatChartData}
                  theme={nivoTheme}
                  margin={{ top: 20, right: 120, bottom: 20, left: 20 }}
                  innerRadius={0.55}
                  padAngle={1.5}
                  cornerRadius={4}
                  activeOuterRadiusOffset={8}
                  colors={{ datum: 'data.color' }}
                  borderWidth={2}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="var(--muted-foreground)"
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                  defs={[
                    {
                      id: 'dots',
                      type: 'patternDots',
                      background: 'inherit',
                      color: 'rgba(255, 255, 255, 0.3)',
                      size: 4,
                      padding: 1,
                      stagger: true,
                    },
                    {
                      id: 'lines',
                      type: 'patternLines',
                      background: 'inherit',
                      color: 'rgba(255, 255, 255, 0.3)',
                      rotation: -45,
                      lineWidth: 6,
                      spacing: 10,
                    },
                  ]}
                  fill={[
                    { match: { id: 'pdf' }, id: 'dots' },
                    { match: { id: 'docx' }, id: 'lines' },
                  ]}
                  legends={[
                    {
                      anchor: 'right',
                      direction: 'column',
                      justify: false,
                      translateX: 80,
                      translateY: 0,
                      itemsSpacing: 8,
                      itemWidth: 60,
                      itemHeight: 18,
                      itemTextColor: 'var(--muted-foreground)',
                      itemDirection: 'left-to-right',
                      itemOpacity: 1,
                      symbolSize: 12,
                      symbolShape: 'circle',
                    },
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Graph Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Network className="w-5 h-5" />
              {t('dashboard.graphOverview')}
            </CardTitle>
            <CardDescription>{t('dashboard.graphOverviewDesc', { nodes: graphData.nodes.length, edges: graphData.edges.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {nodeChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">{t('dashboard.noGraphData')}</p>
            ) : (
              <div className="h-[280px]">
                <ResponsivePie
                  data={nodeChartData}
                  theme={nivoTheme}
                  margin={{ top: 20, right: 120, bottom: 20, left: 20 }}
                  innerRadius={0.55}
                  padAngle={1.5}
                  cornerRadius={4}
                  activeOuterRadiusOffset={8}
                  colors={{ datum: 'data.color' }}
                  borderWidth={2}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="var(--muted-foreground)"
                  arcLinkLabelsThickness={2}
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                  defs={[
                    {
                      id: 'dots',
                      type: 'patternDots',
                      background: 'inherit',
                      color: 'rgba(255, 255, 255, 0.3)',
                      size: 4,
                      padding: 1,
                      stagger: true,
                    },
                    {
                      id: 'lines',
                      type: 'patternLines',
                      background: 'inherit',
                      color: 'rgba(255, 255, 255, 0.3)',
                      rotation: -45,
                      lineWidth: 6,
                      spacing: 10,
                    },
                  ]}
                  legends={[
                    {
                      anchor: 'right',
                      direction: 'column',
                      justify: false,
                      translateX: 80,
                      translateY: 0,
                      itemsSpacing: 8,
                      itemWidth: 60,
                      itemHeight: 18,
                      itemTextColor: 'var(--muted-foreground)',
                      itemDirection: 'left-to-right',
                      itemOpacity: 1,
                      symbolSize: 12,
                      symbolShape: 'circle',
                    },
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {t('dashboard.processingTasks')}
            </CardTitle>
            <CardDescription>{t('dashboard.processingTasksDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard.noProcessingTasks')}</p>
            ) : (
              <div className="space-y-3">
                {recentDocs.map(doc => {
                  const status = statusConfig[doc.status] || statusConfig.uploading
                  const StatusIcon = status.icon
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                      <StatusIcon className={`w-5 h-5 ${status.color.split(' ')[0]} ${doc.status !== 'failed' ? 'animate-spin' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.originalName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={doc.progress || 0} className="flex-1 h-1.5" />
                          <span className="text-xs text-muted-foreground">{doc.progress || 0}%</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={status.color}>
                        {status.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Failed Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              {t('dashboard.failedTasks')}
            </CardTitle>
            <CardDescription>{t('dashboard.failedTasksDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {failedDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard.noFailedTasks')}</p>
            ) : (
              <div className="space-y-3">
                {failedDocs.map(doc => (
                  <div key={doc.id} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      <p className="text-sm font-medium truncate">{doc.originalName}</p>
                    </div>
                    {doc.errorMessage && (
                      <p className="text-xs text-destructive/80 mt-1 line-clamp-2">{doc.errorMessage}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('dashboard.uploadedAt')} {doc.uploadedAt}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
