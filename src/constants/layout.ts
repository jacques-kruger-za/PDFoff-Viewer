/** Layout dimensions and zoom bounds — single source of truth. */

export const LAYOUT = {
  CONTAINER_PADDING: 32,
  CONTAINER_PADDING_WITH_SCROLLBAR: 48,
  SIDEBAR_WIDTH: 148,
  THUMBNAIL_WIDTH: 120,
} as const;

export const ZOOM = {
  MIN: 0.1,
  MAX: 5,
  STEPS: [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2, 2.5, 3, 4, 5,
  ] as readonly number[],
  /** PDF points are 1/72", CSS pixels are 1/96". Extra 1.25x for comfortable reading. */
  BASE_SCALE: (96 / 72) * 1.25,
  WHEEL_BASE_STEP: 1.06,
  WHEEL_ACCELERATION: 0.02,
  WHEEL_MAX_STREAK: 8,
  ANIMATION_EASING: 0.26,
  ANIMATION_STOP_EPSILON: 0.0015,
} as const;

export const PDF_RENDERING = {
  LINE_GROUP_THRESHOLD: 2,
  GUTTER_MIN_GAP: 5,
  INTERSECTION_THRESHOLD: 0.5,
} as const;
