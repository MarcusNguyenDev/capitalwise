"use client";

import { useState } from "react";

import { fetchAutonomyOverview, proposeAutonomy, signOffAutonomyProposal } from "@/shared/api_client/engine_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { ActionCode } from "@/shared/types/case.type";
import { Card } from "@/shared/ui/card.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { SkeletonDetail } from "@/shared/ui/skeleton.component";
import { useToast } from "@/shared/ui/toast.provider";

import { TEAM_LEADER_ROLE } from "../constants/resources_view.constant";
import { AutonomyHeadlineCard } from "./autonomy_headline_card.component";
import { AutonomyPromotionCard } from "./autonomy_promotion_card.component";
import { AutonomyProposalList } from "./autonomy_proposal_list.component";
import { AutonomyStatsTable } from "./autonomy_stats_table.component";

/** Earned autonomy: where staff almost always agree with the AI, propose automating it; a team leader signs off. */
export function AutonomyWorkspace() {
  const { current_staff, current_staff_id } = useCurrentStaff();
  const { showToast } = useToast();
  const autonomy_query = useLiveQuery(fetchAutonomyOverview, CASE_EVENTS);
  const [is_proposing, setIsProposing] = useState(false);
  const [signing_off_proposal_id, setSigningOffProposalId] = useState<number | null>(null);
  const autonomy_overview = autonomy_query.data;
  const is_team_leader = current_staff?.role === TEAM_LEADER_ROLE;

  const proposePromotion = async (action_code: ActionCode) => {
    setIsProposing(true);
    try {
      await proposeAutonomy({ staff_id: current_staff_id, action_code });
      showToast({ title: "Proposal recorded", description: "It needs team-leader sign-off. Live policy is unchanged.", tone: "success" });
      autonomy_query.reload();
    } catch (error) {
      showToast({ title: "Could not record the proposal", description: describeError(error), tone: "error" });
    } finally {
      setIsProposing(false);
    }
  };

  const signOffProposal = async (proposal_id: number) => {
    setSigningOffProposalId(proposal_id);
    try {
      await signOffAutonomyProposal(proposal_id, current_staff_id);
      showToast({ title: "Proposal signed off", description: "Recorded in the audit log. Live policy is unchanged.", tone: "success" });
      autonomy_query.reload();
    } catch (error) {
      showToast({ title: "Could not sign off", description: describeError(error), tone: "error" });
    } finally {
      setSigningOffProposalId(null);
    }
  };

  const findPublishedPromotion = (action_code: ActionCode) =>
    (autonomy_overview?.proposals ?? []).find((proposal) => proposal.action_code === action_code && proposal.status === "SIGNED_OFF" && proposal.published_policy_id);

  const hasOpenProposal = (action_code: ActionCode) =>
    (autonomy_overview?.proposals ?? []).some((proposal) => proposal.action_code === action_code && proposal.status === "PENDING_SIGN_OFF");

  return (
    <>
      <PageHeader title="Earned autonomy" description="Where staff almost always agree with the AI, a team leader can sign off on letting policy run it automatically." />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
        {autonomy_query.error_message ? <ErrorState message={autonomy_query.error_message} onRetry={autonomy_query.reload} /> : null}
        {!autonomy_overview && !autonomy_query.error_message ? <SkeletonDetail label="Loading autonomy statistics" /> : null}
        {autonomy_overview ? (
          <>
            {autonomy_overview.stats
              .filter((autonomy_stat) => autonomy_stat.is_eligible)
              .map((autonomy_stat) => {
                const published_promotion = findPublishedPromotion(autonomy_stat.action_code);
                return published_promotion ? (
                  <AutonomyPromotionCard key={autonomy_stat.action_code} autonomy_stat={autonomy_stat} promotion={published_promotion} />
                ) : (
                  <AutonomyHeadlineCard
                    key={autonomy_stat.action_code}
                    autonomy_stat={autonomy_stat}
                    has_open_proposal={hasOpenProposal(autonomy_stat.action_code)}
                    is_proposing={is_proposing}
                    onPropose={(action_code) => void proposePromotion(action_code)}
                  />
                );
              })}
            <Card
              title="Proposals"
              description={
                is_team_leader
                  ? "You are the team leader, so you can sign these off."
                  : "Only the team leader can sign off. Use “Act as” in your account menu to act as the team leader."
              }
            >
              <AutonomyProposalList
                proposals={autonomy_overview.proposals}
                can_sign_off={is_team_leader}
                signing_off_proposal_id={signing_off_proposal_id}
                onSignOff={(proposal_id) => void signOffProposal(proposal_id)}
              />
            </Card>
            <Card title="Agreement by action" description="How often staff decided the way the AI and policy recommended, and how long a decision took.">
              <AutonomyStatsTable autonomy_stats={autonomy_overview.stats} />
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
