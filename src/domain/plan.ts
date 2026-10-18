export interface DayPlan {
  id: string;
  /** Local calendar date, YYYY-MM-DD, in the store's timezone. */
  date: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  /** Member item IDs in plan order. */
  itemIds: string[];
}
