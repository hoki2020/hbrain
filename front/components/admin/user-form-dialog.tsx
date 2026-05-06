'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { User, Mail, Phone, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import type { User as UserType, Role } from '@/lib/types'
import { useI18n } from '@/lib/i18n'

function createSchemas(t: (key: string) => string) {
  const createUserSchema = z.object({
    username: z.string().min(2, t('validation.usernameMin')).max(20, t('validation.usernameMax')),
    email: z.string().email(t('validation.invalidEmail')),
    password: z.string().min(6, t('validation.passwordMin')),
    phone: z.string().optional(),
    status: z.enum(['active', 'inactive', 'locked']),
    roles: z.array(z.string()).min(1, t('validation.roleRequired')),
  })

  const editUserSchema = z.object({
    username: z.string().min(2, t('validation.usernameMin')).max(20, t('validation.usernameMax')),
    email: z.string().email(t('validation.invalidEmail')),
    password: z.string().optional(),
    phone: z.string().optional(),
    status: z.enum(['active', 'inactive', 'locked']),
    roles: z.array(z.string()).min(1, t('validation.roleRequired')),
  })

  return { createUserSchema, editUserSchema }
}

type UserForm = z.infer<ReturnType<typeof createSchemas>['createUserSchema']>

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserType | null
  roles: Role[]
  onSave: (data: Partial<UserType> & { password?: string }) => void
  isLoading?: boolean
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  roles,
  onSave,
  isLoading,
}: UserFormDialogProps) {
  const { t } = useI18n()
  const isEditing = !!user

  const schemas = useMemo(() => createSchemas(t), [t])

  const form = useForm<UserForm>({
    resolver: zodResolver(isEditing ? schemas.editUserSchema : schemas.createUserSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      phone: '',
      status: 'active',
      roles: [],
    },
  })

  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username,
        email: user.email,
        password: '',
        phone: user.phone || '',
        status: user.status,
        roles: user.roles,
      })
    } else {
      form.reset({
        username: '',
        email: '',
        password: '',
        phone: '',
        status: 'active',
        roles: [],
      })
    }
  }, [user, form])

  const activeRoles = roles.filter(r => r.status === 'active')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('users.editUser') : t('users.createUser')}</DialogTitle>
          <DialogDescription>{isEditing ? t('users.editUserDesc') : t('users.createUserDesc')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('label.username')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder={t('placeholder.enterUsername')} className="pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('label.email')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder={t('placeholder.enterEmail')} className="pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('label.password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="password" placeholder={t('placeholder.enterPasswordHint')} className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('label.phoneOptional')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder={t('placeholder.enterPhone')} className="pl-10" {...field} />
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
                    <FormControl><SelectTrigger><SelectValue placeholder={t('placeholder.selectStatus')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">{t('status.active')}</SelectItem>
                      <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
                      <SelectItem value="locked">{t('status.locked')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roles"
              render={() => (
                <FormItem>
                  <FormLabel>{t('label.roles')}</FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {activeRoles.map((role) => (
                      <FormField
                        key={role.id}
                        control={form.control}
                        name="roles"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(role.name)}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked ? [...field.value, role.name] : field.value?.filter(v => v !== role.name))
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal cursor-pointer">{role.name}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                    {activeRoles.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2">{t('users.noAvailableRoles')}</p>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('action.cancel')}</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <><Spinner className="w-4 h-4 mr-2" /> {t('button.saving')}</> : t('action.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
