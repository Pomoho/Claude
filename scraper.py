"""
Allociné scraper — fetches current movies and their press ratings.

Target page: https://www.allocine.fr/film/aucinema/
Pagination: ?page=N
"""

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://www.allocine.fr"
THEATERS_URL = f"{BASE_URL}/film/aucinema/"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Referer": "https://www.google.fr/",
}


@dataclass
class Movie:
    title: str
    press_rating: float          # out of 5
    link: str
    directors: str = ""
    cast: str = ""
    genres: str = ""
    release_date: str = ""
    synopsis: str = ""

    def to_row(self, scraped_at: str) -> list:
        return [
            self.title,
            self.press_rating,
            self.directors,
            self.cast,
            self.genres,
            self.release_date,
            self.link,
            scraped_at,
        ]


def _parse_rating(text: str) -> Optional[float]:
    """Convert '4,2' or '4.2' to float, return None if unparseable."""
    cleaned = text.strip().replace(",", ".")
    # Remove anything that isn't a digit or dot
    cleaned = re.sub(r"[^\d.]", "", cleaned)
    try:
        return float(cleaned)
    except ValueError:
        return None


class AllocineScraper:
    def __init__(self, request_delay: float = 1.5):
        self.session = requests.Session()
        self.session.headers.update(_HEADERS)
        self.delay = request_delay

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_top_movies(
        self,
        min_press_rating: float = 4.0,
        max_pages: int = 15,
    ) -> list[Movie]:
        """Return current movies whose press rating >= min_press_rating."""
        results: list[Movie] = []

        for page_num in range(1, max_pages + 1):
            url = THEATERS_URL if page_num == 1 else f"{THEATERS_URL}?page={page_num}"
            logger.info("Fetching page %d: %s", page_num, url)

            soup = self._fetch(url)
            if soup is None:
                logger.error("Could not fetch page %d — stopping.", page_num)
                break

            cards = self._find_cards(soup)
            if not cards:
                logger.info("No movie cards on page %d — done.", page_num)
                break

            for card in cards:
                movie = self._parse_card(card)
                if movie is None:
                    continue
                if movie.press_rating >= min_press_rating:
                    results.append(movie)
                    logger.info(
                        "  [%.1f/5] %s", movie.press_rating, movie.title
                    )

            logger.info(
                "Page %d: %d cards parsed, %d qualifying so far.",
                page_num,
                len(cards),
                len(results),
            )

            if not self._has_next_page(soup):
                logger.info("Last page reached.")
                break

            time.sleep(self.delay)

        return results

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _fetch(self, url: str, retries: int = 4) -> Optional[BeautifulSoup]:
        for attempt in range(1, retries + 1):
            try:
                resp = self.session.get(url, timeout=30)
                resp.raise_for_status()
                return BeautifulSoup(resp.text, "html.parser")
            except requests.RequestException as exc:
                wait = 2 ** (attempt - 1)
                logger.warning(
                    "Attempt %d/%d failed for %s: %s — retrying in %ds",
                    attempt, retries, url, exc, wait,
                )
                if attempt < retries:
                    time.sleep(wait)
        return None

    def _find_cards(self, soup: BeautifulSoup) -> list:
        """Try several known Allocine card selectors."""
        for selector in (
            "section.section-movie-list .card",
            ".entity-card",
            ".movie-card-theater",
            ".card.entity-card",
            "[class*='entity-card']",
            ".gd-col-left .card",
        ):
            cards = soup.select(selector)
            if cards:
                logger.debug("Found %d cards with selector: %s", len(cards), selector)
                return cards
        return []

    def _parse_card(self, card) -> Optional[Movie]:
        try:
            # Title + link
            title_tag = card.select_one(
                "a.meta-title-link, .entity-title a, h2.meta-title a, "
                "h3.meta-title a, .card-title a"
            )
            if not title_tag:
                return None
            title = title_tag.get_text(strip=True)
            href = title_tag.get("href", "")
            link = (BASE_URL + href) if href.startswith("/") else href

            # Press rating
            press_rating = self._extract_press_rating(card)
            if press_rating is None:
                return None

            # Optional metadata
            movie = Movie(title=title, press_rating=press_rating, link=link)
            movie.directors = self._text(card, ".meta-director, [data-testid='director'] a")
            movie.cast = self._text(card, ".meta-cast-actor-names, [data-testid='cast'] a")
            movie.genres = self._text(card, ".meta-body-item.meta-body-info, .genre")
            movie.release_date = self._text(card, ".meta-release-date, .date-release, .meta-body-item.meta-body-direction")
            movie.synopsis = self._text(card, ".synopsis, .entity-synopsis, .card-body")

            return movie

        except Exception as exc:
            logger.debug("Error parsing card: %s", exc, exc_info=True)
            return None

    def _extract_press_rating(self, card) -> Optional[float]:
        """
        Allocine shows two rating blocks per card (press + users).
        The press block contains the word 'Presse'.
        """
        # Strategy 1: look for a rating-item that says "Presse"
        for item in card.select(".rating-item, .rating-mscore, .stareval"):
            label = item.select_one(
                ".rating-title, .rating-type, .label, span[class*='label']"
            )
            if label and "presse" in label.get_text(strip=True).lower():
                note_tag = item.select_one(
                    ".stareval-note, .rating-note, span[class*='note']"
                )
                if note_tag:
                    return _parse_rating(note_tag.get_text(strip=True))

        # Strategy 2: data attributes (modern React-rendered pages)
        for el in card.select("[data-rating-type='press'], [class*='press-rating']"):
            rating = el.get("data-rating") or el.get_text(strip=True)
            parsed = _parse_rating(rating)
            if parsed is not None:
                return parsed

        # Strategy 3: aria-label on star widgets
        for el in card.select("[aria-label*='presse'], [aria-label*='Presse']"):
            match = re.search(r"([\d,\.]+)\s*/\s*5", el.get("aria-label", ""))
            if match:
                return _parse_rating(match.group(1))

        return None

    @staticmethod
    def _text(tag, selector: str) -> str:
        el = tag.select_one(selector)
        return el.get_text(separator=", ", strip=True) if el else ""

    def _has_next_page(self, soup: BeautifulSoup) -> bool:
        return bool(
            soup.select_one(
                "a.pagination-item-next, a[rel='next'], "
                ".pager-next a, [class*='pagination'] a[aria-label='Suivant']"
            )
        )
