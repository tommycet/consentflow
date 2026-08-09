export function Docs() {
  return (
    <div className="cf-container py-12">
      <h1 className="text-display text-white mb-4">Documentation</h1>
      <p className="text-cf-muted max-w-2xl">
        ConsentFlow documentation is coming soon. In the meantime, explore the live demos
        or read the smart contract source on GitHub.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="https://github.com/tommycet/consentflow"
          target="_blank"
          rel="noopener noreferrer"
          className="cf-glow-btn"
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
}
