import type { Metadata } from "next";

import { DemoConfigProvider } from "@/shared/demo/demo_config.provider";
import { LiveSocketProvider } from "@/shared/live/live_socket.provider";
import { ToastProvider } from "@/shared/ui/toast.provider";
import { TooltipProvider } from "@/shared/ui/tooltip.component";

import "./globals.css";

export const metadata: Metadata = {
  title: "Specialist console",
  description: "An AI phone specialist with live human oversight. Prototype, mock data only.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full">
        <LiveSocketProvider>
          <DemoConfigProvider>
            <TooltipProvider>
              <ToastProvider>{children}</ToastProvider>
            </TooltipProvider>
          </DemoConfigProvider>
        </LiveSocketProvider>
      </body>
    </html>
  );
}
