import csv
import os
import sqlite3
from pathlib import Path

# ===== CONFIG =====
DB_PATH = Path("mirna.db")   # 👉 luôn nằm trong project
CSV_PATH = Path("data.csv")
TABLE_NAME = "mirna_records"

# ===== UTILS =====
def normalize_column_name(name: str) -> str:
    return (
        name.strip()
        .lower()
        .replace(" ", "_")
        .replace("+", "_")
    )

# ===== BUILD DATABASE =====
def build_database():
    print("========== BUILD DATABASE ==========")
    print("DB PATH :", DB_PATH.resolve())
    print("CSV PATH:", CSV_PATH.resolve())

    if not CSV_PATH.exists():
        raise FileNotFoundError("❌ data.csv not found")

    # 🔥 luôn xóa DB cũ
    if DB_PATH.exists():
        print("Removing old database...")
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # đọc CSV
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames

        if not headers:
            raise RuntimeError("❌ CSV has no headers")

        columns = [normalize_column_name(h) for h in headers]

        if "mirbase_id" not in columns:
            raise RuntimeError("❌ CSV must have mirbase_id column")

        # tạo table
        col_sql = ", ".join(
            f'"{c}" TEXT' + (" PRIMARY KEY" if c == "mirbase_id" else "")
            for c in columns
        )

        cur.execute(f'CREATE TABLE "{TABLE_NAME}" ({col_sql})')

        # insert data
        placeholders = ", ".join("?" for _ in columns)
        insert_sql = f'INSERT INTO "{TABLE_NAME}" VALUES ({placeholders})'

        rows = []
        for row in reader:
            values = [row[h].strip() if row[h] else None for h in headers]
            rows.append(values)

        cur.executemany(insert_sql, rows)

    conn.commit()
    conn.close()

    print(f"✅ Loaded {len(rows)} rows into database")
    print("===================================")


# ===== SEARCH =====
def search_records(query: str, limit: int = 50):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    q = f"%{query.lower()}%"

    sql = f"""
    SELECT * FROM {TABLE_NAME}
    WHERE lower(mirbase_id) LIKE ?
       OR lower(mirbase_accession) LIKE ?
       OR lower(mature_sequence) LIKE ?
       OR lower(seed_m8) LIKE ?
       OR lower(mir_family) LIKE ?
    LIMIT ?
    """

    rows = cur.execute(sql, (q, q, q, q, q, limit)).fetchall()
    conn.close()

    return [dict(r) for r in rows]


# ===== GET BY ID =====
def get_record_by_id(mirna_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    row = cur.execute(
        f"SELECT * FROM {TABLE_NAME} WHERE mirbase_id=?",
        (mirna_id,),
    ).fetchone()

    conn.close()
    return dict(row) if row else None


# ===== MAIN =====
if __name__ == "__main__":
    build_database()