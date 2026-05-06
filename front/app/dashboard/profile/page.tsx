'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { User, Mail, Phone, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { authApi } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'

const createProfileSchema = (t: (key: string) => string) => z.object({
  username: z.string().min(2, t('validation.usernameMin')).max(20, t('validation.usernameMax')),
  email: z.string().email(t('validation.invalidEmail')),
  phone: z.string().optional(),
})

type ProfileForm = z.infer<ReturnType<typeof createProfileSchema>>

export default function ProfilePage() {
  const { user, login } = useAuth()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ProfileForm>({
    resolver: zodResolver(createProfileSchema(t)),
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
  })

  const onSubmit = async (data: ProfileForm) => {
    setIsLoading(true)
    try {
      const res = await authApi.updateProfile(data)
      if (res.success && res.user) {
        login(res.user)
        toast.success(t('profile.profileUpdated'))
      } else {
        toast.error(res.message || t('error.updateFailed'))
      }
    } catch {
      toast.error(t('error.updateFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('profile.subtitle')}</p>
      </div>

      {/* Avatar Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                  {user?.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">{user?.username}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {user?.roles?.map((role, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{role}</Badge>
                ))}
                {(!user?.roles || user.roles.length === 0) && (
                  <Badge variant="secondary" className="text-xs">{t('profile.administrator')}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('profile.editProfile')}</CardTitle>
          <CardDescription>{t('profile.editProfileDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('label.phone')}</FormLabel>
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

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <><Spinner className="w-4 h-4 mr-2" /> {t('button.saving')}</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> {t('action.saveChanges')}</>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('profile.accountInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{t('profile.userId')}</span>
            <span className="text-sm font-mono text-foreground">{user?.id}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-sm text-muted-foreground">{t('profile.createdAt')}</span>
            <span className="text-sm text-foreground">{user?.createdAt}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-sm text-muted-foreground">{t('table.lastLogin')}</span>
            <span className="text-sm text-foreground">{user?.lastLogin || '-'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-sm text-muted-foreground">{t('label.accountStatus')}</span>
            <Badge className="bg-success/10 text-success border-0">
              {user?.status === 'active' ? t('status.normal') : user?.status === 'inactive' ? t('status.inactive') : t('status.locked')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
