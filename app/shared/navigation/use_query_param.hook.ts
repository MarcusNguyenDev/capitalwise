"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * One query-string value as page state, so a selected call or case can be
 * deep-linked and Back/Forward move between selections. Uses the native
 * History API, which Next.js syncs into `useSearchParams` without a server
 * round trip. Components using this must sit inside a <Suspense> boundary.
 */
export function useQueryParam(name: string): [string | null, (value: string | null) => void] {
  const search_params = useSearchParams();
  const value = search_params.get(name);

  const setValue = useCallback(
    (new_value: string | null) => {
      const next_params = new URLSearchParams(window.location.search);
      if (new_value === null || new_value === "") {
        next_params.delete(name);
      } else {
        next_params.set(name, new_value);
      }
      if (next_params.toString() === new URLSearchParams(window.location.search).toString()) {
        return;
      }
      const query_string = next_params.toString();
      window.history.pushState(null, "", `${window.location.pathname}${query_string ? `?${query_string}` : ""}`);
    },
    [name],
  );

  return [value, setValue];
}
