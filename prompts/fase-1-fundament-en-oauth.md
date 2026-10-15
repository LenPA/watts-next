# Prompt — Fase 1: Fundament, Veilige OAuth & 2-Traps Strava Sync

Je bent een senior full-stack engineer. Je bouwt de eerste verticale slice van **Watts Next / Adaptive Cycling Coach** in de bestaande repository.

## 1. Stack & Architectuur
- **Frontend**: React 19, TypeScript (strict), Vite, Lucide React, Recharts / Tailwind of Vanilla CSS.
- **Lokale opslag**: IndexedDB met **Dexie.js** (migreer de eenvoudige `idb`-opzet naar een getypeerde Dexie-database met versiebeheer en veilige migraties).
- **Security & OAuth**: Geen `client_secret` in de browsercode of frontend `.env`. Bouw/documenteer een minimale, stateless serverless functie (bijv. Node/TypeScript voor AWS Amplify / Vercel / Cloudflare) voor de OAuth code-exchange en token refresh.

## 2. Dexie Schema (Basis)
Modelleer minimaal:
- `activities`: Unieke index op `id` (Strava activity ID), index op `start_date`, met ruwe bronwaarden en genormaliseerde velden (tijd, afstand, hoogtemeters, gemiddelde watts, weighted average watts, hartslag, cadans, sporttype). Geen aannames: ontbrekende waarden zijn `null`, nooit 0.
- `activity_streams`: Aparte tabel voor seconde-data (watts, hartslag, cadans, tijd) gekoppeld aan `activity_id`.
- `sync_metadata`: Laatste sync-timestamp, athlete-info, sync-voortgang.

## 3. Strava 2-Traps Sync (Strict Rate Limit Safe)
Strava hanteert een strikt quotum van 100 requests per 15 minuten.
1. **Tier 1 (Initiële bulk sync)**:
   - Haal de laatste 90 dagen activiteiten op via gepagineerde `/athlete/activities?per_page=100` calls (maximaal 1 à 2 requests).
   - Filter op relevante types (`Ride`, `VirtualRide`, `GravelRide`, `MountainBikeRide`).
   - Sla de samenvattingen direct op in IndexedDB via upsert.
2. **Tier 2 (Lazy Stream Sync)**:
   - Haal zware seconde-streams (`/activities/{id}/streams`) **NIET** massaal op bij de initiële sync.
   - Bereid een lazy-loader voor die streams pas ophaalt wanneer een specifieke rit in detail bekeken of herberekend moet worden.

## 4. UI & Functionaliteit
- **Connectiescherm**: Duidelijke statusindicatie (*Niet verbonden*, *Verbinden...*, *Synchroniseren*, *Verbonden*, *Fout bij vernieuwen*).
- **Koppeling beheren**: Handmatige **'Synchroniseer nu'**-knop met laadindicator en voortgang (bijv. "12 nieuwe ritten geïmporteerd").
- **Ontkoppelen & Privacy**: Knop om sessie te beëindigen én een optie om **alle lokaal opgeslagen Strava-data uit IndexedDB te wissen**.
- **Mock / Demo Modus**: Schakelbaar voor lokale ontwikkeling en offline testen zonder actieve Strava-credentials.

## 5. Definition of Done — Fase 1
- [ ] Serverless OAuth handler is opgezet en gedocumenteerd.
- [ ] De gebruiker kan een echt Strava-account autoriseren via de OAuth code flow.
- [ ] De laatste 90 dagen ritten worden opgehaald (zonder rate-limit errors) en opgeslagen in Dexie IndexedDB.
- [ ] Na een pagina-refresh blijft de data behouden en toont de UI de lijst met geïmporteerde ritten en de laatste sync-tijd.
- [ ] Tokens worden automatisch stil ververst wanneer ze verlopen zijn.
- [ ] Lokale data kan met één klik gewist worden.
- [ ] TypeScript compileert foutloos (`npm run build`).
