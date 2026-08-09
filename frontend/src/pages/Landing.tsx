import { useState } from 'react';

/**
 * ConsentFlow landing / overview page.
 * Replaces scattered docs with a single in-app explanation
 * that hackathon judges can read without leaving the app.
 */

const ARCH_SVG = `
<svg viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(16,185,129,0.15)" />
      <stop offset="100%" stop-color="rgba(20,184,166,0.05)" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="420" fill="url(#g1)" rx="12" />

  <!-- Participant -->
  <rect x="20" y="30" width="160" height="80" rx="10" fill="rgba(16,185,129,0.12)" stroke="rgba(52,211,153,0.5)" stroke-width="1.5"/>
  <text x="100" y="55" text-anchor="middle" fill="#34d399" font-size="13" font-weight="600">Participant</text>
  <text x="100" y="75" text-anchor="middle" fill="#94a3b8" font-size="10">Enroll · Revoke</text>
  <text x="100" y="90" text-anchor="middle" fill="#64748b" font-size="9">Wallet owner</text>

  <!-- Cleanverse CVI -->
  <rect x="220" y="30" width="160" height="80" rx="10" fill="rgba(20,184,166,0.12)" stroke="rgba(45,212,191,0.5)" stroke-width="1.5"/>
  <text x="300" y="55" text-anchor="middle" fill="#2dd4bf" font-size="13" font-weight="600">Cleanverse CVI</text>
  <text x="300" y="75" text-anchor="middle" fill="#94a3b8" font-size="10">A-Pass Identity</text>
  <text x="300" y="90" text-anchor="middle" fill="#64748b" font-size="9">generate · freeze · verify</text>

  <!-- ConsentRegistry -->
  <rect x="420" y="30" width="160" height="80" rx="10" fill="rgba(16,185,129,0.12)" stroke="rgba(52,211,153,0.5)" stroke-width="1.5"/>
  <text x="500" y="55" text-anchor="middle" fill="#34d399" font-size="13" font-weight="600">ConsentRegistry</text>
  <text x="500" y="75" text-anchor="middle" fill="#94a3b8" font-size="10">On-chain consent</text>
  <text x="500" y="90" text-anchor="middle" fill="#64748b" font-size="9">Monad testnet</text>

  <!-- ContributionReceipt -->
  <rect x="620" y="30" width="160" height="80" rx="10" fill="rgba(16,185,129,0.12)" stroke="rgba(52,211,153,0.5)" stroke-width="1.5"/>
  <text x="700" y="55" text-anchor="middle" fill="#34d399" font-size="13" font-weight="600">CVA Receipt</text>
  <text x="700" y="75" text-anchor="middle" fill="#94a3b8" font-size="10">Purpose-bound</text>
  <text x="700" y="90" text-anchor="middle" fill="#64748b" font-size="9">Non-transferable</text>

  <!-- Arrows row 1 -->
  <line x1="180" y1="70" x2="220" y2="70" stroke="rgba(52,211,153,0.4)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="380" y1="70" x2="420" y2="70" stroke="rgba(52,211,153,0.4)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="580" y1="70" x2="620" y2="70" stroke="rgba(52,211,153,0.4)" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- Researcher -->
  <rect x="20" y="170" width="160" height="80" rx="10" fill="rgba(96,165,250,0.10)" stroke="rgba(96,165,250,0.3)" stroke-width="1.5"/>
  <text x="100" y="195" text-anchor="middle" fill="#60a5fa" font-size="13" font-weight="600">Researcher</text>
  <text x="100" y="215" text-anchor="middle" fill="#94a3b8" font-size="10">Queue Access</text>
  <text x="100" y="230" text-anchor="middle" fill="#64748b" font-size="9">ETH compensation</text>

  <!-- CCP verify_apass -->
  <rect x="220" y="170" width="160" height="80" rx="10" fill="rgba(251,191,36,0.10)" stroke="rgba(251,191,36,0.3)" stroke-width="1.5"/>
  <text x="300" y="195" text-anchor="middle" fill="#fbbf24" font-size="13" font-weight="600">Cleanverse CCP</text>
  <text x="300" y="215" text-anchor="middle" fill="#94a3b8" font-size="10">verify_apass</text>
  <text x="300" y="230" text-anchor="middle" fill="#64748b" font-size="9">Real-time compliance</text>

  <!-- SettleAccessRequest -->
  <rect x="420" y="170" width="160" height="80" rx="10" fill="rgba(16,185,129,0.12)" stroke="rgba(52,211,153,0.5)" stroke-width="1.5"/>
  <text x="500" y="195" text-anchor="middle" fill="#34d399" font-size="13" font-weight="600">Settle Request</text>
  <text x="500" y="215" text-anchor="middle" fill="#94a3b8" font-size="10">Approved / Rejected</text>
  <text x="500" y="230" text-anchor="middle" fill="#64748b" font-size="9">On-chain record</text>

  <!-- Arrows row 2 -->
  <line x1="180" y1="210" x2="220" y2="210" stroke="rgba(52,211,153,0.4)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="380" y1="210" x2="420" y2="210" stroke="rgba(251,191,36,0.4)" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- Vertical: Registry → Settle -->
  <line x1="500" y1="110" x2="500" y2="170" stroke="rgba(52,211,153,0.4)" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- Backend adapter -->
  <rect x="220" y="290" width="360" height="70" rx="10" fill="rgba(148,163,184,0.08)" stroke="rgba(148,163,184,0.25)" stroke-width="1.5"/>
  <text x="400" y="315" text-anchor="middle" fill="#94a3b8" font-size="13" font-weight="600">Backend Adapter (Node.js/Express)</text>
  <text x="400" y="335" text-anchor="middle" fill="#64748b" font-size="10">Cleanverse API ↔ Ethers v6 ↔ Monad RPC</text>

  <!-- Arrows to backend -->
  <line x1="300" y1="250" x2="330" y2="290" stroke="rgba(148,163,184,0.25)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="500" y1="250" x2="470" y2="290" stroke="rgba(148,163,184,0.25)" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- Monad -->
  <rect x="620" y="170" width="160" height="80" rx="10" fill="rgba(139,92,246,0.10)" stroke="rgba(139,92,246,0.3)" stroke-width="1.5"/>
  <text x="700" y="195" text-anchor="middle" fill="#a78bfa" font-size="13" font-weight="600">Monad Testnet</text>
  <text x="700" y="215" text-anchor="middle" fill="#94a3b8" font-size="10">Chain ID 10143</text>
  <text x="700" y="230" text-anchor="middle" fill="#64748b" font-size="9">EVM · Prague</text>

  <!-- Line from settle/receipt to monad -->
  <line x1="580" y1="210" x2="620" y2="210" stroke="rgba(139,92,246,0.3)" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/>

  <!-- Caps at bottom -->
  <text x="400" y="395" text-anchor="middle" fill="#475569" font-size="10" font-style="italic">ConsentFlow — Clinical Trial Consent Rail powered by Cleanverse CVI · CVA · CCP</text>
</svg>
`.trim();

const STATS = [
  { label: 'Solidity Tests', value: '23', sub: 'All passing' },
  { label: 'Contracts', value: '2', sub: 'Registry + Receipt' },
  { label: 'API Endpoints', value: '12+', sub: 'Cleanverse + on-chain' },
  { label: 'Chain', value: 'Monad', sub: 'Testnet 10143' },
];

const INTEGRATIONS = [
  {
    icon: '🪪',
    title: 'CVI — A-Pass Identity',
    desc: 'Each participant gets a Cleanverse A-Pass (identity NFT). ConsentFlow uses generate_apass for enrollment, update_status for freeze/unfreeze (revocation), and query_apass for status checks.',
    endpoints: ['POST /generate_apass', 'POST /query_apass', 'POST /update_status'],
    color: 'border-teal-500/30 bg-teal-500/5',
  },
  {
    icon: '📜',
    title: 'CVA — Purpose-Bound Receipt',
    desc: 'ContributionReceipt contract stores non-transferable, wallet-locked data receipts with studyId, purposeHash, fixtureHash, and expiry — the CVA layer that binds data usage to consent.',
    endpoints: ['issue()', 'revoke()', 'isValid()'],
    color: 'border-emerald-500/30 bg-emerald-500/5',
  },
  {
    icon: '🔐',
    title: 'CCP — Compliance Check Protocol',
    desc: 'Before settling any access request, the backend calls verify_apass via the Cleanverse API. If the A-Pass is frozen (consent revoked), the request is rejected with reasonCode CVI_REVOKED and the researcher is refunded.',
    endpoints: ['POST /verify_apass'],
    color: 'border-amber-500/30 bg-amber-500/5',
  },
];

const FLOW_STEPS = [
  { step: 1, actor: 'Participant', action: 'Generates A-Pass (CVI)', detail: 'Cleanverse issues identity NFT → status: ACTIVE' },
  { step: 2, actor: 'Participant', action: 'Creates on-chain consent', detail: 'ConsentRegistry records studyId, purposeHash, expiry' },
  { step: 3, actor: 'Researcher', action: 'Queues access request', detail: 'Deposits ETH compensation, submits purposeHash' },
  { step: 4, actor: 'Backend', action: 'Runs CCP (verify_apass)', detail: 'Cleanverse checks A-Pass status → pass or ComplianceFailed' },
  { step: 5, actor: 'Backend', action: 'Settles on-chain', detail: 'Approved → CVA receipt issued + compensation released; Rejected → refund' },
  { step: 6, actor: 'Participant', action: 'Revokes consent', detail: 'update_status → freeze A-Pass → all future CCP checks fail' },
];

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
          : 'bg-consent-panel text-consent-muted hover:text-white hover:bg-consent-panelHover'
      }`}
    >
      {children}
    </button>
  );
}

export function Landing() {
  const [tab, setTab] = useState<'overview' | 'architecture' | 'integrations' | 'flow'>('overview');

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="text-center py-8 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Cleanverse Trusted Assets Build · Track 2 (DeFi)
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">
          ConsentFlow
        </h1>
        <p className="text-lg text-consent-muted max-w-2xl mx-auto leading-relaxed">
          A patient-controlled clinical trial consent rail built on Monad testnet.
          Cleanverse CVI gates identity, CVA binds data usage, and CCP enforces
          real-time compliance — all on-chain, all revocable.
        </p>
      </section>

      {/* Stats banner */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="bg-consent-panel border border-consent-border rounded-xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-emerald-400">{s.value}</div>
            <div className="text-sm text-white font-medium mt-1">{s.label}</div>
            <div className="text-xs text-consent-muted">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* Tab navigation */}
      <section className="flex flex-wrap gap-2 justify-center">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabButton>
        <TabButton active={tab === 'architecture'} onClick={() => setTab('architecture')}>Architecture</TabButton>
        <TabButton active={tab === 'integrations'} onClick={() => setTab('integrations')}>Cleanverse Integration</TabButton>
        <TabButton active={tab === 'flow'} onClick={() => setTab('flow')}>Demo Flow</TabButton>
      </section>

      {/* Tab content */}
      <section className="bg-consent-panel border border-consent-border rounded-xl p-6 min-h-[300px]">
        {tab === 'overview' && (
          <div className="space-y-4 text-consent-text leading-relaxed">
            <h2 className="text-xl font-semibold text-white">The Problem</h2>
            <p>
              Clinical trials lack participant-controlled, revocable consent on-chain.
              Institutions can't verify compliance in real-time, and participants have
              no transparent way to revoke consent once it's given. Paper-based systems
              are slow, opaque, and trust-dependent.
            </p>
            <h2 className="text-xl font-semibold text-white mt-6">The Solution</h2>
            <p>
              ConsentFlow puts consent on-chain. Participants enroll via Cleanverse A-Pass
              (CVI), creating an immutable consent record on Monad's high-throughput EVM
              chain. Researchers request data access with ETH compensation. Before any
              data is shared, the backend runs Cleanverse's verify_apass (CCP) — if the
              participant has frozen their A-Pass (revoked consent), the request is
              rejected instantly and the researcher is refunded. CVA-bound receipt
              contracts ensure data usage is traceable and non-transferable.
            </p>
            <h2 className="text-xl font-semibold text-white mt-6">Why Monad?</h2>
            <p>
              Monad testnet provides the throughput and finality needed for auditable
              consent records. Cleanverse's sandbox already supports Monad with aUSDC,
              AccessCore, and A-Pass NFT contracts deployed at known addresses.
            </p>
          </div>
        )}

        {tab === 'architecture' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">System Architecture</h2>
            {/* Safe: ARCH_SVG is a compile-time string constant (line 9), not user-derived */}
            <div
              className="bg-consent-bg border border-consent-border rounded-lg p-4"
              dangerouslySetInnerHTML={{ __html: ARCH_SVG }}
            />
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-consent-bg border border-consent-border rounded-lg p-4">
                <h3 className="text-emerald-400 font-medium mb-2">On-Chain Layer</h3>
                <ul className="text-sm text-consent-muted space-y-1">
                  <li>• ConsentRegistry — consent lifecycle, access requests, settlement</li>
                  <li>• ContributionReceipt — CVA-bound data receipts, wallet-locked</li>
                  <li>• OpenZeppelin ReentrancyGuard on all state-changing functions</li>
                </ul>
              </div>
              <div className="bg-consent-bg border border-consent-border rounded-lg p-4">
                <h3 className="text-teal-400 font-medium mb-2">Off-Chain Adapter</h3>
                <ul className="text-sm text-consent-muted space-y-1">
                  <li>• Express backend wraps Cleanverse sandbox API</li>
                  <li>• Ethers v6 connects to Monad testnet for contract calls</li>
                  <li>• CCP verify_apass bridges identity status to on-chain settlement</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'integrations' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Cleanverse Integration</h2>
            {INTEGRATIONS.map((int) => (
              <div key={int.title} className={`border rounded-lg p-4 ${int.color}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{int.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-base">{int.title}</h3>
                    <p className="text-sm text-consent-muted mt-1 leading-relaxed">{int.desc}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {int.endpoints.map((ep) => (
                        <code
                          key={ep}
                          className="text-xs px-2 py-0.5 rounded bg-black/30 text-emerald-400 font-mono"
                        >
                          {ep}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'flow' && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-white">End-to-End Demo Flow</h2>
            <div className="space-y-2">
              {FLOW_STEPS.map((s) => (
                <div
                  key={s.step}
                  className="flex items-start gap-3 bg-consent-bg border border-consent-border rounded-lg p-3"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center">
                    {s.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{s.action}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">
                        {s.actor}
                      </span>
                    </div>
                    <p className="text-xs text-consent-muted mt-1">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Try it CTA */}
      <section className="text-center py-4">
        <p className="text-consent-muted text-sm">
          Use the navigation above to try the Participant, Researcher, and Audit views →
        </p>
      </section>
    </div>
  );
}
