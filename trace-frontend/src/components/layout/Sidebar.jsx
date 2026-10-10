import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  HelpCircle,
  FileSearch,
  Settings2,
  DollarSign,
  RefreshCw,
  FlaskConical,
  Sparkles,
  Zap,
  X,
  GitBranch,
  Play,
} from 'lucide-react'

const navItems = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Why Did We Miss?', path: '/why-did-we-miss', icon: HelpCircle },
  { label: 'Impact Tree', path: '/impact-tree', icon: GitBranch },
  { label: 'Evidence', path: '/evidence', icon: FileSearch },
  { label: 'Operations', path: '/operations', icon: Settings2 },
  { label: 'Commercial', path: '/commercial', icon: DollarSign },
  { label: 'Recurrence', path: '/recurrence', icon: RefreshCw },
  { label: 'Recovery Simulator', path: '/simulator', icon: FlaskConical },
  { label: 'AI Investigator', path: '/ai-investigator', icon: Sparkles },
]

const toolItems = [
  { label: 'Model Runner', path: '/model-runner', icon: Play },
]

/** @param {{ open: boolean, onClose: () => void }} props */
export function Sidebar({ open, onClose }) {
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/*
        Navigation surface: bg-sidebar resolves to
          dark  → #1A1A1A  (deeper than main #1D1C1E background)
          light → near-white panel
      */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-60',
          'bg-sidebar border-r border-sidebar-border',
          'flex flex-col transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: '#615FFF' }}
            >
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight tracking-tight text-foreground">TRACE</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Performance Attribution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-accent transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" aria-label="Pages">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active =
              path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(path)
            return (
              <NavLink
                key={path}
                to={path}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon
                  className={cn('w-4 h-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
                />
                <span>{label}</span>
              </NavLink>
            )
          })}

          {/* Tools section */}
          <div className="pt-4 pb-1 px-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2">
              Tools
            </p>
          </div>
          {toolItems.map(({ label, path, icon: Icon }) => {
            const active = location.pathname.startsWith(path)
            return (
              <NavLink
                key={path}
                to={path}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon
                  className={cn('w-4 h-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
                />
                <span>{label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Footer metadata */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-[10px] text-muted-foreground leading-relaxed">Solar Plant Alpha · May 2026</p>
          <p className="text-[10px] text-muted-foreground">
            Data quality:{' '}
            <span style={{ color: '#10B981' }} className="font-semibold">94% Good</span>
          </p>
        </div>
      </aside>
    </>
  )
}
