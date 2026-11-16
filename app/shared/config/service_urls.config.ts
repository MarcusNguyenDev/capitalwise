const API_SERVICE_PORT = 3002;
const CORE_SERVICE_PORT = 3001;

// The phone page can run on a second device on the same network, so the
// default is derived from the address the page was loaded from rather than
// a hard-coded localhost.
function buildSameHostUrl(port: number): string {
  if (typeof window === "undefined") {
    return `http://localhost:${port}`;
  }
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

/** REST API, system of record and decisioning (`api` service). */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || buildSameHostUrl(API_SERVICE_PORT);
}

/** Phone call and AI runtime, plus the live socket (`core` service). */
export function getCoreBaseUrl(): string {
  return process.env.NEXT_PUBLIC_CORE_URL || buildSameHostUrl(CORE_SERVICE_PORT);
}
