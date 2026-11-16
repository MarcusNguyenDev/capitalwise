import { Matches } from 'class-validator';

export class LockCardArgsDto {
  @Matches(/^CRD-[0-9]+$/, { message: 'card_id must look like CRD-10011' })
  card_id: string;
}
