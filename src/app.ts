import { randomUUID } from "node:crypto";
import { systemClock, type Clock } from "./domain/time.js";
import { ItemService } from "./services/items.js";
import { describeSystem, type SystemDescription } from "./services/system.js";
import { SqliteItemRepository } from "./storage/items.js";
import { openStore, type Store, type StoreOptions } from "./storage/store.js";

export interface App {
  store: Store;
  items: ItemService;
  describeSystem(): SystemDescription;
  close(): void;
}

/** Composition root: open the store and wire services to concrete repositories. */
export function openApp(options: StoreOptions & { clock?: Clock }): App {
  const clock = options.clock ?? systemClock;
  const store = openStore({ ...options, now: () => clock.now() });
  const items = new ItemService({
    preset: store.preset,
    items: new SqliteItemRepository(store.db),
    tx: store,
    clock,
    newId: randomUUID,
  });
  return {
    store,
    items,
    describeSystem: () => describeSystem(store.preset, store.timezone),
    close: () => {
      store.close();
    },
  };
}
