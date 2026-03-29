import { useEffect, useState } from 'react'

interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
}

function App() {
  const [wpm, setWpm] = useState(0)
  const [displayWpm, setDisplayWpm] = useState(0)
  const [isDecaying, setIsDecaying] = useState(false)

  useEffect(() => {
    const unsubscribe = window.electronAPI.subscribeToWPM((stats: WPMStats) => {
      setWpm(stats.wpm)
      if (stats.wpm > 0) {
        setIsDecaying(false)
        setDisplayWpm(stats.wpm)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (wpm === 0 && displayWpm > 0 && !isDecaying) {
      setIsDecaying(true)

      let current = displayWpm

      const interval = setInterval(() => {
        current -= Math.max(1, Math.ceil(current * 0.08))

        if (current <= 0) {
          current = 0
          clearInterval(interval)
          setIsDecaying(false)
        }

        setDisplayWpm(current)
      }, 30)

      return () => clearInterval(interval)
    }
  }, [wpm])

  return (
    <div
      className="h-[100px] flex flex-row items-center justify-center px-6 overflow-hidden select-none cursor-default"
      style={{
        background: 'rgba(28, 28, 30, 0.92)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        borderRadius: '18px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        minWidth: '145px',
        gap: '8px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitAppRegion: 'drag',
      }}
    >
      <span
        className="leading-none"
        style={{
          fontSize: '42px',
          fontWeight: 600,
          lineHeight: 1,
          color: 'rgba(255, 255, 255, 0.95)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(displayWpm)}
      </span>
      <span
        className="leading-none"
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
