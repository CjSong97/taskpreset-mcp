import type { Migration } from "../migrate.js";
import { migration001 } from "./001-initial.js";
import { migration002 } from "./002-day-plans.js";

export const MIGRATIONS: readonly Migration[] = [migration001, migration002];
