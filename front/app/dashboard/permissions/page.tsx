'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Key, Menu, MousePointer2, Webhook, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { permissionsApi } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { PermissionModule } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function PermissionsPage() {
  const { t } = useI18n()

  const typeOptions = [
    { value: 'all', label: t('filter.allTypes'), icon: Filter },
    { value: 'menu', label: t('permissions.menuPermissions'), icon: Menu },
    { value: 'button', label: t('permissions.buttonPermissions'), icon: MousePointer2 },
    { value: 'api', label: t('permissions.apiPermissions'), icon: Webhook },
  ]

  const [modules, setModules] = useState<PermissionModule[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [activeModule, setActiveModule] = useState('all')

  const fetchModules = useCallback(async () => {
    try {
      const res = await permissionsApi.listModules()
      if (res.success) setModules(res.modules)
    } catch { toast.error(t('error.fetchPermissionsFailed')) }
  }, [])

  useEffect(() => { fetchModules() }, [fetchModules])

  const allPermissions = modules.flatMap(m => m.permissions)
  const filteredPermissions = allPermissions.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || p.type === typeFilter
    const matchesModule = activeModule === 'all' || p.module === activeModule
    return matchesSearch && matchesType && matchesModule
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'menu': return <Menu className="w-4 h-4" />
      case 'button': return <MousePointer2 className="w-4 h-4" />
      case 'api': return <Webhook className="w-4 h-4" />
      default: return <Key className="w-4 h-4" />
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'menu': return <Badge className="bg-primary/10 text-primary border-0"><Menu className="w-3 h-3 mr-1" />{t('permissions.menu')}</Badge>
      case 'button': return <Badge className="bg-success/10 text-success border-0"><MousePointer2 className="w-3 h-3 mr-1" />{t('permissions.button')}</Badge>
      case 'api': return <Badge className="bg-warning/10 text-warning-foreground border-0"><Webhook className="w-3 h-3 mr-1" />API</Badge>
      default: return <Badge variant="secondary">{type}</Badge>
    }
  }

  const countByType = (type: string) => allPermissions.filter(p => p.type === type).length

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('permissions.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('permissions.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10"><Key className="w-5 h-5 text-primary" /></div>
            <div><p className="text-2xl font-bold text-foreground">{allPermissions.length}</p><p className="text-sm text-muted-foreground">{t('permissions.totalPermissions')}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10"><Menu className="w-5 h-5 text-primary" /></div>
            <div><p className="text-2xl font-bold text-foreground">{countByType('menu')}</p><p className="text-sm text-muted-foreground">{t('permissions.menuPermissions')}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10"><MousePointer2 className="w-5 h-5 text-success" /></div>
            <div><p className="text-2xl font-bold text-foreground">{countByType('button')}</p><p className="text-sm text-muted-foreground">{t('permissions.buttonPermissions')}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10"><Webhook className="w-5 h-5 text-warning-foreground" /></div>
            <div><p className="text-2xl font-bold text-foreground">{countByType('api')}</p><p className="text-sm text-muted-foreground">{t('permissions.apiPermissions')}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('placeholder.searchPermissions')} className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeOptions.map(o => <SelectItem key={o.value} value={o.value}><div className="flex items-center gap-2"><o.icon className="w-4 h-4" />{o.label}</div></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('permissions.permissionList')}</CardTitle>
          <CardDescription>{t('permissions.permissionListDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeModule} onValueChange={setActiveModule}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="all">{t('filter.all')}<Badge variant="secondary" className="ml-1.5 text-xs">{allPermissions.length}</Badge></TabsTrigger>
              {modules.map(m => <TabsTrigger key={m.module} value={m.module}>{m.moduleName}<Badge variant="secondary" className="ml-1.5 text-xs">{m.permissions.length}</Badge></TabsTrigger>)}
            </TabsList>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>{t('permissions.permissionName')}</TableHead>
                    <TableHead>{t('permissions.permissionCode')}</TableHead>
                    <TableHead>{t('permissions.module')}</TableHead>
                    <TableHead>{t('permissions.type')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPermissions.map(p => {
                    const moduleName = modules.find(m => m.module === p.module)?.moduleName || p.module
                    return (
                      <TableRow key={p.id} className="group hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", p.type === 'menu' && "bg-primary/10 text-primary", p.type === 'button' && "bg-success/10 text-success", p.type === 'api' && "bg-warning/10 text-warning-foreground")}>
                              {getTypeIcon(p.type)}
                            </div>
                            <span className="font-medium text-foreground">{p.name}</span>
                          </div>
                        </TableCell>
                        <TableCell><code className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">{p.code}</code></TableCell>
                        <TableCell><Badge variant="outline">{moduleName}</Badge></TableCell>
                        <TableCell>{getTypeBadge(p.type)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {filteredPermissions.length === 0 && <div className="py-12 text-center"><p className="text-muted-foreground">{t('table.noData')}</p></div>}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">{t('permissions.permissionStructure')}</CardTitle><CardDescription>{t('permissions.permissionStructureDesc')}</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module, index) => (
              <motion.div key={module.module} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }} className="p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-foreground">{module.moduleName}</h4>
                  <Badge variant="secondary">{module.permissions.length} {t('permissions.item')}</Badge>
                </div>
                <div className="space-y-2">
                  {module.permissions.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <div className={cn("w-1.5 h-1.5 rounded-full", p.type === 'menu' && "bg-primary", p.type === 'button' && "bg-success", p.type === 'api' && "bg-warning")} />
                      <span className="text-muted-foreground truncate">{p.name}</span>
                    </div>
                  ))}
                  {module.permissions.length > 3 && <p className="text-xs text-muted-foreground">+ {module.permissions.length - 3} {t('permissions.more')}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
