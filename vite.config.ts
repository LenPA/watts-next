import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clientId = env.VITE_STRAVA_CLIENT_ID || env.STRAVA_CLIENT_ID || '213326';
  const clientSecret = env.STRAVA_CLIENT_SECRET || env.VITE_STRAVA_CLIENT_SECRET;

  return {
    plugins: [
      react(),
      {
        name: 'strava-oauth-dev-middleware',
        configureServer(server) {
          server.middlewares.use('/api/strava/token', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method Not Allowed' }));
              return;
            }

            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });

            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const grantType = parsed.grant_type || 'authorization_code';

                const payload: Record<string, string> = {
                  client_id: clientId || '',
                  client_secret: clientSecret || '',
                  grant_type: grantType
                };

                if (grantType === 'refresh_token') {
                  if (!parsed.refresh_token) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Missing refresh_token' }));
                    return;
                  }
                  payload.refresh_token = parsed.refresh_token;
                } else {
                  if (!parsed.code) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Missing code' }));
                    return;
                  }
                  payload.code = parsed.code;
                }

                const stravaRes = await fetch('https://www.strava.com/oauth/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });

                const data = await stravaRes.text();
                res.statusCode = stravaRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Server error exchanging token';
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: message }));
              }
            });
          });
        }
      }
    ]
  };
});

