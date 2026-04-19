import { useState, useEffect } from 'react'

function SegmentedControl({ value, options, onChange }: {
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div style={{
      display: 'flex',
      backgroundColor: 'rgba(44, 44, 46, 0.8)',
      borderRadius: '6px',
      padding: '2px',
      gap: '2px',
    }}>
      {options.map((option) => (
        <div
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: value === option.value ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: value === option.value ? '#ffffff' : 'rgba(255,255,255,0.5)',
            fontSize: '12px',
            fontWeight: value === option.value ? '500' : '400',
            transition: 'all 0.15s ease',
          }}
        >
          {option.label}
        </div>
      ))}
    </div>
  )
}

const cardLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.28)',
}

const cardValueStyle: React.CSSProperties = {
  fontSize: '26px',
  fontWeight: 500,
  color: 'rgba(255,255,255,0.88)',
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.01em',
}

function StatCard({ label, value, fullWidth }: { label: string; value: string | number; fullWidth?: boolean }) {
  return (
    <div style={{
      padding: fullWidth ? '12px 16px' : '14px 16px',
      background: 'transparent',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <div style={cardLabelStyle}>{label}</div>
      <div style={cardValueStyle}>{value}</div>
    </div>
  )
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function Stats() {
  const [activeView, setActiveView] = useState<'session' | 'lifetime'>('session')
  const [displayedView, setDisplayedView] = useState<'session' | 'lifetime'>('session')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [stats, setStats] = useState({
    peakWpm: 0,
    accuracy: null as number | null,
    totalKeystrokes: 0,
    backspaces: 0,
    avgWpm: 0,
    timeTypedMs: 0,
  })
  const [lifetimeStats, setLifetimeStats] = useState({
    peakWpm: 0,
    accuracy: null as number | null,
    avgWpm: 0,
    sessions: 0,
    timeTypedMs: 0,
  })

  useEffect(() => {
    const load = () => {
      window.electronAPI.getSessionStats().then(setStats)
      window.electronAPI.getLifetimeStats().then(setLifetimeStats)
    }
    load()
    const interval = setInterval(load, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="frosted-glass" style={{
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      lineHeight: 1.4,
      display: 'flex',
      flexDirection: 'column',
      color: 'rgba(255,255,255,0.9)',
    }}>
      {/* Titlebar wrapper */}
      <div style={{
        height: '40px',
        background: 'rgba(30,30,30,0.9)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'relative',
      }}>
        {/* Drag layer - lowest layer, covers full titlebar */}
        <div className="titlebar-drag" style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
        }} />

        {/* Title - only wraps content, doesn't cover full width */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: '13px',
            fontWeight: '500',
            color: 'rgba(255,255,255,0.9)',
          }}>Stats</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          paddingTop: '8px',
        }}>
          {/* Toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '14px 24px 0',
          }}>
            <SegmentedControl
              value={activeView}
              options={[
                { label: 'This Session', value: 'session' },
                { label: 'Lifetime', value: 'lifetime' },
              ]}
              onChange={(v) => {
                const next = v as 'session' | 'lifetime'
                if (next === activeView || isTransitioning) return
                setIsTransitioning(true)
                setActiveView(next)
                setTimeout(() => {
                  setDisplayedView(next)
                  setIsTransitioning(false)
                }, 120)
              }}
            />
          </div>

          {/* Hero + Grid (transition wrapper — do not modify) */}
          <div style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? 'translateY(4px)' : 'translateY(0px)',
            transition: 'opacity 120ms ease-out, transform 120ms ease-out',
          }}>
            {/* Hero stat */}
            <div style={{
              padding: '18px 28px 0 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.28)',
              }}>
                {displayedView === 'session' ? 'Peak WPM' : 'All-Time Peak'}
              </div>
              <div style={{
                fontSize: '60px',
                fontWeight: 600,
                lineHeight: 1,
                color: 'rgba(255,255,255,0.95)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.03em',
              }}>
                {displayedView === 'session' ? stats.peakWpm : lifetimeStats.peakWpm}
              </div>
            </div>

            {/* Session grid — Peak full-width, Keys + Backspaces */}
            {displayedView === 'session' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                margin: '14px 24px 0',
              }}>

                <StatCard label="Accuracy" value={stats.accuracy !== null ? `${stats.accuracy}%` : '—'} fullWidth />
                <StatCard label="Average WPM" value={stats.avgWpm} fullWidth />
                <StatCard label="Keys" value={stats.totalKeystrokes} />
                <StatCard label="Time Typed" value={formatTime(stats.timeTypedMs)} />
              </div>
            )}

            {/* Lifetime grid — 2×2 */}
            {displayedView === 'lifetime' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                margin: '14px 24px 0',
              }}>
                <StatCard label="Accuracy" value={lifetimeStats.accuracy !== null ? `${lifetimeStats.accuracy}%` : '—'} />
                <StatCard label="Average WPM" value={lifetimeStats.avgWpm} />
                <StatCard label="Sessions" value={lifetimeStats.sessions} />
                <StatCard label="Time Typed" value={formatTime(lifetimeStats.timeTypedMs)} />
              </div>
            )}
          </div>

          {/* Reset */}
          {activeView === 'session' && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '16px 24px 20px',
            }}>
              <button
                onClick={() => {
                  window.electronAPI.resetSession()
                  setStats({ peakWpm: 0, accuracy: null, totalKeystrokes: 0, backspaces: 0, avgWpm: 0, timeTypedMs: 0 })
                }}
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '7px',
                  padding: '7px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.09)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                }}
              >
                Reset Session
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
