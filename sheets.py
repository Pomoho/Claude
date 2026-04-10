"""
Google Sheets client — writes / refreshes the Allociné movie list.

Authentication: service account JSON stored in the environment variable
GOOGLE_CREDENTIALS_JSON.  The service account must have "Editor" access
to the target spreadsheet.
"""

import json
import logging
from datetime import datetime
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

COLUMN_HEADERS = [
    "Titre",
    "Note Presse (/5)",
    "Réalisateur(s)",
    "Casting",
    "Genre(s)",
    "Date de sortie",
    "Lien Allociné",
    "Mis à jour le",
]

# Background colour for the header row (dark slate)
_HEADER_BG = {"red": 0.18, "green": 0.18, "blue": 0.18}


class GoogleSheetsClient:
    def __init__(self, credentials_json: str, spreadsheet_id: str):
        creds_info = json.loads(credentials_json)
        credentials = service_account.Credentials.from_service_account_info(
            creds_info, scopes=_SCOPES
        )
        self.service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
        self.spreadsheet_id = spreadsheet_id

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update_movies(self, movies: list, sheet_name: str = "Films Allociné") -> None:
        """Replace the sheet contents with the current movie list."""
        sheet_id = self._ensure_sheet(sheet_name)
        now = datetime.now().strftime("%d/%m/%Y %H:%M")

        rows = [COLUMN_HEADERS]
        for movie in movies:
            rows.append(movie.to_row(now))

        self._clear(sheet_name)
        self._write(sheet_name, rows)
        self._format_header(sheet_id)
        self._auto_resize(sheet_id, num_columns=len(COLUMN_HEADERS))

        logger.info(
            "Wrote %d movie(s) to sheet '%s' (spreadsheet: %s)",
            len(movies),
            sheet_name,
            self.spreadsheet_id,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_sheet(self, sheet_name: str) -> int:
        """Return the sheet ID, creating the tab if it doesn't exist."""
        metadata = (
            self.service.spreadsheets()
            .get(spreadsheetId=self.spreadsheet_id)
            .execute()
        )
        for sheet in metadata.get("sheets", []):
            props = sheet["properties"]
            if props["title"] == sheet_name:
                return props["sheetId"]

        # Create the sheet tab
        body = {"requests": [{"addSheet": {"properties": {"title": sheet_name}}}]}
        resp = (
            self.service.spreadsheets()
            .batchUpdate(spreadsheetId=self.spreadsheet_id, body=body)
            .execute()
        )
        sheet_id: int = resp["replies"][0]["addSheet"]["properties"]["sheetId"]
        logger.info("Created new sheet tab: %s (id=%d)", sheet_name, sheet_id)
        return sheet_id

    def _clear(self, sheet_name: str) -> None:
        self.service.spreadsheets().values().clear(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{sheet_name}'!A:Z",
        ).execute()

    def _write(self, sheet_name: str, rows: list) -> None:
        self.service.spreadsheets().values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{sheet_name}'!A1",
            valueInputOption="USER_ENTERED",
            body={"values": rows},
        ).execute()

    def _format_header(self, sheet_id: int) -> None:
        """Bold + dark background on row 1, freeze it."""
        requests = [
            {
                "repeatCell": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "textFormat": {
                                "bold": True,
                                "foregroundColor": {"red": 1, "green": 1, "blue": 1},
                            },
                            "backgroundColor": _HEADER_BG,
                            "horizontalAlignment": "CENTER",
                        }
                    },
                    "fields": "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)",
                }
            },
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": sheet_id,
                        "gridProperties": {"frozenRowCount": 1},
                    },
                    "fields": "gridProperties.frozenRowCount",
                }
            },
        ]
        self.service.spreadsheets().batchUpdate(
            spreadsheetId=self.spreadsheet_id,
            body={"requests": requests},
        ).execute()

    def _auto_resize(self, sheet_id: int, num_columns: int) -> None:
        """Auto-resize all columns to fit their content."""
        self.service.spreadsheets().batchUpdate(
            spreadsheetId=self.spreadsheet_id,
            body={
                "requests": [
                    {
                        "autoResizeDimensions": {
                            "dimensions": {
                                "sheetId": sheet_id,
                                "dimension": "COLUMNS",
                                "startIndex": 0,
                                "endIndex": num_columns,
                            }
                        }
                    }
                ]
            },
        ).execute()
