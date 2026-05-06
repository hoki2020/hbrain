'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Eye, EyeOff, Key, Lock, Shield, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { authApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

const createPasswordSchema = (t: (key: string) => string) => z.object({
  oldPassword: z.string().min(1, t('validation.enterOldPassword')),
  newPassword: z
    .string()
    .min(6, t('validation.passwordMin'))
    .max(20, t('validation.passwordMax'))
    .regex(/[a-z]/, t('validation.passwordLowercase'))
    .regex(/[A-Z]/, t('validation.passwordUppercase'))
    .regex(/[0-9]/, t('validation.passwordNumber')),
  confirmPassword: z.string(),
}).refine(data => data.newPassword !== data.oldPassword, {
  message: t('validation.passwordSame'),
  path: ['newPassword'],
}).refine(data => data.newPassword === data.confirmPassword, {
  message: t('validation.passwordMismatch'),
  path: ['confirmPassword'],
})

type PasswordForm = z.infer<ReturnType<typeof createPasswordSchema>>

// 密码强度检测
function getPasswordStrength(password: string, t: (key: string) => string): { score: number; label: string; color: string } {
  let score = 0

  if (password.length >= 6) score += 20
  if (password.length >= 10) score += 20
  if (/[a-z]/.test(password)) score += 15
  if (/[A-Z]/.test(password)) score += 15
  if (/[0-9]/.test(password)) score += 15
  if (/[^a-zA-Z0-9]/.test(password)) score += 15

  if (score < 40) return { score, label: t('changePassword.weak'), color: 'bg-destructive' }
  if (score < 70) return { score, label: t('changePassword.medium'), color: 'bg-warning' }
  return { score, label: t('changePassword.strong'), color: 'bg-success' }
}

export default function ChangePasswordPage() {
  const { t } = useI18n()
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const passwordRules = [
    { label: t('changePassword.ruleMinLength'), test: (p: string) => p.length >= 6 },
    { label: t('changePassword.ruleLowercase'), test: (p: string) => /[a-z]/.test(p) },
    { label: t('changePassword.ruleUppercase'), test: (p: string) => /[A-Z]/.test(p) },
    { label: t('changePassword.ruleNumber'), test: (p: string) => /[0-9]/.test(p) },
  ]

  const form = useForm<PasswordForm>({
    resolver: zodResolver(createPasswordSchema(t)),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const newPassword = form.watch('newPassword')
  const strength = getPasswordStrength(newPassword || '', t)

  const onSubmit = async (data: PasswordForm) => {
    setIsLoading(true)
    try {
      const result = await authApi.changePassword(data.oldPassword, data.newPassword)
      if (result.success) {
        toast.success(t('changePassword.passwordChanged'), {
          description: t('changePassword.useNewPassword'),
        })
        form.reset()
      } else {
        toast.error(t('error.passwordChangeFailed'), {
          description: result.message,
        })
      }
    } catch {
      toast.error(t('error.passwordChangeFailed'), {
        description: t('error.networkError'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto"
    >
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('changePassword.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('changePassword.subtitle')}</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('changePassword.passwordSettings')}</CardTitle>
              <CardDescription>{t('changePassword.passwordSettingsDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('changePassword.oldPassword')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showOldPassword ? 'text' : 'password'}
                          placeholder={t('placeholder.enterOldPassword')}
                          className="pl-10 pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showOldPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('changePassword.newPassword')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder={t('placeholder.enterNewPassword')}
                          className="pl-10 pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />

                    {/* Password Strength */}
                    {newPassword && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <Progress value={strength.score} className="flex-1 h-2" />
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            strength.score < 40 && "bg-destructive/10 text-destructive",
                            strength.score >= 40 && strength.score < 70 && "bg-warning/10 text-warning-foreground",
                            strength.score >= 70 && "bg-success/10 text-success"
                          )}>
                            {strength.label}
                          </span>
                        </div>

                        {/* Password Rules */}
                        <div className="grid grid-cols-2 gap-2">
                          {passwordRules.map((rule, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle2
                                className={cn(
                                  "w-4 h-4 transition-colors",
                                  rule.test(newPassword)
                                    ? "text-success"
                                    : "text-muted-foreground/40"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-xs transition-colors",
                                  rule.test(newPassword)
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                                )}
                              >
                                {rule.label}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('changePassword.confirmNewPassword')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder={t('placeholder.confirmNewPassword')}
                          className="pl-10 pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  {t('action.reset')}
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      {t('button.saving')}
                    </>
                  ) : (
                    t('action.saveChanges')
                  )}
                </Button>
              </div>
            </form>
          </Form>

          {/* Security Tips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 p-4 rounded-lg bg-accent/50 border border-border"
          >
            <h4 className="text-sm font-medium text-foreground mb-2">{t('changePassword.securityTips')}</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>{t('changePassword.rotatePassword')}</li>
              <li>{t('changePassword.uniquePassword')}</li>
              <li>{t('changePassword.complexPassword')}</li>
              <li>{t('changePassword.keepSecret')}</li>
            </ul>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
