// Nav.tsx — top navigation bar with active-route highlighting.

import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/study', label: 'Study', end: false },
  { to: '/lessons', label: 'Lessons', end: false },
  { to: '/scope', label: 'Scope', end: false },
  { to: '/sources', label: 'Sources', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

export function Nav() {
  return (
    <nav aria-label="Main" style={{ background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 6px' }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5,
          background: 'color-mix(in srgb, var(--c-accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--c-accent) 20%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'var(--c-accent)', userSelect: 'none',
        }}>↻</div>
        <span style={{ fontSize: 11, color: 'var(--c-text2)', letterSpacing: '0.14em', fontWeight: 500 }}>
          REPRISE
        </span>
      </div>
      <ul style={{ display: 'flex', overflowX: 'auto', padding: '0 6px', margin: 0, listStyle: 'none' }}>
        {links.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              style={({ isActive }) => ({
                display: 'block',
                padding: '7px 10px',
                fontSize: 11,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                transition: 'color 120ms',
                color: isActive ? 'var(--c-text)' : 'var(--c-text2)',
                borderBottom: `2px solid ${isActive ? 'var(--c-accent)' : 'transparent'}`,
              })}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
