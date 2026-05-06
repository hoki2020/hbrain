'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Shield,
  Key,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  BookOpen,
  Network,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout, hasPermission } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const menuItems = [
    { title: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard, requiredPermission: 'dashboard:view' },
    { title: t('nav.knowledge'), href: '/dashboard/knowledge', icon: BookOpen, requiredPermission: 'knowledge:view' },
    { title: t('nav.graph'), href: '/dashboard/graph', icon: Network, requiredPermission: 'graph:view' },
    { title: t('nav.users'), href: '/dashboard/users', icon: Users, requiredPermission: 'user:view' },
    { title: t('nav.roles'), href: '/dashboard/roles', icon: Shield, requiredPermission: 'role:view' },
    { title: t('nav.permissions'), href: '/dashboard/permissions', icon: Key, requiredPermission: 'permission:view' },
    { title: t('nav.settings'), href: '/dashboard/settings', icon: Settings, requiredPermission: 'settings:view' },
  ]

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 h-screen bg-card border-r border-border flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="11" cy="13" r="2.5" fill="currentColor"/>
                  <circle cx="21" cy="13" r="2.5" fill="currentColor"/>
                  <circle cx="16" cy="21" r="2.5" fill="currentColor"/>
                  <path d="M11 13h10M11 13l5 8M21 13l-5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="16" cy="13" r="1.5" fill="currentColor" fillOpacity="0.5"/>
                </svg>
              </div>
              <span className="font-semibold text-foreground">{t('sidebar.brand')}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {menuItems.filter(item => hasPermission(item.requiredPermission)).map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => setHoveredItem(item.href)}
              onMouseLeave={() => setHoveredItem(null)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                'hover:bg-accent group',
                isActive && 'bg-primary/10 text-primary'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <Icon
                className={cn(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>
              
              {/* Tooltip for collapsed state */}
              {collapsed && hoveredItem === item.href && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-md whitespace-nowrap z-50"
                >
                  {item.title}
                </motion.div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-border space-y-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'w-full justify-start gap-3 text-muted-foreground hover:text-foreground',
            collapsed && 'justify-center px-0'
          )}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span className="text-sm">{theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}</span>}
        </Button>

        {/* User Info */}
        <div
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg bg-accent/50',
            collapsed && 'justify-center p-2'
          )}
        >
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {user?.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 min-w-0"
            >
              <p className="text-sm font-medium text-foreground truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.roles?.[0]}</p>
            </motion.div>
          )}
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className={cn(
            'w-full justify-start gap-3 text-muted-foreground hover:text-destructive',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm">{t('auth.logout')}</span>}
        </Button>
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm hover:bg-accent"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </Button>
    </motion.aside>
  )
}
