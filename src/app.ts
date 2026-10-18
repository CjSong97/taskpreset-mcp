import { randomUUID } from "node:crypto";
import { systemClock, type Clock } from "./domain/time.js";
import { ItemService } from "./services/items.js";
import { MetricsService } from "./services/metrics.js";
import { PlanService } from "./services/plans.js";
import { describeSystem, type SystemDescription } from "./services/system.js";
import { SqliteItemRepository } from "./storage/items.js";
import { SqlitePlanRepository } from "./storage/plans.js";
import { openStore, type Store, type StoreOptions } from "./storage/store.js";

export interface App {
  store: Store;
  items: ItemService;
  plans: PlanService;
  metrics: MetricsService;
  describeSystem(): SystemDescription;
  close(): void;
}

/** Composition root: open the store and wire services to concrete repositories. */
export function openApp(options: StoreOptions & { clock?: Clock }): App {
  const clock = options.clock ?? systemClock;
  const store = openStore({ ...options, now: () => clock.now() });
  const itemRepository = new SqliteItemRepository(store.db);
  const items = new ItemService({
    preset: store.preset,
    items: itemRepository,
    tx: store,
    clock,
    newId: randomUUID,
  });
  const planRepository = new SqlitePlanRepository(store.db);
  const plans = new PlanService({
    preset: store.preset,
    timezone: store.timezone,
    items: itemRepository,
    plans: planRepository,
    tx: store,
    clock,
    newId: randomUUID,
  });
  const metrics = new MetricsService({
    preset: store.preset,
    timezone: store.timezone,
    items: itemRepository,
    plans: planRepository,
    tx: store,
    clock,
  });
  return {
    store,
    items,
    plans,
    metrics,
    describeSystem: () => describeSystem(store.preset, store.timezone),
    close: () => {
      store.close();
    },
  };
}
