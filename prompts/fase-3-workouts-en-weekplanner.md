# Prompt — Fase 3: Workoutbibliotheek & Deterministische Weekplanner

Je bouwt de deterministische weekplanner en trainingsbibliotheek voor **Watts Next / Adaptive Cycling Coach**.

## 1. Doel & Filosofie
De kernvraag van het dashboard is: **'Wat moet ik vandaag trainen, en waarom?'**
- De planner is **puur deterministisch** in TypeScript (geen LLM-afhankelijkheid).
- Iedere geplande workout bevat traceerbare redenen (`reasonCodes` en een heldere toelichting voor de fietser).

## 2. Gestructureerde Workoutbibliotheek
Modelleer gestructureerde workouts met exacte stappen:
- Categorieën: `recovery`, `endurance`, `tempo`, `sweetspot`, `threshold`, `vo2max`, `anaerobic`, `rest`, en vrije buitenritten.
- Stappen bevatten type (`warmup`, `steadystate`, `interval`, `recovery_interval`, `cooldown`), duur in seconden en streefpercentage van de FTP (% FTP).
- **Dynamische duur**: Bereken de exacte totale duur inclusief pauzes. Zorg dat intervallen of warm-up/cooldown schalen naar de beschikbare tijd van de renner.
- Bereken actuele streef-wattages direct aan de hand van het actuele FTP van het profiel.

Startcollectie:
- Duurtraining (60–180 min, 60–75% FTP)
- Sweet Spot (bijv. 3×12 min op 90% FTP met 4 min rust)
- VO₂max (bijv. 40/20 intervallen op 120% / 55% FTP)
- Herstelrit (30–60 min rustig)

## 3. Deterministische Planning Engine (`TrainingPlanGenerator`)
Input: Profiel (FTP, doelen), 7-daagse weekbeschikbaarheid (minuten + indoor/outdoor), huidige CTL/ATL/TSB en recente ritten van de afgelopen 14 dagen.
Regels:
1. **Strikte randvoorwaarden**: Plan nooit over de beschikbare tijd heen en plan geen indoorworkout op een uitsluitend 'buiten'-dag.
2. **Polarisatie & Herstel**: Maximaal 2 intensieve sessies per week (VO2max/Threshold/Sweetspot), gescheiden door rust of lichte duurtraining.
3. **Doelgerichtheid**: FTP-doel prioriteert sweetspot/threshold; evenement/duur-doel prioriteert lange Z2-duur op dagen met de meeste tijd.
4. **Vastgelegde ritten**: Houd rekening met vaste ritten die de gebruiker zelf heeft ingevuld (bijv. woon-werkverkeer of een clubrit).
5. **Transparante motivatie**: Elke workout krijgt een motivatie (bijv. *"Ingepland op woensdag omdat je 90 min binnen beschikbaar hebt en TSB voldoende herstel toont na je zware zondagrit"*).

## 4. UI & Dashboard
- **'Vandaag Trainen' Hero Card**: Toont direct de workout van vandaag met doel, duur, watts en het 'waarom'.
- **Weekkalender**: 7-daags overzicht (maandag t/m zondag) met workouts, geplande belasting (TSS), en rustdagen.
- **Interactie**: De renner kan een geplande training handmatig verplaatsen, als 'overgeslagen' markeren of details van de stappen bekijken.

## 5. Definition of Done — Fase 3
- [ ] Generator genereert een consistent, deterministisch weekschema op basis van beschikbaarheid en actuele conditie (getest met unit tests).
- [ ] Schema respecteert rustdagen en overschrijdt nergens de beschikbare minuten.
- [ ] Dashboard toont duidelijk de training van vandaag met fysiologische onderbouwing.
- [ ] De gestructureerde trainingsstappen worden overzichtelijk gevisualiseerd (grafiekje/tijdsblokken met vermogen).
