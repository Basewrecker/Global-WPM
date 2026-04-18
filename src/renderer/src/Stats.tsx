import { useState, useEffect } from 'react'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '11px',
      fontWeight: '600',
      color: 'rgba(255,255,255,0.45)',
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      marginBottom: '6px',
      marginTop: '20px',
    }}>{children}</h3>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
    }}>
      <span style={{ fontSize: '13px', color: '#e5e5e7' }}>{label}</span>
      {children}
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

export default function Stats() {
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
      <div style={{
        flex: 1,
        padding: '12px 28px 24px',
        overflowY: 'auto',
        maxWidth: '440px',
        margin: '0 auto',
        width: '100%',
      }}>
        <SectionTitle>Session Stats</SectionTitle>
        <SettingRow label="WPM">
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
            {Math.round(stats.wpm)}
          </span>
        </SettingRow>
        <SettingRow label="Accuracy (%)">
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
            {stats.accuracy}
          </span>
        </SettingRow>
        <SettingRow label="Total Keystrokes">
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
            {stats.totalKeystrokes}
          </span>
        </SettingRow>
        <SettingRow label="Backspaces">
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
            {stats.backspaces}
          </span>
        </SettingRow>

        <div style={{ marginTop: '28px' }}>
          <ResetButton onClick={() => setStats({ wpm: 0, accuracy: 0, totalKeystrokes: 0, backspaces: 0 })} />
        </div>
      </div>
    </div>
  )
}
