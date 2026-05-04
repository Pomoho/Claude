# ImmoGuide IDF

Application web d'aide à la décision immobilière en Île-de-France.

## Stack
- **Frontend / Backend** : Next.js 14 (App Router) + TypeScript
- **Base de données** : SQLite via Prisma (zero-config local)
- **Auth** : Magic link (dev mode sans email requis)
- **UI** : Tailwind CSS + Framer Motion
- **Charts** : Recharts

## Installation

```bash
cd projet-immo
npm install
npx prisma db push      # Crée la base SQLite (dev.db)
npm run dev             # Lance sur http://localhost:3000
```

## Flux utilisateur

1. `/` → Landing page
2. `/login` → Saisir un email → bouton "Accéder" apparaît (mode dev)
3. `/onboarding` → Questionnaire 4 étapes
4. `/dashboard` → Recommandations + cartes villes + alertes

## Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| Onboarding | 4 étapes : profil, projet, préférences, financement |
| Acheter vs Louer | Score 0-100 avec 5 facteurs explicités |
| Neuf vs Ancien | Score 0-100 avec 5 facteurs explicités |
| Top 5 villes | 28 communes IDF scorées sur 5 critères |
| Simulation financière | Coût cumulé achat vs location sur l'horizon |
| Alertes | Liens filtrés SeLoger, Leboncoin, Bien'ici |

## Architecture

```
projet-immo/
├── app/                  # Pages Next.js + API routes
│   ├── api/auth/         # Login / Verify / Logout
│   ├── api/profile/      # CRUD profil
│   ├── api/alerts/       # CRUD alertes
│   ├── login/            # Page connexion
│   ├── onboarding/       # Questionnaire
│   └── dashboard/        # Tableau de bord
├── components/ui/        # Composants réutilisables
├── lib/
│   ├── data/             # Données villes IDF
│   ├── scoring/          # Moteur de recommandation
│   ├── db.ts             # Client Prisma
│   ├── session.ts        # Gestion session iron-session
│   └── types.ts          # Types TypeScript
└── prisma/schema.prisma  # Schéma BDD
```

## Évolutions prévues

- Remplacement des données simulées par une API immobilière (DVF, API Gouv)
- Moteur ML pour affiner les recommandations de villes
- Intégration directe des annonces (scraping ou partenariat SeLoger/Bien'ici)
- Export PDF du bilan personnalisé
- Mode multi-profil (couple)
