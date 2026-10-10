import { Menu, ChevronDown, Shield, Bell, Zap, LogOut, Moon, Sun, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { usePlantContext } from '@/contexts/PlantContext'
import { useNavigate } from 'react-router-dom'
import { usePlants, useOverview } from '@/hooks/useTrace'
import { cn } from '@/lib/utils'

/** @param {{ onMenuClick: () => void }} props */
export function TopBar({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { activePlantId, activePeriod, selectPlant } = usePlantContext()
  const navigate = useNavigate()

  const plantsQuery = usePlants()
  const overviewQuery = useOverview()

  const plants = plantsQuery.data || []
  const overviewData = overviewQuery.data || {}

  const plantName = overviewData.plant || 'Solar Plant Alpha'
  const period = overviewData.period || activePeriod || 'May 2026'
  const dqScore = overviewData.dataQuality?.overall ?? 94

  const handleSignOut = async () => {
    try { await signOut(); navigate('/landing') }
    catch (err) { console.error('Sign out failed:', err) }
  }

  const dqColor =
    dqScore >= 90 ? '#10B981' :
      dqScore >= 80 ? '#F59E0B' :
        '#EF4444'

  const dqBorderColor =
    dqScore >= 90 ? 'rgba(16,185,129,0.25)' :
      dqScore >= 80 ? 'rgba(245,158,11,0.25)' :
        'rgba(239,68,68,0.25)'

  return (
    /*
      Header surface: bg-sidebar resolves to
        dark  → #1A1A1A  (same as sidebar — unified navigation surface)
        light → near-white
    */
    <header
      className="sticky top-0 z-20 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3"
      style={{ backdropFilter: 'blur(8px)' }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-[6px] hover:bg-accent transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Logo — mobile only */}
      <div className="flex items-center gap-2 lg:hidden">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: '#615FFF' }}
        >
          <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-sm tracking-tight text-foreground">TRACE</span>
      </div>

      {/* Plant + Period */}
      <div className="hidden sm:flex items-center gap-2">
        <PlantSelector
          plants={plants}
          activePlantId={activePlantId}
          plantName={plantName}
          onSelect={selectPlant}
        />
        <StatChip label="Period" value={period} />
      </div>

      <div className="flex-1" />

      {/* Data quality */}
      <div
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium"
        style={{ color: dqColor, borderColor: dqBorderColor, background: `${dqColor}14` }}
      >
        <Shield className="w-3.5 h-3.5" />
        <span>{dqScore}% DQ</span>
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-[6px] hover:bg-accent transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'light'
          ? <Moon className="w-4 h-4 text-muted-foreground" />
          : <Sun className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Notifications */}
      <button
        className="p-1.5 rounded-[6px] hover:bg-accent transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        <span
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: '#615FFF' }}
        />
      </button>

      {/* User menu */}
      <div className="relative group">
        <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] hover:bg-accent transition-colors">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(97,95,255,0.15)', border: '1px solid rgba(97,95,255,0.3)' }}
          >
            <span className="text-xs font-semibold" style={{ color: '#615FFF' }}>
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* Dropdown */}
        <div className="absolute right-0 top-full mt-2 w-56 rounded-[10px] border border-border bg-popover shadow-[0_4px_18px_rgba(0,0,0,0.35)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Signed in</p>
          </div>
          <div className="p-2">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm hover:bg-muted transition-colors"
              style={{ color: '#EF4444' }}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

/* ─── Plant Selector dropdown ─────────────────────────────────────────────── */
function PlantSelector({ plants, activePlantId, plantName, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-border bg-background hover:bg-muted transition-colors text-sm"
      >
        <span className="text-muted-foreground text-xs">Plant:</span>
        <span className="font-medium text-foreground max-w-[130px] truncate">{plantName}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-64 rounded-[10px] border border-border bg-popover shadow-[0_4px_18px_rgba(0,0,0,0.35)] z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Select Plant
            </p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {plants.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Loading plants…</p>
            ) : (
              plants.map((p) => {
                const pid = p.plant_id || p.id
                const isActive = pid === activePlantId
                return (
                  <button
                    key={pid}
                    onClick={() => { onSelect(pid); setOpen(false) }}
                    className={cn(
                      'w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted transition-colors',
                      isActive && 'bg-accent',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.location} · {p.capacity_kw ? `${(p.capacity_kw / 1000).toFixed(1)} MW` : ''}
                      </p>
                    </div>
                    {isActive && <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#615FFF' }} />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Stat chip ───────────────────────────────────────────────────────────── */
function StatChip({ label, value }) {
  return (
    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] border border-border bg-background text-sm">
      <span className="text-muted-foreground text-xs">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
