/**
 * EventLog.jsx
 * Terminal-style collapsible event log.
 * Receives events[] from the parent (which polls /events incrementally).
 */
import { useRef, useEffect, useState } from 'react'
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const LEVEL_STYLES = {
  info:    'text-muted-foreground',
  warning: 'text-amber-400',
  error:   'text-red-400',
}

function formatTs(ts) {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

export function EventLog({ events = [], className }) {
  const [collapsed, setCollapsed] = useState(false)
  const bottomRef = useRef(null)

  // Auto-scroll to latest event
  useEffect(() => {
    if (!collapsed && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [events.length, collapsed])

  return (
    <div className={cn('border border-border/50 rounded-xl overflow-hidden', className)}>
      {/* Header bar */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground tracking-wide">TRACE ENGINE LOG</span>
          <span className="text-[10px] text-muted-foreground">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronUp   className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {/* Log lines */}
      {!collapsed && (
        <div className="h-36 overflow-y-auto bg-[#0f0f10] px-4 py-3 font-mono">
          {events.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/40 italic">Waiting for pipeline events…</p>
          ) : (
            events.map((evt, i) => (
              <div key={i} className="flex gap-3 mb-0.5">
                <span className="text-[10px] text-muted-foreground/50 shrink-0 select-none w-16">
                  {formatTs(evt.ts)}
                </span>
                <span className={cn('text-[11px] leading-relaxed break-all', LEVEL_STYLES[evt.level] ?? LEVEL_STYLES.info)}>
                  {evt.message}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
