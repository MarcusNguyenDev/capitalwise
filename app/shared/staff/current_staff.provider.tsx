"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { fetchWorkforce } from "@/shared/api_client/engine_api.client";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveSocket } from "@/shared/live/live_socket.provider";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { StaffMember } from "@/shared/types/resources.type";

// The demo presenter is the team leader unless they switch.
const DEFAULT_STAFF_ID = "STF-01";
const SELECTED_STAFF_STORAGE_KEY = "capitalwise.selected_staff_id";

interface CurrentStaffContextValue {
  staff_members: StaffMember[];
  current_staff: StaffMember | null;
  current_staff_id: string;
  selectStaff: (staff_id: string) => void;
}

const CurrentStaffContext = createContext<CurrentStaffContextValue>({
  staff_members: [],
  current_staff: null,
  current_staff_id: DEFAULT_STAFF_ID,
  selectStaff: () => undefined,
});

/** Stands in for authentication: the header's staff switcher decides who is acting. */
export function CurrentStaffProvider({ children }: { children: ReactNode }) {
  const [current_staff_id, setCurrentStaffId] = useState(DEFAULT_STAFF_ID);
  const { joinRooms } = useLiveSocket();
  const workforce_query = useLiveQuery(fetchWorkforce, [LIVE_EVENT.STAFF_UPDATED, LIVE_EVENT.CASE_CREATED, LIVE_EVENT.CASE_UPDATED]);

  useEffect(() => {
    const stored_staff_id = window.localStorage.getItem(SELECTED_STAFF_STORAGE_KEY);
    if (stored_staff_id) {
      // Restoring a browser-only preference after hydration is the documented exception.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentStaffId(stored_staff_id);
    }
  }, []);

  useEffect(() => {
    joinRooms({ role: "STAFF", staff_id: current_staff_id });
  }, [joinRooms, current_staff_id]);

  const selectStaff = useCallback((staff_id: string) => {
    window.localStorage.setItem(SELECTED_STAFF_STORAGE_KEY, staff_id);
    setCurrentStaffId(staff_id);
  }, []);

  const context_value = useMemo(() => {
    const staff_members = workforce_query.data?.staff ?? [];
    return {
      staff_members,
      current_staff: staff_members.find((staff_member) => staff_member.staff_id === current_staff_id) ?? null,
      current_staff_id,
      selectStaff,
    };
  }, [workforce_query.data, current_staff_id, selectStaff]);

  return <CurrentStaffContext.Provider value={context_value}>{children}</CurrentStaffContext.Provider>;
}

export function useCurrentStaff(): CurrentStaffContextValue {
  return useContext(CurrentStaffContext);
}
