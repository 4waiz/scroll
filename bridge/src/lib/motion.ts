/**
 * Motion layer.
 *
 * Single seam between the in-lens demos and the underlying animation runtime.
 * Every demo imports `animate`, `createTimeline`, `stagger`, `svg`, and friends
 * from here rather than reaching for the vendor package directly, so the
 * runtime can be swapped or wrapped in one place instead of across nine files.
 */

export * from 'animejs';
