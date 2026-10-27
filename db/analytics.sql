-- Product analytics for the Game Discovery Tool.
--
-- Run this once against the Postgres database that should store analytics.
-- It creates three tables:
--   analytics_users     one anonymous browser, kept in localStorage
--   analytics_sessions  one visit, kept in sessionStorage (a new row after 30 minutes idle)
--   analytics_events    one action: a page, a click, a tab change, or a search
--
-- The app does not create these tables itself. Point the Netlify function at the
-- database with ANALYTICS_DATABASE_URL (a Postgres connection string). DATABASE_URL
-- is used when ANALYTICS_DATABASE_URL is unset.
--
-- `product` separates the tools:
--   find_a_game   Find a Game for Me (/find)
--   diiig         DIIIG (/diiig)
--   recommender   Recommender (/recommender)
--   site          every other page
--
-- Search parameters live in analytics_events.properties (jsonb), not in extra columns,
-- so a new filter does not need a new migration. Expected event_name values:
--   page_view            route change, including the query string
--   click                a click on a link, button, tab, field, or the DIIIG canvas
--   search               a Find a Game or DIIIG query; product says which one
--   dig_choice           one DIIIG choice, including the effect that was applied
--   dig_box_tap          one counted tap on the DIIIG box
--   recommender_query    the text typed into the Recommender game search
--   recommender_search   the game that was compared, plus the comparison settings

CREATE TABLE IF NOT EXISTS analytics_users (
  id uuid PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  locale text
);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES analytics_users (id),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  landing_path text,
  referrer text
);

CREATE INDEX IF NOT EXISTS analytics_sessions_user_idx
  ON analytics_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES analytics_users (id),
  session_id uuid NOT NULL REFERENCES analytics_sessions (id),
  product text NOT NULL CHECK (product IN ('site', 'find_a_game', 'diiig', 'recommender')),
  event_name text NOT NULL,
  path text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx
  ON analytics_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_product_name_idx
  ON analytics_events (product, event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_session_idx
  ON analytics_events (session_id, occurred_at);

-- Recommender game names are queried often enough to index on their own.
CREATE INDEX IF NOT EXISTS analytics_events_recommender_game_idx
  ON analytics_events ((properties->>'gameName'))
  WHERE product = 'recommender'
    AND event_name IN ('recommender_query', 'recommender_search');

-- Find a Game searches, with every parameter that was sent.
-- SELECT occurred_at, properties
-- FROM analytics_events
-- WHERE product = 'find_a_game' AND event_name = 'search'
-- ORDER BY occurred_at DESC;

-- DIIIG searches. The same event_name as Find a Game; product keeps them apart.
-- SELECT occurred_at,
--        properties->>'minDate' AS min_date,
--        properties->>'maxDate' AS max_date,
--        properties->'tags' AS tags,
--        properties->>'scoreLabel' AS score,
--        properties->>'minReviews' AS min_reviews,
--        properties->>'maxReviews' AS max_reviews
-- FROM analytics_events
-- WHERE product = 'diiig' AND event_name = 'search'
-- ORDER BY occurred_at DESC;

-- Games people looked up in the Recommender, and the comparison they ran.
-- SELECT properties->>'gameName' AS game,
--        properties->>'appId' AS app_id,
--        count(*) AS searches
-- FROM analytics_events
-- WHERE product = 'recommender' AND event_name = 'recommender_search'
-- GROUP BY 1, 2
-- ORDER BY searches DESC;
