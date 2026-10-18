import type { Item } from "../domain/item.js";

/** Keyset position: items are ordered by (createdAt, id). */
export interface ItemCursor {
  createdAt: string;
  id: string;
}

export interface ItemFilter {
  id?: string | undefined;
  type?: string | undefined;
  statuses?: string[] | undefined;
  parentId?: string | undefined;
  rootOnly?: boolean | undefined;
  tag?: string | undefined;
  dueFrom?: string | undefined;
  dueTo?: string | undefined;
}

export interface ItemRepository {
  insert(item: Item, request?: { id: string; fingerprint: string }): void;
  get(id: string): Item | undefined;
  findByRequestId(requestId: string): { item: Item; fingerprint: string } | undefined;
  query(filter: ItemFilter, limit: number, after?: ItemCursor): Item[];
  update(item: Item): void;
  /** IDs from the item's parent up to the root. */
  ancestorIds(id: string): string[];
}

/** Transaction boundary implemented by the store. */
export interface UnitOfWork {
  write<T>(fn: () => T): T;
  read<T>(fn: () => T): T;
}
