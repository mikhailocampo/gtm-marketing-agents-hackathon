/**
 * Worker entrypoint. Re-exports the open-next-generated handler as default and
 * the SessionDO class so Cloudflare can mount the Durable Object binding.
 */

// @ts-expect-error - generated at build time by @opennextjs/cloudflare
export { default } from "./.open-next/worker.js";
export { SessionDO } from "./lib/session-do";
