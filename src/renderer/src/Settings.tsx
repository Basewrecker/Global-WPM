import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Sun, Sliders, Activity, Wrench } from 'lucide-react'

const DEFAULT_SHORTCUT = 'Alt+Shift+W'

interface Settings {
  general: {
    launchAtLogin: boolean
    showMenuBarWpm: boolean
    globalShortcut: string
  }
  display: {
    showOverlay: boolean
    opacity: number
  }
  appearance: {
    smartColouring: boolean
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
  },
  display: {
    showOverlay: true,
    opacity: 0.9,
  },
  appearance: {
    smartColouring: true,
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

function SettingRow({ label, children, isLast }: { label: string; children: React.ReactNode; isLast?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: '13px', color: '#e5e5e7' }}>{label}</span>
      {children}
    </div>
  )
}

function NumberRow({ label, value, min, max, onChange, isLast }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; isLast?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
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

function formatShortcut(shortcut: string): string {
  return shortcut
    .replace(/CommandOrControl|Ctrl/gi, '⌘')
    .replace(/Alt/gi, '⌥')
    .replace(/Control/gi, '⌃')
    .replace(/Shift/gi, '⇧')
    .replace(/\+/g, ' + ')
}

function ShortcutRow({ label, shortcut, onChange, isLast }: {
  label: string; shortcut: string; onChange: (s: string) => void; isLast?: boolean
}) {
  const [listening, setListening] = useState(false)

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
  }

  const isDefault = shortcut === DEFAULT_SHORTCUT

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: '13px', color: '#e5e5e7' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
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

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null)

  useEffect(() => {
    window.electronAPI.getGlobalShortcut().then((shortcut) => {
      setSettings((prev) => ({
        ...prev,
        general: { ...prev.general, globalShortcut: shortcut }
      }))
    })
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
              isLast
            />
          </div>
        )

      case 'appearance':
        return (
          <div>
            <SectionTitle>Colors</SectionTitle>
            <SettingRow label="Smart Colouring" isLast>
              <Toggle checked={settings.appearance.smartColouring} onChange={(v) => {
                update('appearance', 'smartColouring', v)
                window.electronAPI.setSmartColouring(v)
              }} />
            </SettingRow>
          </div>
        )

      case 'behaviour':
        return (
          <div>
            <SectionTitle>Typing Detection</SectionTitle>
            <NumberRow label="Inactivity Timeout (ms)" value={settings.behaviour.inactivityTimeout} min={2000} max={10000} onChange={(v) => update('behaviour', 'inactivityTimeout', v)} />
            <NumberRow label="Minimum Keystrokes" value={settings.behaviour.minKeystrokes} min={1} max={50} onChange={(v) => update('behaviour', 'minKeystrokes', v)} isLast />
          </div>
        )

      case 'tracking':
        return (
          <div>
            <SectionTitle>Metrics</SectionTitle>
            <SettingRow label="Track Accuracy">
              <Toggle checked={settings.tracking.trackAccuracy} onChange={(v) => update('tracking', 'trackAccuracy', v)} />
            </SettingRow>
            <SettingRow label="Track Raw WPM" isLast>
              <Toggle checked={settings.tracking.trackRawWpm} onChange={(v) => update('tracking', 'trackRawWpm', v)} />
            </SettingRow>
          </div>
        )

      case 'advanced':
        return (
          <div>
            <SectionTitle>Developer</SectionTitle>
            <SettingRow label="Debug Mode" isLast>
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
