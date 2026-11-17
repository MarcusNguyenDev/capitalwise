import type { LucideIcon } from "lucide-react";
import { ChartColumn, CirclePlay, ClipboardCheck, FileSearch, FileText, Headphones, Scale, ScrollText, Sparkles, Users } from "lucide-react";

export type NavigationCountKey = "NEEDS_ATTENTION" | "PENDING_APPROVALS";

export interface NavigationLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the command palette under the label. */
  description: string;
  count_key?: NavigationCountKey;
}

export interface NavigationSection {
  title: string;
  links: NavigationLink[];
}

/** Ordered by how often each job comes up: live work first, governance and review after. */
export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    title: "Work",
    links: [
      { href: "/", label: "Live calls", icon: Headphones, description: "Watch AI-handled calls and step in", count_key: "NEEDS_ATTENTION" },
      { href: "/approvals", label: "Approvals", icon: ClipboardCheck, description: "Decide cases the AI proposed", count_key: "PENDING_APPROVALS" },
    ],
  },
  {
    title: "Team",
    links: [{ href: "/resources", label: "Team and routing", icon: Users, description: "Who is available, skill queues, AI agents" }],
  },
  {
    title: "Governance",
    links: [
      { href: "/resources/policies", label: "Policies", icon: Scale, description: "Actions the AI may propose and the rules that decide them" },
      { href: "/resources/prompts", label: "Prompt versions", icon: FileText, description: "The AI specialist's instructions and their history" },
      { href: "/resources/autonomy", label: "Earned autonomy", icon: Sparkles, description: "Agreement rates and proposals to automate" },
    ],
  },
  {
    title: "Review",
    links: [
      { href: "/audit", label: "Audit log", icon: ScrollText, description: "Every event, append-only and tamper-evident" },
      { href: "/audit/decisions", label: "Decisions", icon: FileSearch, description: "Why a case was decided, and who approved it" },
      { href: "/audit/replay", label: "Call replay", icon: CirclePlay, description: "Replay an ended call's timeline" },
    ],
  },
  {
    title: "Insights",
    links: [{ href: "/compare", label: "Before and after", icon: ChartColumn, description: "Today's phone banking journey against the AI specialist" }],
  },
];

export const CUSTOMER_PHONE_PATH = "/phone";
