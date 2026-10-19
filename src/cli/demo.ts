import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, normalize } from "node:path";
import { openApp } from "../app.js";
import { WaypointError } from "../domain/errors.js";
import { statusesIn } from "../domain/item.js";
import { addDays, type Clock } from "../domain/time.js";

export const DEMO_START = "2026-08-31";
export const DEMO_END = "2026-10-12";

interface DemoShape {
  presetId: string;
  containerType: string;
  taskType: string;
  tags: string[];
  /** Open statuses a started task can be moved to. */
  started: string[];
}

const SHAPES: DemoShape[] = [
  {
    presetId: "avatar-lite",
    containerType: "project",
    taskType: "task",
    tags: ["Fire", "Water", "Earth", "Air"],
    started: ["in_progress"],
  },
  {
    presetId: "gtd-lite",
    containerType: "project",
    taskType: "action",
    tags: ["@computer", "@home", "@errands", "@phone"],
    started: ["next", "waiting"],
  },
];

const PROJECTS = ["Ship the side project", "Get fitter", "Learn Spanish"];

const TASKS: string[][] = [
  [
    "Sketch the landing page",
    "Write the README intro",
    "Pick a colour palette",
    "Set up the repo and CI",
    "Draft the pricing page",
    "Record a 60-second demo",
    "Fix the sign-up bug",
    "Reply to beta tester feedback",
    "Add dark mode",
    "Write release notes",
    "Plan the launch week",
    "Back up the database",
    "Tidy the issue tracker",
    "Review open pull requests",
    "Draft a launch post",
    "Test on a slow connection",
    "Clean up the changelog",
    "Choose a project name",
  ],
  [
    "Book a physio check-up",
    "Run 5 km",
    "Plan this week's meals",
    "Buy resistance bands",
    "Stretch for 15 minutes",
    "Try a new yoga class",
    "Swim 20 lengths",
    "Prep lunches for the week",
    "Walk to the park",
    "Sleep before 11pm",
    "Track water for a week",
    "Order trail shoes",
    "Foam roll after the gym",
    "Cycle to the market",
    "Set a Sunday long run",
    "Update the training plan",
    "Fill the water bottles",
    "Weigh in and log it",
  ],
  [
    "Do the Monday vocab set",
    "Watch a Spanish film",
    "Book a conversation class",
    "Learn 10 verbs",
    "Read a short story",
    "Label the kitchen in Spanish",
    "Listen to a podcast episode",
    "Write a postcard in Spanish",
    "Review last week's mistakes",
    "Practise ordering food",
    "Shadow a news clip",
    "Buy a grammar workbook",
    "Message a language partner",
    "Memorise the days and months",
    "Sing along to a playlist",
    "Translate a recipe",
    "Take the level check quiz",
    "Plan a trip phrasebook",
  ],
];

/** Small deterministic PRNG so the demo store is identical on every run. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoOptions {
  out: string | undefined;
  preset: string | undefined;
}

/**
 * Seed a brand-new store at an explicit path with six weeks of plausible, synthetic history so
 * the report can be demonstrated and screenshotted reproducibly. Timestamps are produced by
 * driving a fake clock through the normal services, never by writing rows directly. The real
 * store is never touched: --out is required and must not exist.
 */
export function seedDemo(options: DemoOptions): string[] {
  if (options.out === undefined || !isAbsolute(options.out)) {
    throw new WaypointError("config", "demo requires --out with an absolute .db file path.");
  }
  const out = normalize(options.out);
  if (existsSync(out) && statSync(out).size > 0) {
    throw new WaypointError("config", `${out} already exists; demo only creates new stores.`);
  }
  const presetId = options.preset ?? "avatar-lite";
  const shape = SHAPES.find((s) => s.presetId === presetId);
  if (shape === undefined) {
    throw new WaypointError(
      "config",
      `demo supports ${SHAPES.map((s) => s.presetId).join(" and ")}, not "${presetId}".`,
    );
  }
  mkdirSync(dirname(out), { recursive: true });

  let current = new Date(`${DEMO_START}T07:00:00Z`).getTime();
  const clock: Clock = { now: () => new Date(current) };
  const at = (date: string, hour: number) => {
    current = new Date(`${date}T00:00:00Z`).getTime() + hour * 3_600_000;
  };
  const rand = mulberry32(2026);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;

  const app = openApp({ path: out, preset: presetId, clock });
  try {
    const projectIds = PROJECTS.map(
      (title) => app.items.capture({ type: shape.containerType, title }).item.id,
    );
    const queue = TASKS.flatMap((titles, project) => titles.map((title) => ({ title, project })));
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [queue[i], queue[j]] = [
        queue[j] as (typeof queue)[number],
        queue[i] as (typeof queue)[number],
      ];
    }

    const openTasks = () =>
      app.items.query({ type: shape.taskType, statusCategory: "open", limit: 100 }).items;
    let cancelled = 0;

    for (let day = DEMO_START; day <= DEMO_END; day = addDays(day, 1)) {
      const weekend = [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());
      at(day, 7.5);

      const captures = weekend ? (rand() < 0.3 ? 1 : 0) : 1 + Math.floor(rand() * 2);
      for (let i = 0; i < captures; i++) {
        const next = queue.shift();
        if (next === undefined) break;
        app.items.capture({
          type: shape.taskType,
          title: next.title,
          parentId: projectIds[next.project],
          tags: [pick(shape.tags)],
          priority: rand() < 0.2 ? 1 : rand() < 0.3 ? 2 : rand() < 0.2 ? 4 : 3,
          ...(rand() < 0.35 ? { dueDate: addDays(day, 2 + Math.floor(rand() * 11)) } : {}),
        });
      }

      const started = shape.started[0];
      if (started !== undefined && rand() < 0.4) {
        const candidate = openTasks().find((t) => t.status !== started);
        if (candidate) app.items.update({ id: candidate.id, status: pick(shape.started) });
      }

      let planned: string[] = [];
      if (!weekend && rand() < 0.75) {
        planned = app.plans
          .preview({ maxItems: 2 + Math.floor(rand() * 4) })
          .candidates.map((c) => c.id);
        if (planned.length > 0) app.plans.commit({ itemIds: planned });
      }

      const isLast = day === DEMO_END;
      const target = weekend
        ? rand() < 0.25
          ? 1
          : 0
        : rand() < 0.12
          ? 0
          : Math.min(planned.length || 3, 1 + Math.floor(rand() * 4));
      const wanted = isLast ? Math.max(1, Math.floor(planned.length / 2)) : target;
      const order = [
        ...planned,
        ...openTasks()
          .map((t) => t.id)
          .filter((id) => !planned.includes(id)),
      ];
      let done = 0;
      for (const id of order) {
        if (done >= wanted || openTasks().length <= 9) break;
        at(day, 9 + done * 1.7);
        app.items.complete(id);
        done++;
      }

      if (!isLast && cancelled < 3 && rand() < 0.05) {
        const victim = openTasks().at(-1);
        if (victim) {
          const [cancelStatus] = statusesIn(app.store.preset, "cancelled");
          if (cancelStatus !== undefined) app.items.update({ id: victim.id, status: cancelStatus });
          cancelled++;
        }
      }
    }
    const stats = app.metrics.get({ from: DEMO_START, to: DEMO_END });
    return [
      `Demo store written to ${out}`,
      `  preset:    ${presetId} (synthetic data, ${DEMO_START} to ${DEMO_END})`,
      `  contents:  ${stats.completedCount} completions, ${stats.currentOpenCount} open tasks`,
      `  next:      report --db ${out} --out <absolute .html> --as-of ${DEMO_END}`,
    ];
  } finally {
    app.close();
  }
}
