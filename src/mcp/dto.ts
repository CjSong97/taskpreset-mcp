import type { Item } from "../domain/item.js";
import type { PlanWithItems } from "../services/plans.js";

/** Wire format for items: snake_case, matching tool input field names. */
export function itemDto(item: Item): Record<string, unknown> {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    status: item.status,
    parent_id: item.parentId,
    tags: item.tags,
    priority: item.priority,
    due_date: item.dueDate,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    completed_at: item.completedAt,
  };
}

export function planDto({ plan, items }: PlanWithItems): Record<string, unknown> {
  return {
    date: plan.date,
    revision: plan.revision,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
    items: items.map((item, index) => ({ position: index + 1, item: itemDto(item) })),
  };
}
