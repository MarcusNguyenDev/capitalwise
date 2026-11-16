import { readFile } from 'fs/promises';
import { resolve } from 'path';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { appConfig } from '../config/app.config';
import { CompareRepository } from './compare.repository';
import { CompareJourneyConfigError } from './errors/compare_journey_config.error';
import {
  CompareJourneyConfig,
  JourneyConfig,
  JourneyStepConfig,
  MeasuredCallMetrics,
  MeasuredMetric,
} from './types/compare_journey.type';

const MILLISECONDS_PER_SECOND = 1000;

const MEASURED_METRIC_COLUMNS: Record<
  MeasuredMetric,
  keyof MeasuredCallMetrics
> = {
  avg_response_ms: 'avg_response_ms',
  time_to_identity_ms: 'avg_time_to_identity_ms',
  time_to_resolution_ms: 'avg_time_to_resolution_ms',
  time_to_human_ms: 'avg_time_to_human_ms',
};

@Injectable()
export class CompareService {
  private readonly logger = new Logger(CompareService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly app_settings: ConfigType<typeof appConfig>,
    private readonly compare_repository: CompareRepository,
  ) {}

  // The file is read on every request so durations can be edited without a
  // restart.
  async getComparison() {
    const [journey_config, measured] = await Promise.all([
      this.readJourneyConfig(),
      this.compare_repository.selectMeasuredMetrics(),
    ]);
    return {
      legacy_journey: this.buildJourney(journey_config.legacy_journey, null),
      ai_journey: this.buildJourney(journey_config.ai_journey, measured),
      measured,
    };
  }

  private async readJourneyConfig(): Promise<CompareJourneyConfig> {
    const config_path = resolve(
      process.cwd(),
      this.app_settings.compare_journey_path,
    );
    try {
      return JSON.parse(await readFile(config_path, 'utf8'));
    } catch (error) {
      this.logger.error({
        message: 'Compare journey config could not be read',
        config_path,
        error_message: (error as Error).message,
      });
      throw new CompareJourneyConfigError(config_path);
    }
  }

  private buildJourney(
    journey: JourneyConfig,
    measured: MeasuredCallMetrics | null,
  ) {
    const steps = journey.steps.map((step) => {
      const measured_seconds = this.measureStep(step, measured);
      return {
        label: step.label,
        detail: step.detail,
        duration_seconds: measured_seconds ?? step.duration_seconds,
        is_measured: measured_seconds !== null,
        is_optional_path: step.is_optional_path ?? false,
      };
    });
    const total_seconds = steps
      .filter((step) => !step.is_optional_path)
      .reduce(
        (running_total, step) => running_total + step.duration_seconds,
        0,
      );
    return {
      title: journey.title,
      steps,
      total_seconds: Math.round(total_seconds * 10) / 10,
      outcome: journey.outcome,
    };
  }

  private measureStep(
    step: JourneyStepConfig,
    measured: MeasuredCallMetrics | null,
  ): number | null {
    const measured_ms = this.readMetric(step.measured_metric, measured);
    if (measured_ms === null) {
      return null;
    }
    const overlap_ms = this.readMetric(step.subtract_metric, measured) ?? 0;
    const step_ms = Math.max(measured_ms - overlap_ms, 0);
    return Math.round((step_ms / MILLISECONDS_PER_SECOND) * 10) / 10;
  }

  private readMetric(
    metric: MeasuredMetric | undefined,
    measured: MeasuredCallMetrics | null,
  ): number | null {
    if (!metric || !measured) {
      return null;
    }
    const metric_column = MEASURED_METRIC_COLUMNS[metric];
    return metric_column ? measured[metric_column] : null;
  }
}
