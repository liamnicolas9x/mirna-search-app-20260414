import sqlite3
import tempfile
from pathlib import Path

db_path = Path(tempfile.gettempdir()) / "mirna-search" / "mirna.db"

print("DB PATH:", db_path)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT mirbase_id, mirbase_accession FROM mirna_records WHERE mirbase_id='miR-500b-5p'")
print(cur.fetchall())