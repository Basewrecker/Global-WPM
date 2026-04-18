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
            color: value === option.value ? '#ffffff' : 'rgba(255,255,255,0.6)',
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

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '11px',
        color: 'rgba(255,255,255,0.6)',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px',
        padding: '5px 10px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'block',
        margin: '0 24px 20px auto',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
      }}
    >
      Reset Session
    </button>
  )
}

function StatGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1px',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: '10px',
      overflow: 'hidden',
      margin: '20px 24px',
    }}>
      {items.map(({ label, value }) => (
        <div key={label} style={{
          padding: '18px 20px',
          background: 'rgba(20,20,20,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
          }}>
            {label}
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1,
          }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Stats() {
  const [activeView, setActiveView] = useState<'session' | 'lifetime'>('session')
  const [displayedView, setDisplayedView] = useState<'session' | 'lifetime'>('session')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [stats, setStats] = useState({
    wpm: 0,
    accuracy: 0,
    totalKeystrokes: 0,
    backspaces: 0,
  })

  useEffect(() => {
    window.electronAPI.getSessionStats().then((result) => {
      setStats(result)
    })
  }, [])

  const sessionItems = [
    { label: 'Current WPM', value: Math.round(stats.wpm) },
    { label: 'Peak WPM', value: 0 },
    { label: 'Total Keystrokes', value: stats.totalKeystrokes },
    { label: 'Backspaces', value: stats.backspaces },
  ]

  const lifetimeItems = [
    { label: 'All-time Peak WPM', value: 0 },
    { label: 'Total Keystrokes', value: 0 },
    { label: 'Total Sessions', value: 0 },
    { label: 'Time Active', value: '00:00' },
  ]

  return (
    <div className="frosted-glass" style={{
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      lineHeight: 1.4,
      display: 'flex',
      flexDirection: 'column',
      color: 'rgba(255,255,255,0.9)',
    }}>
      {/* Titlebar */}
      <div style={{
        height: '60px',
        background: 'rgba(30,30,30,0.9)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'relative',
      }}>
        <div className="titlebar-drag" style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
        }} />
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
        {/* Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '20px 24px 0',
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

        {/* Grid */}
        <div style={{
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'translateY(4px)' : 'translateY(0px)',
          transition: 'opacity 120ms ease-out, transform 120ms ease-out',
        }}>
          <StatGrid items={displayedView === 'session' ? sessionItems : lifetimeItems} />
        </div>

        {/* Reset */}
        {activeView === 'session' && (
          <ResetButton onClick={() => setStats({ wpm: 0, accuracy: 0, totalKeystrokes: 0, backspaces: 0 })} />
        )}
      </div>
    </div>
  )
}
