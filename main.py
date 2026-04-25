import logging
import os

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from db import (
    get_all_snp_in_mature,
    get_record_by_id,
    get_snp_in_mature_by_mirna,
    load_snp_in_mature,
    search_records,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="microRNA Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔥 preload DB (fix lag lần đầu)
@app.on_event("startup")
def startup():
    try:
        search_records("miR")
        print("✅ DB warmed up")
    except Exception as e:
        print("Warmup failed:", e)

    try:
        load_snp_in_mature()
        print("SNP database warmed up")
    except Exception as e:
        print("SNP warmup failed:", e)

@app.get("/health", response_class=PlainTextResponse)
async def healthcheck() -> str:
    return "OK"

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

@app.get("/mirna/{mirna_id}")
async def get_mirna(mirna_id: str):
    record = get_record_by_id(mirna_id.strip())

    if record is None:
        raise HTTPException(status_code=404, detail="microRNA not found")

    return record

@app.get("/snp-in-mature")
async def get_snp_in_mature():
    lookup = get_all_snp_in_mature()

    return {
        "count_mirna": len(lookup),
        "count_snp": sum(len(snps) for snps in lookup.values()),
        "results": lookup,
    }

@app.get("/snp-in-mature/{mirna_id}")
async def get_snp_in_mature_for_mirna(mirna_id: str):
    snps = get_snp_in_mature_by_mirna(mirna_id.strip())

    return {
        "mirna_id": mirna_id,
        "count": len(snps),
        "results": snps,
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
