'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sidebar } from '@/components/admin/sidebar'
import { Header } from '@/components/admin/header'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const { t } = useI18n()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8 text-primary" />
          <span className="text-muted-foreground">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <motion.div
        initial={{ x: -256 }}
        animate={{ x: mobileMenuOpen ? 0 : -256 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 z-40 lg:hidden"
      >
        <Sidebar 
          collapsed={false} 
          onToggle={() => setMobileMenuOpen(false)} 
        />
      </motion.div>

      {/* Main Content */}
      <motion.div
        initial={false}
        animate={{ 
          marginLeft: sidebarCollapsed ? 72 : 256 
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          'min-h-screen transition-all duration-300',
          'lg:ml-64',
          sidebarCollapsed && 'lg:ml-[72px]',
          'ml-0'
        )}
      >
        <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="p-4 lg:p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </motion.div>
    </div>
  )
}
