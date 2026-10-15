# Serverless Strava OAuth Handler

Dit document beschrijft de architectuur en configuratie voor het veilig afhandelen van Strava OAuth token-uitwisselingen zonder dat het `client_secret` in de browser belandt.

## Waarom een serverless proxy?
Strava's OAuth flow vereist dat zowel de initiële token-uitwisseling (`authorization_code`) als het vernieuwen van verlopen tokens (`refresh_token`) vergezeld gaan van het `client_secret`.
In een pure client-side Single Page Application (SPA) mag het secret **nooit** in de client code of publieke environment variables staan.

## Lokale Ontwikkeling
Tijdens `npm run dev` wordt het endpoint `/api/strava/token` automatisch afgehandeld door de middleware in [vite.config.ts](file:///Users/lenp/repositories/strava-insights/vite.config.ts).
Deze middleware leest `STRAVA_CLIENT_ID` en `STRAVA_CLIENT_SECRET` uit `.env.local` via Node.js aan de serverkant. De frontend browsercode ziet het secret dus niet.

## Productie Deployment

### Optie 1: AWS Amplify Gen 2 / AWS Lambda (Aanbevolen voor watts-next.nl)
In AWS Amplify kun je een serverless functie toevoegen:
1. Kopieer [server/token-handler.ts](file:///Users/lenp/repositories/strava-insights/server/token-handler.ts) naar je Amplify backend functie (bijv. `amplify/functions/strava-token/handler.ts`).
2. Koppel de functie aan een HTTP API route op `/api/strava/token`.
3. Stel in het AWS Amplify Console onder **Environment Variables** in:
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`

### Optie 2: Vercel of Netlify
Plaats een bestand `api/strava-token.ts`:
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTokenExchange } from '../server/token-handler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const result = await handleTokenExchange(req.body);
  res.status(result.statusCode).json(JSON.parse(result.body));
}
```

### Optie 3: Cloudflare Workers
Kopieer de `handleTokenExchange` logica naar `worker.ts` met `env.STRAVA_CLIENT_SECRET`.
