import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def create(url="https://example.com/page", alias=None):
    return client.post("/api/links", json={"url": url, "alias": alias})


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_create_redirect_and_count_clicks():
    r = create()
    assert r.status_code == 201
    code = r.json()["code"]

    r = client.get(f"/{code}", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers["location"] == "https://example.com/page"

    assert client.get(f"/api/links/{code}").json()["clicks"] == 1


def test_custom_alias_and_conflict():
    assert create(alias="mon-lien").json()["code"] == "mon-lien"
    assert create(alias="mon-lien").status_code == 409


def test_invalid_alias_and_url():
    assert create(alias="a b").status_code == 422
    assert create(alias="api").status_code == 422
    assert create(url="pas-une-url").status_code == 422


def test_list_and_delete():
    code = create(alias="a-supprimer").json()["code"]
    assert any(link["code"] == code for link in client.get("/api/links").json())

    assert client.delete(f"/api/links/{code}").status_code == 204
    assert client.delete(f"/api/links/{code}").status_code == 404
    assert client.get(f"/{code}", follow_redirects=False).status_code == 404


def test_global_stats():
    code = create(alias="populaire").json()["code"]
    client.get(f"/{code}", follow_redirects=False)
    client.get(f"/{code}", follow_redirects=False)

    stats = client.get("/api/stats").json()
    assert stats["total_links"] >= 1
    assert stats["total_clicks"] >= 2
    assert stats["top"][0]["clicks"] >= 2