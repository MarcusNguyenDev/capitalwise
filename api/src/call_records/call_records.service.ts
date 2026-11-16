import { Injectable } from '@nestjs/common';

import { CallRecordsRepository } from './call_records.repository';
import { CallNotFoundError } from './errors/call_not_found.error';
import { CallRecord } from './types/call_record.type';

@Injectable()
export class CallRecordsService {
  constructor(
    private readonly call_records_repository: CallRecordsRepository,
  ) {}

  async getCall(call_id: string): Promise<CallRecord> {
    const call_record = await this.call_records_repository.findCall(call_id);
    if (!call_record) {
      throw new CallNotFoundError(call_id);
    }
    return call_record;
  }
}
