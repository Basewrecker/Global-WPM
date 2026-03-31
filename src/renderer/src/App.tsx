import { useEffect, useState } from 'react'

interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
  smartColouring: boolean
  wpmTextSize: 'medium' | 'large'
}

function getWpmColor(wpm: number): string {
  if (wpm === 0) return '#9CA3AF'
  if (wpm <= 60) return '#EF4444'
  if (wpm <= 90) return '#EAB308'
  if (wpm <= 120) return '#22C55E'
  return '#3B82F6'
}

function App() {
  const [wpm, setWpm] = useState(0)
  const [displayWpm, setDisplayWpm] = useState(0)
  const [isDecaying, setIsDecaying] = useState(false)
  const [wpmColor, setWpmColor] = useState('#9ca3af')
  const [textSize, setTextSize] = useState<'medium' | 'large'>('medium')

  const fontSize = textSize === 'large' ? '48px' : '42px'
  const labelSize = textSize === 'large' ? '12px' : '11px'

  useEffect(() => {
    const unsubscribe = window.electronAPI.subscribeToWPM((stats: WPMStats) => {
      setWpm(stats.wpm)
      setTextSize(stats.wpmTextSize || 'medium')
      if (stats.smartColouring) {
        setWpmColor(getWpmColor(stats.wpm))
      } else {
        setWpmColor('#9CA3AF')
      }
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
        minWidth: textSize === 'large' ? '160px' : '145px',
        gap: '8px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      {...({ WebkitAppRegion: 'drag' } as React.HTMLAttributes<HTMLDivElement>)}
    >
      <span
        className="leading-none"
        style={{
          fontSize,
          fontWeight: 600,
          lineHeight: 1,
          color: wpmColor,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          transition: 'color 0.15s ease, font-size 0.2s ease',
        }}
      >
        {Math.round(displayWpm)}
      </span>
      <span
        className="leading-none"
        style={{
          fontSize: labelSize,
          fontWeight: 500,
          lineHeight: 1,
          color: 'rgba(255, 255, 255, 0.65)',
          letterSpacing: '0.05em',
          transition: 'font-size 0.2s ease',
        }}
      >
        WPM
      </span>
    </div>
  )
}

export default App
