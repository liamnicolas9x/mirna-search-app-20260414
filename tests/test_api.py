def test_healthcheck():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.text == "OK"


def test_search_endpoint():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as client:
        response = client.get("/search", params={"q": "let"})
        data = response.json()
        assert response.status_code == 200
        assert data["count"] > 0
        assert any("let" in (row["mirbase_id"] or "").lower() for row in data["results"])
        assert len(data["results"]) <= 50


def test_mirna_detail_endpoint():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as client:
        response = client.get("/mirna/let-7a-5p")
        assert response.status_code == 200
        payload = response.json()
        assert payload["mirbase_id"] == "let-7a-5p"
        assert payload["mir_family"] == "let-7-5p/98-5p"


def test_unknown_mirna_returns_404():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as client:
        response = client.get("/mirna/not-a-real-id")
        assert response.status_code == 404
