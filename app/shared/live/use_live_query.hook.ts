"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { describeError } from "@/shared/http/service_request.error";

import { LIVE_EVENT } from "./live_event_names.constant";
import { useLiveEvent } from "./use_live_event.hook";

const REFETCH_DEBOUNCE_MS = 200;

export interface LiveQuery<Data> {
  data: Data | null;
  error_message: string | null;
  is_loading: boolean;
  reload: () => void;
}

/**
 * Loads data once, then reloads it (debounced) whenever one of the given
 * live events arrives, and always after a demo reset. `query_key` restarts
 * the query when its inputs change.
 */
export function useLiveQuery<Data>(
  fetchData: () => Promise<Data>,
  refresh_event_names: readonly string[],
  query_key = "",
): LiveQuery<Data> {
  const [data, setData] = useState<Data | null>(null);
  const [error_message, setErrorMessage] = useState<string | null>(null);
  const [is_loading, setIsLoading] = useState(true);
  const debounce_timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest_request_ref = useRef(0);

  const fetch_data_ref = useRef(fetchData);

  useEffect(() => {
    fetch_data_ref.current = fetchData;
  });

  const loadData = useCallback(async () => {
    const request_number = ++latest_request_ref.current;
    try {
      const loaded_data = await fetch_data_ref.current();
      // A slower, older response must not overwrite a newer one.
      if (request_number === latest_request_ref.current) {
        setData(loaded_data);
        setErrorMessage(null);
      }
    } catch (error) {
      if (request_number === latest_request_ref.current) {
        setErrorMessage(describeError(error));
      }
    } finally {
      if (request_number === latest_request_ref.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const scheduleReload = useCallback(() => {
    if (debounce_timer_ref.current) {
      clearTimeout(debounce_timer_ref.current);
    }
    debounce_timer_ref.current = setTimeout(() => void loadData(), REFETCH_DEBOUNCE_MS);
  }, [loadData]);

  useEffect(() => {
    // The first load is scheduled rather than run inline so the effect body
    // itself never sets state.
    const first_load_timer = setTimeout(() => void loadData(), 0);
    return () => {
      clearTimeout(first_load_timer);
      if (debounce_timer_ref.current) {
        clearTimeout(debounce_timer_ref.current);
      }
    };
  }, [loadData, query_key]);

  useLiveEvent([...refresh_event_names, LIVE_EVENT.DEMO_RESET], scheduleReload);

  return { data, error_message, is_loading, reload: scheduleReload };
}
