import csv
import os
import sqlite3
from pathlib import Path

DB_PATH = Path("mirna.db")
CSV_PATH = Path("data.csv")
SNP_CSV_PATH = Path("data/snp_in_mature.csv")

TABLE_MAIN = "mirna_records"
TABLE_FTS = "mirna_fts"

_SNP_LOOKUP_CACHE = None


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


def normalize_mirna_id(mirna_id: str):
    value = mirna_id.strip()
    if value.startswith("hsa-"):
        return value[4:]
    return value


def load_snp_in_mature():
    global _SNP_LOOKUP_CACHE

    if _SNP_LOOKUP_CACHE is not None:
        return _SNP_LOOKUP_CACHE

    lookup = {}
    if not SNP_CSV_PATH.exists():
        _SNP_LOOKUP_CACHE = lookup
        return lookup

    with open(SNP_CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            mirna = normalize_mirna_id(row.get("miRNA", ""))
            if not mirna:
                continue

            try:
                pos_in_mature = int(row.get("pos_in_mature", ""))
            except ValueError:
                continue

            lookup.setdefault(mirna, []).append({
                "snp_id": row.get("SNP_id", "").strip(),
                "ref": row.get("Ref", "").strip(),
                "alt": row.get("Alt", "").strip(),
                "pos_in_mature": pos_in_mature,
                "functional_region": row.get("functional_region", "").strip(),
                "chr": row.get("Chr", "").strip(),
                "position": row.get("Position", "").strip(),
                "g": row.get("G", "").strip(),
            })

    for snps in lookup.values():
        snps.sort(key=lambda item: (
            item["pos_in_mature"],
            item["snp_id"],
            item["alt"],
        ))

    _SNP_LOOKUP_CACHE = dict(sorted(lookup.items()))
    return _SNP_LOOKUP_CACHE


def get_all_snp_in_mature():
    return load_snp_in_mature()


def get_snp_in_mature_by_mirna(mirna_id: str):
    lookup = load_snp_in_mature()
    return lookup.get(normalize_mirna_id(mirna_id), [])


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
