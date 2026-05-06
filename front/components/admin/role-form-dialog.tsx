'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Shield, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import type { Role } from '@/lib/types'
import { useI18n } from '@/lib/i18n'

function createRoleSchema(t: (key: string) => string) {
  return z.object({
    name: z
      .string()
      .min(2, t('roles.nameMin'))
      .max(20, t('roles.nameMax')),
    code: z
      .string()
      .min(2, t('roles.codeMin'))
      .max(30, t('roles.codeMax'))
      .regex(/^[a-z_]+$/, t('roles.codePattern')),
    description: z.string().max(200, t('validation.descMax')).optional(),
    status: z.enum(['active', 'inactive']),
  })
}

type RoleForm = z.infer<ReturnType<typeof createRoleSchema>>

interface RoleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: Role | null
  onSave: (data: Partial<Role>) => void
  isLoading?: boolean
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSave,
  isLoading,
}: RoleFormDialogProps) {
  const { t } = useI18n()
  const isEditing = !!role

  const roleSchema = useMemo(() => createRoleSchema(t), [t])

  const form = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      status: 'active',
    },
  })

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        code: role.code,
        description: role.description || '',
        status: role.status,
      })
    } else {
      form.reset({
        name: '',
        code: '',
        description: '',
        status: 'active',
      })
    }
  }, [role, form])

  const onSubmit = (data: RoleForm) => {
    onSave(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('roles.editRole') : t('roles.createRole')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('roles.editRoleDesc') : t('roles.createRoleDesc')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('roles.roleName')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t('roles.enterRoleName')}
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('roles.roleCode')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Code className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t('roles.roleCodePlaceholder')}
                        className="pl-10"
                        disabled={isEditing}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('label.descriptionOptional')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Textarea
                        placeholder={t('roles.enterRoleDesc')}
                        className="pl-10 min-h-[80px]"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('label.status')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('placeholder.selectStatus')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">{t('roles.enabled')}</SelectItem>
                      <SelectItem value="inactive">{t('roles.disabled')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('action.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    {t('button.saving')}
                  </>
                ) : (
                  t('action.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
