'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Filter,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { usersApi, rolesApi } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import type { User, Role } from '@/lib/types'
import { UserFormDialog } from '@/components/admin/user-form-dialog'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { hasPermission } = useAuth()
  const { t } = useI18n()

  const statusOptions = [
    { value: 'all', label: t('filter.allStatus') },
    { value: 'active', label: t('status.active') },
    { value: 'inactive', label: t('status.inactive') },
    { value: 'locked', label: t('status.locked') },
  ]

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersApi.list()
      if (res.success) setUsers(res.users)
    } catch { toast.error(t('error.fetchUsersFailed')) }
  }, [])

  const fetchRoles = useCallback(async () => {
    try {
      const res = await rolesApi.list()
      if (res.success) setRoles(res.roles)
    } catch {}
  }, [])

  useEffect(() => { fetchUsers(); fetchRoles() }, [fetchUsers, fetchRoles])

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleSelectAll = (checked: boolean) => {
    setSelectedUsers(checked ? filteredUsers.map(u => u.id) : [])
  }

  const handleSelectOne = (userId: string, checked: boolean) => {
    setSelectedUsers(checked ? [...selectedUsers, userId] : selectedUsers.filter(id => id !== userId))
  }

  const handleSaveUser = async (userData: Partial<User> & { password?: string }) => {
    setIsLoading(true)
    try {
      if (editingUser) {
        const res = await usersApi.update(editingUser.id, userData)
        if (res.success) { toast.success(t('success.userUpdated')); fetchUsers() }
        else toast.error(res.message)
      } else {
        const res = await usersApi.create({
          username: userData.username || '',
          email: userData.email || '',
          password: userData.password || '123456',
          phone: userData.phone,
          roles: userData.roles,
        })
        if (res.success) { toast.success(t('success.userCreated')); fetchUsers() }
        else toast.error(res.message)
      }
      setIsFormOpen(false)
      setEditingUser(null)
    } catch { toast.error(t('error.operationFailed')) }
    finally { setIsLoading(false) }
  }

  const handleDeleteUser = async () => {
    if (!deleteUserId) return
    setIsLoading(true)
    try {
      const res = await usersApi.remove(deleteUserId)
      if (res.success) { toast.success(t('success.userDeleted')); fetchUsers() }
      else toast.error(res.message)
      setDeleteUserId(null)
    } catch { toast.error(t('error.deleteFailed')) }
    finally { setIsLoading(false) }
  }

  const getStatusBadge = (status: User['status']) => {
    switch (status) {
      case 'active': return <Badge className="bg-success/10 text-success border-0">{t('status.active')}</Badge>
      case 'inactive': return <Badge variant="secondary">{t('status.inactive')}</Badge>
      case 'locked': return <Badge className="bg-destructive/10 text-destructive border-0">{t('status.locked')}</Badge>
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('users.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('users.subtitle')}</p>
        </div>
        {hasPermission('user:create') && (
          <Button onClick={() => { setEditingUser(null); setIsFormOpen(true) }}>
            <Plus className="w-4 h-4 mr-2" /> {t('users.createUser')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('placeholder.searchUsers')} className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><Filter className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => { fetchUsers(); toast.success(t('success.refreshed')) }}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('users.userList')}</CardTitle>
          <CardDescription>{t('users.userCount', { count: filteredUsers.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">
                    <Checkbox checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length} onCheckedChange={handleSelectAll} />
                  </TableHead>
                  <TableHead>{t('table.userInfo')}</TableHead>
                  <TableHead>{t('table.phone')}</TableHead>
                  <TableHead>{t('table.roles')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.lastLogin')}</TableHead>
                  <TableHead className="w-20 text-right">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="group hover:bg-muted/30">
                    <TableCell>
                      <Checkbox checked={selectedUsers.includes(user.id)} onCheckedChange={c => handleSelectOne(user.id, c as boolean)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar><AvatarImage src={user.avatar} /><AvatarFallback className="bg-primary/20 text-primary">{user.username.charAt(0)}</AvatarFallback></Avatar>
                        <div><p className="font-medium text-foreground">{user.username}</p><p className="text-sm text-muted-foreground">{user.email}</p></div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role, i) => <Badge key={i} variant="outline" className="text-xs">{role}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.lastLogin || '-'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {hasPermission('user:edit') && (
                            <DropdownMenuItem onClick={() => { setEditingUser(user); setIsFormOpen(true) }}>
                              <Edit className="w-4 h-4 mr-2" /> {t('action.edit')}
                            </DropdownMenuItem>
                          )}
                          {hasPermission('user:edit') && hasPermission('user:delete') && <DropdownMenuSeparator />}
                          {hasPermission('user:delete') && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteUserId(user.id)}>
                              <Trash2 className="w-4 h-4 mr-2" /> {t('action.delete')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredUsers.length === 0 && <div className="py-12 text-center"><p className="text-muted-foreground">{t('table.noData')}</p></div>}
        </CardContent>
      </Card>

      <UserFormDialog
        open={isFormOpen}
        onOpenChange={open => { setIsFormOpen(open); if (!open) setEditingUser(null) }}
        user={editingUser}
        roles={roles}
        onSave={handleSaveUser}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialog.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dialog.confirmDeleteUser')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoading ? <Spinner className="w-4 h-4 mr-2" /> : null} {t('action.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
