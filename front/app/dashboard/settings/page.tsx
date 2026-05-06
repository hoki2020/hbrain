'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Bell,
  Shield,
  Palette,
  Globe,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth-context'
import { useI18n, type Locale } from '@/lib/i18n'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { hasPermission } = useAuth()
  const { locale, setLocale, t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        pushNotifications: true,
        twoFactorAuth: false,
        autoLogout: true,
      }
    }
    try {
      const saved = localStorage.getItem('hbrain_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Remove deprecated settings
        delete parsed.emailNotifications
        delete parsed.loginAlerts
        delete parsed.language // Language is handled by i18n context
        return parsed
      }
    } catch {}
    return {
      pushNotifications: true,
      twoFactorAuth: false,
      autoLogout: true,
    }
  })

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale)
  }

  const handleSave = () => {
    setIsLoading(true)
    try {
      localStorage.setItem('hbrain_settings', JSON.stringify(settings))
      toast.success(t('settings.saved'))
    } catch {
      toast.error(t('settings.saveFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Palette className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('settings.appearance')}</CardTitle>
                <CardDescription>{t('settings.themeDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">{t('settings.theme')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.themeDesc')}</p>
              </div>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.dark')}</SelectItem>
                  <SelectItem value="system">{t('settings.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('settings.notifications')}</CardTitle>
                <CardDescription>{t('settings.notifications')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">{t('settings.browserNotifications')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.browserNotificationsDesc')}</p>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Language */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('settings.language')}</CardTitle>
                <CardDescription>{t('settings.languageDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">{t('settings.language')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.languageDesc')}</p>
              </div>
              <Select value={locale} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="zh-TW">繁體中文</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('settings.security')}</CardTitle>
                <CardDescription>{t('settings.security')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">{t('settings.twoFactor')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.twoFactorDesc')}</p>
              </div>
              <Switch
                checked={settings.twoFactorAuth}
                onCheckedChange={(checked) => handleSettingChange('twoFactorAuth', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">{t('settings.autoLogout')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.autoLogoutDesc')}</p>
              </div>
              <Switch
                checked={settings.autoLogout}
                onCheckedChange={(checked) => handleSettingChange('autoLogout', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Save Button */}
      {hasPermission('settings:save') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-end"
        >
          <Button onClick={handleSave} disabled={isLoading} className="min-w-32">
            {isLoading ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                {t('settings.saving')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {t('settings.saveSettings')}
              </>
            )}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}
