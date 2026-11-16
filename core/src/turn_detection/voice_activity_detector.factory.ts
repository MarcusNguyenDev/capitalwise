import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { CALLER_INPUT_SAMPLE_RATE } from '../audio/constants/call_audio_format.constant';
import { turnDetectionConfig } from '../config/turn_detection.config';
import { EnergyVoiceActivityDetector } from './energy_voice_activity.detector';

// One detector per call (it keeps that caller's noise floor).
@Injectable()
export class VoiceActivityDetectorFactory {
  constructor(
    @Inject(turnDetectionConfig.KEY)
    private readonly turn_detection_config: ConfigType<
      typeof turnDetectionConfig
    >,
  ) {}

  createDetector(): EnergyVoiceActivityDetector {
    return new EnergyVoiceActivityDetector({
      sample_rate: CALLER_INPUT_SAMPLE_RATE,
      ...this.turn_detection_config,
    });
  }
}
