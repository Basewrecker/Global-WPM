import { useState, useEffect, useRef, useMemo } from 'react'
import { Settings as SettingsIcon, Sun, Sliders, Activity, Wrench } from 'lucide-react'
import { HexColorPicker } from 'react-colorful'

const DEFAULT_SHORTCUT = 'Alt+Shift+W'

const SPACING = { section: 20, row: 12, gap: 10 }

interface Settings {
  general: {
    launchAtLogin: boolean
    showMenuBarWpm: boolean
    globalShortcut: string
    lockOverlayToDesktop: boolean
    trackingEnabled: boolean
  }
  display: {
    showOverlay: boolean
    opacity: number
    blur: boolean
  }
  appearance: {
    smartColouring: boolean
    wpmTextSize: 'medium' | 'large'
  }
  behaviour: {
    inactivityTimeout: number
    minKeystrokes: number
  }
  tracking: {
    trackAccuracy: boolean
    trackRawWpm: boolean
  }
  advanced: {
    debugMode: boolean
  }
}

const defaultSettings: Settings = {
  general: {
    launchAtLogin: false,
    showMenuBarWpm: false,
    globalShortcut: DEFAULT_SHORTCUT,
    lockOverlayToDesktop: false,
    trackingEnabled: true,
  },
  display: {
    showOverlay: true,
    opacity: 0.9,
    blur: false,
  },
  appearance: {
    smartColouring: true,
    wpmTextSize: 'medium',
  },
  behaviour: {
    inactivityTimeout: 5000,
    minKeystrokes: 10,
  },
  tracking: {
    trackAccuracy: false,
    trackRawWpm: true,
  },
  advanced: {
    debugMode: false,
  },
}

type TabId = 'general' | 'appearance' | 'behaviour' | 'tracking' | 'advanced'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'general', label: 'General', icon: <SettingsIcon size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Sun size={16} /> },
  { id: 'behaviour', label: 'Behaviour', icon: <Sliders size={16} /> },
  { id: 'tracking', label: 'Tracking', icon: <Activity size={16} /> },
  { id: 'advanced', label: 'Advanced', icon: <Wrench size={16} /> },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      style={{
        width: '36px',
        height: '22px',
        borderRadius: '11px',
        backgroundColor: checked ? '#30d158' : '#48484a',
        position: 'relative',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '9px',
          backgroundColor: '#ffffff',
          position: 'absolute',
          top: '2px',
          left: checked ? '16px' : '2px',
          transition: 'all 0.2s ease',
        }}
      />
    </div>
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

function NumberRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
      <span style={{ fontSize: '13px', color: '#e5e5e7' }}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        style={{
          width: '80px',
          padding: '5px 10px',
          backgroundColor: 'rgba(44, 44, 46, 0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '5px',
          color: '#ffffff',
          fontSize: '13px',
          textAlign: 'center',
          outline: 'none',
        }}
      />
    </div>
  )
}

function SliderRow({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
      <span style={{ fontSize: '13px', color: '#e5e5e7' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: '120px',
            height: '4px',
            appearance: 'none',
            background: `linear-gradient(to right, #30d158 ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.15) ${((value - min) / (max - min)) * 100}%)`,
            borderRadius: '2px',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', minWidth: '36px', textAlign: 'right' }}>
          {Math.round(value)}%
        </span>
      </div>
    </div>
  )
}

function ColorPicker({ color, onChange, disabled }: { color: string; onChange: (color: string) => void; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div ref={popoverRef} style={{ position: 'relative' }}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '22px',
          height: '22px',
          backgroundColor: color,
          borderRadius: '7px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25), 0 0 6px rgba(0,0,0,0.2)',
          opacity: disabled ? 0.4 : 1,
          transition: 'transform 0.15s ease, opacity 0.2s ease',
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1.05)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      />
      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: '32px',
          right: 0,
          zIndex: 1000,
          background: 'rgba(20, 20, 20, 0.98)',
          borderRadius: '10px',
          padding: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <HexColorPicker color={color} onChange={onChange} />
          <input
            type="text"
            value={color.toUpperCase()}
            onChange={(e) => {
              const val = e.target.value
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                onChange(val)
              }
            }}
            style={{
              width: '80px',
              marginTop: '8px',
              padding: '6px 8px',
              backgroundColor: 'rgba(44, 44, 46, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '12px',
              fontFamily: 'monospace',
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  )
}

function formatShortcut(shortcut: string): string {
  return shortcut
    .replace(/CommandOrControl|Ctrl/gi, '⌘')
    .replace(/Alt/gi, '⌥')
    .replace(/Control/gi, '⌃')
    .replace(/Shift/gi, '⇧')
    .replace(/\+/g, ' + ')
}

function ShortcutRow({ label, shortcut, onChange }: {
  label: string; shortcut: string; onChange: (s: string) => void
}) {
  const [listening, setListening] = useState(false)
  const shortcutRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!listening) {
      return
    }

    const keys = new Set<string>()

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.repeat) return

      const modifierKeys = ['Shift', 'Alt', 'Control', 'Meta']
      
      if (modifierKeys.includes(e.key)) {
        if (e.key === 'Shift') keys.add('Shift')
        if (e.key === 'Alt') keys.add('Alt')
        if (e.key === 'Control') keys.add('Control')
        if (e.key === 'Meta') keys.add('CommandOrControl')
        return
      }

      let finalKey = e.key
      if (finalKey.length === 1) {
        finalKey = finalKey.toUpperCase()
      } else if (finalKey.startsWith('Arrow')) {
        finalKey = finalKey.replace('Arrow', '')
      } else if (finalKey === 'Space') {
        finalKey = 'Space'
      }

      if (['Up', 'Down', 'Left', 'Right', 'Space', 'Enter', 'Backspace', 'Tab', 'Escape', 'Delete'].includes(finalKey)) {
        keys.add(finalKey)
      } else if (finalKey.length === 1 || finalKey.length > 1) {
        keys.add(finalKey)
      }

      if (keys.size >= 2) {
        const accelerator = Array.from(keys).join('+')
        onChange(accelerator)
        setListening(false)
        keys.clear()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [listening, onChange])

  const handleReset = () => {
    onChange(DEFAULT_SHORTCUT)
    
    if (shortcutRef.current) {
      shortcutRef.current.classList.remove('shortcut-reset')
      void shortcutRef.current.offsetWidth
      shortcutRef.current.classList.add('shortcut-reset')
      setTimeout(() => {
        shortcutRef.current?.classList.remove('shortcut-reset')
      }, 350)
    }
  }

  const isDefault = shortcut === DEFAULT_SHORTCUT

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
    }}>
      <span style={{ fontSize: '13px', color: '#e5e5e7' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          ref={shortcutRef}
          onClick={() => setListening(true)}
          onBlur={() => setListening(false)}
          style={{
            padding: '6px 12px',
            backgroundColor: listening ? 'rgba(48, 209, 88, 0.2)' : 'rgba(44, 44, 46, 0.8)',
            border: `1px solid ${listening ? '#30D158' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '6px',
            color: listening ? '#30D158' : '#ffffff',
          fontSize: '12px',
          cursor: 'pointer',
          minWidth: '100px',
          textAlign: 'center',
          fontFamily: 'monospace',
        }}
      >
        {listening ? 'Press keys...' : formatShortcut(shortcut)}
      </div>
        {!isDefault && (
          <button
            onClick={handleReset}
            style={{
              padding: '4px 10px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '4px',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '11px',
      fontWeight: '600',
      color: 'rgba(255,255,255,0.45)',
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      marginBottom: `${SPACING.row}px`,
      marginTop: `${SPACING.section}px`,
    }}>{children}</h3>
  )
}

function SegmentedControl<T extends string>({ 
  value, 
  options, 
  onChange 
}: { 
  value: T
  options: { label: string; value: T }[]
  onChange: (value: T) => void
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
      Reset All Settings
    </button>
  )
}

const defaultColors = {
  low: '#ef4444',
  mid: '#eab308',
  high: '#22c55e',
  ultra: '#3b82f6',
}

const HEATMAP_ACCENT = '45, 212, 191' // #2dd4bf — teal heat accent

// Sqrt scale lifts mid-frequency keys so common letters read clearly brighter
// than rare ones, instead of only the single max cell standing out.
function heatmapIntensity(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0
  return Math.max(Math.sqrt(count) / Math.sqrt(maxCount), 0.12)
}

function heatmapColor(intensity: number): string {
  if (intensity <= 0) return 'rgba(255,255,255,0.04)'
  return `rgba(${HEATMAP_ACCENT}, ${intensity.toFixed(3)})`
}

function heatmapTextColor(intensity: number): string {
  return intensity > 0.4 ? '#ffffff' : 'rgba(255,255,255,0.4)'
}

const KEY_CELL_SIZE = 22
const KEY_CELL_GAP = 3
const KEY_ROW_GAP = 5

const KEYBOARD_ROWS: { key: string; label: string }[][] = [
  [
    { key: 'backquote', label: '`' }, { key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' },
    { key: '4', label: '4' }, { key: '5', label: '5' }, { key: '6', label: '6' }, { key: '7', label: '7' },
    { key: '8', label: '8' }, { key: '9', label: '9' }, { key: '0', label: '0' },
    { key: 'minus', label: '-' }, { key: 'equal', label: '=' },
  ],
  [
    { key: 'q', label: 'q' }, { key: 'w', label: 'w' }, { key: 'e', label: 'e' }, { key: 'r', label: 'r' },
    { key: 't', label: 't' }, { key: 'y', label: 'y' }, { key: 'u', label: 'u' }, { key: 'i', label: 'i' },
    { key: 'o', label: 'o' }, { key: 'p', label: 'p' },
    { key: 'bracketleft', label: '[' }, { key: 'bracketright', label: ']' }, { key: 'backslash', label: '\\' },
  ],
  [
    { key: 'a', label: 'a' }, { key: 's', label: 's' }, { key: 'd', label: 'd' }, { key: 'f', label: 'f' },
    { key: 'g', label: 'g' }, { key: 'h', label: 'h' }, { key: 'j', label: 'j' }, { key: 'k', label: 'k' },
    { key: 'l', label: 'l' }, { key: 'semicolon', label: ';' }, { key: 'quote', label: "'" },
  ],
  [
    { key: 'z', label: 'z' }, { key: 'x', label: 'x' }, { key: 'c', label: 'c' }, { key: 'v', label: 'v' },
    { key: 'b', label: 'b' }, { key: 'n', label: 'n' }, { key: 'm', label: 'm' },
    { key: 'comma', label: ',' }, { key: 'period', label: '.' }, { key: 'slash', label: '/' },
  ],
]

// Standard QWERTY stagger — each row nudges right relative to the last.
const ROW_OFFSETS = [0, 13, 18, 31]

function KeyCell({ label, count, maxCount, wide, onHover, onMove }: {
  label: string; count: number; maxCount: number; wide?: boolean
  onHover: (text: string | null) => void
  onMove: (x: number, y: number) => void
}) {
  const intensity = heatmapIntensity(count, maxCount)
  return (
    <div
      onMouseEnter={() => onHover(`${label.toUpperCase()} — ${count.toLocaleString()} press${count === 1 ? '' : 'es'}`)}
      onMouseMove={(e) => onMove(e.clientX, e.clientY)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: wide ? `${KEY_CELL_SIZE * 6 + KEY_CELL_GAP * 5}px` : `${KEY_CELL_SIZE}px`,
        height: `${KEY_CELL_SIZE}px`,
        borderRadius: '5px',
        backgroundColor: heatmapColor(intensity),
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        color: heatmapTextColor(intensity),
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {label}
    </div>
  )
}

function KeyboardHeatmap({ keyFrequency, onHover, onMove }: {
  keyFrequency: Record<string, number>
  onHover: (text: string | null) => void
  onMove: (x: number, y: number) => void
}) {
  const maxCount = useMemo(
    () => Math.max(0, ...Object.values(keyFrequency)),
    [keyFrequency]
  )
  const spaceCount = keyFrequency.space || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${KEY_ROW_GAP}px`, alignItems: 'center' }}>
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: `${KEY_CELL_GAP}px`, marginLeft: `${ROW_OFFSETS[i]}px` }}>
          {row.map(({ key, label }) => (
            <KeyCell
              key={key}
              label={label}
              count={keyFrequency[key] || 0}
              maxCount={maxCount}
              onHover={onHover}
              onMove={onMove}
            />
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: `${KEY_CELL_GAP}px` }}>
        <KeyCell label="space" count={spaceCount} maxCount={maxCount} wide onHover={onHover} onMove={onMove} />
      </div>
    </div>
  )
}

const HOUR_LABELS: Record<number, string> = { 0: '12am', 6: '6am', 12: '12pm', 18: '6pm' }

function formatHourReadout(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

const HOUR_CELL_SIZE = 12
const HOUR_CELL_GAP = 2

function HourlyActivityGrid({ hourly, onHover, onMove }: {
  hourly: number[]
  onHover: (text: string | null) => void
  onMove: (x: number, y: number) => void
}) {
  const maxHourly = useMemo(() => Math.max(0, ...hourly), [hourly])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: `${HOUR_CELL_GAP}px` }}>
        {hourly.map((count, hour) => (
          <div
            key={hour}
            onMouseEnter={() => onHover(`${formatHourReadout(hour)} — ${count.toLocaleString()} keystrokes`)}
            onMouseMove={(e) => onMove(e.clientX, e.clientY)}
            onMouseLeave={() => onHover(null)}
            style={{
              width: `${HOUR_CELL_SIZE}px`,
              height: `${HOUR_CELL_SIZE}px`,
              borderRadius: '3px',
              backgroundColor: heatmapColor(heatmapIntensity(count, maxHourly)),
              border: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: `${HOUR_CELL_GAP}px`, marginTop: '4px' }}>
        {hourly.map((_, hour) => (
          <div
            key={hour}
            style={{
              width: `${HOUR_CELL_SIZE}px`,
              flexShrink: 0,
              fontSize: '8px',
              color: 'rgba(255,255,255,0.35)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {HOUR_LABELS[hour] || ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function HeatmapTooltip({ text, pos }: { text: string | null; pos: { x: number; y: number } | null }) {
  if (!text || !pos) return null

  // Flip to the cursor's left when there isn't room to the right.
  const nearRightEdge = pos.x > window.innerWidth - 160
  const left = nearRightEdge ? pos.x - 12 : pos.x + 12

  return (
    <div style={{
      position: 'fixed',
      left: `${left}px`,
      top: `${pos.y - 8}px`,
      transform: nearRightEdge ? 'translateX(-100%)' : 'none',
      background: 'rgba(20,20,22,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '6px',
      padding: '4px 8px',
      fontSize: '12px',
      color: '#ffffff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      pointerEvents: 'none',
      zIndex: 1000,
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {text}
    </div>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null)
  const [overlayOpacity, setOverlayOpacity] = useState(90)
  const [blurEnabled, setBlurEnabled] = useState(false)
  const [trackingEnabled, setTrackingEnabled] = useState(true)
  const [colorRanges, setColorRanges] = useState({ ...defaultColors })
  const [sessionStats, setSessionStats] = useState({
    wpm: 0,
    accuracy: 0,
    totalKeystrokes: 0,
    backspaces: 0,
  })
  const emptyHeatmapSet = { keyFrequency: {} as Record<string, number>, hourly: new Array(24).fill(0) }
  const [heatmapData, setHeatmapData] = useState<{
    lifetime: { keyFrequency: Record<string, number>; hourly: number[] }
    session: { keyFrequency: Record<string, number>; hourly: number[] }
  }>({
    lifetime: emptyHeatmapSet,
    session: emptyHeatmapSet,
  })
  const [heatmapMode, setHeatmapMode] = useState<'lifetime' | 'session'>('lifetime')
  const [hoverReadout, setHoverReadout] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    window.electronAPI.getGlobalShortcut().then((shortcut) => {
      setSettings((prev) => ({
        ...prev,
        general: { ...prev.general, globalShortcut: shortcut }
      }))
    })
    window.electronAPI.getColorRanges().then((ranges) => {
      if (ranges) {
        setColorRanges(ranges)
      }
    })
    setBlurEnabled(settings.display.blur)
  }, [])

  useEffect(() => {
    if (activeTab !== 'tracking') return
    window.electronAPI.getHeatmapData().then(setHeatmapData)
  }, [activeTab])

  const update = <K extends keyof Settings>(section: K, key: keyof Settings[K], value: Settings[K][keyof Settings[K]]) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }))
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div>
            <SectionTitle>General</SectionTitle>
            <SettingRow label="Launch at Login">
              <Toggle checked={settings.general.launchAtLogin} onChange={(v) => {
                update('general', 'launchAtLogin', v)
                window.electronAPI.setLaunchAtLogin(v)
              }} />
            </SettingRow>
            <SettingRow label="Show WPM in Menu Bar">
              <Toggle checked={settings.general.showMenuBarWpm} onChange={(v) => {
                update('general', 'showMenuBarWpm', v)
                window.electronAPI.setShowMenuBarWpm(v)
              }} />
            </SettingRow>
            <SettingRow label="Enable Tracking">
              <Toggle checked={trackingEnabled} onChange={(v) => {
                setTrackingEnabled(v)
                window.electronAPI.setTrackingEnabled(v)
              }} />
            </SettingRow>
            <ShortcutRow
              label="Global Shortcut"
              shortcut={settings.general.globalShortcut}
              onChange={async (shortcut) => {
                update('general', 'globalShortcut', shortcut)
                await window.electronAPI.setGlobalShortcut(shortcut)
              }}
            />
            <SettingRow label="Lock Overlay to Desktop">
              <Toggle checked={settings.general.lockOverlayToDesktop} onChange={(v) => {
                update('general', 'lockOverlayToDesktop', v)
                window.electronAPI.setLockOverlayToDesktop(v)
              }} />
            </SettingRow>
          </div>
        )

      case 'appearance':
        return (
          <div>
            <SectionTitle>Colors</SectionTitle>
            <SettingRow label="Smart Colouring">
              <Toggle checked={settings.appearance.smartColouring} onChange={(v) => {
                update('appearance', 'smartColouring', v)
                window.electronAPI.setSmartColouring(v)
              }} />
            </SettingRow>
            <div
              style={{
                opacity: settings.appearance.smartColouring ? 1 : 0.5,
                filter: settings.appearance.smartColouring ? 'none' : 'grayscale(0.3)',
                transition: 'opacity 0.2s ease, filter 0.2s ease',
              }}
            >
              <SectionTitle>WPM Color Ranges</SectionTitle>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: `${SPACING.row}px`, marginTop: '4px' }}>
                Customize how your WPM is colored based on typing speed.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: `${SPACING.gap}px`, cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                <span style={{ fontSize: '13px', color: '#e5e5e7' }}>Slow (0–60)</span>
                <ColorPicker color={colorRanges.low} onChange={(c) => {
                  const newRanges = { ...colorRanges, low: c }
                  setColorRanges(newRanges)
                  window.electronAPI.setColorRanges(newRanges)
                }} disabled={!settings.appearance.smartColouring} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: `${SPACING.gap}px`, cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                <span style={{ fontSize: '13px', color: '#e5e5e7' }}>Average (60–90)</span>
                <ColorPicker color={colorRanges.mid} onChange={(c) => {
                  const newRanges = { ...colorRanges, mid: c }
                  setColorRanges(newRanges)
                  window.electronAPI.setColorRanges(newRanges)
                }} disabled={!settings.appearance.smartColouring} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: `${SPACING.gap}px`, cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                <span style={{ fontSize: '13px', color: '#e5e5e7' }}>Fast (90–120)</span>
                <ColorPicker color={colorRanges.high} onChange={(c) => {
                  const newRanges = { ...colorRanges, high: c }
                  setColorRanges(newRanges)
                  window.electronAPI.setColorRanges(newRanges)
                }} disabled={!settings.appearance.smartColouring} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: `${SPACING.gap}px`, cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                <span style={{ fontSize: '13px', color: '#e5e5e7' }}>Very Fast (120+)</span>
                <ColorPicker color={colorRanges.ultra} onChange={(c) => {
                  const newRanges = { ...colorRanges, ultra: c }
                  setColorRanges(newRanges)
                  window.electronAPI.setColorRanges(newRanges)
                }} disabled={!settings.appearance.smartColouring} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: `${SPACING.row}px` }}>
                <button
                  onClick={() => {
                    if (
                      colorRanges.low !== defaultColors.low ||
                      colorRanges.mid !== defaultColors.mid ||
                      colorRanges.high !== defaultColors.high ||
                      colorRanges.ultra !== defaultColors.ultra
                    ) {
                      setColorRanges({ ...defaultColors })
                      window.electronAPI.setColorRanges(defaultColors)
                    }
                  }}
                  disabled={
                    colorRanges.low === defaultColors.low &&
                    colorRanges.mid === defaultColors.mid &&
                    colorRanges.high === defaultColors.high &&
                    colorRanges.ultra === defaultColors.ultra
                  }
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.6)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    cursor: 
                      colorRanges.low === defaultColors.low &&
                      colorRanges.mid === defaultColors.mid &&
                      colorRanges.high === defaultColors.high &&
                      colorRanges.ultra === defaultColors.ultra ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: 
                      colorRanges.low === defaultColors.low &&
                      colorRanges.mid === defaultColors.mid &&
                      colorRanges.high === defaultColors.high &&
                      colorRanges.ultra === defaultColors.ultra ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (
                      colorRanges.low !== defaultColors.low ||
                      colorRanges.mid !== defaultColors.mid ||
                      colorRanges.high !== defaultColors.high ||
                      colorRanges.ultra !== defaultColors.ultra
                    ) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                  }}
                >
                  Reset to Default
                </button>
              </div>
            </div>
            <SectionTitle>Display</SectionTitle>
            <SettingRow label="WPM Text Size">
              <SegmentedControl
                value={settings.appearance.wpmTextSize}
                options={[
                  { label: 'Medium', value: 'medium' },
                  { label: 'Large', value: 'large' },
                ]}
                onChange={(size) => {
                  update('appearance', 'wpmTextSize', size)
                  window.electronAPI.setWpmTextSize(size)
                }}
              />
            </SettingRow>
            <SettingRow label="Blur Effect">
              <Toggle checked={blurEnabled} onChange={(v) => {
                setBlurEnabled(v)
                window.electronAPI.setBlur(v)
              }} />
            </SettingRow>
            <SliderRow
              label="Overlay Opacity"
              value={overlayOpacity}
              min={0}
              max={100}
              step={1}
              onChange={(v) => {
                setOverlayOpacity(v)
                window.electronAPI.setOpacity(v)
              }}
            />
          </div>
        )

      case 'behaviour':
        return (
          <div>
            <SectionTitle>Typing Detection</SectionTitle>
            <NumberRow label="Inactivity Timeout (ms)" value={settings.behaviour.inactivityTimeout} min={2000} max={10000} onChange={(v) => {
              update('behaviour', 'inactivityTimeout', v)
              window.electronAPI.setInactivityTimeout(v)
            }} />
            <NumberRow label="Minimum Keystrokes" value={settings.behaviour.minKeystrokes} min={1} max={50} onChange={(v) => {
              update('behaviour', 'minKeystrokes', v)
              window.electronAPI.setMinKeystrokes(v)
            }} />
          </div>
        )

      case 'tracking': {
        const activeHeatmap = heatmapData[heatmapMode]
        const hasHeatmapData = Object.keys(activeHeatmap.keyFrequency).length > 0

        return (
          <div>
            <SectionTitle>Metrics</SectionTitle>
            <SettingRow label="Track Accuracy">
              <Toggle checked={settings.tracking.trackAccuracy} onChange={(v) => update('tracking', 'trackAccuracy', v)} />
            </SettingRow>
            <SettingRow label="Track Raw WPM">
              <Toggle checked={settings.tracking.trackRawWpm} onChange={(v) => update('tracking', 'trackRawWpm', v)} />
            </SettingRow>

            <SectionTitle>Key Frequency</SectionTitle>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: `${SPACING.row}px` }}>
              <SegmentedControl
                value={heatmapMode}
                options={[
                  { label: 'Lifetime', value: 'lifetime' },
                  { label: 'Session', value: 'session' },
                ]}
                onChange={setHeatmapMode}
              />
            </div>

            <HeatmapTooltip text={hoverReadout} pos={tooltipPos} />

            {!hasHeatmapData ? (
              <div style={{
                textAlign: 'center',
                padding: '28px 0',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.35)',
              }}>
                Start typing to build your heatmap
              </div>
            ) : (
              <>
                <div style={{
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'center',
                }}>
                  <KeyboardHeatmap keyFrequency={activeHeatmap.keyFrequency} onHover={setHoverReadout} onMove={(x, y) => setTooltipPos({ x, y })} />
                </div>

                <SectionTitle>Typing Activity by Hour</SectionTitle>
                <div style={{
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: '8px',
                  padding: '14px',
                }}>
                  <HourlyActivityGrid hourly={activeHeatmap.hourly} onHover={setHoverReadout} onMove={(x, y) => setTooltipPos({ x, y })} />
                </div>
              </>
            )}
          </div>
        )
      }

      case 'advanced':
        return (
          <div>
            <SectionTitle>Developer</SectionTitle>
            <SettingRow label="Debug Mode">
              <Toggle checked={settings.advanced.debugMode} onChange={(v) => update('advanced', 'debugMode', v)} />
            </SettingRow>
          </div>
        )

      default:
        return null
    }
  }

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
        height: '60px',
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

        {/* Tabs container - only wraps tabs, doesn't cover full width */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
        }}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              className="no-drag"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 
                                hoveredTab === tab.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : 'rgba(255,255,255,0.6)',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? '500' : '400',
                transition: 'all 0.12s ease',
                opacity: activeTab === tab.id ? 1 : hoveredTab === tab.id ? 0.85 : 0.6,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
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
        {renderContent()}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '14px 28px',
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <ResetButton onClick={() => {
          if (window.confirm('Are you sure you want to reset all settings?')) {
            window.electronAPI.resetAllSettings()
            setSettings({
              ...defaultSettings,
              general: {
                ...defaultSettings.general,
                globalShortcut: DEFAULT_SHORTCUT,
              },
              appearance: {
                ...defaultSettings.appearance,
                wpmTextSize: 'medium',
              },
            })
            setOverlayOpacity(0.9)
          }
        }} />
      </div>
    </div>
  )
}
