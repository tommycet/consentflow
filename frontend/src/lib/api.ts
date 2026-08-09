// Cleanverse adapter API client — wraps backend routes on port 4000.
// All /api calls are proxied to the backend via Vite's proxy config in dev mode.

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const json: ApiEnvelope<T> = await res.json().catch(() => ({
      success: false,
      error: `parse error: ${res.status}`,
    }));

    if (!json.success) {
      throw new Error(json.error || `API error: ${res.status}`);
    }
    return json.data as T;
  }

  // ─── Health ───────────────────────────────────────────
  async health(): Promise<{
    service: string;
    cleanverseConfigured: boolean;
    baseUrl: string;
    chain: string;
  }> {
    return this.request('GET', '/health');
  }

  // ─── CVI (A-Pass) ─────────────────────────────────────
  async generateApass(wallet: string): Promise<{
    cvRecordId: number;
    txHash: string;
    status: number;
    tier: number;
    countries?: string[];
  }> {
    return this.request('POST', `/cvi/${wallet}/generate`, { skipKyc: true });
  }

  async getCviStatus(wallet: string): Promise<null | {
    status: number;
    tier: number;
    cvRecordId: number;
    countries?: string[];
  }> {
    return this.request('GET', `/cvi/${wallet}/status`);
  }

  async freezeCvi(wallet: string): Promise<Record<string, unknown>> {
    return this.request('POST', `/cvi/${wallet}/freeze`, {});
  }

  async unfreezeCvi(wallet: string): Promise<Record<string, unknown>> {
    return this.request('POST', `/cvi/${wallet}/unfreeze`, {});
  }

  // ─── CVA (A-Token) ────────────────────────────────────
  async addRule(wallet: string, rules: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request('POST', '/cva/rule', { wallet, rules });
  }

  async getRules(wallet: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/cva/${wallet}/rules`);
  }

  // ─── CCP ──────────────────────────────────────────────
  async verifyCcp(wallet: string, tokenAddress?: string): Promise<{
    code: number | string;
    meaning: string;
    allowed: boolean;
    raw: Record<string, unknown>;
  }> {
    return this.request('POST', '/ccp/verify', { wallet, tokenAddress });
  }
}

export const apiClient = new ApiClient();
