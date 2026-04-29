create table if not exists app_state (
  user_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Future normalized tables can grow from the JSON snapshot above once login is added.
-- The current app writes one demo workspace per deployment so Render PostgreSQL can
-- persist portfolio accounts, holdings, options, settings, and action logs.
