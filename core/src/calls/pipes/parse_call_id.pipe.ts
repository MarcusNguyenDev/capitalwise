import { Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

import { InvalidCallIdError } from '../errors/invalid_call_id.error';

@Injectable()
export class ParseCallIdPipe implements PipeTransform<string, string> {
  transform(call_id: string): string {
    if (!isUUID(call_id)) {
      throw new InvalidCallIdError();
    }
    return call_id;
  }
}
