import csv
import logging
import os
import sqlite3
import tempfile
from threading import Lock
from pathlib import Path
from typing import Any, Optional

DEFAULT_DB_DIR = Path(os.getenv("MIRNA_DB_DIR", str(Path(tempfile.gettempdir()) / "mirna-search")))
DEFAULT_DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(os.getenv("MIRNA_DB_PATH", str(DEFAULT_DB_DIR / "mirna.db")))
CSV_PATH = Path("data.csv")
TABLE_NAME = "mirna_records"
IMPORTANT_COLUMNS = [
    "mirbase_id",
    "mirbase_accession",
    "mature_sequence",
    "seed_m8",
    "mir_family",
]
ENCODINGS = ("utf-8-sig", "utf-8", "cp1252", "latin-1")
_INITIALIZATION_LOCK = Lock()
_INITIALIZED = False


def normalize_column_name(name: str) -> str:
    normalized = name.strip().lower().replace(" ", "_")
    normalized = normalized.replace("+", "_")
    normalized = "".join(char if char.isalnum() or char == "_" else "_" for char in normalized)
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_")


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _table_exists(connection: sqlite3.Connection) -> bool:
    row = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (TABLE_NAME,),
    ).fetchone()
    return row is not None


def _table_has_expected_columns(connection: sqlite3.Connection) -> bool:
    if not _table_exists(connection):
        return False
    columns = {
        row[1] for row in connection.execute(f'PRAGMA table_info("{TABLE_NAME}")').fetchall()
    }
    return all(column in columns for column in IMPORTANT_COLUMNS)


def _open_csv_reader() -> tuple[csv.DictReader, Any]:
    last_error: Optional[Exception] = None
    for encoding in ENCODINGS:
        try:
            handle = CSV_PATH.open("r", encoding=encoding, newline="")
            return csv.DictReader(handle), handle
        except UnicodeDecodeError as exc:
            last_error = exc
    raise RuntimeError(f"Unable to decode {CSV_PATH}") from last_error


def _normalize_row(row: dict[str, Optional[str]], headers: list[str]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for header in headers:
        raw_value = row.get(header)
        value = raw_value.strip() if isinstance(raw_value, str) else raw_value
        normalized[normalize_column_name(header)] = value or None
    return normalized


def initialize_database() -> None:
    global _INITIALIZED

    if _INITIALIZED:
        return

    with _INITIALIZATION_LOCK:
        if _INITIALIZED:
            return

        if not CSV_PATH.exists():
            raise FileNotFoundError(f"CSV source not found: {CSV_PATH}")

        connection = get_connection()
        try:
            if DB_PATH.exists() and _table_has_expected_columns(connection):
                logging.info("SQLite database already exists at %s", DB_PATH)
                _INITIALIZED = True
                return

            connection.execute(f'DROP TABLE IF EXISTS "{TABLE_NAME}"')
            connection.execute(f'DROP INDEX IF EXISTS "idx_{TABLE_NAME}_mirbase_id"')
            connection.execute(f'DROP INDEX IF EXISTS "idx_{TABLE_NAME}_mir_family"')
            connection.commit()
        finally:
            connection.close()

        reader, handle = _open_csv_reader()
        with handle:
            original_headers = reader.fieldnames or []
            normalized_headers = [normalize_column_name(header) for header in original_headers]
            if "mirbase_id" not in normalized_headers:
                raise RuntimeError("Expected 'mirbase_id' column in CSV data")

            connection = get_connection()
            try:
                columns_sql = ", ".join(
                    f'"{column}" TEXT' + (" PRIMARY KEY" if column == "mirbase_id" else "")
                    for column in normalized_headers
                )
                connection.execute(f'CREATE TABLE "{TABLE_NAME}" ({columns_sql})')

                placeholders = ", ".join("?" for _ in normalized_headers)
                quoted_columns = ", ".join(f'"{column}"' for column in normalized_headers)
                insert_sql = (
                    f'INSERT OR REPLACE INTO "{TABLE_NAME}" ({quoted_columns}) VALUES ({placeholders})'
                )

                rows_to_insert: list[tuple[Any, ...]] = []
                for row in reader:
                    normalized_row = _normalize_row(row, original_headers)
                    rows_to_insert.append(tuple(normalized_row[column] for column in normalized_headers))

                connection.executemany(insert_sql, rows_to_insert)
                connection.execute(
                    f'CREATE INDEX "idx_{TABLE_NAME}_mirbase_id" ON "{TABLE_NAME}"("mirbase_id")'
                )
                connection.execute(
                    f'CREATE INDEX "idx_{TABLE_NAME}_mir_family" ON "{TABLE_NAME}"("mir_family")'
                )
                connection.commit()
                logging.info("Loaded %s rows into %s", len(rows_to_insert), DB_PATH)
                _INITIALIZED = True
            finally:
                connection.close()


def search_records(query: str, limit: int = 50) -> list[dict[str, Any]]:
    initialize_database()
    safe_limit = max(1, min(limit, 100))
    search_term = f"%{query.lower()}%"
    sql = f"""
        SELECT * FROM "{TABLE_NAME}"
        WHERE lower(coalesce(mirbase_id, '')) LIKE ?
           OR lower(coalesce(mirbase_accession, '')) LIKE ?
           OR lower(coalesce(mature_sequence, '')) LIKE ?
           OR lower(coalesce(seed_m8, '')) LIKE ?
           OR lower(coalesce(mir_family, '')) LIKE ?
        ORDER BY mirbase_id COLLATE NOCASE
        LIMIT ?
    """
    with get_connection() as connection:
        rows = connection.execute(sql, (search_term,) * 5 + (safe_limit,)).fetchall()
    return [dict(row) for row in rows]


def get_record_by_id(mirna_id: str) -> Optional[dict[str, Any]]:
    initialize_database()
    sql = f"""
        SELECT * FROM "{TABLE_NAME}"
        WHERE lower(mirbase_id) = lower(?)
        LIMIT 1
    """
    with get_connection() as connection:
        row = connection.execute(sql, (mirna_id,)).fetchone()
    return dict(row) if row else None
