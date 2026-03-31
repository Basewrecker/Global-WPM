import { useState } from 'react'
import { Settings as SettingsIcon, Sun, Sliders, Activity, Wrench } from 'lucide-react'

interface Settings {
  general: {
    launchAtLogin: boolean
    showMenuBarWpm: boolean
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

function SliderRow({ label, value, min, max, step, onChange, isLast }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; isLast?: boolean
}) {
  return (
    <div style={{ padding: '12px 0', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', color: '#e5e5e7' }}>{label}</span>
        <span style={{ fontSize: '13px', color: '#8e8e93' }}>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: '4px',
          borderRadius: '2px',
          background: `linear-gradient(to right, #30d158 ${((value - min) / (max - min)) * 100}%, #48484a ${((value - min) / (max - min)) * 100}%)`,
          appearance: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
      />
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
            <SettingRow label="Show WPM in Menu Bar" isLast>
              <Toggle checked={settings.general.showMenuBarWpm} onChange={(v) => {
                update('general', 'showMenuBarWpm', v)
                window.electronAPI.setShowMenuBarWpm(v)
              }} />
            </SettingRow>
            <SectionTitle>Display</SectionTitle>
            <SettingRow label="Show Overlay">
              <Toggle checked={settings.display.showOverlay} onChange={(v) => {
                update('display', 'showOverlay', v)
                window.electronAPI.setShowOverlay(v)
              }} />
            </SettingRow>
            <SliderRow label="Opacity" value={settings.display.opacity} min={0.3} max={1} step={0.1} onChange={(v) => {
              update('display', 'opacity', v)
              window.electronAPI.setOpacity(v)
            }} isLast={true} />
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
    <div style={{
      height: '100vh',
      background: 'rgba(15, 15, 15, 0.25)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      lineHeight: 1.4,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(255,255,255,0.05)',
      color: 'rgba(255,255,255,0.9)',
    }}>
      {/* Titlebar wrapper */}
      <div style={{
        height: '60px',
        background: 'rgba(15,15,15,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'relative',
      }}>
        {/* Drag layer - lowest layer, covers full titlebar */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
        } as React.CSSProperties}
        {...({ WebkitAppRegion: 'drag' } as React.HTMLAttributes<HTMLDivElement>)} />

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
              {...({ WebkitAppRegion: 'no-drag' } as React.HTMLAttributes<HTMLDivElement>)}
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
