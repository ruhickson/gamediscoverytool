"""Points for the Disclosure Day 3D chart.

Each point is a game released from 1 January 2020 through 29 October 2026
with more than 10 positive reviews. The tag score is the average gap, in
percentage points, between how often that game's tags appear on disclosed
games and on games with no disclosure, among games above the same cutoff.
List price is the earliest initial price, in bands of one euro.
"""
import json
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]
OMITTED = {"Singleplayer", "Indie", "Action", "Adventure", "2D", "3D", "Casual"}
MIN_TAG_GAMES = 40

env = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    env[key.strip()] = value.strip().strip('"').strip("'")

conn = psycopg2.connect(env["SUPABASE_CONNECTION_STRING"])
cur = conn.cursor(name="profile3d")
cur.itersize = 20000
cur.execute(
    """
    WITH priced AS (
      SELECT DISTINCT ON (app_id) app_id, initial_price
      FROM price_history
      WHERE initial_price IS NOT NULL AND initial_price <> ''
      ORDER BY app_id, timestamp ASC
    )
    SELECT g.app_id, g.name, g.made_with_ai, g.total_positive, g.is_free,
           g.price_overview, t.tag, p.initial_price
    FROM games g
    LEFT JOIN game_tags t ON t.app_id = g.app_id
    LEFT JOIN priced p ON p.app_id = g.app_id
    WHERE g.type = 'game'
      AND g.release_date_actual >= DATE '2020-01-01'
      AND g.release_date_actual <= DATE '2026-10-29'
      AND g.total_positive > 10
    """
)

games = {}
for app_id, name, made_with_ai, positive, is_free, overview, tag, initial in cur:
    slot = games.get(app_id)
    if slot is None:
        slot = {
            "name": name or str(app_id),
            "ai": bool(made_with_ai),
            "positive": int(positive),
            "free": bool(is_free),
            "overview": overview,
            "initial": initial,
            "tags": [],
        }
        games[app_id] = slot
    if tag and tag not in OMITTED and tag not in slot["tags"]:
        slot["tags"].append(tag)
cur.close()
conn.close()

ai_total = sum(1 for game in games.values() if game["ai"])
other_total = sum(1 for game in games.values() if not game["ai"])
counts = {}
for game in games.values():
    for tag in game["tags"]:
        slot = counts.setdefault(tag, [0, 0])
        slot[0 if game["ai"] else 1] += 1

scores = {}
for tag, (ai_n, other_n) in counts.items():
    if ai_n + other_n < MIN_TAG_GAMES or not ai_total or not other_total:
        continue
    gap = (ai_n / ai_total - other_n / other_total) * 100
    scores[tag] = round(gap, 1)

def cents_of(game):
    raw = game["initial"]
    if raw not in (None, ""):
        try:
            cents = int(float(raw))
        except (TypeError, ValueError):
            cents = None
        else:
            if cents >= 0:
                return cents
    text = game["overview"]
    if text:
        try:
            parsed = json.loads(text)
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = None
        if isinstance(parsed, dict) and parsed.get("initial") is not None:
            try:
                cents = int(float(parsed["initial"]))
            except (TypeError, ValueError):
                cents = None
            else:
                if cents >= 0:
                    return cents
    if game["free"]:
        return 0
    return None

def band_of(cents):
    euros = cents / 100
    if euros < 1:
        return 0
    if euros >= 60:
        return 60
    return int(euros)

ai = []
other = []
missing_price = 0
for game in games.values():
    used = [tag for tag in game["tags"] if tag in scores]
    if game["positive"] <= 10 or not used:
        continue
    cents = cents_of(game)
    if cents is None:
        missing_price += 1
        continue
    score = round(sum(scores[tag] for tag in used) / len(used), 1)
    point = [game["positive"], score, band_of(cents), game["name"]]
    (ai if game["ai"] else other).append(point)

ai.sort(key=lambda point: point[0], reverse=True)
other.sort(key=lambda point: point[0], reverse=True)
payload = {
    "asOf": "2026-10-29",
    "aiGames": ai_total,
    "otherGames": other_total,
    "scoredTags": len(scores),
    "missingPrice": missing_price,
    "ai": ai,
    "other": other,
}
out = ROOT / "public" / "blog" / "critical-mass-profile3d.json"
out.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
print(
    f"ai {len(ai)} other {len(other)} tagged {ai_total}+{other_total} "
    f"tags {len(scores)} missing {missing_price} bytes {out.stat().st_size}"
)
if "Simulation" in scores:
    print("simulation", scores["Simulation"])
