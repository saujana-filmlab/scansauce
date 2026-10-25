CREATE TABLE IF NOT EXISTS house_catalog (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
