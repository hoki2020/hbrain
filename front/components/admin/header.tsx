'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Bell,
  Settings,
  User,
  LogOut,
  Key,
  Menu,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { knowledgeApi } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

interface HeaderProps {
  onMobileMenuToggle?: () => void
}

interface Notification {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  type: 'success' | 'error' | 'info'
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const [searchFocused, setSearchFocused] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [lastDocStates, setLastDocStates] = useState<Record<string, string>>({})

  const unreadCount = notifications.filter(n => !n.read).length

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Poll document status and generate notifications
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const docs = await knowledgeApi.listDocuments()
        const newStates: Record<string, string> = {}

        docs.forEach(doc => {
          newStates[doc.id] = doc.status
          const prevState = lastDocStates[doc.id]

          // Detect state changes
          if (prevState && prevState !== doc.status) {
            let notification: Notification | null = null

            if (doc.status === 'completed') {
              notification = {
                id: `${doc.id}-${Date.now()}`,
                title: t('notification.docCompleted'),
                message: `"${doc.originalName}" ${t('notification.docCompletedDesc')}`,
                time: t('dashboard.uploadedAt'),
                read: false,
                type: 'success',
              }
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(t('notification.docCompleted'), {
                  body: `"${doc.originalName}" ${t('notification.docCompletedDesc')}`,
                  icon: '/icon.svg',
                })
              }
            } else if (doc.status === 'failed') {
              notification = {
                id: `${doc.id}-${Date.now()}`,
                title: t('notification.docFailed'),
                message: `"${doc.originalName}" ${t('notification.docFailedDesc')}: ${doc.errorMessage || ''}`,
                time: t('dashboard.uploadedAt'),
                read: false,
                type: 'error',
              }
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(t('notification.docFailed'), {
                  body: `"${doc.originalName}" ${t('notification.docFailedDesc')}`,
                  icon: '/icon.svg',
                })
              }
            }

            if (notification) {
              setNotifications(prev => [notification!, ...prev].slice(0, 20))
            }
          }
        })

        setLastDocStates(newStates)
      } catch (e) {
        // Silent fail
      }
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [lastDocStates])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="h-16 bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-4 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMobileMenuToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Search */}
          <div className="relative hidden sm:block">
            <motion.div
              animate={{ width: searchFocused ? 320 : 240 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('search.placeholder')}
                className="pl-10 bg-accent/50 border-transparent focus:border-primary focus:bg-background transition-all"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </motion.div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center"
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>{t('notification.title')}</span>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="h-auto p-0 text-xs text-primary">
                    {t('notification.markAllRead')}
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {t('notification.empty')}
                  </div>
                ) : (
                  <AnimatePresence>
                    {notifications.map((notification, index) => {
                      const Icon = notification.type === 'success' ? CheckCircle2
                        : notification.type === 'error' ? XCircle
                        : FileText
                      const iconColor = notification.type === 'success' ? 'text-green-600'
                        : notification.type === 'error' ? 'text-destructive'
                        : 'text-primary'
                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <DropdownMenuItem className="flex items-start gap-3 p-3 cursor-pointer">
                            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 w-full">
                                <span className={cn(
                                  "font-medium text-sm",
                                  !notification.read && "text-foreground"
                                )}>
                                  {notification.title}
                                </span>
                                {!notification.read && (
                                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {notification.message}
                              </p>
                              <span className="text-xs text-muted-foreground/60">
                                {notification.time}
                              </span>
                            </div>
                          </DropdownMenuItem>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {user?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium">
                  {user?.username}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.username}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
                <User className="w-4 h-4 mr-2" />
                {t('nav.profile')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/change-password')}>
                <Key className="w-4 h-4 mr-2" />
                {t('nav.changePassword')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                {t('nav.settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
