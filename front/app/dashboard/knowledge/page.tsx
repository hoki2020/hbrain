'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  FileText,
  FileType,
  Upload,
  Search,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  Loader2,
  File,
  Filter,
  Download,
  Image,
  RefreshCw,
  FileEdit,
  ClipboardPaste,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { knowledgeApi } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import type { KnowledgeDocument } from '@/lib/types'

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 获取格式图标
function FormatIcon({ format }: { format: string }) {
  const iconClass = 'w-5 h-5'
  
  switch (format) {
    case 'pdf':
      return <FileText className={`${iconClass} text-red-500`} />
    case 'docx':
    case 'doc':
      return <FileType className={`${iconClass} text-blue-500`} />
    case 'xlsx':
    case 'xls':
      return <FileText className={`${iconClass} text-green-500`} />
    case 'pptx':
    case 'ppt':
      return <FileText className={`${iconClass} text-orange-500`} />
    case 'txt':
      return <File className={`${iconClass} text-gray-500`} />
    case 'text':
      return <FileEdit className={`${iconClass} text-teal-500`} />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
    case 'bmp':
      return <Image className={`${iconClass} text-purple-500`} />
    default:
      return <File className={`${iconClass} text-muted-foreground`} />
  }
}

// 状态徽章组件
function StatusBadge({ status }: { status: KnowledgeDocument['status'] }) {
  const { t } = useI18n()
  switch (status) {
    case 'uploading':
      return (
        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('status.uploading')}
        </Badge>
      )
    case 'parsing':
      return (
        <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('status.parsing')}
        </Badge>
      )
    case 'extracting':
      return (
        <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('status.extracting')}
        </Badge>
      )
    case 'completed':
      return (
        <Badge variant="outline" className="gap-1 bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
          <CheckCircle className="w-3 h-3" />
          {t('status.completed')}
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="outline" className="gap-1 bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
          <AlertCircle className="w-3 h-3" />
          {t('status.failed')}
        </Badge>
      )
    default:
      return null
  }
}

export default function KnowledgePage() {
  const { t } = useI18n()
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [formatFilter, setFormatFilter] = useState<string>('all')
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<KnowledgeDocument | null>(null)
  const [logDialogOpen, setLogDialogOpen] = useState(false)
  const [logDoc, setLogDoc] = useState<KnowledgeDocument | null>(null)
  const [logData, setLogData] = useState<{ status: string; progress?: number; errorMessage?: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [convertToWiki, setConvertToWiki] = useState(false)
  const [textSubmitting, setTextSubmitting] = useState(false)
  const { hasPermission } = useAuth()
  const canUpload = hasPermission('knowledge:upload')
  const canDelete = hasPermission('knowledge:delete')

  // Keep a ref in sync so the polling interval always reads the latest documents
  // without depending on `documents` in the effect (which would recreate the interval).
  const docsRef = useRef<KnowledgeDocument[]>(documents)
  docsRef.current = documents

  // 加载文档列表
  const loadDocuments = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const docs = await knowledgeApi.listDocuments({ signal })
      if (!signal?.aborted) setDocuments(docs)
    } catch (e: any) {
      if (e.name === 'AbortError') return
      if (!signal?.aborted) {
        console.error('Failed to load documents:', e)
        setLoadError(e?.message || t('error.loadDocumentListFailed'))
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadDocuments(controller.signal)
    return () => controller.abort()
  }, [loadDocuments])

  // 轮询解析中的文档状态 — runs once on mount, cleans up on unmount
  useEffect(() => {
    const interval = setInterval(async () => {
      const parsingDocs = docsRef.current.filter(d =>
        !d.id.startsWith('temp-') && (d.status === 'parsing' || d.status === 'uploading' || d.status === 'extracting')
      )
      if (parsingDocs.length === 0) return

      const results = await Promise.allSettled(
        parsingDocs.map(doc => knowledgeApi.getDocument(doc.id))
      )
      setDocuments(prev => {
        const next = [...prev]
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'fulfilled') {
            const updated = (results[i] as PromiseFulfilledResult<any>).value
            const idx = next.findIndex(d => d.id === parsingDocs[i].id)
            if (idx !== -1) next[idx] = { ...next[idx], ...updated }
          }
        }
        return next
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // 拖拽上传配置
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploadDialogOpen(false)
    for (const file of acceptedFiles) {
      const tempId = `temp-${Date.now()}-${Math.random()}`
      const tempDoc: KnowledgeDocument = {
        id: tempId,
        filename: file.name,
        originalName: file.name,
        format: file.name.split('.').pop()?.toLowerCase() as any || 'txt',
        size: file.size,
        status: 'uploading',
        progress: 0,
        uploadedAt: new Date().toISOString(),
      }
      setDocuments(prev => [tempDoc, ...prev])

      try {
        const result = await knowledgeApi.uploadDocument(file)
        setDocuments(prev => prev.map(d => d.id === tempId ? { ...result, progress: 100 } : d))
      } catch (e) {
        setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, status: 'failed', errorMessage: t('error.uploadFailed') } : d))
        console.error('Upload failed:', e)
      }
    }
  }, [])

  // 提交文本片段
  const handleSubmitText = useCallback(async () => {
    if (!textTitle.trim()) return
    if (!textContent.trim()) return

    setTextSubmitting(true)
    try {
      const result = await knowledgeApi.submitText({
        title: textTitle.trim(),
        content: textContent.trim(),
        convert_to_wiki: convertToWiki,
      })
      const tempDoc: KnowledgeDocument = {
        ...result,
        progress: 0,
      }
      setDocuments(prev => [tempDoc, ...prev])
      setTextTitle('')
      setTextContent('')
      setConvertToWiki(false)
      setUploadDialogOpen(false)
    } catch (e) {
      console.error('Text submit failed:', e)
    } finally {
      setTextSubmitting(false)
    }
  }, [textTitle, textContent, convertToWiki])

  const { getRootProps, getInputProps, isDragActive, isFocused } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'text/plain': ['.txt'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
    },
    multiple: true,
  })

  // 筛选文档
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const originalName = doc.originalName || ''
      const filename = doc.filename || ''
      const matchesSearch =
        originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        filename.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter
      const matchesFormat = formatFilter === 'all' || doc.format === formatFilter
      return matchesSearch && matchesStatus && matchesFormat
    })
  }, [documents, searchQuery, statusFilter, formatFilter])

  // 预览文档 (Markdown)
  const handlePreview = useCallback(async (doc: KnowledgeDocument) => {
    setSelectedDoc(doc)
    setDialogOpen(true)
    setPreviewLoading(true)
    setPreviewError(null)
    setMarkdownContent(null)

    try {
      const data = await knowledgeApi.getMarkdown(doc.id)
      if (data.error) throw new Error(data.error)
      const md = data.markdown || ''
      setMarkdownContent(md)

      // 预加载 markdown 中的图片，避免渲染时逐张请求
      const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
      let match
      while ((match = imgRegex.exec(md)) !== null) {
        const url = match[1]
        if (url.includes('proxy-image')) {
          const img = new window.Image()
          img.src = url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${url}`
        }
      }
    } catch (e: any) {
      setPreviewError(e.message || t('error.loadFileFailed'))
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  // 删除文档
  const handleDelete = (doc: KnowledgeDocument) => {
    setDocToDelete(doc)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!docToDelete) return
    const id = docToDelete.id
    // Optimistically remove from UI immediately
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    setDeleteDialogOpen(false)
    setDocToDelete(null)
    try {
      await knowledgeApi.deleteDocument(id)
    } catch (e) {
      console.error('Delete failed:', e)
      // Re-fetch to restore if delete failed
      loadDocuments()
    }
  }

  // 重新解析
  const handleRetry = useCallback(async (doc: KnowledgeDocument) => {
    try {
      await knowledgeApi.retryDocument(doc.id)
      setDocuments(prev =>
        prev.map(d => d.id === doc.id ? { ...d, status: 'parsing' as const, progress: 0, errorMessage: undefined } : d)
      )
    } catch (e) {
      console.error('Retry failed:', e)
    }
  }, [])

  // 查看日志
  const handleViewLogs = useCallback(async (doc: KnowledgeDocument) => {
    setLogDoc(doc)
    setLogDialogOpen(true)
    try {
      const data = await knowledgeApi.getDocumentLogs(doc.id)
      setLogData(data)
    } catch {
      setLogData({ status: doc.status, progress: doc.progress, errorMessage: doc.errorMessage })
    }
  }, [])

  // 统计数据
  const stats = useMemo(() => ({
    total: documents.length,
    completed: documents.filter((d) => d.status === 'completed').length,
    processing: documents.filter((d) => d.status === 'parsing' || d.status === 'uploading' || d.status === 'extracting').length,
    failed: documents.filter((d) => d.status === 'failed').length,
  }), [documents])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('knowledge.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('knowledge.subtitle')}</p>
        </div>
        {canUpload && (
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            {t('action.upload')}
          </Button>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('stat.total'), value: stats.total, color: 'text-primary' },
          { label: t('stat.completed'), value: stats.completed, color: 'text-green-600' },
          { label: t('stat.processing'), value: stats.processing, color: 'text-amber-600' },
          { label: t('stat.failed'), value: stats.failed, color: 'text-red-600' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-sm text-muted-foreground">{stat.label}</div>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg">{t('card.docList')}</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('placeholder.searchDocuments')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('label.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filter.allStatus')}</SelectItem>
                  <SelectItem value="completed">{t('status.completed')}</SelectItem>
                  <SelectItem value="extracting">{t('status.extracting')}</SelectItem>
                  <SelectItem value="parsing">{t('status.parsing')}</SelectItem>
                  <SelectItem value="uploading">{t('status.uploading')}</SelectItem>
                  <SelectItem value="failed">{t('status.failed')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder={t('label.format')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filter.allFormat')}</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="docx">Word</SelectItem>
                  <SelectItem value="xlsx">Excel</SelectItem>
                  <SelectItem value="pptx">PPT</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                  <SelectItem value="text">{t('filter.text')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[50px]">{t('label.format')}</TableHead>
                  <TableHead>{t('label.filename')}</TableHead>
                  <TableHead className="w-[100px]">{t('label.size')}</TableHead>
                  <TableHead className="w-[140px]">{t('label.status')}</TableHead>
                  <TableHead className="w-[160px]">{t('label.uploadTime')}</TableHead>
                  <TableHead className="w-[100px] text-right">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {loadError ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-destructive">
                          <AlertCircle className="w-5 h-5" />
                          <span className="text-sm">{loadError}</span>
                          <Button variant="outline" size="sm" onClick={() => loadDocuments()}>
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {t('action.retry')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin opacity-50" />
                          <span className="text-sm">{t('action.loading') || '加载中...'}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        {t('table.noDocuments')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocuments.map((doc, index) => (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.03 }}
                        className="group hover:bg-muted/50"
                      >
                        <TableCell>
                          <FormatIcon format={doc.format} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground truncate max-w-[300px]">
                              {doc.originalName}
                            </span>
                            {doc.errorMessage && (
                              <span className="text-xs text-destructive">{doc.errorMessage}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFileSize(doc.size)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={doc.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {doc.uploadedAt}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {(doc.status === 'parsing' || doc.status === 'extracting') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                onClick={() => handleViewLogs(doc)}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            )}
                            {doc.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-500"
                                onClick={() => handleRetry(doc)}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handlePreview(doc)}
                              disabled={doc.status !== 'completed'}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDelete(doc)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 文件预览弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[66vw] w-[66vw] h-[85vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 pr-14 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedDoc && <FormatIcon format={selectedDoc.format} />}
              <span className="truncate">{selectedDoc?.originalName}</span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (selectedDoc) {
                      const data = await knowledgeApi.getDownloadUrl(selectedDoc.id)
                      if (data.url) window.open(data.url, '_blank')
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-1" />
                  {t('action.download')}
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              {selectedDoc?.originalName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {previewLoading && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('common.loading')}</span>
              </div>
            )}

            {previewError && (
              <div className="flex flex-col items-center justify-center h-full text-destructive">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p>{previewError}</p>
              </div>
            )}

            {!previewLoading && !previewError && selectedDoc && (
              <>
                {(selectedDoc.format === 'png' || selectedDoc.format === 'jpg' ||
                  selectedDoc.format === 'jpeg' || selectedDoc.format === 'webp' ||
                  selectedDoc.format === 'gif' || selectedDoc.format === 'bmp') && !markdownContent ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Image className="w-12 h-12 mb-4" />
                    <p className="text-lg font-medium mb-2">{t('knowledge.imageFile')}</p>
                    <p className="text-sm mb-4">{t('knowledge.imageFileDesc')}</p>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const data = await knowledgeApi.getDownloadUrl(selectedDoc.id)
                        if (data.url) window.open(data.url, '_blank')
                      }}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      {t('action.downloadFile')}
                    </Button>
                  </div>
                ) : markdownContent !== null ? (
                  <ScrollArea className="h-full">
                    <div className="p-6 prose prose-sm dark:prose-invert max-w-none [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-md [&_pre]:overflow-x-auto [&_table]:text-xs [&_table]:overflow-x-auto [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-border/30 [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-border/30 [&_th]:bg-muted">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {markdownContent}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>{t('knowledge.noContent')}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialog.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialog.confirmDeleteDoc', { name: docToDelete?.originalName || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('action.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 日志查看弹窗 */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5" />
              {t('knowledge.processingLog')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {logDoc?.originalName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground truncate">
              {logDoc?.originalName}
            </div>
            {logData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t('label.status')}:</span>
                  <StatusBadge status={logData.status as KnowledgeDocument['status']} />
                </div>
                {logData.errorMessage && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-destructive">{t('label.errorMessage')}:</span>
                    <pre className="text-sm text-destructive bg-destructive/5 p-3 rounded-md whitespace-pre-wrap break-words">
                      {logData.errorMessage}
                    </pre>
                  </div>
                )}
                {!logData.errorMessage && (logData.status === 'parsing' || logData.status === 'extracting') && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('label.processing')}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 上传/粘贴弹窗 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload className="w-5 h-5" />
              {t('knowledge.uploadFile')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('knowledge.orClickToSelect')}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="gap-1.5">
                <Upload className="w-4 h-4" />
                {t('knowledge.uploadFileTab')}
              </TabsTrigger>
              <TabsTrigger value="text" className="gap-1.5">
                <ClipboardPaste className="w-4 h-4" />
                {t('knowledge.pasteTextTab')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <div
                {...getRootProps()}
                className={`
                  relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                  transition-all duration-300 ease-out
                  ${isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'
                  }
                `}
              >
                <input {...getInputProps()} />
                <div className={`
                  mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4
                  transition-colors duration-300
                  ${isDragActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                `}>
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {isDragActive ? t('knowledge.dropFiles') : t('knowledge.dragHere')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('knowledge.orClickToSelect')}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="text" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text-title">{t('knowledge.textTitle')}</Label>
                <Input
                  id="text-title"
                  placeholder={t('knowledge.textTitlePlaceholder')}
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="text-content">{t('knowledge.textContent')}</Label>
                <Textarea
                  id="text-content"
                  placeholder={t('knowledge.textContentPlaceholder')}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="min-h-[200px] resize-y"
                />
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="convert-wiki"
                  checked={convertToWiki}
                  onCheckedChange={(checked) => setConvertToWiki(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="convert-wiki" className="text-sm font-medium cursor-pointer">
                    {t('knowledge.convertToWiki')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('knowledge.convertToWikiDesc')}
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSubmitText}
                disabled={textSubmitting || !textTitle.trim() || !textContent.trim()}
              >
                {textSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <FileEdit className="w-4 h-4 mr-2" />
                    {t('knowledge.submitText')}
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
