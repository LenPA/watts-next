import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTokenExchange } from '../token-handler';

describe('Serverless Token Exchange Handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.STRAVA_CLIENT_ID = 'test_client_id';
    process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
  });

  it('rejects request when missing authorization code', async () => {
    const result = await handleTokenExchange({
      grant_type: 'authorization_code'
    });

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Missing code');
  });

  it('rejects request when missing refresh token', async () => {
    const result = await handleTokenExchange({
      grant_type: 'refresh_token'
    });

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Missing refresh_token');
  });

  it('rejects request when credentials are not configured on server', async () => {
    delete process.env.STRAVA_CLIENT_ID;
    delete process.env.VITE_STRAVA_CLIENT_ID;

    const result = await handleTokenExchange({
      grant_type: 'authorization_code',
      code: 'valid_code'
    });

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('STRAVA_CLIENT_ID');
  });

  it('calls Strava token endpoint with credentials and returns tokens', async () => {
    const mockTokenResponse = {
      token_type: 'Bearer',
      access_token: 'mock_access_token_123',
      expires_at: 1792000000,
      expires_in: 21600,
      refresh_token: 'mock_refresh_token_456'
    };

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify(mockTokenResponse)
    } as unknown as Response);

    const result = await handleTokenExchange({
      grant_type: 'authorization_code',
      code: 'strava_auth_code_xyz'
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.access_token).toBe('mock_access_token_123');

    // Verify fetch was called with client_secret
    expect(global.fetch).toHaveBeenCalledWith('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'test_client_id',
        client_secret: 'test_client_secret',
        grant_type: 'authorization_code',
        code: 'strava_auth_code_xyz'
      })
    });
  });
});
