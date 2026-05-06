'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Plus, MoreHorizontal, Edit, Trash2, Users, Key, Shield, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { rolesApi, permissionsApi } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import type { Role, PermissionModule } from '@/lib/types'
import { RoleFormDialog } from '@/components/admin/role-form-dialog'
import { PermissionDialog } from '@/components/admin/permission-dialog'

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isPermissionOpen, setIsPermissionOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { hasPermission } = useAuth()
  const { t } = useI18n()

  const fetchRoles = useCallback(async () => {
    try {
      const res = await rolesApi.list()
      if (res.success) setRoles(res.roles)
    } catch { toast.error(t('error.fetchRolesFailed')) }
  }, [])

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await permissionsApi.listModules()
      if (res.success) setPermissionModules(res.modules)
    } catch {}
  }, [])

  useEffect(() => { fetchRoles(); fetchPermissions() }, [fetchRoles, fetchPermissions])

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSaveRole = async (roleData: Partial<Role>) => {
    setIsLoading(true)
    try {
      if (editingRole) {
        const res = await rolesApi.update(editingRole.id, roleData)
        if (res.success) { toast.success(t('success.roleUpdated')); fetchRoles() }
        else toast.error(res.message)
      } else {
        const res = await rolesApi.create({
          name: roleData.name || '',
          code: roleData.code || '',
          description: roleData.description || '',
          permissions: roleData.permissions || [],
        })
        if (res.success) { toast.success(t('success.roleCreated')); fetchRoles() }
        else toast.error(res.message)
      }
      setIsFormOpen(false)
      setEditingRole(null)
    } catch { toast.error(t('error.operationFailed')) }
    finally { setIsLoading(false) }
  }

  const handleDeleteRole = async () => {
    if (!deleteRoleId) return
    setIsLoading(true)
    try {
      const res = await rolesApi.remove(deleteRoleId)
      if (res.success) { toast.success(t('success.roleDeleted')); fetchRoles() }
      else toast.error(res.message)
      setDeleteRoleId(null)
    } catch { toast.error(t('error.deleteFailed')) }
    finally { setIsLoading(false) }
  }

  const handleSavePermissions = async (permissions: string[]) => {
    if (!selectedRole) return
    setIsLoading(true)
    try {
      const res = await rolesApi.update(selectedRole.id, { permissions })
      if (res.success) { toast.success(t('success.permissionsSaved')); fetchRoles() }
      else toast.error(res.message)
      setIsPermissionOpen(false)
      setSelectedRole(null)
    } catch { toast.error(t('error.saveFailed')) }
    finally { setIsLoading(false) }
  }

  const totalPermissions = permissionModules.reduce((sum, m) => sum + m.permissions.length, 0)

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('roles.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('roles.subtitle')}</p>
        </div>
        {hasPermission('role:create') && (
          <Button onClick={() => { setEditingRole(null); setIsFormOpen(true) }}>
            <Plus className="w-4 h-4 mr-2" /> {t('roles.createRole')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10"><Shield className="w-5 h-5 text-primary" /></div>
            <div><p className="text-2xl font-bold text-foreground">{roles.length}</p><p className="text-sm text-muted-foreground">{t('roles.totalRoles')}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10"><Users className="w-5 h-5 text-success" /></div>
            <div><p className="text-2xl font-bold text-foreground">{roles.reduce((s, r) => s + r.userCount, 0)}</p><p className="text-sm text-muted-foreground">{t('roles.totalRoleUsers')}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10"><Key className="w-5 h-5 text-warning-foreground" /></div>
            <div><p className="text-2xl font-bold text-foreground">{totalPermissions}</p><p className="text-sm text-muted-foreground">{t('roles.totalPermissions')}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('placeholder.searchRoles')} className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Button variant="outline" size="icon" onClick={() => { fetchRoles(); toast.success(t('success.refreshed')) }}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('roles.roleList')}</CardTitle>
          <CardDescription>{t('roles.roleCount', { count: filteredRoles.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t('roles.roleName')}</TableHead>
                  <TableHead>{t('roles.roleCode')}</TableHead>
                  <TableHead>{t('table.description')}</TableHead>
                  <TableHead>{t('roles.userCount')}</TableHead>
                  <TableHead>{t('roles.permissionCount')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead className="w-20 text-right">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id} className="group hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="w-4 h-4 text-primary" /></div>
                        <span className="font-medium text-foreground">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><code className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">{role.code}</code></TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{role.description || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{t('roles.person', { count: role.userCount })}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{role.permissions.includes('*') ? t('roles.allPermissions') : t('roles.permissionCount', { count: role.permissions.length })}</Badge></TableCell>
                    <TableCell>{role.status === 'active' ? <Badge className="bg-success/10 text-success border-0">{t('roles.enabled')}</Badge> : <Badge variant="secondary">{t('roles.disabled')}</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {hasPermission('role:edit') && (
                            <DropdownMenuItem onClick={() => { setEditingRole(role); setIsFormOpen(true) }}><Edit className="w-4 h-4 mr-2" /> {t('action.edit')}</DropdownMenuItem>
                          )}
                          {hasPermission('role:assign') && (
                            <DropdownMenuItem onClick={() => { setSelectedRole(role); setIsPermissionOpen(true) }}><Key className="w-4 h-4 mr-2" /> {t('action.configurePermissions')}</DropdownMenuItem>
                          )}
                          {(hasPermission('role:edit') || hasPermission('role:assign')) && hasPermission('role:delete') && <DropdownMenuSeparator />}
                          {hasPermission('role:delete') && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteRoleId(role.id)}><Trash2 className="w-4 h-4 mr-2" /> {t('action.delete')}</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredRoles.length === 0 && <div className="py-12 text-center"><p className="text-muted-foreground">{t('table.noData')}</p></div>}
        </CardContent>
      </Card>

      <RoleFormDialog open={isFormOpen} onOpenChange={open => { setIsFormOpen(open); if (!open) setEditingRole(null) }} role={editingRole} onSave={handleSaveRole} isLoading={isLoading} />
      <PermissionDialog open={isPermissionOpen} onOpenChange={open => { setIsPermissionOpen(open); if (!open) setSelectedRole(null) }} role={selectedRole} permissionModules={permissionModules} onSave={handleSavePermissions} isLoading={isLoading} />

      <AlertDialog open={!!deleteRoleId} onOpenChange={() => setDeleteRoleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('dialog.confirmDelete')}</AlertDialogTitle><AlertDialogDescription>{t('dialog.confirmDeleteRole')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isLoading ? <Spinner className="w-4 h-4 mr-2" /> : null} {t('action.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
