import { createHash } from "node:crypto";
import { canonicalJson } from "../config/canonical.js";
import { WaypointError } from "../domain/errors.js";
import {
  assertDateOnly,
  assertItemType,
  assertParentAllowed,
  doneStatus,
  normalizeTags,
  statusCategory,
  statusesIn,
  type Item,
} from "../domain/item.js";
import { LIMITS } from "../domain/limits.js";
import type { Preset, StatusCategory } from "../domain/preset.js";
import type { Clock } from "../domain/time.js";
import type { ItemCursor, ItemFilter, ItemRepository, UnitOfWork } from "./ports.js";

export interface CaptureInput {
  type: string;
  title: string;
  description?: string | undefined;
  status?: string | undefined;
  parentId?: string | undefined;
  tags?: string[] | undefined;
  priority?: number | undefined;
  dueDate?: string | undefined;
  requestId?: string | undefined;
}

export interface CaptureResult {
  item: Item;
  /** True when an earlier capture with the same request_id and payload was returned. */
  replayed: boolean;
}

export interface QueryInput {
  id?: string | undefined;
  type?: string | undefined;
  statuses?: string[] | undefined;
  statusCategory?: StatusCategory | undefined;
  parentId?: string | undefined;
  rootOnly?: boolean | undefined;
  tag?: string | undefined;
  dueFrom?: string | undefined;
  dueTo?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface QueryResult {
  items: Item[];
  nextCursor: string | null;
}

export interface CompleteResult {
  item: Item;
  /** True when the item was already done; nothing was changed and no new completion counted. */
  alreadyCompleted: boolean;
}

export interface ItemServiceDeps {
  preset: Preset;
  items: ItemRepository;
  tx: UnitOfWork;
  clock: Clock;
  newId: () => string;
}

function encodeCursor(cursor: ItemCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt, cursor.id]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): ItemCursor {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === "string" &&
      typeof value[1] === "string"
    ) {
      return { createdAt: value[0], id: value[1] };
    }
  } catch {
    // fall through
  }
  throw new WaypointError("validation", "cursor is invalid; pass next_cursor from a prior page.");
}

export class ItemService {
  constructor(private readonly deps: ItemServiceDeps) {}

  capture(input: CaptureInput): CaptureResult {
    const { preset, items, tx, clock, newId } = this.deps;
    assertItemType(preset, input.type);

    const title = input.title.trim();
    if (title.length === 0) throw new WaypointError("validation", "title must not be empty.");
    const description = input.description?.trim() || null;
    const status = input.status ?? preset.initialStatuses[0] ?? "";
    statusCategory(preset, status);
    if (!preset.initialStatuses.includes(status)) {
      throw new WaypointError("validation", `Items cannot be created with status "${status}".`, {
        allowed: preset.initialStatuses,
      });
    }
    const tags = normalizeTags(input.tags ?? []);
    const priority = input.priority ?? LIMITS.priority.default;
    if (input.dueDate !== undefined) assertDateOnly("due_date", input.dueDate);

    const normalized = {
      type: input.type,
      title,
      description,
      status,
      parentId: input.parentId ?? null,
      tags,
      priority,
      dueDate: input.dueDate ?? null,
    };
    const fingerprint = createHash("sha256").update(canonicalJson(normalized)).digest("hex");

    return tx.write(() => {
      if (input.requestId !== undefined) {
        const previous = items.findByRequestId(input.requestId);
        if (previous) {
          if (previous.fingerprint !== fingerprint) {
            throw new WaypointError(
              "conflict",
              "request_id was already used for a different capture. Use a new request_id for new work.",
              { item_id: previous.item.id },
            );
          }
          return { item: previous.item, replayed: true };
        }
      }

      let parent: Item | undefined;
      if (normalized.parentId !== null) {
        parent = items.get(normalized.parentId);
        if (!parent) {
          throw new WaypointError(
            "not_found",
            `Parent item ${normalized.parentId} does not exist.`,
          );
        }
      }
      assertParentAllowed(preset, { type: normalized.type }, parent);

      const now = clock.now().toISOString();
      const item: Item = {
        id: newId(),
        ...normalized,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      items.insert(
        item,
        input.requestId === undefined ? undefined : { id: input.requestId, fingerprint },
      );
      return { item, replayed: false };
    });
  }

  query(input: QueryInput): QueryResult {
    const { preset, items, tx } = this.deps;
    if (input.type !== undefined) assertItemType(preset, input.type);
    for (const status of input.statuses ?? []) statusCategory(preset, status);
    if (input.dueFrom !== undefined) assertDateOnly("due_from", input.dueFrom);
    if (input.dueTo !== undefined) assertDateOnly("due_to", input.dueTo);
    if (input.parentId !== undefined && input.rootOnly === true) {
      throw new WaypointError("validation", "Use either parent_id or root_only, not both.");
    }

    let statuses = input.statuses;
    if (input.statusCategory !== undefined) {
      const inCategory = statusesIn(preset, input.statusCategory);
      statuses = statuses ? statuses.filter((s) => inCategory.includes(s)) : inCategory;
    }

    const limit = Math.min(input.limit ?? LIMITS.queryPageSizeDefault, LIMITS.queryPageSizeMax);
    const after = input.cursor === undefined ? undefined : decodeCursor(input.cursor);
    const filter: ItemFilter = {
      id: input.id,
      type: input.type,
      statuses,
      parentId: input.parentId,
      rootOnly: input.rootOnly,
      tag: input.tag?.trim(),
      dueFrom: input.dueFrom,
      dueTo: input.dueTo,
    };

    return tx.read(() => {
      if (input.id !== undefined && after === undefined && !items.get(input.id)) {
        throw new WaypointError("not_found", `Item ${input.id} does not exist.`);
      }
      // Fetch one extra row to learn whether another page exists.
      const page = items.query(filter, limit + 1, after);
      const hasMore = page.length > limit;
      const visible = hasMore ? page.slice(0, limit) : page;
      const last = visible.at(-1);
      return {
        items: visible,
        nextCursor: hasMore && last ? encodeCursor(last) : null,
      };
    });
  }

  /**
   * Move an open item to the preset's done status and stamp completed_at, atomically. Repeating
   * the call returns the original completion unchanged. Children are never completed implicitly.
   */
  complete(id: string): CompleteResult {
    const { preset, items, tx, clock } = this.deps;
    const done = doneStatus(preset);
    return tx.write(() => {
      const item = items.get(id);
      if (!item) throw new WaypointError("not_found", `Item ${id} does not exist.`);
      const category = statusCategory(preset, item.status);
      if (category === "done") return { item, alreadyCompleted: true };
      if (category === "cancelled") {
        throw new WaypointError(
          "invalid_transition",
          `Item ${id} is cancelled and cannot be completed.`,
        );
      }
      const now = clock.now().toISOString();
      const completed: Item = { ...item, status: done, completedAt: now, updatedAt: now };
      items.update(completed);
      return { item: completed, alreadyCompleted: false };
    });
  }
}
