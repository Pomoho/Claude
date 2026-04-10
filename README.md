# Allociné Movie Scraper → Google Sheets

Automatically scrapes [Allociné](https://www.allocine.fr/film/aucinema/) every week for currently-showing movies that have a **press rating of 4 stars or above (out of 5)** and writes the results to a Google Sheet.

## What it does

1. Fetches the "Au cinéma en ce moment" listing from Allociné (with pagination).
2. Extracts title, press rating, directors, cast, genres, release date, and a direct link.
3. Filters to keep only movies with **press rating ≥ 4.0 / 5**.
4. Overwrites a designated Google Sheets tab with the fresh results (bold header, frozen row, auto-sized columns).
5. Runs automatically **every Monday at 09:00 UTC** via GitHub Actions.

---

## Project structure

```
.
├── main.py                          # Entry point
├── scraper.py                       # Allociné HTML scraper
├── sheets.py                        # Google Sheets API client
├── requirements.txt
├── .env.example                     # Template for local runs
└── .github/
    └── workflows/
        └── weekly-scraper.yml       # Scheduled GitHub Actions workflow
```

---

## Setup

### 1. Google Cloud — service account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create (or select) a project.
3. Enable the **Google Sheets API**.
4. Create a **Service Account** (IAM & Admin → Service Accounts → Create).
5. Generate a **JSON key** for the service account (Keys → Add Key → JSON). Download it.
6. Open your target Google Sheet and **share it** with the service account's email address (`…@….iam.gserviceaccount.com`) as **Editor**.

### 2. GitHub Secrets

In your repository go to **Settings → Secrets and variables → Actions** and add:

| Secret name | Value |
|---|---|
| `GOOGLE_CREDENTIALS_JSON` | The full content of the JSON key file (copy-paste the entire file) |
| `GOOGLE_SPREADSHEET_ID` | The spreadsheet ID from the sheet URL (the long alphanumeric string between `/d/` and `/edit`) |

Optionally add these as **Repository Variables** (not secrets) to override defaults without a code change:

| Variable | Default |
|---|---|
| `SHEET_NAME` | `Films Allociné` |
| `MIN_PRESS_RATING` | `4.0` |
| `MAX_PAGES` | `15` |

### 3. Enable the workflow

The workflow file is at `.github/workflows/weekly-scraper.yml`.  
It runs automatically on the schedule. You can also trigger it manually via **Actions → Weekly Allociné Scraper → Run workflow**.

---

## Local development

```bash
# 1. Clone the repo and install dependencies
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Create your .env file
cp .env.example .env
# Edit .env with your real credentials

# 3. Run
python main.py
```

`python-dotenv` is included in the requirements so the `.env` file is loaded automatically.

---

## Output columns

| Column | Description |
|---|---|
| Titre | Movie title |
| Note Presse (/5) | Press rating out of 5 |
| Réalisateur(s) | Directors |
| Casting | Main cast |
| Genre(s) | Genre tags |
| Date de sortie | Release date |
| Lien Allociné | Direct URL to the movie page |
| Mis à jour le | Timestamp of the last scrape |

---

## Troubleshooting

| Issue | Likely cause |
|---|---|
| `No movie cards found` | Allociné changed their HTML structure — update the CSS selectors in `scraper.py::_find_cards` and `_parse_card`. |
| `GOOGLE_CREDENTIALS_JSON is not set` | The secret is missing or incorrectly named in GitHub. |
| `HttpError 403` | The service account was not granted Editor access to the spreadsheet. |
| Empty press rating | Some movies have no press reviews yet and are skipped. |

---

## Customising the schedule

Edit the `cron` expression in `.github/workflows/weekly-scraper.yml`:

```yaml
schedule:
  - cron: "0 9 * * 1"   # Every Monday 09:00 UTC
```

Use [crontab.guru](https://crontab.guru/) to build your own expression.
