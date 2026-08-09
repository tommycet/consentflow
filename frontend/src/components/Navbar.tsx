import { NavLink, useLocation } from 'react-router-dom';

export function Navbar() {
  const location = useLocation();

  const navItems = [
    { path: '/participant', label: 'Participant', icon: '👤' },
    { path: '/researcher', label: 'Researcher', icon: '🔬' },
    { path: '/audit', label: 'Audit', icon: '📋' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏥</span>
            <span className="text-xl font-bold text-emerald-400 tracking-tight">ConsentFlow</span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-700">
              Demo
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-gray-900/50 rounded-lg p-1 border border-gray-800">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30 shadow-lg shadow-emerald-600/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}