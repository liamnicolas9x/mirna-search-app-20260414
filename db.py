import csv
import os
import sqlite3
from pathlib import Path

DB_PATH = Path("mirna.db")
CSV_PATH = Path("data.csv")

TABLE_MAIN = "mirna_records"
TABLE_FTS = "mirna_fts"


def normalize(name: str):
    return (
        name.strip()
        .lower()
        .replace(" ", "_")
        .replace("+", "_")
        .replace("-", "_")
        .replace("?", "")
        .replace("/", "_")
    )


def quote(name: str):
    return f'"{name}"'


def is_rna(seq: str):
    s = seq.upper()
    return all(c in "AUGC" for c in s) and len(s) >= 5


# ===== BUILD DATABASE =====
def build_database():
    print("========== BUILD DATABASE ==========")

    if not CSV_PATH.exists():
        raise FileNotFoundError("❌ data.csv not found")

    if DB_PATH.exists():
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames

        cols = [normalize(h) for h in headers]

        col_sql = ", ".join(
            f'{quote(c)} TEXT' + (" PRIMARY KEY" if c == "mirbase_id" else "")
            for c in cols
        )
        cur.execute(f'CREATE TABLE {TABLE_MAIN} ({col_sql})')

        rows = []
        for row in reader:
            values = [row[h].strip() if row[h] else None for h in headers]
            rows.append(values)

        placeholders = ", ".join("?" for _ in cols)
        cur.executemany(
            f'INSERT INTO {TABLE_MAIN} VALUES ({placeholders})',
            rows
        )

    # ===== FTS =====
    fts_cols = ", ".join([quote(c) for c in cols])

    cur.execute(f"""
        CREATE VIRTUAL TABLE {TABLE_FTS}
        USING fts5({fts_cols})
    """)

    col_list = ", ".join([quote(c) for c in cols])

    cur.execute(f"""
        INSERT INTO {TABLE_FTS}
        SELECT {col_list}
        FROM {TABLE_MAIN}
    """)

    conn.commit()
    conn.close()

    print("✅ Database + FTS ready")


# ===== SEARCH =====
def search_records(query: str, limit: int = 50):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    q_lower = query.lower()

    # 🔥 ===== CASE 1: RNA TAIL SEARCH =====
    if is_rna(query):
        rows = cur.execute(f"""
            SELECT *,
            (
                CASE
                    WHEN lower(mature_sequence) LIKE ? THEN 0
                    ELSE 1
                END
            ) as rank
            FROM {TABLE_MAIN}
            WHERE lower(mature_sequence) LIKE ?
            ORDER BY rank
            LIMIT ?
        """, (
            f"%{q_lower}",
            f"%{q_lower}",
            limit
        )).fetchall()

        conn.close()
        return [dict(r) for r in rows]

    # 🔥 ===== CASE 2: NORMAL SEARCH (FTS + RANK) =====
    tokens = query.strip().split()
    fts_query = " ".join([f"{t}*" for t in tokens])

    try:
        rows = cur.execute(f"""
            SELECT *,
            (
                CASE
                    WHEN lower(mirbase_id) LIKE ? THEN 0
                    WHEN lower(mirbase_accession) LIKE ? THEN 1
                    WHEN lower(mature_sequence) LIKE ? THEN 2
                    WHEN lower(seed_m8) LIKE ? THEN 3
                    WHEN lower(mir_family) LIKE ? THEN 4
                    ELSE 5
                END
            ) as rank
            FROM {TABLE_FTS}
            WHERE {TABLE_FTS} MATCH ?
            ORDER BY rank, mirbase_id
            LIMIT ?
        """, (
            f"%{q_lower}%",
            f"%{q_lower}%",
            f"%{q_lower}%",
            f"%{q_lower}%",
            f"%{q_lower}%",
            fts_query,
            limit
        )).fetchall()

    except:
        q = f"%{q_lower}%"
        cols = get_columns(cur)

        where = " OR ".join([f'lower("{c}") LIKE ?' for c in cols])

        rows = cur.execute(f"""
            SELECT *,
            (
                CASE
                    WHEN lower(mirbase_id) LIKE ? THEN 0
                    WHEN lower(mirbase_accession) LIKE ? THEN 1
                    WHEN lower(mature_sequence) LIKE ? THEN 2
                    WHEN lower(seed_m8) LIKE ? THEN 3
                    WHEN lower(mir_family) LIKE ? THEN 4
                    ELSE 5
                END
            ) as rank
            FROM {TABLE_MAIN}
            WHERE {where}
            ORDER BY rank, mirbase_id
            LIMIT ?
        """,
        (*([q] * len(cols)), q, q, q, q, q, limit)
        ).fetchall()

    conn.close()
    return [dict(r) for r in rows]


def get_columns(cur):
    rows = cur.execute(f"PRAGMA table_info({TABLE_MAIN})").fetchall()
    return [r[1] for r in rows]


# ===== GET BY ID =====
def get_record_by_id(mirna_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    row = cur.execute(
        f'SELECT * FROM {TABLE_MAIN} WHERE "mirbase_id"=?',
        (mirna_id,),
    ).fetchone()

    conn.close()
    return dict(row) if row else None


# ===== MAIN =====
if __name__ == "__main__":
    build_database()