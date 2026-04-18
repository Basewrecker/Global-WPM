import { useState, useEffect, useRef } from 'react'
import { Settings as SettingsIcon, Sun, Sliders, Activity, Wrench } from 'lucide-react'
import { HexColorPicker } from 'react-colorful'

const DEFAULT_SHORTCUT = 'Alt+Shift+W'

interface Settings {
  general: {
    launchAtLogin: boolean
    showMenuBarWpm: boolean
    globalShortcut: string
    lockOverlayToDesktop: boolean
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
      marginBottom: '6px',
      marginTop: '20px',
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

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null)
  const [overlayOpacity, setOverlayOpacity] = useState(90)
  const [blurEnabled, setBlurEnabled] = useState(false)
  const [colorRanges, setColorRanges] = useState({ ...defaultColors })
  const [sessionStats, setSessionStats] = useState({
    wpm: 0,
    accuracy: 0,
    totalKeystrokes: 0,
    backspaces: 0,
  })

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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
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
                marginTop: '16px',
                opacity: settings.appearance.smartColouring ? 1 : 0.5,
                filter: settings.appearance.smartColouring ? 'none' : 'grayscale(0.3)',
                transition: 'opacity 0.2s ease, filter 0.2s ease',
              }}
            >
              <SectionTitle>WPM Color Ranges</SectionTitle>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px', marginTop: '4px' }}>
                Customize how your WPM is colored based on typing speed.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                <span style={{ fontSize: '13px', color: '#e5e5e7' }}>Slow (0–60)</span>
                <ColorPicker color={colorRanges.low} onChange={(c) => {
                  const newRanges = { ...colorRanges, low: c }
                  setColorRanges(newRanges)
                  window.electronAPI.setColorRanges(newRanges)
                }} disabled={!settings.appearance.smartColouring} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                <span style={{ fontSize: '13px', color: '#e5e5e7' }}>Average (60–90)</span>
                <ColorPicker color={colorRanges.mid} onChange={(c) => {
                  const newRanges = { ...colorRanges, mid: c }
                  setColorRanges(newRanges)
                  window.electronAPI.setColorRanges(newRanges)
                }} disabled={!settings.appearance.smartColouring} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                <span style={{ fontSize: '13px', color: '#e5e5e7' }}>Fast (90–120)</span>
                <ColorPicker color={colorRanges.high} onChange={(c) => {
                  const newRanges = { ...colorRanges, high: c }
                  setColorRanges(newRanges)
                  window.electronAPI.setColorRanges(newRanges)
                }} disabled={!settings.appearance.smartColouring} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', cursor: settings.appearance.smartColouring ? 'default' : 'not-allowed' }}>
                <span style={{ fontSize: '13px', color: '#e5e5e7' }}>Very Fast (120+)</span>
                <ColorPicker color={colorRanges.ultra} onChange={(c) => {
                  const newRanges = { ...colorRanges, ultra: c }
                  setColorRanges(newRanges)
                  window.electronAPI.setColorRanges(newRanges)
                }} disabled={!settings.appearance.smartColouring} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
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

      case 'tracking':
        return (
          <div>
            <SectionTitle>Metrics</SectionTitle>
            <SettingRow label="Track Accuracy">
              <Toggle checked={settings.tracking.trackAccuracy} onChange={(v) => update('tracking', 'trackAccuracy', v)} />
            </SettingRow>
            <SettingRow label="Track Raw WPM">
              <Toggle checked={settings.tracking.trackRawWpm} onChange={(v) => update('tracking', 'trackRawWpm', v)} />
            </SettingRow>
            <SectionTitle>Session Stats</SectionTitle>
            <SettingRow label="WPM">
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                {sessionStats.wpm}
              </span>
            </SettingRow>
            <SettingRow label="Accuracy (%)">
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                {sessionStats.accuracy}
              </span>
            </SettingRow>
            <SettingRow label="Total Keystrokes">
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                {sessionStats.totalKeystrokes}
              </span>
            </SettingRow>
            <SettingRow label="Backspaces">
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                {sessionStats.backspaces}
              </span>
            </SettingRow>
          </div>
        )

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
    </div>
  )
}
