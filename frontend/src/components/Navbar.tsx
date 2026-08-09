import { NavLink, useLocation, Link } from 'react-router-dom';
import { IconMenu, IconArrowRight, IconX } from './Icons';
import { useState } from 'react';

function ParenthesisLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
      <path d="M6 1.5C4 3.5 2.5 5.5 2.5 7s1.5 3.5 3.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ParenthesisRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
      <path d="M2 1.5C4 3.5 5.5 5.5 5.5 7s-1.5 3.5-3.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="2" y="6" width="24" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" className="text-cf-teal" />
      <path d="M8 12h4M8 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-cf-teal" />
      <circle cx="20" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.5" className="text-cf-teal" />
      <path d="M20 11.5v3M17.5 14h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-cf-teal" opacity="0.7" />
    </svg>
  );
}

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/docs', label: 'Docs' },
  { path: '/participant', label: 'Participant' },
  { path: '/researcher', label: 'Researcher' },
  { path: '/audit', label: 'Audit' },
];

export function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-cf-bg/90 backdrop-blur-sm border-b border-cf-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="ConsentFlow home">
            <LogoMark />
            <span className="font-display font-semibold text-lg tracking-tight text-cf-text group-hover:text-cf-teal transition-colors">
              ConsentFlow
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'text-cf-teal'
                      : 'text-cf-muted hover:text-cf-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`${isActive ? 'text-cf-teal' : 'text-cf-dim group-hover:text-cf-teal'} transition-colors duration-200`}>
                      <ParenthesisLeft />
                    </span>
                    <span className="relative py-1">
                      {item.label}
                      {isActive && (
                        <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-cf-teal shadow-[0_0_8px_rgba(7,211,186,0.4)]" />
                      )}
                    </span>
                    <span className={`${isActive ? 'text-cf-teal' : 'text-cf-dim group-hover:text-cf-teal'} transition-colors duration-200`}>
                      <ParenthesisRight />
                    </span>
                  </>
                )}
              </NavLink>
            ))}

            <div className="ml-3 pl-3 border-l border-cf-border/60">
              <Link
                to="/participant"
                className="cf-glow-btn inline-flex items-center gap-2 text-xs"
              >
                Launch Demo
                <IconArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-cf-muted hover:text-cf-text hover:bg-cf-panel transition-colors"
            aria-expanded={open}
            aria-label="Toggle navigation"
          >
            {open ? <IconX className="w-5 h-5" /> : <IconMenu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
          open ? 'max-h-[400px] opacity-100 border-b border-cf-border/60' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 py-3 space-y-1 bg-cf-bg/95 backdrop-blur-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-cf-tealSoft text-cf-teal'
                    : 'text-cf-muted hover:text-cf-text hover:bg-cf-panel'
                }`
              }
            >
              <span className="text-cf-dim">
                <ParenthesisLeft />
              </span>
              {item.label}
              <span className="text-cf-dim ml-auto">
                <ParenthesisRight />
              </span>
            </NavLink>
          ))}
          <div className="pt-2">
            <Link
              to="/participant"
              onClick={() => setOpen(false)}
              className="cf-glow-btn inline-flex items-center justify-center w-full gap-2 text-sm"
            >
              Launch Demo
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
