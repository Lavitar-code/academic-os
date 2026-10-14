# 🎓 AcademicOS

![Electron](https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)

App desktop che fa da "sistema operativo per lo studio": pianifica le sessioni, programma i ripassi con la **ripetizione dilazionata**, importa gli appunti da PDF/Word e tiene traccia dei progressi verso gli esami.

**Local-first:** i dati restano sul tuo computer in un database locale nel browser (IndexedDB via Dexie); con la versione Electron, accanto all'eseguibile.

## Funzionalità

- **Planner:** piano di studio giornaliero con sessioni e scadenze d'esame
- **Ripasso (spaced repetition):** intervalli `1·3·7·14·30` giorni che si accorciano man mano che l'esame si avvicina (`src/Utils/reviewScheduler.js`)
- **Dubbi:** raccolta delle cose non chiare da rivedere
- **Documenti:** libreria con import di testo da **PDF** (pdf.js) e **Word** (mammoth)
- **Statistiche:** grafici sui progressi e sul tempo di studio
- **Focus timer** con controlli anti-distrazione
- **Integrità dei dati:** pagina per verificare e sistemare il database locale

## Stack

| Ambito | Tecnologia |
|---|---|
| App desktop | Electron |
| Interfaccia | React 19 + Vite + Tailwind CSS 4 |
| Animazioni | Framer Motion |
| Dati | IndexedDB (Dexie) |
| Import file | pdf.js (PDF), mammoth (Word) |

## Struttura

```
src/pages/        schermate: Dashboard, Planner, Review, Doubts, Stats, Settings, DataIntegrity
src/components/   modali e UI (timer, ricerca, import, libreria documenti)
src/Utils/        logica: ripasso, impostazioni, import note, estrazione testo
src/database/     accesso al database locale (Dexie)
electron/         processo principale Electron (finestra desktop)
```

## Avvio

**Requisiti:** Node.js.

```bash
npm install
npm run dev            # sviluppo nel browser
npm run electron:dev   # avvia come app desktop
npm run dist:portable  # genera l'eseguibile portabile per Windows
```

## Autore

**Vittorio Gaudiello** — [@Lavitar-code](https://github.com/Lavitar-code)
