# Prompt — Fase 4: Adaptief Herplannen, Zwift (.zwo) Export & Data Beheer

Je voltooit **Watts Next / Adaptive Cycling Coach** door het toevoegen van adaptieve herplanning bij afwijkende ritten, Zwift workout-export en robuust databeheer.

## 1. Adaptief Herplannen (Feedback Loop)
Wanneer een nieuwe rit via Strava binnenkomt:
1. **Activiteiten Matchen**:
   - Koppel de gereden rit automatisch aan de geplande workout van die dag op basis van datum en type (bied ook handmatige correctie aan).
   - Classificeer de status: *Voltooid zoals gepland*, *Zwaarder dan gepland*, *Lichter dan gepland*, *Niet uitgevoerd*, of *Ongeplande extra rit*.
2. **Herplan-algoritme**:
   - Herbereken de actuele vermoeidheid en belasting.
   - Als een rit wezenlijk afwijkt (bijv. renner reed 2,5 uur volle bak i.p.v. 60 min rustig voor een zware VO2max-dag), genereert het systeem een **voorstel tot herziening** van de resterende week.
   - Mogelijke acties: intensieve training uitstellen, vervangen door herstelrit of inkorten.
3. **Gebruikerscontrole**:
   - Toon het herplanvoorstel in een duidelijke modal of notificatie: *"Wat verandert er?"*, *"Waarom?"* en *"Wat gebeurt er als je het plan niet aanpast?"*.
   - De gebruiker moet **accepteren of afwijzen**. Een bevestigd plan wordt **nooit stilzwijgend overschreven**.

## 2. Zwift Export (`.zwo`)
- Bouw een exportfunctie die van elke gestructureerde workout uit de bibliotheek een valide XML-bestand (`.zwo`) genereert.
- Ondersteun tags: `<warmup>`, `<steadyState>`, `<intervalsT>`, `<cooldown>`. Vermogens worden weergegeven als fractie van FTP (bijv. 0.90 voor 90% FTP).
- Bied een directe downloadknop in de browser aan (*"Download .zwo voor Zwift"*).
- Valideer de syntax en de berekende totale duur.

## 3. Data Export, Import & Volledig Beheer
- **Backup & Herstel**:
  - Exporteer alle IndexedDB-tabellen (profiel, doelen, ritten, plannen, revisies) naar een enkel JSON-bestand.
  - Importeer een backup JSON-bestand met schemavalidatie.
- **Opslag persistentie**:
  - Vraag via de `navigator.storage.persist()` API toestemming om de IndexedDB data persistent te maken tegen automatische browser-cleanup.
  - Toon duidelijke waarschuwing dat IndexedDB lokaal aan de browser gebonden is en dat regelmatige JSON-backups worden aangeraden.

## 4. Polishing & E2E Validatie
- Zorg voor soepele overgangen, responsive layout (mobiel en desktop) en foutafhandeling wanneer Strava offline is.
- Schrijf integratie-/E2E-tests voor de volledige cyclus: koppelen → data synchroniseren → schema genereren → afwijkende rit simuleren → herplanvoorstel accepteren → .zwo downloaden.

## 5. Definition of Done — Fase 4
- [ ] Afwijkende ritten triggeren een transparant herplanvoorstel dat de gebruiker kan accepteren of weigeren.
- [ ] Gegenereerde `.zwo`-bestanden zijn valide XML en foutloos in te laden in Zwift.
- [ ] Volledige backup kan worden geëxporteerd en geïmporteerd via JSON.
- [ ] Productie-build slaagt (`npm run build`).
