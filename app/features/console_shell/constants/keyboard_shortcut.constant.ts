export interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

/** Listed in the "?" help dialog. The handlers live with the screens that own them. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Anywhere",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Search calls, cases and customers, or jump to a page (Ctrl K on Windows)" },
      { keys: ["?"], description: "Show these shortcuts" },
      { keys: ["Alt", "T"], description: "Move to the latest notification" },
    ],
  },
  {
    title: "Queues (live calls, approvals, decisions, replay)",
    shortcuts: [
      { keys: ["J"], description: "Next item" },
      { keys: ["K"], description: "Previous item" },
      { keys: ["Enter"], description: "Open the highlighted item" },
      { keys: ["Esc"], description: "Close the open item" },
    ],
  },
  {
    title: "An open call",
    shortcuts: [
      { keys: ["W"], description: "Write a whisper to the AI, or a reply once you have the call" },
      { keys: ["T"], description: "Take over the call" },
      { keys: ["L"], description: "Listen in, or stop listening" },
    ],
  },
  {
    title: "An open case",
    shortcuts: [
      { keys: ["A"], description: "Approve (you still confirm)" },
      { keys: ["E"], description: "Edit the terms and approve" },
      { keys: ["R"], description: "Reject (you still confirm)" },
    ],
  },
];
