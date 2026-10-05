import os
import re
import secrets
import sqlite3
import string
from typing import Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, HttpUrl

DB_PATH = os.getenv("DB_PATH", "data/urls.db")
ALPHABET = string.ascii_letters + string.digits
ALIAS_RE = re.compile(r"^[A-Za-z0-9_-]{3,32}$")
RESERVED = {"api", "static", "health", "docs", "redoc", "openapi.json"}

app = FastAPI(title="URL Shortener API")


class LinkIn(BaseModel):
    url: HttpUrl
    alias: Optional[str] = None


def get_db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE IF NOT EXISTS urls ("
        "code TEXT PRIMARY KEY, url TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 0)"
    )
    columns = [r["name"] for r in conn.execute("PRAGMA table_info(urls)")]
    if "created_at" not in columns:
        conn.execute("ALTER TABLE urls ADD COLUMN created_at TEXT")
    return conn


def row_to_dict(row):
    return {
        "code": row["code"],
        "url": row["url"],
        "clicks": row["clicks"],
        "created_at": row["created_at"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/links", status_code=201)
def create_link(payload: LinkIn):
    alias = (payload.alias or "").strip()
    if alias and (not ALIAS_RE.match(alias) or alias.lower() in RESERVED):
        raise HTTPException(
            status_code=422,
            detail="Alias invalide : 3 à 32 caractères (lettres, chiffres, - et _)",
        )

    with get_db() as db:
        if alias:
            code = alias
            if db.execute("SELECT 1 FROM urls WHERE code = ?", (code,)).fetchone():
                raise HTTPException(status_code=409, detail="Cet alias est déjà pris")
        else:
            while True:
                code = "".join(secrets.choice(ALPHABET) for _ in range(6))
                if not db.execute("SELECT 1 FROM urls WHERE code = ?", (code,)).fetchone():
                    break
        db.execute(
            "INSERT INTO urls (code, url, created_at) VALUES (?, ?, datetime('now'))",
            (code, str(payload.url)),
        )
        row = db.execute("SELECT * FROM urls WHERE code = ?", (code,)).fetchone()
    return row_to_dict(row)


@app.get("/api/links")
def list_links():
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM urls ORDER BY created_at DESC, rowid DESC LIMIT 50"
        ).fetchall()
    return [row_to_dict(r) for r in rows]


@app.get("/api/links/{code}")
def get_link(code: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM urls WHERE code = ?", (code,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Code inconnu")
    return row_to_dict(row)


@app.delete("/api/links/{code}", status_code=204)
def delete_link(code: str):
    with get_db() as db:
        cur = db.execute("DELETE FROM urls WHERE code = ?", (code,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Code inconnu")
    return Response(status_code=204)


@app.get("/api/stats")
def global_stats():
    with get_db() as db:
        totals = db.execute(
            "SELECT COUNT(*) AS links, COALESCE(SUM(clicks), 0) AS clicks FROM urls"
        ).fetchone()
        top = db.execute(
            "SELECT code, url, clicks FROM urls ORDER BY clicks DESC LIMIT 3"
        ).fetchall()
    return {
        "total_links": totals["links"],
        "total_clicks": totals["clicks"],
        "top": [dict(r) for r in top],
    }


@app.get("/{code}")
def redirect(code: str):
    with get_db() as db:
        row = db.execute("SELECT url FROM urls WHERE code = ?", (code,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Code inconnu")
        db.execute("UPDATE urls SET clicks = clicks + 1 WHERE code = ?", (code,))
    return RedirectResponse(row["url"], status_code=307)