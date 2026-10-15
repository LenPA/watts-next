/**
 * Serverless Token Exchange Handler for Strava OAuth.
 * Compatible with AWS Lambda, AWS Amplify Functions, Vercel Serverless, and Netlify Functions.
 *
 * Requirements:
 * - Environment variable: STRAVA_CLIENT_ID
 * - Environment variable: STRAVA_CLIENT_SECRET
 *
 * This endpoint handles:
 * 1. authorization_code grant (initial OAuth token exchange)
 * 2. refresh_token grant (automatic token refresh)
 */

export interface TokenRequestBody {
  code?: string;
  refresh_token?: string;
  grant_type: 'authorization_code' | 'refresh_token';
}

export async function handleTokenExchange(body: TokenRequestBody): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  const clientId = process.env.STRAVA_CLIENT_ID || process.env.VITE_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET || process.env.VITE_STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Missing server configuration: STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is not set.'
      })
    };
  }

  const { grant_type, code, refresh_token } = body;

  const payload: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type
  };

  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing refresh_token in request body' })
      };
    }
    payload.refresh_token = refresh_token;
  } else if (grant_type === 'authorization_code') {
    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code in request body' })
      };
    }
    payload.code = code;
  } else {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unsupported grant_type: ${grant_type}` })
    };
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    return {
      statusCode: response.status,
      headers,
      body: responseText
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: 'Failed to communicate with Strava token endpoint',
        details: message
      })
    };
  }
}

export interface LambdaHttpEvent {
  httpMethod?: string;
  body?: string | TokenRequestBody;
}

// AWS Lambda / Amplify Handler
export const handler = async (event: LambdaHttpEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  const body: TokenRequestBody = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || { grant_type: 'authorization_code' });
  return handleTokenExchange(body);
};
