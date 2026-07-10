import { useState, useEffect, useRef, useMemo } from 'react'
import { getRandomPassage, passages, Passage, PassageCategory } from './data/passages'

const ACCENT = '#2dd4bf'
const ERROR_COLOR = '#f87171'

// --- Lightweight JS-ish syntax highlighter for the code editor panel. Not a full
// tokenizer — just enough to make code read like code (keywords/strings/numbers/
// comments colored, everything else neutral). ---
type CodeTokenType = 'keyword' | 'string' | 'number' | 'comment' | 'punct' | 'plain'

interface CodeToken {
  start: number
  end: number
  type: CodeTokenType
}

const SYNTAX_COLORS: Record<CodeTokenType, string> = {
  keyword: '#c792ea',
  string: '#c3e88d',
  number: '#f78c6c',
  comment: '#5c6370',
  punct: 'rgba(255,255,255,0.5)',
  plain: 'rgba(255,255,255,0.75)',
}

const JS_KEYWORDS = new Set([
  'function', 'return', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'class',
  'extends', 'new', 'await', 'async', 'import', 'export', 'default', 'from', 'this',
  'typeof', 'null', 'undefined', 'true', 'false', 'of', 'in', 'try', 'catch', 'finally',
  'switch', 'case', 'break', 'continue', 'throw', 'yield', 'static', 'get', 'set',
  'instanceof', 'void', 'delete', 'do',
])

function tokenizeCode(text: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]

    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      const stop = nl === -1 ? text.length : nl
      tokens.push({ start: i, end: stop, type: 'comment' })
      i = stop
      continue
    }

    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2)
      const stop = close === -1 ? text.length : close + 2
      tokens.push({ start: i, end: stop, type: 'comment' })
      i = stop
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < text.length && text[j] !== ch) {
        if (text[j] === '\\') j++
        j++
      }
      j = Math.min(j + 1, text.length)
      tokens.push({ start: i, end: j, type: 'string' })
      i = j
      continue
    }

    if (/[0-9]/.test(ch)) {
      let j = i
      while (j < text.length && /[0-9.]/.test(text[j])) j++
      tokens.push({ start: i, end: j, type: 'number' })
      i = j
      continue
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let j = i
      while (j < text.length && /[A-Za-z0-9_$]/.test(text[j])) j++
      const word = text.slice(i, j)
      tokens.push({ start: i, end: j, type: JS_KEYWORDS.has(word) ? 'keyword' : 'plain' })
      i = j
      continue
    }

    if (/[{}()[\];,.:=+\-*/%<>!&|?]/.test(ch)) {
      tokens.push({ start: i, end: i + 1, type: 'punct' })
      i++
      continue
    }

    tokens.push({ start: i, end: i + 1, type: 'plain' })
    i++
  }
  return tokens
}

type GameMode = 'picker' | 'challenge' | 'focus' | 'arcade'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100vh',
      width: '100%',
      background: '#18181a',
      color: 'rgba(255,255,255,0.9)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '13px',
        color: 'rgba(255,255,255,0.55)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '6px 4px',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
    >
      ‹ Back
    </button>
  )
}

function Panel({ index, name, description, hoveredIndex, onHover, onClick }: {
  index: number
  name: string
  description: string
  hoveredIndex: number | null
  onHover: (i: number | null) => void
  onClick: () => void
}) {
  const isHovered = hoveredIndex === index
  const isDimmed = hoveredIndex !== null && !isHovered

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'relative',
        flex: 1,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.004), rgba(255,255,255,0.03))',
        borderRight: index < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
      }}
    >
      {/* Hover wash — a separate layer so it fades in/out as a clean opacity transition
          instead of trying to crossfade the base gradient itself. */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(45,212,191,0.1)',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.22s ease-out',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        padding: '0 32px 40px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.28)',
          letterSpacing: '0.08em',
          marginBottom: '12px',
          opacity: isDimmed ? 0.45 : 1,
          transition: 'opacity 0.22s ease-out',
        }}>
          0{index + 1}
        </div>
        <div style={{
          fontSize: '30px',
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          color: isHovered ? ACCENT : 'rgba(255,255,255,0.92)',
          opacity: isDimmed ? 0.45 : 1,
          transition: 'color 0.22s ease-out, opacity 0.22s ease-out',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: '13px',
          lineHeight: 1.55,
          maxWidth: '220px',
          marginTop: '14px',
          color: isHovered ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.4)',
          opacity: isDimmed ? 0.45 : 1,
          transition: 'color 0.22s ease-out, opacity 0.22s ease-out',
        }}>
          {description}
        </div>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: ACCENT,
          marginTop: '18px',
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'translateX(0)' : 'translateX(-6px)',
          transition: 'opacity 0.22s ease-out, transform 0.22s ease-out',
        }}>
          Start →
        </div>
      </div>
    </div>
  )
}

const PICKER_MODES: { mode: GameMode; name: string; description: string }[] = [
  { mode: 'challenge', name: 'Typing Challenge', description: 'Race a passage, live WPM and accuracy.' },
  { mode: 'focus', name: 'Focus Session', description: 'Timed distraction-free typing block.' },
  { mode: 'arcade', name: 'Combo Arcade', description: 'Chain streaks for score multipliers.' },
]

function Picker({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: '24px 0 16px 24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.01em' }}>
          Game Mode
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
          Pick a mode to sharpen your typing.
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {PICKER_MODES.map((m, i) => (
          <Panel
            key={m.mode}
            index={i}
            name={m.name}
            description={m.description}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
            onClick={() => onSelect(m.mode)}
          />
        ))}
      </div>
    </div>
  )
}

function ComingSoon({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <BackButton onClick={onBack} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <div style={{ fontSize: '17px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{title}</div>
        <div style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.4)',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '5px 14px',
        }}>
          Coming soon
        </div>
      </div>
    </div>
  )
}

const CATEGORY_META: Record<PassageCategory, { name: string; description: string }> = {
  quotes: { name: 'Quotes', description: 'Famous quotes and sayings' },
  pangrams: { name: 'Pangrams', description: 'Sentences using every letter' },
  code: { name: 'Code', description: 'Real code snippets' },
}

function passageCount(category: PassageCategory): number {
  return passages.filter((p) => p.category === category).length
}

function CategoryCard({ name, description, count, onClick }: {
  name: string; description: string; count: number; onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '180px',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${hover ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '14px',
        padding: '28px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minHeight: '150px',
        cursor: 'pointer',
        transition: 'all 0.18s ease-out',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: '17px', fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{name}</div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.45 }}>{description}</div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: ACCENT, marginTop: 'auto', paddingTop: '10px' }}>
        {count} passage{count === 1 ? '' : 's'}
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  const minutes = elapsedMs / 60000
  return Math.round((correctChars / 5) / minutes)
}

function ResultCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      flex: 1,
      padding: '14px 16px',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
      }}>{label}</div>
      <div style={{
        fontSize: '24px', fontWeight: 500, color: 'rgba(255,255,255,0.88)',
        lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
      }}>{value}</div>
    </div>
  )
}

/** Quotes/Pangrams: clean centered text in a subtle contained mono panel. */
function MonoTextPanel({ passage, typed }: { passage: Passage; typed: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      padding: '32px 36px',
      width: '600px',
      maxWidth: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: '20px',
        lineHeight: 1.7,
        letterSpacing: '0.01em',
        textAlign: 'left',
      }}>
        {passage.text.split('').map((char, i) => {
          let color = 'rgba(255,255,255,0.28)'
          let borderBottom = 'none'
          if (i < typed.length) {
            color = typed[i] === char ? ACCENT : ERROR_COLOR
          } else if (i === typed.length) {
            color = 'rgba(255,255,255,0.6)'
            borderBottom = `2px solid ${ACCENT}`
          }
          return (
            <span key={i} style={{ color, borderBottom, whiteSpace: 'pre' }}>{char}</span>
          )
        })}
      </div>
    </div>
  )
}

/** Code: full IDE-style panel — traffic-light title bar, line-number gutter, base
 * syntax highlighting with the typed correct/incorrect state overlaid on top. */
function CodePanel({ passage, typed }: { passage: Passage; typed: string }) {
  const tokens = useMemo(() => tokenizeCode(passage.text), [passage.text])
  const lines = useMemo(() => passage.text.split('\n'), [passage.text])
  const lineStarts = useMemo(() => {
    let cursor = 0
    return lines.map((line) => {
      const start = cursor
      cursor += line.length + 1
      return start
    })
  }, [lines])

  const colorForIndex = (i: number): string => {
    const token = tokens.find((t) => i >= t.start && i < t.end)
    return token ? SYNTAX_COLORS[token.type] : SYNTAX_COLORS.plain
  }

  // Cursor-follow horizontal scroll — keeps the active character in view like a
  // real editor instead of letting long lines clip off the panel's right edge.
  const viewportRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const cursor = cursorRef.current
    if (!viewport || !cursor) return

    const viewportWidth = viewport.clientWidth
    const cursorLeft = cursor.offsetLeft
    const currentScroll = viewport.scrollLeft
    const rightBuffer = 80
    const leftBuffer = 40

    if (cursorLeft - currentScroll > viewportWidth - rightBuffer) {
      viewport.scrollLeft = cursorLeft - viewportWidth + rightBuffer
    } else if (cursorLeft - currentScroll < leftBuffer) {
      viewport.scrollLeft = Math.max(0, cursorLeft - leftBuffer)
    }
  }, [typed])

  return (
    <div style={{
      width: '600px',
      maxWidth: '100%',
      background: '#0d0d0f',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      overflow: 'hidden',
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
        <span style={{
          marginLeft: '10px',
          fontSize: '11.5px',
          color: 'rgba(255,255,255,0.45)',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '5px',
          padding: '3px 10px',
        }}>
          challenge.js
        </span>
      </div>

      <div style={{ display: 'flex', padding: '18px 0' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          padding: '0 14px',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          minWidth: '38px',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}>
          {lines.map((_, li) => (
            <div key={li} style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(255,255,255,0.25)' }}>
              {li + 1}
            </div>
          ))}
        </div>
        <div
          ref={viewportRef}
          style={{
            position: 'relative',
            padding: '0 20px',
            fontSize: '14px',
            lineHeight: 1.7,
            flex: 1,
            minWidth: 0,
            overflowX: 'hidden',
            overflowY: 'hidden',
            scrollBehavior: 'smooth',
          }}
        >
          {lines.map((line, li) => (
            <div key={li} style={{ whiteSpace: 'pre' }}>
              {line.length === 0 ? ' ' : line.split('').map((char, ci) => {
                const idx = lineStarts[li] + ci
                const isCursor = idx === typed.length
                let color = colorForIndex(idx)
                let background = 'transparent'
                let borderBottom = 'none'
                if (idx < typed.length) {
                  if (typed[idx] === char) {
                    color = ACCENT
                  } else {
                    background = 'rgba(248,113,113,0.35)'
                    color = '#fff'
                  }
                } else if (isCursor) {
                  borderBottom = `2px solid ${ACCENT}`
                }
                return (
                  <span key={ci} ref={isCursor ? cursorRef : undefined} style={{ color, background, borderBottom }}>{char}</span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TypingChallenge({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<'category' | 'typing' | 'results'>('category')
  const [passage, setPassage] = useState<Passage | null>(null)
  const [typed, setTyped] = useState('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [best, setBest] = useState<number | undefined>(undefined)
  const [isNewRecord, setIsNewRecord] = useState(false)
  const [finalStats, setFinalStats] = useState({ wpm: 0, accuracy: 0, timeMs: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.electronAPI.getGameScores().then((scores) => setBest(scores.challenge))
  }, [])

  useEffect(() => {
    if (phase !== 'typing' || startTime === null) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [phase, startTime])

  const beginPassage = (category: PassageCategory, excludeId?: string) => {
    const p = getRandomPassage(category, excludeId)
    setPassage(p)
    setTyped('')
    setStartTime(null)
    setNow(Date.now())
    setIsNewRecord(false)
    setPhase('typing')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Tab-to-restart: keeps the SAME passage (a fair retry, not a new random one —
  // that's what the "Retry" button on the results screen is for).
  const restartCurrent = () => {
    if (!passage) return
    setTyped('')
    setStartTime(null)
    setNow(Date.now())
    setIsNewRecord(false)
    setPhase('typing')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  useEffect(() => {
    if (phase !== 'typing' && phase !== 'results') return
    const handleGlobalTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        restartCurrent()
      }
    }
    window.addEventListener('keydown', handleGlobalTab)
    return () => window.removeEventListener('keydown', handleGlobalTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, passage])

  const elapsedMs = startTime !== null ? now - startTime : 0
  const correctChars = passage
    ? typed.split('').filter((ch, i) => ch === passage.text[i]).length
    : 0
  const liveWpm = computeWpm(correctChars, elapsedMs)
  const liveAccuracy = typed.length > 0 ? Math.round((correctChars / typed.length) * 100) : 100

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!passage || phase !== 'typing') return
    const value = e.target.value.slice(0, passage.text.length)

    if (startTime === null && value.length > 0) {
      setStartTime(Date.now())
    }

    setTyped(value)

    if (value.length === passage.text.length) {
      const finishTime = Date.now()
      const start = startTime ?? finishTime
      const timeMs = finishTime - start
      const correct = value.split('').filter((ch, i) => ch === passage.text[i]).length
      const wpm = computeWpm(correct, timeMs)
      const accuracy = Math.round((correct / value.length) * 100)
      setFinalStats({ wpm, accuracy, timeMs })

      window.electronAPI.saveGameScore('challenge', wpm).then((result) => {
        setIsNewRecord(result.isNewRecord)
        setBest(result.best)
      })

      setPhase('results')
    }
  }


  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <BackButton onClick={onBack} />
      </div>

      {phase === 'category' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          {/* Header + cards as one composition — the group's width shrinks to the card
              row (its widest child), so alignItems: flex-start lines the header up with
              the card row's left edge instead of floating dead-center above it. */}
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.01em' }}>
                Typing Challenge
              </div>
              <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                Choose a category
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: '20px', marginTop: '28px' }}>
              {(['quotes', 'pangrams', 'code'] as PassageCategory[]).map((cat) => (
                <CategoryCard
                  key={cat}
                  name={CATEGORY_META[cat].name}
                  description={CATEGORY_META[cat].description}
                  count={passageCount(cat)}
                  onClick={() => beginPassage(cat)}
                />
              ))}
            </div>

            {best !== undefined && (
              <div style={{ width: '100%', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '16px' }}>
                Best WPM: {best}
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'typing' && passage && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Stats bar + editor grouped as one centered composition. */}
          <div
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 48px', cursor: 'text' }}
            onClick={() => inputRef.current?.focus()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  WPM <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{liveWpm}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  Accuracy <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{liveAccuracy}%</span>
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  Time <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatTime(elapsedMs)}</span>
                </div>
              </div>

              {passage.category === 'code'
                ? <CodePanel passage={passage} typed={typed} />
                : <MonoTextPanel passage={passage} typed={typed} />}
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)', paddingBottom: '20px' }}>
            Tab to restart
          </div>

          <input
            ref={inputRef}
            value={typed}
            onChange={handleChange}
            autoFocus
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: '1px',
              height: '1px',
            }}
          />
        </div>
      )}

      {phase === 'results' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          {isNewRecord && (
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: ACCENT,
              background: 'rgba(45,212,191,0.12)',
              border: '1px solid rgba(45,212,191,0.3)',
              borderRadius: '20px',
              padding: '6px 16px',
            }}>
              New Record!
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', width: '440px' }}>
            <ResultCard label="WPM" value={finalStats.wpm} />
            <ResultCard label="Accuracy" value={`${finalStats.accuracy}%`} />
            <ResultCard label="Time" value={formatTime(finalStats.timeMs)} />
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            Best: <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{best ?? finalStats.wpm}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={() => passage && beginPassage(passage.category, passage.id)}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: ACCENT,
                border: 'none',
                color: '#0b0b0c',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
            <button
              onClick={onBack}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              ‹ Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Game() {
  const [mode, setMode] = useState<GameMode>('picker')

  return (
    <Shell>
      {mode === 'picker' && <Picker onSelect={setMode} />}
      {mode === 'challenge' && <TypingChallenge onBack={() => setMode('picker')} />}
      {mode === 'focus' && <ComingSoon title="Focus Session" onBack={() => setMode('picker')} />}
      {mode === 'arcade' && <ComingSoon title="Combo Arcade" onBack={() => setMode('picker')} />}
    </Shell>
  )
}
