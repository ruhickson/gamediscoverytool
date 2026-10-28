-- Product analytics for the Game Discovery Tool.
--
-- Run this in the Supabase SQL editor. Running it again is safe.
-- It creates three tables:
--   analytics_users     one anonymous browser, kept in localStorage
--   analytics_sessions  one visit, kept in sessionStorage (a new row after 30 minutes idle)
--   analytics_events    one action: a page, a click, a tab change, or a search
--
-- The app does not create these tables itself. The Netlify function writes through
-- Supabase using NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
-- Those credentials can call analytics_ingest and nothing else: row security is on,
-- and the anon role has no privileges on the tables. Re-run this file after the
-- first time; the tables are created only if they are missing, and existing rows stay.
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
--   click                a click on a link, button, tab, field, or the DIIIG canvas.
--                      Steam, ITAD, and blog clicks add properties.destination
--                      (steam, itad, or blog). Blog clicks also store properties.slug,
--                      including posts added later. A blog page view does the same.
--   search               a Find a Game or DIIIG query; product says which one
--   dig_choice           one DIIIG choice, including the effect that was applied
--   dig_box_tap          one counted tap on the DIIIG box
--   dig_results          the games a DIIIG search returned, in the order shown
--   recommender_query    the text typed into the Recommender game search
--   recommender_search   the seed game and comparison settings, not the games returned

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

-- Games DIIIG showed, including a short list.
-- SELECT occurred_at,
--        game->>'position' AS position,
--        game->>'name' AS game,
--        game->>'appId' AS app_id
-- FROM analytics_events
-- CROSS JOIN LATERAL jsonb_array_elements(properties->'games') AS game
-- WHERE product = 'diiig' AND event_name = 'dig_results'
-- ORDER BY occurred_at DESC;

-- The anon key reaches the tables only through this function. It runs as the owner,
-- so it can insert while row security still blocks direct reads and writes.
CREATE OR REPLACE FUNCTION analytics_ingest(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
  session_id uuid;
  seen_at timestamptz := now();
  started_at timestamptz := now();
  occurred_at timestamptz;
  event jsonb;
  props jsonb;
  accepted integer := 0;
  product text;
  event_name text;
  uuid_re text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payload' USING ERRCODE = '22023';
  END IF;
  IF payload->'user'->>'id' !~* uuid_re OR payload->'session'->>'id' !~* uuid_re THEN
    RAISE EXCEPTION 'Invalid id' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(payload->'events') <> 'array'
     OR jsonb_array_length(payload->'events') < 1
     OR jsonb_array_length(payload->'events') > 40 THEN
    RAISE EXCEPTION 'Invalid events' USING ERRCODE = '22023';
  END IF;

  user_id := (payload->'user'->>'id')::uuid;
  session_id := (payload->'session'->>'id')::uuid;
  IF payload->'session'->>'startedAt' ~ '^\d{4}-\d{2}-\d{2}T' THEN
    BEGIN
      started_at := (payload->'session'->>'startedAt')::timestamptz;
    EXCEPTION WHEN others THEN
      started_at := seen_at;
    END;
  END IF;

  INSERT INTO analytics_users (id, first_seen_at, last_seen_at, user_agent, locale)
  VALUES (
    user_id,
    seen_at,
    seen_at,
    NULLIF(left(payload->'user'->>'userAgent', 300), ''),
    NULLIF(left(payload->'user'->>'locale', 35), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at,
        user_agent = EXCLUDED.user_agent,
        locale = EXCLUDED.locale;

  INSERT INTO analytics_sessions (id, user_id, started_at, last_seen_at, landing_path, referrer)
  VALUES (
    session_id,
    user_id,
    started_at,
    seen_at,
    NULLIF(left(payload->'session'->>'landingPath', 500), ''),
    NULLIF(left(payload->'session'->>'referrer', 500), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at;

  FOR event IN SELECT value FROM jsonb_array_elements(payload->'events')
  LOOP
    product := left(COALESCE(event->>'product', ''), 32);
    event_name := left(COALESCE(event->>'eventName', ''), 64);
    IF product NOT IN ('site', 'find_a_game', 'diiig', 'recommender')
       OR event_name !~ '^[a-z][a-z0-9_]{0,63}$' THEN
      RAISE EXCEPTION 'Invalid event' USING ERRCODE = '22023';
    END IF;

    props := COALESCE(event->'properties', '{}'::jsonb);
    IF jsonb_typeof(props) <> 'object' OR length(props::text) > 20000 THEN
      props := '{}'::jsonb;
    ELSE
      SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
        INTO props
      FROM jsonb_each(props)
      WHERE lower(key) NOT IN ('password', 'token', 'secret', 'authorization', 'cookie', 'email');
    END IF;

    occurred_at := seen_at;
    IF event->>'occurredAt' ~ '^\d{4}-\d{2}-\d{2}T' THEN
      BEGIN
        occurred_at := (event->>'occurredAt')::timestamptz;
      EXCEPTION WHEN others THEN
        occurred_at := seen_at;
      END;
    END IF;

    INSERT INTO analytics_events
      (occurred_at, user_id, session_id, product, event_name, path, properties)
    VALUES (
      occurred_at,
      user_id,
      session_id,
      product,
      event_name,
      NULLIF(left(COALESCE(event->>'path', ''), 500), ''),
      props
    );
    accepted := accepted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'accepted', accepted,
    'userId', user_id,
    'sessionId', session_id
  );
END;
$$;

REVOKE ALL ON FUNCTION analytics_ingest(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION analytics_ingest(jsonb) TO anon, authenticated, service_role;

ALTER TABLE analytics_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE analytics_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE analytics_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE analytics_events FROM PUBLIC, anon, authenticated;

-- Games people looked up in the Recommender, and the comparison they ran.
-- SELECT properties->>'gameName' AS game,
--        properties->>'appId' AS app_id,
--        count(*) AS searches
-- FROM analytics_events
-- WHERE product = 'recommender' AND event_name = 'recommender_search'
-- GROUP BY 1, 2
-- ORDER BY searches DESC;
