import type { Migration } from "../migrate.js";

export const migration002: Migration = {
  version: 2,
  name: "day-plans",
  sql: `
    CREATE TABLE day_plans (
      id         TEXT PRIMARY KEY,
      plan_date  TEXT NOT NULL UNIQUE
                 CHECK (plan_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      revision   INTEGER NOT NULL CHECK (revision >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE day_plan_items (
      plan_id  TEXT NOT NULL REFERENCES day_plans (id) ON DELETE CASCADE,
      item_id  TEXT NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
      position INTEGER NOT NULL CHECK (position >= 1),
      PRIMARY KEY (plan_id, item_id),
      UNIQUE (plan_id, position)
    ) STRICT;

    CREATE INDEX day_plan_items_item ON day_plan_items (item_id);
  `,
};
