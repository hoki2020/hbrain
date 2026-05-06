'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Eye, EyeOff, LogIn, User, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { authApi, setToken } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'

type LoginForm = {
  username: string
  password: string
  remember?: boolean
}

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { t } = useI18n()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const loginSchema = z.object({
    username: z.string().min(1, t('validation.enterUsername')),
    password: z.string().min(1, t('validation.enterPassword')),
    remember: z.boolean().optional(),
  })

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      remember: false,
    },
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const result = await authApi.login(data.username, data.password)
      if (result.success && result.user) {
        if (result.token) setToken(result.token)
        login(result.user)
        toast.success(t('success.loginSuccess'), {
          description: t('success.redirecting'),
        })
        router.push('/dashboard')
      } else {
        toast.error(t('error.loginFailed'), {
          description: result.message,
        })
      }
    } catch {
      toast.error(t('error.loginFailed'), {
        description: t('error.networkError'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-border/50 shadow-xl shadow-primary/5">
          <CardHeader className="text-center pb-2">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center"
            >
              <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="11" cy="13" r="2.5" fill="currentColor"/>
                <circle cx="21" cy="13" r="2.5" fill="currentColor"/>
                <circle cx="16" cy="21" r="2.5" fill="currentColor"/>
                <path d="M11 13h10M11 13l5 8M21 13l-5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="16" cy="13" r="1.5" fill="currentColor" fillOpacity="0.5"/>
              </svg>
            </motion.div>
            <CardTitle className="text-2xl font-bold">{t('login.welcome')}</CardTitle>
            <CardDescription>{t('login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
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
                          <Input
                            placeholder={t('placeholder.enterUsername')}
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
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('label.password')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t('placeholder.enterPassword')}
                            className="pl-10 pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? (
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

                <div className="flex items-center justify-between">
                  <FormField
                    control={form.control}
                    name="remember"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal cursor-pointer">
                          {t('label.rememberMe')}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    {t('link.forgotPassword')}
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      {t('button.loggingIn')}
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      {t('button.login')}
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t('login.noAccount')}{' '}
              <Link href="/register" className="text-primary hover:underline font-medium">
                {t('login.registerNow')}
              </Link>
            </div>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
