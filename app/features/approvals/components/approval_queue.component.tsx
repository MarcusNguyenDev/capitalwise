"use client";

import { useState } from "react";

import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { BatchApproveResult, BatchGroup, CaseDecisionResult, EngineCase } from "@/shared/types/case.type";
import { EmptyState, ErrorState, LoadingState, PageHeading } from "@/shared/ui/surface.component";

import { useApprovalQueue } from "../hooks/use_approval_queue.hook";
import type { DecidedOutcome } from "../hooks/use_approval_queue.hook";

import { BatchApproveBanner } from "./batch_approve_banner.component";
import { BatchApproveDialog } from "./batch_approve_dialog.component";
import { CasePackPanel } from "./case_pack_panel.component";
import { DecidedRow } from "./decided_row.component";
import { QueueRow } from "./queue_row.component";

interface QueueListProps {
  queued_cases: EngineCase[];
  decided_outcomes: DecidedOutcome[];
  selected_case_number: string | null;
  onSelect: (case_number: string) => void;
}

function QueueList({ queued_cases, decided_outcomes, selected_case_number, onSelect }: QueueListProps) {
  const current_time_ms = useCurrentTime();
  return (
    <div className="space-y-2">
      {decided_outcomes.map((outcome) => (
        <DecidedRow key={outcome.decided_case.case_number} outcome={outcome} onSelect={onSelect} />
      ))}
      {queued_cases.map((queued_case) => (
        <QueueRow
          key={queued_case.case_number}
          queued_case={queued_case}
          is_selected={queued_case.case_number === selected_case_number}
          current_time_ms={current_time_ms}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function ApprovalQueue() {
  const { current_staff } = useCurrentStaff();
  const { queued_cases, decided_outcomes, batch_groups, is_loading, error_message, recordOutcome } = useApprovalQueue();
  const [chosen_case_number, setChosenCaseNumber] = useState<string | null>(null);
  const [reviewed_batch_group, setReviewedBatchGroup] = useState<BatchGroup | null>(null);
  const [execution_results, setExecutionResults] = useState<Record<string, Record<string, unknown> | null>>({});
  const selected_case_number = chosen_case_number ?? queued_cases[0]?.case_number ?? null;

  const rememberExecutionResult = (case_number: string, execution_result: Record<string, unknown> | null) =>
    setExecutionResults((current_results) => ({ ...current_results, [case_number]: execution_result }));

  const recordDecision = (decision_result: CaseDecisionResult) => {
    setChosenCaseNumber(decision_result.case.case_number);
    rememberExecutionResult(decision_result.case.case_number, decision_result.execution_result);
    recordOutcome({ decided_case: decision_result.case, execution_result: decision_result.execution_result });
  };

  const recordBatchApproval = (batch_result: BatchApproveResult) => {
    for (const approved_case of batch_result.approved) {
      const queued_case = queued_cases.find((each_case) => each_case.case_number === approved_case.case_number);
      rememberExecutionResult(approved_case.case_number, approved_case.execution_result);
      if (queued_case) {
        recordOutcome({
          decided_case: { ...queued_case, status: "EXECUTED", decision: "APPROVED", decided_by_name: current_staff?.name },
          execution_result: approved_case.execution_result,
        });
      }
    }
    setChosenCaseNumber(null);
    setReviewedBatchGroup(null);
  };

  return (
    <>
      <PageHeading
        title="Approval queue"
        description="The AI proposes, deterministic policy decides, humans oversee. Every case arrives with its evidence and the rule that routed it here."
        actions={<p className="text-2xl font-bold tabular-nums">{queued_cases.length} waiting</p>}
      />
      {error_message ? <ErrorState message={error_message} /> : null}
      <div className="mb-6 space-y-3">
        {batch_groups.map((batch_group) => (
          <BatchApproveBanner key={batch_group.group_key} batch_group={batch_group} onReview={setReviewedBatchGroup} />
        ))}
      </div>
      <div className="grid grid-cols-[30rem_1fr] items-start gap-6">
        <aside className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
          {is_loading ? <LoadingState label="Loading the queue" /> : null}
          {!is_loading && queued_cases.length === 0 && decided_outcomes.length === 0 ? (
            <EmptyState title="Nothing is waiting for approval" description="New cases appear here the moment the AI proposes them." />
          ) : null}
          <QueueList
            queued_cases={queued_cases}
            decided_outcomes={decided_outcomes}
            selected_case_number={selected_case_number}
            onSelect={setChosenCaseNumber}
          />
        </aside>
        <div>
          {selected_case_number ? (
            <CasePackPanel
              key={selected_case_number}
              case_number={selected_case_number}
              execution_result={execution_results[selected_case_number] ?? null}
              onDecided={recordDecision}
            />
          ) : (
            <EmptyState title="Select a case to see its case pack" />
          )}
        </div>
      </div>
      {reviewed_batch_group ? (
        <BatchApproveDialog batch_group={reviewed_batch_group} onClose={() => setReviewedBatchGroup(null)} onApproved={recordBatchApproval} />
      ) : null}
    </>
  );
}
