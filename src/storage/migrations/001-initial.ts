import type { Migration } from "../migrate.js";

export const migration001: Migration = {
  version: 1,
  name: "initial",
  sql: `
    CREATE TABLE app_metadata (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE items (
      id                  TEXT PRIMARY KEY,
      type                TEXT NOT NULL,
      title               TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
      description         TEXT CHECK (description IS NULL OR length(description) <= 5000),
      status              TEXT NOT NULL,
      parent_id           TEXT REFERENCES items (id) ON DELETE RESTRICT,
      tags                TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags) AND json_type(tags) = 'array'),
      priority            INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 4),
      due_date            TEXT CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      completed_at        TEXT,
      request_id          TEXT UNIQUE,
      request_fingerprint TEXT,
      CHECK (parent_id IS NULL OR parent_id <> id),
      CHECK ((request_id IS NULL) = (request_fingerprint IS NULL))
    ) STRICT;

    CREATE INDEX items_status ON items (status);
    CREATE INDEX items_parent ON items (parent_id);
    CREATE INDEX items_type ON items (type);
    CREATE INDEX items_due_date ON items (due_date);
    CREATE INDEX items_completed_at ON items (completed_at);
  `,
};
