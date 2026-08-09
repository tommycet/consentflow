import { Link } from 'react-router-dom';
import { IconCode, IconExternalLink, IconShield, IconGlobe, IconFileText, IconHash } from './Icons';

const platformLinks = [
  { to: '/', label: 'Landing', icon: IconShield },
  { to: '/participant', label: 'Participant', icon: IconFileText },
  { to: '/researcher', label: 'Researcher', icon: IconGlobe },
  { to: '/audit', label: 'Audit', icon: IconHash },
];

const resourceLinks = [
  { to: '/docs', label: 'Documentation', icon: IconFileText },
  { href: 'https://github.com/tommycet/consentflow', label: 'Smart Contracts', external: true, icon: IconCode },
  { href: 'https://github.com/tommycet/consentflow', label: 'Cleanverse Integration', external: true, icon: IconExternalLink },
];

const networkLinks = [
  { href: 'https://testnet.monad.xyz/', label: 'Monad Testnet', external: true, sub: 'Chain ID 10143', icon: IconGlobe },
  { href: 'https://github.com/tommycet/consentflow', label: 'Cleanverse Sandbox', external: true, icon: IconShield },
];

const projectLinks = [
  { href: 'https://github.com/tommycet/consentflow', label: 'GitHub', external: true, icon: IconCode },
  { href: 'https://github.com/tommycet/consentflow', label: 'Prism Audit Report', external: true, icon: IconExternalLink },
];

function FooterLink({ to, href, external, label, sub, icon: Icon }: any) {
  const content = (
    <span className="flex items-center gap-2 text-cf-muted hover:text-cf-teal transition-colors duration-200">
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span className="flex flex-col">
        <span className="text-sm leading-tight">{label}</span>
        {sub && <span className="text-xs text-cf-dim leading-tight">{sub}</span>}
      </span>
    </span>
  );

  if (href) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="group"
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={to} className="group">
      {content}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-cf-border/60 bg-cf-bg/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 md:py-16">
          {/* Platform */}
          <div>
            <h3 className="font-display font-semibold text-sm text-cf-text tracking-wide uppercase mb-4">
              Platform
            </h3>
            <ul className="space-y-3">
              {platformLinks.map((item) => (
                <li key={item.to}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-display font-semibold text-sm text-cf-text tracking-wide uppercase mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              {resourceLinks.map((item) => (
                <li key={item.label}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </div>

          {/* Network */}
          <div>
            <h3 className="font-display font-semibold text-sm text-cf-text tracking-wide uppercase mb-4">
              Network
            </h3>
            <ul className="space-y-3">
              {networkLinks.map((item) => (
                <li key={item.label}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </div>

          {/* Project */}
          <div>
            <h3 className="font-display font-semibold text-sm text-cf-text tracking-wide uppercase mb-4">
              Project
            </h3>
            <ul className="space-y-3">
              {projectLinks.map((item) => (
                <li key={item.label}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-t border-cf-border/40">
          <p className="text-xs text-cf-dim">
            © {new Date().getFullYear()} ConsentFlow. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/tommycet/consentflow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cf-panel border border-cf-border text-cf-muted hover:text-cf-teal hover:border-cf-teal/30 transition-colors duration-200"
            >
              <IconCode className="w-3.5 h-3.5" />
              GitHub
            </a>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cf-tealSoft border border-cf-teal/20 text-cf-teal">
              Built for hackathon
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
