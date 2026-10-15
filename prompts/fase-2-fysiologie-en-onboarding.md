# Prompt — Fase 2: Fysiologische Analyse-engine & Onboarding

Je bouwt de fysiologische rekenlaag en onboardingflow voor **Watts Next / Adaptive Cycling Coach** bovenop de gesynchroniseerde data uit Fase 1.

## 1. Principes & Scheiding
- Bouw een **pure TypeScript trainingsanalyse-engine** in `src/lib/` zonder UI-afhankelijkheden. Alles moet 100% deterministisch en met unit tests gedekt zijn.
- Data-integriteit: Maak expliciet onderscheid tussen **gemeten** data, **berekende** data, **geschatte** data en **onbekende** data.

## 2. Trainingsanalyse & Belasting (Coggan & EWMA)
Implementeer:
- **Vermogenszones**: Z1 t/m Z7 op basis van actuele FTP + aparte Sweet Spot zone (88–93% FTP).
- **Belasting per rit**:
  - Indien seconde-streams beschikbaar: bereken echte Normalized Power (NP: 30s rolling average, vierde macht), Intensity Factor ($IF = NP / FTP$) en $TSS = \frac{sec \times NP \times IF}{FTP \times 3600} \times 100$.
  - Indien alleen samenvattingsdata beschikbaar: gebruik Strava's `weighted_average_watts` als proxy voor NP (duidelijk gelabeld als *berekend via Strava weighted watts*).
  - Indien geen vermogensmeter: val terug op hartslag-belasting (hrTSS/TRIMP) mits HR beschikbaar is, of label belasting expliciet als *geschat op basis van tijd/suffer score*. Verzin nooit fictieve power-TSS.
- **Fitness / Vermoeidheid Trends (EWMA)**:
  - Acute Training Load (ATL, 7 dagen vermoeidheid).
  - Chronic Training Load (CTL, 42 dagen conditie).
  - Training Stress Balance ($TSB = CTL_{gisteren} - ATL_{gisteren}$, vorm/frisheid).
  - Initialiseer zinvol op basis van de 90-dagen historie. Documenteer dat TSB een indicatie is van trainingsbelasting, geen absolute herstelmeting.

## 3. Datamodellen & Onboarding
Voeg toe aan Dexie:
- `athlete_profile`: Gewicht, actuele FTP, max HR, rust HR (optioneel), ervaringsniveau.
- `ftp_history`: Historische FTP-waarden met ingangsdatum (ritten in het verleden worden geanalyseerd tegen de FTP die op dat moment gold).
- `training_goals`: Doelen met type (bijv. FTP verhogen, lange tocht/Gran Fondo, algemene conditie), streefdatum en toelichting.
- `availability`: Weekschema (minuten per dag, voorkeur indoor/outdoor/beide).

## 4. UI Schermen
- **Onboarding wizard**: Stap-voor-stap invoer voor nieuwe gebruikers (of bij ontbrekend profiel): FTP instellen, doelen selecteren en weekbeschikbaarheid aangeven.
- **Rittenoverzicht & Detailweergave**: Lijst met gesynchroniseerde ritten. Klikken op een rit toont details, gebruikte belastingformule en (indien van toepassing) een knop om streams lazy in te laden voor een herberekening naar echte NP.
- **Fitness & Vorm Grafiek**: Recharts visualisatie van CTL, ATL en TSB over de afgelopen 90 dagen.

## 5. Definition of Done — Fase 2
- [ ] Unit tests voor vermogenszones, NP, IF, TSS en EWMA (ATL/CTL/TSB) slagen.
- [ ] Onboardingflow slaat atleetprofiel, doelen en beschikbaarheid betrouwbaar op in IndexedDB.
- [ ] De 90 dagen Strava-ritten worden voorzien van berekende trainingsbelasting met heldere labels over de databron.
- [ ] De Fitness & Freshness grafiek rendert accuraat op basis van de historische belasting.
- [ ] TypeScript compileert foutloos en zonder linterfouten.
