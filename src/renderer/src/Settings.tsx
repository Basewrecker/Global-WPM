import { useState, useEffect, useRef, useMemo } from 'react'
import { Settings as SettingsIcon, Sun, Sliders, Activity, Wrench } from 'lucide-react'
import { HexColorPicker } from 'react-colorful'

const DEFAULT_SHORTCUT = 'Alt+Shift+W'

const SPACING = { section: 20, row: 12, gap: 10 }

// Warm teal accent — shared by toggles, slider fills, and the heatmap, for a single cohesive accent color.
const ACCENT = '#2dd4bf'
const ACCENT_RGB = '45, 212, 191'

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
    rollingWindowMs: number
    wpmSmoothing: number
    idleDecay: boolean
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
    rollingWindowMs: 10000,
    wpmSmoothing: 0.15,
    idleDecay: true,
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

// ---------- Design system primitives ----------

/** Global styles for the row-divider system (last row in a card has no divider). */
function DesignSystemStyles() {
  return (
    <style>{`
      .settings-card > .settings-row:last-child { border-bottom: none !important; }
    `}</style>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '11px',
      fontWeight: '600',
      color: 'rgba(255,255,255,0.45)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '10px',
      marginTop: `${SPACING.section}px`,
    }}>{children}</h3>
  )
}

// ---------- Flat layout primitives (Advanced tab trial — no boxed cards) ----------

function FlatSectionTitle({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <h3 style={{
      fontSize: '11px',
      fontWeight: '600',
      color: color ?? 'rgba(255,255,255,0.45)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      margin: '0 0 14px',
    }}>{children}</h3>
  )
}

/** Two-column row with no surrounding box and no per-row divider — sections are
 * separated by FlatDivider instead, so individual rows don't need their own hairline. */
function FlatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 0',
      gap: '16px',
    }}>
      <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  )
}

function FlatDivider() {
  return <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '28px 0' }} />
}

function Card({ children, padding }: { children: React.ReactNode; padding?: string }) {
  return (
    <div className="settings-card" style={{
      background: '#161618',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      padding: padding ?? '4px 20px',
    }}>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      gap: '16px',
    }}>
      <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  )
}

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
        backgroundColor: checked ? ACCENT : '#48484a',
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

/** Small labeled checkbox — used for one-shot options (e.g. export selection) that
 * are not persistent settings, so unlike Toggle it carries no ACCENT-track chrome. */
function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '5px',
          border: `1px solid ${checked ? ACCENT : 'rgba(255,255,255,0.18)'}`,
          backgroundColor: checked ? ACCENT : 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.2 11.5L13 4.5" stroke="#0b0b0c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{label}</span>
    </div>
  )
}

/** Stepper: [ − ] value [ + ] — replaces raw number inputs. */
function Stepper({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  const atMin = value <= min
  const atMax = value >= max

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '16px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    transition: 'background 0.15s ease',
    padding: 0,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button
        type="button"
        disabled={atMin}
        onClick={() => onChange(Math.max(min, value - step))}
        style={buttonStyle(atMin)}
        onMouseEnter={(e) => { if (!atMin) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      >
        −
      </button>
      <span style={{
        minWidth: '56px',
        textAlign: 'center',
        fontSize: '14px',
        color: '#ffffff',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      }}>
        {value}
      </span>
      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange(Math.min(max, value + step))}
        style={buttonStyle(atMax)}
        onMouseEnter={(e) => { if (!atMax) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      >
        +
      </button>
    </div>
  )
}

function SliderControl({ value, min, max, step, onChange, formatValue }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void
  formatValue?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
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
          background: `linear-gradient(to right, ${ACCENT} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
          borderRadius: '2px',
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      <span style={{
        fontSize: '12px',
        color: 'rgba(255,255,255,0.6)',
        minWidth: '36px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatValue ? formatValue(value) : `${Math.round(value)}%`}
      </span>
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
          width: '24px',
          height: '24px',
          backgroundColor: color,
          borderRadius: '7px',
          border: '1px solid rgba(255,255,255,0.1)',
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
    <div className="settings-row" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      gap: '16px',
    }}>
      <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          ref={shortcutRef}
          onClick={() => setListening(true)}
          onBlur={() => setListening(false)}
          style={{
            padding: '6px 12px',
            height: '28px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: listening ? `rgba(${ACCENT_RGB}, 0.15)` : 'rgba(255,255,255,0.06)',
            border: `1px solid ${listening ? ACCENT : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '8px',
            color: listening ? ACCENT : '#ffffff',
            fontSize: '12px',
            cursor: 'pointer',
            minWidth: '100px',
            justifyContent: 'center',
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
              borderRadius: '6px',
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
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: '8px',
      padding: '3px',
      gap: '2px',
    }}>
      {options.map((option) => (
        <div
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: '5px 14px',
            borderRadius: '6px',
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
        fontSize: '12px',
        color: 'rgba(255,255,255,0.65)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '7px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.09)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.95)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
      }}
    >
      Reset All Settings
    </button>
  )
}

function DangerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '12px',
        color: 'rgba(248,113,113,0.85)',
        background: 'rgba(248,113,113,0.07)',
        border: '1px solid rgba(248,113,113,0.18)',
        borderRadius: '8px',
        padding: '7px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(248,113,113,0.14)'
        e.currentTarget.style.color = 'rgba(248,113,113,1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(248,113,113,0.07)'
        e.currentTarget.style.color = 'rgba(248,113,113,0.85)'
      }}
    >
      {label}
    </button>
  )
}

function SubtleButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: '11px',
        color: 'rgba(255,255,255,0.6)',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '5px 10px',
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
      }}
    >
      {label}
    </button>
  )
}

const defaultColors = {
  low: '#ef4444',
  mid: '#eab308',
  high: '#22c55e',
  ultra: '#3b82f6',
}

const HEATMAP_ACCENT = ACCENT_RGB // shared teal accent, ties the heatmap to the rest of the UI

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
  const [exportOptions, setExportOptions] = useState({ settings: true, lifetimeStats: true, heatmap: true })
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const lastSmoothingRef = useRef(0.15)

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
    window.electronAPI.getBehaviourSettings().then((behaviour) => {
      setSettings((prev) => ({ ...prev, behaviour }))
    })
    setBlurEnabled(settings.display.blur)
  }, [])

  useEffect(() => {
    if (activeTab !== 'tracking') return
    window.electronAPI.getHeatmapData().then(setHeatmapData)
  }, [activeTab])

  useEffect(() => {
    if (!exportStatus) return
    const t = setTimeout(() => setExportStatus(null), 3000)
    return () => clearTimeout(t)
  }, [exportStatus])

  const update = <K extends keyof Settings>(section: K, key: keyof Settings[K], value: Settings[K][keyof Settings[K]]) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }))
  }

  const colorRangesAtDefault =
    colorRanges.low === defaultColors.low &&
    colorRanges.mid === defaultColors.mid &&
    colorRanges.high === defaultColors.high &&
    colorRanges.ultra === defaultColors.ultra

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div>
            <SectionTitle>General</SectionTitle>
            <Card>
              <Row label="Launch at Login">
                <Toggle checked={settings.general.launchAtLogin} onChange={(v) => {
                  update('general', 'launchAtLogin', v)
                  window.electronAPI.setLaunchAtLogin(v)
                }} />
              </Row>
              <Row label="Show WPM in Menu Bar">
                <Toggle checked={settings.general.showMenuBarWpm} onChange={(v) => {
                  update('general', 'showMenuBarWpm', v)
                  window.electronAPI.setShowMenuBarWpm(v)
                }} />
              </Row>
              <Row label="Enable Tracking">
                <Toggle checked={trackingEnabled} onChange={(v) => {
                  setTrackingEnabled(v)
                  window.electronAPI.setTrackingEnabled(v)
                }} />
              </Row>
              <ShortcutRow
                label="Global Shortcut"
                shortcut={settings.general.globalShortcut}
                onChange={async (shortcut) => {
                  update('general', 'globalShortcut', shortcut)
                  await window.electronAPI.setGlobalShortcut(shortcut)
                }}
              />
              <Row label="Lock Overlay to Desktop">
                <Toggle checked={settings.general.lockOverlayToDesktop} onChange={(v) => {
                  update('general', 'lockOverlayToDesktop', v)
                  window.electronAPI.setLockOverlayToDesktop(v)
                }} />
              </Row>
            </Card>
          </div>
        )

      case 'appearance':
        return (
          <div>
            <SectionTitle>Colors</SectionTitle>
            <Card>
              <Row label="Smart Colouring">
                <Toggle checked={settings.appearance.smartColouring} onChange={(v) => {
                  update('appearance', 'smartColouring', v)
                  window.electronAPI.setSmartColouring(v)
                }} />
              </Row>
            </Card>

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
              <Card>
                <Row label="Slow (0–60)">
                  <div style={{ cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                    <ColorPicker color={colorRanges.low} onChange={(c) => {
                      const newRanges = { ...colorRanges, low: c }
                      setColorRanges(newRanges)
                      window.electronAPI.setColorRanges(newRanges)
                    }} disabled={!settings.appearance.smartColouring} />
                  </div>
                </Row>
                <Row label="Average (60–90)">
                  <div style={{ cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                    <ColorPicker color={colorRanges.mid} onChange={(c) => {
                      const newRanges = { ...colorRanges, mid: c }
                      setColorRanges(newRanges)
                      window.electronAPI.setColorRanges(newRanges)
                    }} disabled={!settings.appearance.smartColouring} />
                  </div>
                </Row>
                <Row label="Fast (90–120)">
                  <div style={{ cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                    <ColorPicker color={colorRanges.high} onChange={(c) => {
                      const newRanges = { ...colorRanges, high: c }
                      setColorRanges(newRanges)
                      window.electronAPI.setColorRanges(newRanges)
                    }} disabled={!settings.appearance.smartColouring} />
                  </div>
                </Row>
                <Row label="Very Fast (120+)">
                  <div style={{ cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                    <ColorPicker color={colorRanges.ultra} onChange={(c) => {
                      const newRanges = { ...colorRanges, ultra: c }
                      setColorRanges(newRanges)
                      window.electronAPI.setColorRanges(newRanges)
                    }} disabled={!settings.appearance.smartColouring} />
                  </div>
                </Row>
              </Card>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: `${SPACING.row}px` }}>
                <SubtleButton
                  label="Reset to Default"
                  disabled={colorRangesAtDefault}
                  onClick={() => {
                    if (!colorRangesAtDefault) {
                      setColorRanges({ ...defaultColors })
                      window.electronAPI.setColorRanges(defaultColors)
                    }
                  }}
                />
              </div>
            </div>

            <SectionTitle>Display</SectionTitle>
            <Card>
              <Row label="WPM Text Size">
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
              </Row>
              <Row label="Blur Effect">
                <Toggle checked={blurEnabled} onChange={(v) => {
                  setBlurEnabled(v)
                  window.electronAPI.setBlur(v)
                }} />
              </Row>
              <Row label="Overlay Opacity">
                <SliderControl
                  value={overlayOpacity}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => {
                    setOverlayOpacity(v)
                    window.electronAPI.setOpacity(v)
                  }}
                />
              </Row>
            </Card>
          </div>
        )

      case 'behaviour': {
        const smoothingEnabled = settings.behaviour.wpmSmoothing > 0

        return (
          <div>
            <SectionTitle>Typing Detection</SectionTitle>
            <Card>
              <Row label="Inactivity Timeout (ms)">
                <Stepper value={settings.behaviour.inactivityTimeout} min={2000} max={10000} step={500} onChange={(v) => {
                  update('behaviour', 'inactivityTimeout', v)
                  window.electronAPI.setInactivityTimeout(v)
                }} />
              </Row>
              <Row label="Minimum Keystrokes">
                <Stepper value={settings.behaviour.minKeystrokes} min={1} max={50} step={1} onChange={(v) => {
                  update('behaviour', 'minKeystrokes', v)
                  window.electronAPI.setMinKeystrokes(v)
                }} />
              </Row>
            </Card>

            <SectionTitle>WPM Behaviour</SectionTitle>
            <Card>
              <Row label="Rolling Window">
                <SliderControl
                  value={settings.behaviour.rollingWindowMs / 1000}
                  min={5}
                  max={30}
                  step={1}
                  formatValue={(v) => `${Math.round(v)}s`}
                  onChange={(v) => {
                    const ms = v * 1000
                    update('behaviour', 'rollingWindowMs', ms)
                    window.electronAPI.setRollingWindow(ms)
                  }}
                />
              </Row>
              <Row label="Smooth WPM">
                <Toggle checked={smoothingEnabled} onChange={(checked) => {
                  if (checked) {
                    const restored = lastSmoothingRef.current > 0 ? lastSmoothingRef.current : 0.15
                    update('behaviour', 'wpmSmoothing', restored)
                    window.electronAPI.setWpmSmoothing(restored)
                  } else {
                    if (settings.behaviour.wpmSmoothing > 0) {
                      lastSmoothingRef.current = settings.behaviour.wpmSmoothing
                    }
                    update('behaviour', 'wpmSmoothing', 0)
                    window.electronAPI.setWpmSmoothing(0)
                  }
                }} />
              </Row>
              {smoothingEnabled && (
                <Row label="Smoothing Amount">
                  <SliderControl
                    value={(settings.behaviour.wpmSmoothing / 0.5) * 100}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => {
                      const smoothing = (v / 100) * 0.5
                      update('behaviour', 'wpmSmoothing', smoothing)
                      window.electronAPI.setWpmSmoothing(smoothing)
                    }}
                  />
                </Row>
              )}
              <Row label="Idle Decay">
                <Toggle checked={settings.behaviour.idleDecay} onChange={(v) => {
                  update('behaviour', 'idleDecay', v)
                  window.electronAPI.setIdleDecay(v)
                }} />
              </Row>
            </Card>
          </div>
        )
      }

      case 'tracking': {
        const activeHeatmap = heatmapData[heatmapMode]
        const hasHeatmapData = Object.keys(activeHeatmap.keyFrequency).length > 0

        return (
          <div>
            <SectionTitle>Metrics</SectionTitle>
            <Card>
              <Row label="Track Accuracy">
                <Toggle checked={settings.tracking.trackAccuracy} onChange={(v) => update('tracking', 'trackAccuracy', v)} />
              </Row>
              <Row label="Track Raw WPM">
                <Toggle checked={settings.tracking.trackRawWpm} onChange={(v) => update('tracking', 'trackRawWpm', v)} />
              </Row>
            </Card>

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
                <Card padding="16px 20px">
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <KeyboardHeatmap keyFrequency={activeHeatmap.keyFrequency} onHover={setHoverReadout} onMove={(x, y) => setTooltipPos({ x, y })} />
                  </div>
                </Card>

                <SectionTitle>Typing Activity by Hour</SectionTitle>
                <Card padding="16px 20px">
                  <HourlyActivityGrid hourly={activeHeatmap.hourly} onHover={setHoverReadout} onMove={(x, y) => setTooltipPos({ x, y })} />
                </Card>
              </>
            )}
          </div>
        )
      }

      case 'advanced': {
        const nothingSelected = !exportOptions.settings && !exportOptions.lifetimeStats && !exportOptions.heatmap

        return (
          <div>
            {/* Export Data — flat, with a faint tint grouping the checkboxes only */}
            <FlatSectionTitle>Export Data</FlatSectionTitle>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '14px 16px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Include:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
                <Checkbox
                  label="Settings"
                  checked={exportOptions.settings}
                  onChange={(v) => setExportOptions((prev) => ({ ...prev, settings: v }))}
                />
                <Checkbox
                  label="Lifetime Stats"
                  checked={exportOptions.lifetimeStats}
                  onChange={(v) => setExportOptions((prev) => ({ ...prev, lifetimeStats: v }))}
                />
                <Checkbox
                  label="Heatmap Data"
                  checked={exportOptions.heatmap}
                  onChange={(v) => setExportOptions((prev) => ({ ...prev, heatmap: v }))}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '12px',
              }}>
                {exportStatus && (
                  <span style={{
                    fontSize: '12px',
                    color: exportStatus.type === 'success' ? ACCENT : 'rgba(248,113,113,0.85)',
                  }}>
                    {exportStatus.message}
                  </span>
                )}
                <SubtleButton
                  label="Export Data"
                  disabled={nothingSelected}
                  onClick={async () => {
                    const result = await window.electronAPI.exportData(exportOptions)
                    if (result.cancelled) return
                    setExportStatus(
                      result.success
                        ? { type: 'success', message: 'Exported ✓' }
                        : { type: 'error', message: result.error || 'Export failed' }
                    )
                  }}
                />
              </div>
            </div>

            <FlatDivider />

            {/* Utilities — fully flat, single two-column row */}
            <FlatSectionTitle>Utilities</FlatSectionTitle>
            <FlatRow label="Open Config Folder">
              <SubtleButton
                label="Open Folder"
                disabled={false}
                onClick={() => {
                  window.electronAPI.openConfigFolder()
                }}
              />
            </FlatRow>

            <FlatDivider />

            {/* Developer — fully flat, single two-column row */}
            <FlatSectionTitle>Developer</FlatSectionTitle>
            <FlatRow label="Debug Mode">
              <Toggle checked={settings.advanced.debugMode} onChange={(v) => {
                update('advanced', 'debugMode', v)
                window.electronAPI.setDebugMode(v)
              }} />
            </FlatRow>

            <FlatDivider />

            {/* Danger Zone — subtle red tint, no hard border, bottom of the tab */}
            <FlatSectionTitle color="rgba(255,90,60,0.7)">Danger Zone</FlatSectionTitle>
            <div style={{ background: 'rgba(255,90,60,0.04)', borderRadius: '10px', padding: '14px 16px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
                These actions permanently erase data.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Reset Lifetime Stats</span>
                <DangerButton
                  label="Reset"
                  onClick={async () => {
                    if (window.confirm('This will permanently erase all lifetime stats and heatmap data. Continue?')) {
                      await window.electronAPI.resetLifetimeStats()
                      setHeatmapData({ lifetime: emptyHeatmapSet, session: emptyHeatmapSet })
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )
      }

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
      <DesignSystemStyles />
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
        padding: '28px',
        overflowY: 'auto',
        maxWidth: '440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
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
