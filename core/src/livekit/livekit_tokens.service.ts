import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

import { livekitConfig } from '../config/livekit.config';
import { MediaUnavailableError } from './errors/media_unavailable.error';
import { RoomGrant } from './types/room_grant.type';

const TOKEN_TIME_TO_LIVE = '2h';

// Mints LiveKit join tokens. The API secret never leaves core.
@Injectable()
export class LivekitTokensService {
  constructor(
    @Inject(livekitConfig.KEY)
    private readonly livekit_config: ConfigType<typeof livekitConfig>,
  ) {}

  isConfigured(): boolean {
    return (
      this.livekit_config.url.length > 0 &&
      this.livekit_config.api_key.length > 0 &&
      this.livekit_config.api_secret.length > 0
    );
  }

  async mintToken(room_grant: RoomGrant): Promise<string> {
    if (!this.isConfigured()) {
      throw new MediaUnavailableError(
        'set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in core/.env',
      );
    }
    const access_token = new AccessToken(
      this.livekit_config.api_key,
      this.livekit_config.api_secret,
      {
        identity: room_grant.identity,
        name: room_grant.display_name,
        ttl: TOKEN_TIME_TO_LIVE,
      },
    );
    access_token.addGrant({
      room: room_grant.room_name,
      roomJoin: true,
      canPublish: room_grant.can_publish,
      canSubscribe: true,
      canPublishData: false,
    });
    return access_token.toJwt();
  }
}
