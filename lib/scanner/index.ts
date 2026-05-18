/**
 * Project Scanner — re-exports.
 *
 * Client components: import from `./shared` or `./runProjectScan` only.
 * API routes: import from `./server` for filesystem access.
 */

export * from './shared';
export { buildProjectContext, scanProjectLocal } from './server';
