"use client";

import { useEffect, useState } from "react";

import { fetchSimulatorStatus, setSimulatorSpeed, startSimulator, stopSimulator } from "@/shared/api_client/core_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveEvent } from "@/shared/live/use_live_event.hook";
import type { SimulatorStatus } from "@/shared/types/call.type";
import { useToast } from "@/shared/ui/toast.provider";

export type SimulatorSpeed = 1 | 2;

export interface Simulator {
  simulator_status: SimulatorStatus | null;
  speed: SimulatorSpeed;
  is_busy: boolean;
  start: (call_count: number) => void;
  stop: () => void;
  changeSpeed: (speed: SimulatorSpeed) => void;
}

/** Start, stop and speed for the call simulator that makes the dashboard come alive. */
export function useSimulator(): Simulator {
  const [simulator_status, setSimulatorStatus] = useState<SimulatorStatus | null>(null);
  const [chosen_speed, setChosenSpeed] = useState<SimulatorSpeed>(1);
  const [is_busy, setIsBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let is_cancelled = false;
    fetchSimulatorStatus()
      .then((fetched_status) => !is_cancelled && setSimulatorStatus(fetched_status))
      .catch(() => undefined);
    return () => {
      is_cancelled = true;
    };
  }, []);

  useLiveEvent<SimulatorStatus>(LIVE_EVENT.SIMULATOR_STATUS, setSimulatorStatus);

  const runSimulatorRequest = async (failure_title: string, sendRequest: () => Promise<SimulatorStatus>) => {
    setIsBusy(true);
    try {
      setSimulatorStatus(await sendRequest());
    } catch (error) {
      showToast({ title: failure_title, description: describeError(error), tone: "error" });
    } finally {
      setIsBusy(false);
    }
  };

  const speed = simulator_status?.is_running ? simulator_status.speed : chosen_speed;

  return {
    simulator_status,
    speed,
    is_busy,
    start: (call_count) => void runSimulatorRequest("Could not start the simulation", () => startSimulator(call_count, speed)),
    stop: () => void runSimulatorRequest("Could not stop the simulation", stopSimulator),
    changeSpeed: (new_speed) => {
      setChosenSpeed(new_speed);
      if (simulator_status?.is_running) {
        void runSimulatorRequest("Could not change the speed", () => setSimulatorSpeed(new_speed));
      }
    },
  };
}
