"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { fetchDemoConfig } from "@/shared/api_client/engine_api.client";
import type { DemoConfig } from "@/shared/types/resources.type";

const DEFAULT_DEMO_CONFIG: DemoConfig = { bank_name: "Westpac", is_demo_mode: false };

const DemoConfigContext = createContext<DemoConfig>(DEFAULT_DEMO_CONFIG);

/** Bank name and demo mode come from the `api` service so one .env drives every screen. */
export function DemoConfigProvider({ children }: { children: ReactNode }) {
  const [demo_config, setDemoConfig] = useState<DemoConfig>(DEFAULT_DEMO_CONFIG);

  useEffect(() => {
    let is_cancelled = false;
    fetchDemoConfig()
      .then((loaded_config) => {
        if (!is_cancelled) {
          setDemoConfig(loaded_config);
        }
      })
      .catch(() => undefined);
    return () => {
      is_cancelled = true;
    };
  }, []);

  return <DemoConfigContext.Provider value={demo_config}>{children}</DemoConfigContext.Provider>;
}

export function useDemoConfig(): DemoConfig {
  return useContext(DemoConfigContext);
}
