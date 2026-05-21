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
    <nav aria-label="Main" className="border-b border-zinc-800 bg-zinc-950 px-4">
      <ul className="flex gap-1 overflow-x-auto">
        {links.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'block px-3 py-3 text-sm transition-colors',
                  isActive
                    ? 'border-b-2 border-sky-400 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
