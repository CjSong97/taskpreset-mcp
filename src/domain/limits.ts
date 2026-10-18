export const LIMITS = {
  titleMaxLength: 200,
  descriptionMaxLength: 5000,
  tagsMax: 20,
  tagMaxLength: 40,
  requestIdMaxLength: 100,
  queryPageSizeDefault: 25,
  queryPageSizeMax: 100,
  planMaxItems: 20,
  planPreviewDefault: 5,
  priority: { highest: 1, lowest: 4, default: 3 },
} as const;
