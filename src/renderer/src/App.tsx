import { useEffect, useState } from 'react'

interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
}

function App() {
  const [wpm, setWpm] = useState(0)

  useEffect(() => {
    const unsubscribe = window.electronAPI.subscribeToWPM((stats: WPMStats) => {
      setWpm(stats.wpm)
    })
    return () => unsubscribe()
  }, [])

  return (
    <div
      className="w-[120px] h-[100px] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'rgba(28, 28, 30, 0.85)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderRadius: '18px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <span
        className="leading-none"
        style={{
          fontSize: '44px',
          fontWeight: 600,
          lineHeight: 1,
          color: 'rgba(255, 255, 255, 0.95)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {wpm}
      </span>

      <span
        className="leading-none mt-1"
        style={{
          fontSize: '11px',
          fontWeight: 500,
          lineHeight: 1,
          color: 'rgba(255, 255, 255, 0.65)',
          letterSpacing: '0.05em',
        }}
      >
        WPM
      </span>
    </div>
  )
}

export default App
