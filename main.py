"""
Entry point for the Allociné → Google Sheets agent.

Usage:
    python main.py

Required environment variables:
    GOOGLE_CREDENTIALS_JSON  – Service account JSON (full JSON string)
    GOOGLE_SPREADSHEET_ID    – Target spreadsheet ID

Optional environment variables:
    SHEET_NAME               – Tab name (default: "Films Allociné")
    MIN_PRESS_RATING         – Minimum press rating out of 5 (default: 4.0)
    MAX_PAGES                – Max listing pages to scrape (default: 15)
"""

import logging
import os
import sys

from scraper import AllocineScraper
from sheets import GoogleSheetsClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        logger.error("Required environment variable '%s' is not set.", name)
        sys.exit(1)
    return value


def main() -> None:
    credentials_json = _require_env("GOOGLE_CREDENTIALS_JSON")
    spreadsheet_id = _require_env("GOOGLE_SPREADSHEET_ID")
    sheet_name = os.environ.get("SHEET_NAME", "Films Allociné").strip()
    min_rating = float(os.environ.get("MIN_PRESS_RATING", "4.0"))
    max_pages = int(os.environ.get("MAX_PAGES", "15"))

    logger.info(
        "Starting Allociné scraper (min press rating: %.1f/5, max pages: %d)",
        min_rating,
        max_pages,
    )

    scraper = AllocineScraper()
    movies = scraper.get_top_movies(min_press_rating=min_rating, max_pages=max_pages)

    if not movies:
        logger.warning(
            "No movies found with press rating >= %.1f/5 — "
            "the sheet will be updated with an empty list.",
            min_rating,
        )
    else:
        logger.info(
            "Found %d movie(s) with press rating >= %.1f/5:",
            len(movies),
            min_rating,
        )
        for m in movies:
            logger.info("  [%.1f] %s", m.press_rating, m.title)

    logger.info("Writing results to Google Sheets (spreadsheet: %s)…", spreadsheet_id)
    client = GoogleSheetsClient(credentials_json, spreadsheet_id)
    client.update_movies(movies, sheet_name=sheet_name)
    logger.info("Done.")


if __name__ == "__main__":
    main()
