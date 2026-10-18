import type { Item } from "../domain/item.js";

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
