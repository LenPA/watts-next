# Watts Next — Implementatie Roadmap & Agent Prompts

Dit mapje bevat de 4 gefaseerde prompt-bestanden voor het iteratief bouwen van de **Adaptive Cycling Coach** binnen Watts Next (React 19 + TypeScript + Vite + Dexie.js).

## Bestanden
1. [Fase 1: Fundament, Veilige OAuth & 2-Traps Strava Sync](./fase-1-fundament-en-oauth.md)
   - Doel: Dexie database opzetten, veilige serverless OAuth proxy documenteren/opzetten, 90-dagen bulk sync (zonder rate limit risico), lokale data wissen optie.
2. [Fase 2: Fysiologische Analyse-engine & Onboarding](./fase-2-fysiologie-en-onboarding.md)
   - Doel: Pure TypeScript engine voor Coggan zones, NP, IF, TSS, EWMA (CTL/ATL/TSB), onboarding flow voor FTP en doelen, fitness grafiek.
3. [Fase 3: Workoutbibliotheek & Deterministische Weekplanner](./fase-3-workouts-en-weekplanner.md)
   - Doel: Gestructureerde workouts met schaalbare stappen, deterministische generator die planning maakt op basis van beschikbaarheid en actuele conditie, "Wat moet ik vandaag trainen en waarom?".
4. [Fase 4: Adaptief Herplannen, Zwift (.zwo) Export & Data Beheer](./fase-4-adaptiviteit-en-zwift-export.md)
   - Doel: Matchen van uitgevoerde ritten, voorstellen tot herziening bij afwijkingen, Zwift .zwo export, JSON backup & herstel.

## Aanbevolen werkwijze
Voed deze bestanden **één voor één** aan de coding agent. Laat de agent pas aan de volgende fase beginnen zodra de *Definition of Done* van de huidige fase is behaald en gecontroleerd.
