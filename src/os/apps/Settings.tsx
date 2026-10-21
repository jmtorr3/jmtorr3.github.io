import { useEffect, useState } from 'react'
import { devices, DEVICE_KINDS } from '../../data/devices'
import { Sprite, PET_PORTRAIT } from '../Pets'
import { THEMES, useTheme } from '../theme'
import { Icon, type IconName } from '../Icon'
import { addMenuItems } from '../appMenu'
import { useStore } from '../../store'

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: 'image' },
  { id: 'devices', label: 'Devices', icon: 'keyboard' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[]

type Section = (typeof SECTIONS)[number]['id']

// KDE System Settings: the desktop theme, and the keyboard and mouse plugged into
// Slumpy (Chiba and Hanzo, the ones on the desk in the room)
export function Settings({ props }: { props?: Record<string, unknown> }) {
  const [section, setSection] = useState<Section>((props?.section as Section) ?? 'appearance')
  const unplugged = useStore((s) => s.unplugged) // (their USB plugs pulled out at the back of the case, in the room)
  useEffect(() => {
    if (props?.section) setSection(props.section as Section)
  }, [props?.section])
  const { theme, setTheme } = useTheme()

  return (
    <div
      className="skills settings"
      onContextMenu={(e) =>
        addMenuItems(e, [
          ...SECTIONS.map((s) => ({ label: s.label, icon: s.icon, checked: s.id === section, onClick: () => setSection(s.id) })),
          { separator: true },
          ...THEMES.map((t) => ({ label: t.label, checked: t.id === theme, onClick: () => setTheme(t.id) })),
        ])
      }
    >
      <aside className="places">
        <div className="places-title">Settings</div>
        {SECTIONS.map((s) => (
          <button key={s.id} className={s.id === section ? 'active' : ''} onClick={() => setSection(s.id)}>
            <Icon name={s.icon} size={16} /> {s.label}
          </button>
        ))}
      </aside>
      <div className="skills-main">
        {section === 'appearance' ? (
          <>
            <h2 className="section-title">Theme</h2>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button key={t.id} className={`theme-card ${t.id === theme ? 'active' : ''}`} onClick={() => setTheme(t.id)}>
                  {/* a tiny window in the theme's colors */}
                  <span className="theme-preview" style={{ background: t.swatch[0], borderColor: t.swatch[1] }}>
                    <span style={{ background: t.swatch[1] }} />
                    <span style={{ background: t.swatch[2] }} />
                    <span style={{ background: t.swatch[2], width: '60%' }} />
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="section-title">Connected Devices</h2>
            <div className="device-list">
              {DEVICE_KINDS.map((k) => {
                const d = devices[k]
                return (
                  <div key={k} className="device">
                    <Icon name={k} size={40} />
                    <div>
                      <strong>{d.name}</strong> <span className="muted">· {d.type}</span>
                      <div className="muted">{d.model}</div>
                      <div className="muted">USB {d.usbId}</div>
                      <div className="device-note">{d.note}</div>
                      <div className="device-pet">
                        <Sprite rows={PET_PORTRAIT[k]} scale={2} />
                        <span>
                          <strong>On the desktop:</strong> {d.pet}. {d.petNote}
                          {unplugged[k] && <span className="muted"> (not around while unplugged)</span>}
                        </span>
                      </div>
                    </div>
                    <span className={`device-status ${unplugged[k] ? 'off' : ''}`}>{unplugged[k] ? '○ Disconnected' : '● Connected'}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
