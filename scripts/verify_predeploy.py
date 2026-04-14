import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import httpx

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
DIST_ASSETS = FRONTEND_DIR / "dist" / "assets"
BACKEND_URL = "http://127.0.0.1:8000"
PRODUCTION_API_URL = "https://mirna-search-api-20260414.onrender.com"
LOCAL_API_URL = "http://localhost:8000"


def log(message: str) -> None:
    print(f"[verify] {message}")


def run(command: list[str], cwd: Path) -> subprocess.CompletedProcess:
    log(f"Running: {' '.join(command)}")
    return subprocess.run(command, cwd=cwd, check=True)


def find_first_asset() -> Path:
    assets = sorted(DIST_ASSETS.glob("*.js"))
    if not assets:
        raise RuntimeError("No built frontend asset found in dist/assets")
    return assets[0]


def assert_in_bundle(expected: str, asset_path: Path) -> None:
    content = asset_path.read_text(encoding="utf-8")
    if expected not in content:
        raise RuntimeError(f"Expected '{expected}' in built asset {asset_path.name}")


def assert_not_in_bundle(unexpected: str, asset_path: Path) -> None:
    content = asset_path.read_text(encoding="utf-8")
    if unexpected in content:
        raise RuntimeError(f"Unexpected '{unexpected}' found in built asset {asset_path.name}")


def wait_for_backend() -> None:
    deadline = time.time() + 60
    last_error: Optional[Exception] = None
    while time.time() < deadline:
        try:
            response = httpx.get(f"{BACKEND_URL}/health", timeout=5.0)
            if response.status_code == 200 and response.text == "OK":
                return
        except Exception as exc:  # pragma: no cover - transient startup
            last_error = exc
        time.sleep(1)
    raise RuntimeError("Backend did not become healthy in time") from last_error


def verify_backend() -> None:
    health = httpx.get(f"{BACKEND_URL}/health", timeout=10.0)
    if health.status_code != 200 or health.text != "OK":
        raise RuntimeError("/health did not return OK")

    search = httpx.get(f"{BACKEND_URL}/search", params={"q": "let"}, timeout=10.0)
    search.raise_for_status()
    payload = search.json()
    if payload.get("count", 0) <= 0 or not payload.get("results"):
        raise RuntimeError("/search did not return valid results")


def verify_frontend_builds() -> None:
    run(["npm.cmd", "run", "build"], FRONTEND_DIR)
    prod_asset = find_first_asset()
    assert_in_bundle(PRODUCTION_API_URL, prod_asset)
    assert_not_in_bundle(LOCAL_API_URL, prod_asset)

    run(["npm.cmd", "run", "build", "--", "--mode", "development"], FRONTEND_DIR)
    dev_asset = find_first_asset()
    assert_in_bundle(LOCAL_API_URL, dev_asset)


def main() -> int:
    env = os.environ.copy()
    env["PORT"] = "8000"

    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_backend()
        verify_backend()
        verify_frontend_builds()
        log("All predeploy checks passed.")
        return 0
    finally:
        backend.terminate()
        try:
            backend.wait(timeout=10)
        except subprocess.TimeoutExpired:
            backend.kill()


if __name__ == "__main__":
    raise SystemExit(main())
