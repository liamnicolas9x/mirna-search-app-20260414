import csv
import json

input_file = "data.csv"
output_file = "frontend/src/data/light_db.json"

def normalize_key(k):
    k = k.strip().lower()

    # 🔥 map chuẩn theo CSV của bạn
    if "mirbase id" in k:
        return "mirbase_id"
    if "mirbase a" in k or "accession" in k:
        return "mirbase_accession"
    if "mature" in k:
        return "mature_sequence"
    if "seed" in k:
        return "seed_m8"
    if "family" in k:
        return "mir_family"

    return k.replace(" ", "_").replace("-", "_")

data = []

with open(input_file, "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)

    for row in reader:
        clean_row = {
            normalize_key(k): (v.strip() if v else None)
            for k, v in row.items()
        }
        data.append(clean_row)

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(f"✅ JSON built: {len(data)} records")