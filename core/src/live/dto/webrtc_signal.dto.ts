import { IsDefined, IsIn, IsString } from 'class-validator';

export class WebrtcSignalDto {
  @IsString()
  call_id: string;

  @IsIn(['STAFF', 'PHONE'])
  sender: 'STAFF' | 'PHONE';

  // An SDP description or ICE candidate; relayed untouched.
  @IsDefined()
  payload: unknown;
}
