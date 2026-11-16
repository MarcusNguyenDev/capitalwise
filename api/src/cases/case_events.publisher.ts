import { Injectable } from '@nestjs/common';

import { STAFF_ROOM } from '../live_events/constants/live_events_channel.constant';
import { LiveEventsPublisher } from '../live_events/live_events.publisher';
import { CasesRepository } from './cases.repository';

@Injectable()
export class CaseEventsPublisher {
  constructor(
    private readonly cases_repository: CasesRepository,
    private readonly live_events_publisher: LiveEventsPublisher,
  ) {}

  publishCaseCreated(case_number: string): Promise<void> {
    return this.publishCaseEvent('case.created', case_number);
  }

  publishCaseUpdated(case_number: string): Promise<void> {
    return this.publishCaseEvent('case.updated', case_number);
  }

  private async publishCaseEvent(
    event: string,
    case_number: string,
  ): Promise<void> {
    const case_explanation =
      await this.cases_repository.selectCaseExplanation(case_number);
    if (!case_explanation) {
      return;
    }
    await this.live_events_publisher.publish({
      event,
      payload: case_explanation,
      rooms: [STAFF_ROOM],
    });
  }
}
