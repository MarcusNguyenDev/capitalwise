import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const MAX_CUSTOMER_MESSAGE_LENGTH = 500;

export class SendCustomerMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_CUSTOMER_MESSAGE_LENGTH)
  @Matches(/\S/, { message: 'text must contain more than spaces' })
  text: string;
}
