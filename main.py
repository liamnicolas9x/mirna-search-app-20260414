import logging
import os

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

# ✅ CHỈ import 2 hàm (bỏ initialize_database)
from db import get_record_by_id, search_records

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ❌ KHÔNG dùng lifespan nữa (vì không còn initialize_database)
app = FastAPI(title="microRNA Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== HEALTH =====
@app.get("/health", response_class=PlainTextResponse)
async def healthcheck() -> str:
    return "OK"

# ===== SEARCH =====
@app.get("/search")
async def search(q: str = Query(..., min_length=1), limit: int = Query(50, ge=1, le=100)):
    if not q.strip():
        return {"query": q, "count": 0, "results": []}

    results = search_records(q.strip(), limit)

    return {
        "query": q,
        "count": len(results),
        "results": results,
    }

# ===== GET BY ID =====
@app.get("/mirna/{mirna_id}")
async def get_mirna(mirna_id: str):
    record = get_record_by_id(mirna_id.strip())

    if record is None:
        raise HTTPException(status_code=404, detail="microRNA not found")

    return record

# ===== RUN =====
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port)