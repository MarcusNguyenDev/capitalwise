"use client";

import { useState } from "react";

import { fetchAutonomyOverview, proposeAutonomy, signOffAutonomyProposal } from "@/shared/api_client/engine_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { ActionCode } from "@/shared/types/case.type";
import { Card, ErrorState, LoadingState, SectionHeading } from "@/shared/ui/surface.component";
import { useToast } from "@/shared/ui/toast.provider";

import { TEAM_LEADER_ROLE } from "../constants/resources_view.constant";

import { AutonomyHeadlineCard } from "./autonomy_headline_card.component";
import { AutonomyProposalList } from "./autonomy_proposal_list.component";
import { AutonomyStatCard } from "./autonomy_stat_card.component";

export function EarnedAutonomySection() {
  const { current_staff, current_staff_id } = useCurrentStaff();
  const { showToast } = useToast();
  const autonomy_query = useLiveQuery(fetchAutonomyOverview, CASE_EVENTS);
  const [is_proposing, setIsProposing] = useState(false);
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
    try {
      await signOffAutonomyProposal(proposal_id, current_staff_id);
      showToast({ title: "Proposal signed off", description: "Recorded in the audit log. Live policy is unchanged.", tone: "success" });
      autonomy_query.reload();
    } catch (error) {
      showToast({ title: "Could not sign off", description: describeError(error), tone: "error" });
    }
  };

  if (!autonomy_overview) {
    return autonomy_query.error_message ? <ErrorState message={autonomy_query.error_message} /> : <LoadingState label="Loading autonomy statistics" />;
  }
  const hasOpenProposal = (action_code: ActionCode) =>
    autonomy_overview.proposals.some((proposal) => proposal.action_code === action_code && proposal.status === "PENDING_SIGN_OFF");

  return (
    <div className="space-y-8">
      {autonomy_overview.stats
        .filter((autonomy_stat) => autonomy_stat.is_eligible)
        .map((autonomy_stat) => (
          <AutonomyHeadlineCard
            key={autonomy_stat.action_code}
            autonomy_stat={autonomy_stat}
            has_open_proposal={hasOpenProposal(autonomy_stat.action_code)}
            is_proposing={is_proposing}
            onPropose={proposePromotion}
          />
        ))}
      <div>
        <SectionHeading title="Agreement by action" description="How often staff decided the way the AI and policy recommended, and how long a decision took." />
        <div className="grid grid-cols-4 gap-4">
          {autonomy_overview.stats.map((autonomy_stat) => (
            <AutonomyStatCard key={autonomy_stat.action_code} autonomy_stat={autonomy_stat} />
          ))}
        </div>
      </div>
      <Card>
        <SectionHeading
          title="Proposals"
          description={
            is_team_leader
              ? "You are the team leader, so you can sign these off."
              : "Only the team leader can sign off. Switch staff member in the header to act as the team leader."
          }
        />
        <AutonomyProposalList proposals={autonomy_overview.proposals} can_sign_off={is_team_leader} onSignOff={signOffProposal} />
      </Card>
    </div>
  );
}
