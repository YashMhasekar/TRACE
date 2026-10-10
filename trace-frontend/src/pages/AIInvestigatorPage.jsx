/**
 * AIInvestigatorPage.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * TRACE AI Investigator
 * Evidence-grounded answers from real PVDAQ data · Grok-3-mini
 *
 * Architecture & Features:
 *   • Real Groq LLM integration (reference model: openai/gpt-oss-120b)
 *   • Full multi-turn conversation memory maintained in state
 *   • Token streaming SSE via streamChat() with smooth real-time rendering
 *   • Automatic fallback to sendChat() if stream is interrupted
 *   • Zero-overlap layout: flex-1 viewport calculated with sticky pinned input bar
 *   • Enhanced Markdown renderer supporting tables, headers, lists, and code blocks
 *   • Quick prompt chips categorized by investigation topic
 *   • Copy to clipboard, regenerate response, stop generation, and clear conversation
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSuggestedQuestions } from '@/hooks/useTrace'
import { streamChat, sendChat } from '@/api/aiApi'
import {
  Sparkles, Send, Square, AlertTriangle, ChevronDown,
  Zap, RefreshCw, Copy, Check, User, Bot, RotateCcw,
  CheckCircle2, ShieldCheck, ArrowRight, CornerDownLeft, Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Robust Markdown Renderer (Headers, Tables, Lists, Code, Dividers, Bold, Inline Code)
// ─────────────────────────────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null

  const lines = text.split('\n')
  const output = []
  let listItems = []
  let listType = 'bullet' // 'bullet' or 'numbered'
  let codeLines = []
  let inCode = false
  let tableRows = []
  let inTable = false
  let keyIndex = 0

  const flushList = () => {
    if (listItems.length) {
      if (listType === 'numbered') {
        output.push(
          <ol key={`ol-${keyIndex++}`} className="my-2.5 space-y-1 pl-1">
            {listItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90">
                <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold"
                  style={{ background: 'rgba(97,95,255,0.15)', color: '#818CF8' }}>
                  {i + 1}
                </span>
                <span className="pt-0.5">{inlineRender(item)}</span>
              </li>
            ))}
          </ol>
        )
      } else {
        output.push(
          <ul key={`ul-${keyIndex++}`} className="my-2.5 space-y-1.5 pl-1">
            {listItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: '#818CF8' }} />
                <span>{inlineRender(item)}</span>
              </li>
            ))}
          </ul>
        )
      }
      listItems = []
    }
  }

  const flushCode = () => {
    if (codeLines.length) {
      output.push(
        <div key={`code-${keyIndex++}`} className="my-3 rounded-lg overflow-hidden border border-border/70"
          style={{ background: 'rgba(20,20,24,0.7)' }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 text-[11px] text-muted-foreground font-mono">
            <span>Code / Telemetry snippet</span>
            <CopyButton text={codeLines.join('\n')} />
          </div>
          <pre className="p-3 text-xs font-mono overflow-x-auto text-foreground/90 leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      )
      codeLines = []
    }
  }

  const flushTable = () => {
    if (tableRows.length >= 2) {
      // First row is header, second is delimiter (|---|), subsequent are body rows
      const headerRow = tableRows[0]
      const bodyRows = tableRows.slice(2) // skip delimiter

      output.push(
        <div key={`table-${keyIndex++}`} className="my-3 overflow-x-auto rounded-lg border border-border/80 shadow-sm"
          style={{ background: 'rgba(26,26,30,0.6)' }}>
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr style={{ background: 'rgba(97,95,255,0.12)', borderBottom: '1px solid var(--border)' }}>
                {headerRow.map((cell, ci) => (
                  <th key={ci} className="px-3.5 py-2.5 font-semibold text-foreground tracking-wide">
                    {inlineRender(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/40 transition-colors"
                  style={{ background: ri % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3.5 py-2 text-foreground/90 font-medium">
                      {inlineRender(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    tableRows = []
    inTable = false
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const line = rawLine.trim()

    // 1. Code block delimiter
    if (line.startsWith('```')) {
      if (inCode) {
        flushCode()
        inCode = false
      } else {
        flushList()
        flushTable()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeLines.push(rawLine)
      continue
    }

    // 2. Table row detector (| cell | cell |)
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList()
      inTable = true
      const cells = line.slice(1, -1).split('|').map((c) => c.trim())
      // Check if it's separator line (|---|---|)
      const isSeparator = cells.every((c) => /^[-:]+$/.test(c))
      if (isSeparator && tableRows.length === 1) {
        tableRows.push(cells) // marker for delimiter
      } else if (!isSeparator) {
        tableRows.push(cells)
      }
      continue
    } else if (inTable) {
      flushTable()
    }

    // 3. Horizontal Rule (--- or ***)
    if (/^([-*_]){3,}$/.test(line)) {
      flushList()
      output.push(<hr key={`hr-${keyIndex++}`} className="my-3 border-t border-border/60" />)
      continue
    }

    // 4. Bullet list item (- , * , • )
    if (/^[-*•]\s/.test(line)) {
      if (listType === 'numbered') flushList()
      listType = 'bullet'
      listItems.push(line.replace(/^[-*•]\s/, ''))
      continue
    }

    // 5. Numbered list item (1. , 2. )
    if (/^\d+\.\s/.test(line)) {
      if (listType === 'bullet') flushList()
      listType = 'numbered'
      listItems.push(line.replace(/^\d+\.\s/, ''))
      continue
    }

    flushList()

    // 6. Empty line
    if (!line) {
      output.push(<div key={`br-${keyIndex++}`} className="h-2" />)
      continue
    }

    // 7. Headings (#, ##, ###)
    if (/^#{1,3}\s/.test(line)) {
      const match = line.match(/^(#{1,3})\s/)
      const level = match[1].length
      const content = line.slice(match[0].length)
      const className =
        level === 1 ? 'text-base font-bold text-foreground mt-3.5 mb-1.5' :
        level === 2 ? 'text-sm font-bold text-foreground mt-3 mb-1' :
        'text-xs font-bold uppercase tracking-wider text-primary mt-2 mb-0.5'
      output.push(<p key={`h-${keyIndex++}`} className={className}>{inlineRender(content)}</p>)
      continue
    }

    // 8. Blockquote (> quote)
    if (line.startsWith('>')) {
      const content = line.replace(/^>\s*/, '')
      output.push(
        <div key={`quote-${keyIndex++}`}
          className="my-2 pl-3 py-1.5 border-l-2 rounded-r-md text-xs sm:text-sm text-foreground/85 italic"
          style={{ borderColor: '#615FFF', background: 'rgba(97,95,255,0.05)' }}>
          {inlineRender(content)}
        </div>
      )
      continue
    }

    // 9. Standard paragraph
    output.push(
      <p key={`p-${keyIndex++}`} className="text-sm leading-relaxed text-foreground/90">
        {inlineRender(line)}
      </p>
    )
  }

  flushList()
  flushTable()
  flushCode()
  return output
}

function inlineRender(text) {
  if (!text) return ''
  // Bold **text**, inline `code`, italic *text*
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded text-xs font-mono font-medium"
          style={{ background: 'rgba(97,95,255,0.14)', color: '#A5B4FC' }}>
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-foreground/90">{part.slice(1, -1)}</em>
    }
    return part
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy Button Component
// ─────────────────────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
      title="Copy text"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
          <span style={{ color: '#10B981' }}>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing Animation Dots
// ─────────────────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full"
          style={{
            background: '#818CF8',
            animation: `traceDotBounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-2 font-medium">Investigating PVDAQ telemetry…</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble Component
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({ message, isStreaming, onRetry }) {
  const isUser = message.role === 'user'
  const isError = message.isError

  return (
    <div className={cn('flex gap-3 items-start', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold shadow-sm"
        style={
          isUser
            ? {
                background: 'linear-gradient(135deg, rgba(97,95,255,0.25), rgba(97,95,255,0.10))',
                border: '1px solid rgba(97,95,255,0.40)',
                color: '#818CF8',
              }
            : {
                background: 'linear-gradient(135deg, rgba(97,95,255,0.20), rgba(16,185,129,0.10))',
                border: '1px solid rgba(97,95,255,0.30)',
              }
        }
      >
        {isUser ? (
          <User className="w-4 h-4" style={{ color: '#818CF8' }} />
        ) : (
          <Bot className="w-4 h-4" style={{ color: '#818CF8' }} />
        )}
      </div>

      {/* Bubble Container */}
      <div className={cn('flex-1 max-w-[88%]', isUser && 'flex flex-col items-end')}>
        {/* Header Label */}
        <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/80">
            {isUser ? 'You' : 'TRACE AI Investigator (Groq · openai/gpt-oss-120b)'}
          </span>
          {message.timestamp && <span>· {message.timestamp}</span>}
        </div>

        {/* Message Content */}
        <div
          className={cn(
            'rounded-[14px] px-4 py-3 shadow-sm text-sm',
            isUser
              ? 'rounded-tr-xs bg-primary/15 border border-primary/30 text-foreground'
              : isError
              ? 'rounded-tl-xs bg-destructive/10 border border-destructive/30 text-foreground'
              : 'rounded-tl-xs bg-card border border-border text-foreground'
          )}
        >
          {isUser ? (
            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming && !message.content ? (
            <TypingDots />
          ) : (
            <div className="space-y-1">
              {renderMarkdown(message.content)}
              {isStreaming && (
                <span
                  className="inline-block w-1.5 h-4 ml-1 rounded-sm align-middle"
                  style={{
                    background: '#818CF8',
                    animation: 'traceCursorBlink 0.8s step-end infinite',
                  }}
                />
              )}
            </div>
          )}

          {/* Error Message */}
          {isError && (
            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-destructive/20 text-xs text-destructive">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{message.errorDetail || 'Connection to Groq AI service failed.'}</span>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 px-2 py-0.5 rounded font-medium bg-destructive/15 hover:bg-destructive/25 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Retry
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Toolbar for AI responses */}
        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-2 px-1 mt-1">
            <CopyButton text={message.content} />
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/70 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                title="Regenerate this response"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Categorized Suggested Questions
// ─────────────────────────────────────────────────────────────────────────────
const QUESTION_CATEGORIES = [
  {
    category: 'Target & Gap',
    questions: [
      'Why did we miss our generation target?',
      'Is the revenue gap driven by generation or commercial terms?',
    ],
  },
  {
    category: 'Controllability',
    questions: [
      'What was the largest controllable loss this period?',
      'What evidence supports the equipment attribution?',
    ],
  },
  {
    category: 'Recovery',
    questions: [
      'How much generation is realistically recoverable?',
      'What would a 30% improvement in equipment performance recover?',
    ],
  },
  {
    category: 'Recurrence',
    questions: [
      'Which performance problem is recurring?',
      'Show me the top 3 episodes by financial impact.',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main AI Investigator Page Component
// ─────────────────────────────────────────────────────────────────────────────
export function AIInvestigatorPage() {
  const suggestionsQuery = useSuggestedQuestions()
  const fallbackSuggestions = suggestionsQuery.data ?? []

  // Conversation state
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setStreaming] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  // Refs for zero-overlap layout and streaming controller
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  // ── Auto-scroll to latest token / message ─────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    })
  }, [])

  useEffect(() => {
    scrollToBottom(true)
  }, [messages, scrollToBottom])

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    setStreamError(null)

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { role: 'user', content: trimmed, id: Date.now(), timestamp: now }
    const assistantId = Date.now() + 1

    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: 'assistant', content: '', id: assistantId, isStreaming: true, timestamp: now },
    ])
    setInputText('')
    setStreaming(true)

    // Build history for backend
    setMessages((prev) => {
      const history = prev
        .filter((m) => !m.isStreaming && m.role && m.content)
        .concat(userMsg)
        .map(({ role, content }) => ({ role, content }))

      let accumulated = ''

      abortRef.current = streamChat(
        history,
        // onChunk
        (chunk) => {
          accumulated += chunk
          setMessages((msgs) =>
            msgs.map((m) =>
              m.id === assistantId
                ? { ...m, content: accumulated, isStreaming: true }
                : m
            )
          )
        },
        // onDone
        () => {
          setStreaming(false)
          setMessages((msgs) =>
            msgs.map((m) =>
              m.id === assistantId
                ? { ...m, content: accumulated || '(No response received)', isStreaming: false }
                : m
            )
          )
          inputRef.current?.focus()
        },
        // onError: try non-streaming fallback
        async (err) => {
          try {
            const reply = await sendChat(history)
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === assistantId
                  ? { ...m, content: reply, isStreaming: false }
                  : m
              )
            )
          } catch (fallbackErr) {
            const errMsg = err?.message || fallbackErr?.message || 'Connection failed'
            setStreamError(errMsg)
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: 'I encountered an issue connecting to the TRACE AI service. Please verify your connection or click Retry.',
                      isStreaming: false,
                      isError: true,
                      errorDetail: errMsg,
                    }
                  : m
              )
            )
          } finally {
            setStreaming(false)
            inputRef.current?.focus()
          }
        }
      )

      return prev
    })
  }, [isStreaming])

  // ── Stop streaming ────────────────────────────────────────────────────────
  const stopStreaming = () => {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages((msgs) =>
      msgs.map((m) =>
        m.isStreaming
          ? { ...m, isStreaming: false, content: m.content || '(Generation stopped)' }
          : m
      )
    )
    inputRef.current?.focus()
  }

  // ── Regenerate response ───────────────────────────────────────────────────
  const handleRegenerate = () => {
    if (messages.length === 0 || isStreaming) return
    // Find last user message
    const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === 'user')
    if (lastUserIndex === -1) return
    const actualIndex = messages.length - 1 - lastUserIndex
    const lastUserMessage = messages[actualIndex]

    // Remove everything after that user message
    setMessages((prev) => prev.slice(0, actualIndex))
    sendMessage(lastUserMessage.content)
  }

  // ── Clear conversation ────────────────────────────────────────────────────
  const clearChat = () => {
    if (isStreaming) stopStreaming()
    setMessages([])
    setStreamError(null)
  }

  // ── Handle Enter key ──────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputText)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Styles for animations */}
      <style>{`
        @keyframes traceDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes traceCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      {/* Main Page Container: Exact Height, Zero Overlap, Relative Child Alignment */}
      <div className="flex flex-col h-[calc(100dvh-8rem)] min-h-[580px] max-w-4xl mx-auto w-full relative">

        {/* ── Header: Title, Subtitle, Model Badge, Actions ────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(97,95,255,0.25), rgba(97,95,255,0.08))',
                border: '1px solid rgba(97,95,255,0.35)',
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: '#818CF8' }} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight">
                TRACE AI Investigator
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                Evidence-grounded answers from real PVDAQ data · Grok-3-mini
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Model Badge */}
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold shadow-xs"
              style={{
                background: 'rgba(97,95,255,0.10)',
                border: '1px solid rgba(97,95,255,0.28)',
                color: '#818CF8',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Groq · openai/gpt-oss-120b</span>
            </div>

            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/60 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-all shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>New chat</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Notice Banner (Dismissible, Compact) ─────────────────────────── */}
        {!noticeDismissed && (
          <div
            className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg mb-3 shrink-0 text-xs border shadow-xs"
            style={{
              background: 'rgba(245,158,11,0.07)',
              borderColor: 'rgba(245,158,11,0.25)',
              color: 'var(--foreground)',
            }}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />
              <span className="text-[11px] sm:text-xs">
                <strong className="font-semibold text-amber-400">Strictly Grounded:</strong> Answers cite NREL PVDAQ System 1430 observations (Jan–Feb 2017). Attributions are evidence-weighted heuristic models.
              </span>
            </div>
            <button
              onClick={() => setNoticeDismissed(true)}
              className="text-muted-foreground hover:text-foreground p-1 text-xs font-bold leading-none"
              title="Dismiss note"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Chat Messages Container (Scrollable Flex-1, Zero Clip) ───────── */}
        <div
          className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border bg-card/40 backdrop-blur-xs p-4 sm:p-5 space-y-4.5 shadow-inner"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Empty State Showcase */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center max-w-2xl mx-auto">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(97,95,255,0.22), rgba(97,95,255,0.08))',
                  border: '1px solid rgba(97,95,255,0.30)',
                }}
              >
                <Sparkles className="w-7 h-7" style={{ color: '#818CF8' }} />
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">
                Investigate Real Plant Performance
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6 max-w-md leading-relaxed">
                Ask targeted questions about solar production shortfalls, controllable equipment losses, recurrence patterns, and financial recovery metrics.
              </p>

              {/* Categorized Question Grid */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {QUESTION_CATEGORIES.map((catGroup, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border/80 bg-background/50 hover:bg-background/80 transition-all flex flex-col justify-between"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {catGroup.category}
                    </span>
                    <div className="space-y-1.5">
                      {catGroup.questions.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => sendMessage(q)}
                          disabled={isStreaming}
                          className="w-full text-left p-2 rounded-md hover:bg-primary/10 hover:border-primary/30 border border-transparent text-xs text-foreground/90 font-medium transition-all group flex items-start justify-between gap-1.5"
                        >
                          <span className="leading-snug">{q}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Render Active Messages */}
          {!isEmpty && (
            <div className="space-y-4.5">
              {messages.map((msg, index) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={!!msg.isStreaming}
                  onRetry={index === messages.length - 1 && msg.role === 'assistant' ? handleRegenerate : undefined}
                />
              ))}
              <div ref={bottomRef} className="h-1" />
            </div>
          )}
        </div>

        {/* ── Quick Prompts Strip (Visible when Chat Active) ───────────────── */}
        {!isEmpty && fallbackSuggestions.length > 0 && (
          <div className="mt-2.5 shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-semibold text-muted-foreground shrink-0 uppercase tracking-wider">
              Quick:
            </span>
            {fallbackSuggestions.slice(0, 6).map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isStreaming}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-medium border border-border bg-card hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all shadow-2xs disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* ── Sticky Pinned Chat Input Area (Zero Overlap Guaranteed) ─────── */}
        <div
          className={cn(
            'mt-2.5 flex items-end gap-2 px-3.5 py-2.5 rounded-xl border bg-card shadow-sm transition-all shrink-0',
            isStreaming ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20'
          )}
        >
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'TRACE AI is investigating…' : 'Ask about generation gaps, attribution, recurrence, recovery…'}
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed py-1"
            style={{
              maxHeight: '110px',
              minHeight: '26px',
            }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
            }}
          />

          <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                title="Stop generating"
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-destructive/15 hover:bg-destructive/25 border border-destructive/30 transition-colors"
              >
                <Square className="w-4 h-4 text-destructive" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(inputText)}
                disabled={!inputText.trim()}
                title="Send message (Enter)"
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-all shadow-xs',
                  inputText.trim()
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground opacity-40 cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Footer Hints ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 px-1 shrink-0">
          <span>
            Press <kbd className="px-1 py-0.5 rounded border border-border font-mono text-[9px] bg-background">Enter</kbd> to send ·{' '}
            <kbd className="px-1 py-0.5 rounded border border-border font-mono text-[9px] bg-background">Shift+Enter</kbd> for newline
          </span>
          <span className="hidden sm:inline">
            Deterministic attribution · No hallucinations
          </span>
        </div>

        {/* Stream Error Notification */}
        {streamError && (
          <div
            className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs shrink-0 border bg-destructive/10 border-destructive/30 text-destructive shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{streamError}</span>
            </div>
            <button
              onClick={() => setStreamError(null)}
              className="font-bold hover:opacity-75 px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </>
  )
}
