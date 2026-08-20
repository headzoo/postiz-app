/**
 * Site-level docs configuration used by link rewriting and CI comments.
 */

/** @type {string} Public GitHub repository URL (no trailing slash). */
export const repoUrl = 'https://github.com/headzoo/postplusplus';

/** @type {string} Default git branch for blob links. */
export const defaultBranch = 'main';

/** @type {string} GitHub blob URL prefix for source file links. */
export const repoBlobUrl = `${repoUrl}/blob/${defaultBranch}`;
