import { useEffect, useState, useRef } from 'react'

interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
  lastKeyTime: number
  smartColouring: boolean
  wpmTextSize: 'medium' | 'large'
  colorRanges: {
    low: string
    mid: string
    high: string
    ultra: string
  }
  opacity: number
  blur: boolean
}

const IDLE_THRESHOLD_MS = 3000

function App() {
  const [displayWpm, setDisplayWpm] = useState(0)
  const [wpmColor, setWpmColor] = useState('#9ca3af')
  const [textSize, setTextSize] = useState<'medium' | 'large'>('medium')
  const [smartColouring, setSmartColouring] = useState(true)
  const [, setOpacity] = useState(0.9)
  const [blurEnabled, setBlurEnabled] = useState(false)

  const rawWpmRef = useRef(0)
  const displayWpmRef = useRef(0)
  const lastKeyTimeRef = useRef(0)
  const blurRef = useRef(false)
  const colorRangesRef = useRef<WPMStats['colorRanges']>({
    low: '#ef4444',
    mid: '#eab308',
    high: '#22c55e',
    ultra: '#3b82f6',
  })

  const defaultColor = '#9CA3AF'

  const fontSize = textSize === 'large' ? '50px' : '44px'
  const labelSize = '13px'

  useEffect(() => {
    const unsubscribe = window.electronAPI.subscribeToWPM((stats: WPMStats) => {
      rawWpmRef.current = stats.wpm
      lastKeyTimeRef.current = stats.lastKeyTime || 0
      setTextSize(stats.wpmTextSize || 'medium')
      setSmartColouring(stats.smartColouring)
      setOpacity(stats.opacity ?? 0.9)
      const nextBlur = stats.blur ?? false
      if (nextBlur !== blurRef.current) {
        blurRef.current = nextBlur
        setBlurEnabled(nextBlur)
      }
      if (stats.colorRanges) {
        colorRangesRef.current = stats.colorRanges
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let animationId: number
    
    const getTier = (wpm: number): number => {
      if (wpm < 60) return 0
      if (wpm < 90) return 1
      if (wpm < 120) return 2
      return 3
    }
    
    const getColorForTier = (tier: number): string => {
      const ranges = colorRangesRef.current
      switch (tier) {
        case 0: return ranges.low
        case 1: return ranges.mid
        case 2: return ranges.high
        case 3: return ranges.ultra
        default: return '#9CA3AF'
      }
    }
    
    const animate = () => {
      const now = Date.now()
      const lastKeyTime = lastKeyTimeRef.current
      let rawWpm = rawWpmRef.current
      let displayWpm = displayWpmRef.current
      
      if (rawWpm === 0) {
        displayWpm = 0
      } else {
        const isIdle = lastKeyTime > 0 && (now - lastKeyTime) > IDLE_THRESHOLD_MS
        
        if (isIdle) {
          if (rawWpm > 0) {
            rawWpm *= 0.92
            if (rawWpm < 1) rawWpm = 0
            rawWpmRef.current = rawWpm
          }
          
          if (displayWpm > 0) {
            displayWpm *= 0.92
            if (displayWpm < 1) displayWpm = 0
          }
        } else {
          if (rawWpm > 0) {
            displayWpm += (rawWpm - displayWpm) * 0.4
          }
        }
      }
      
      if (!isFinite(displayWpm) || displayWpm < 0) displayWpm = 0
      if (!isFinite(rawWpm) || rawWpm < 0) rawWpm = 0
      
      displayWpmRef.current = displayWpm
      setDisplayWpm(displayWpm)
      
      const roundedWpm = Math.round(displayWpm)
      
      let currentColor = defaultColor
      if (smartColouring && roundedWpm > 0) {
        const tier = getTier(roundedWpm)
        currentColor = getColorForTier(tier)
      }
      
      setWpmColor(currentColor)
      
      animationId = requestAnimationFrame(animate)
    }
    
    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [smartColouring])

  return (
    <div
      className="flex items-center justify-center overflow-hidden select-none cursor-default overlay-drag"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        backgroundColor: blurEnabled ? 'rgba(28, 28, 30, 0.55)' : '#1c1c1e',
        backdropFilter: blurEnabled ? 'blur(20px) saturate(150%)' : undefined,
        WebkitBackdropFilter: blurEnabled ? 'blur(20px) saturate(150%)' : undefined,
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div className="flex flex-row items-baseline justify-start" style={{ gap: '4px', width: '100%', paddingLeft: '6px' }}>
        <span
          className="leading-none"
          style={{
            fontSize,
            fontWeight: 700,
            lineHeight: 1,
            color: wpmColor,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(displayWpm)}
        </span>
        <span
          className="leading-none"
          style={{
            fontSize: labelSize,
            fontWeight: 600,
            lineHeight: 1,
            color: 'rgba(255, 255, 255, 0.55)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          WPM
        </span>
      </div>
    </div>
  )
}

export default App
