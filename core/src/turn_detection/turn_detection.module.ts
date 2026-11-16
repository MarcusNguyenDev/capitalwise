import { Module } from '@nestjs/common';

import { VoiceActivityDetectorFactory } from './voice_activity_detector.factory';

@Module({
  providers: [VoiceActivityDetectorFactory],
  exports: [VoiceActivityDetectorFactory],
})
export class TurnDetectionModule {}
