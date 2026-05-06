'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Key, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Role, PermissionModule } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

interface PermissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: Role | null
  permissionModules: PermissionModule[]
  onSave: (permissions: string[]) => void
  isLoading?: boolean
}

export function PermissionDialog({
  open,
  onOpenChange,
  role,
  permissionModules,
  onSave,
  isLoading,
}: PermissionDialogProps) {
  const { t } = useI18n()
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [expandedModules, setExpandedModules] = useState<string[]>([])

  useEffect(() => {
    if (role) {
      if (role.permissions.includes('*')) {
        const allPermissions = permissionModules.flatMap(m => m.permissions.map(p => p.code))
        setSelectedPermissions(allPermissions)
      } else {
        setSelectedPermissions(role.permissions)
      }
      setExpandedModules(permissionModules.map(m => m.module))
    } else {
      setSelectedPermissions([])
    }
  }, [role, permissionModules])

  const toggleModule = (module: string) => {
    setExpandedModules(prev =>
      prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]
    )
  }

  const togglePermission = (code: string) => {
    setSelectedPermissions(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    )
  }

  const toggleModuleAll = (module: string) => {
    const modulePermissions = permissionModules.find(m => m.module === module)?.permissions.map(p => p.code) || []
    const allSelected = modulePermissions.every(p => selectedPermissions.includes(p))
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !modulePermissions.includes(p)))
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...modulePermissions])])
    }
  }

  const isModuleAllSelected = (module: string) => {
    const modulePermissions = permissionModules.find(m => m.module === module)?.permissions.map(p => p.code) || []
    return modulePermissions.every(p => selectedPermissions.includes(p))
  }

  const isModuleSomeSelected = (module: string) => {
    const modulePermissions = permissionModules.find(m => m.module === module)?.permissions.map(p => p.code) || []
    return modulePermissions.some(p => selectedPermissions.includes(p)) && !isModuleAllSelected(module)
  }

  const getPermissionTypeLabel = (type: string) => {
    switch (type) {
      case 'menu': return t('permissions.menu')
      case 'button': return t('permissions.button')
      case 'api': return 'API'
      default: return type
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> {t('permissions.configurePermissions')}
          </DialogTitle>
          <DialogDescription>
            {t('permissions.configForRole', { name: role?.name || '' })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {permissionModules.map((module, moduleIndex) => {
              const isExpanded = expandedModules.includes(module.module)
              const isAllSelected = isModuleAllSelected(module.module)
              const isSomeSelected = isModuleSomeSelected(module.module)

              return (
                <motion.div
                  key={module.module}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: moduleIndex * 0.05 }}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  <Collapsible open={isExpanded} onOpenChange={() => toggleModule(module.module)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={() => toggleModuleAll(module.module)}
                            onClick={e => e.stopPropagation()}
                            className={cn(isSomeSelected && "data-[state=unchecked]:bg-primary/30")}
                          />
                          <span className="font-medium text-foreground">{module.moduleName}</span>
                          <Badge variant="secondary" className="text-xs">{module.permissions.length} {t('permissions.item')}</Badge>
                        </div>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-3 space-y-2 bg-card">
                        {module.permissions.map((permission, permIndex) => {
                          const isSelected = selectedPermissions.includes(permission.code)
                          return (
                            <motion.div
                              key={permission.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: permIndex * 0.02 }}
                              className={cn(
                                "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer",
                                isSelected ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50"
                              )}
                              onClick={() => togglePermission(permission.code)}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox checked={isSelected} onCheckedChange={() => togglePermission(permission.code)} onClick={e => e.stopPropagation()} />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{permission.name}</p>
                                  <code className="text-xs text-muted-foreground">{permission.code}</code>
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  permission.type === 'menu' && "border-primary/30 text-primary",
                                  permission.type === 'button' && "border-success/30 text-success",
                                  permission.type === 'api' && "border-warning/30 text-warning-foreground"
                                )}
                              >
                                {getPermissionTypeLabel(permission.type)}
                              </Badge>
                            </motion.div>
                          )
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              )
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {t('permissions.selectedCount', { count: selectedPermissions.length })}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('action.cancel')}</Button>
            <Button onClick={() => onSave(selectedPermissions)} disabled={isLoading}>
              {isLoading ? <><Spinner className="w-4 h-4 mr-2" /> {t('button.saving')}</> : <><Check className="w-4 h-4 mr-2" /> {t('action.save')}</>}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
