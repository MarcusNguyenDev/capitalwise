import { formatCodeLabel } from "@/shared/format/format_values.util";
import type { SkillQueue } from "@/shared/types/resources.type";
import { Stat } from "@/shared/ui/stat.component";

/** One row per skill: how many cases wait, who can take them, and how long it will be. */
export function SkillQueueSummary({ skill_queues }: { skill_queues: SkillQueue[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {skill_queues.map((skill_queue) => (
        <section key={skill_queue.skill} aria-label={`${formatCodeLabel(skill_queue.skill)} queue`} className="rounded-lg border border-line bg-white px-4 py-3 shadow-card">
          <h3 className="text-sm font-semibold">{formatCodeLabel(skill_queue.skill)}</h3>
          <dl className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="Waiting" value={String(skill_queue.waiting_case_count)} is_highlighted={skill_queue.waiting_case_count > 0 && skill_queue.available_staff_count === 0} />
            <Stat label="Available" value={String(skill_queue.available_staff_count)} />
            <Stat label="Wait" value={`${skill_queue.expected_wait_minutes} min`} />
          </dl>
        </section>
      ))}
    </div>
  );
}
