import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { CallScriptsLoader } from '../call_scripts/call_scripts_loader.service';
import { CallScript } from '../call_scripts/types/call_script.type';
import { CallToolsService } from '../call_tools/call_tools.service';
import { CallsService } from '../calls/calls.service';
import { appConfig } from '../config/app.config';
import { contentConfig } from '../config/content.config';
import { EngineApiClient } from '../engine_api/engine_api.client';
import { InterventionsService } from '../interventions/interventions.service';
import { InterventionWithStaff } from '../interventions/types/intervention.type';
import {
  INTERNAL_EVENT,
  LIVE_EVENT,
} from '../live/constants/live_event_names.constant';
import { STAFF_ROOM } from '../live/constants/live_rooms.constant';
import { LiveBroadcaster } from '../live/live_broadcaster.service';
import { LiveEventBus } from '../live/live_event_bus.service';
import {
  CALL_START_STAGGER_MS,
  SIMULATION_START_ORDER,
} from './constants/simulator_pacing.constant';
import { SetSimulatorSpeedDto } from './dto/set_simulator_speed.dto';
import { StartSimulatorDto } from './dto/start_simulator.dto';
import { SimulatedCallRunner } from './simulated_call.runner';
import { SimulatorSpeed, SimulatorStatus } from './types/simulator_status.type';

function readStartPosition(script: CallScript): number {
  const start_position = SIMULATION_START_ORDER.indexOf(script.script_id);
  return start_position === -1 ? SIMULATION_START_ORDER.length : start_position;
}

@Injectable()
export class SimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimulatorService.name);
  private readonly runners = new Set<SimulatedCallRunner>();
  private readonly start_timers = new Set<NodeJS.Timeout>();
  private readonly unsubscribe_functions: (() => void)[] = [];
  private scripts: CallScript[] = [];
  private speed: SimulatorSpeed = 1;
  private is_running = false;

  constructor(
    private readonly call_scripts_loader: CallScriptsLoader,
    private readonly calls_service: CallsService,
    private readonly call_tools_service: CallToolsService,
    private readonly interventions_service: InterventionsService,
    private readonly engine_api_client: EngineApiClient,
    private readonly live_broadcaster: LiveBroadcaster,
    private readonly live_event_bus: LiveEventBus,
    @Inject(appConfig.KEY)
    private readonly app_config: ConfigType<typeof appConfig>,
    @Inject(contentConfig.KEY)
    private readonly content_config: ConfigType<typeof contentConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    const loaded_scripts = await this.call_scripts_loader.loadScripts(
      this.content_config.simulations_dir,
    );
    this.scripts = loaded_scripts.sort(
      (first_script, second_script) =>
        readStartPosition(first_script) - readStartPosition(second_script),
    );
    this.logger.log(`Loaded ${this.scripts.length} simulation scripts`);
    this.subscribeToEvents();
  }

  onModuleDestroy(): void {
    this.unsubscribe_functions.forEach((unsubscribe) => unsubscribe());
    this.abortEverything();
  }

  getStatus(): SimulatorStatus {
    return {
      is_running: this.is_running,
      speed: this.speed,
      active_call_count: [...this.runners].filter((runner) => runner.call_id)
        .length,
      scripts: this.scripts.map((script) => ({
        script_id: script.script_id,
        title: script.title,
        customer_id: script.customer_id,
      })),
    };
  }

  async start(start_simulator: StartSimulatorDto): Promise<SimulatorStatus> {
    await this.stopAndEndCalls();
    this.speed = start_simulator.speed;
    const scripts_to_run = this.scripts.slice(0, start_simulator.call_count);
    this.is_running = scripts_to_run.length > 0;
    scripts_to_run.forEach((script, script_index) => {
      const start_timer = setTimeout(
        () => {
          this.start_timers.delete(start_timer);
          this.launchRunner(script);
        },
        (script_index * CALL_START_STAGGER_MS) / this.speed,
      );
      this.start_timers.add(start_timer);
    });
    return this.broadcastStatus();
  }

  async stop(): Promise<SimulatorStatus> {
    await this.stopAndEndCalls();
    return this.broadcastStatus();
  }

  // Applies from the next step of every running call.
  setSpeed(set_simulator_speed: SetSimulatorSpeedDto): SimulatorStatus {
    this.speed = set_simulator_speed.speed;
    return this.broadcastStatus();
  }

  private subscribeToEvents(): void {
    this.unsubscribe_functions.push(
      this.live_event_bus.subscribe<InterventionWithStaff>(
        INTERNAL_EVENT.INTERVENTION_RECORDED,
        (intervention) =>
          this.findRunner(intervention.call_id)?.handleIntervention(
            intervention,
          ),
      ),
      this.live_event_bus.subscribe<{
        call_id: string;
        notification_id: string;
      }>(INTERNAL_EVENT.IDENTITY_PUSH_SENT, (identity_push) =>
        this.findRunner(identity_push.call_id)?.handleIdentityPushSent(
          identity_push.notification_id,
        ),
      ),
      // A supervisor (or a new call from the same number) ended a simulated call.
      this.live_event_bus.subscribe<{ call_id: string }>(
        INTERNAL_EVENT.CALL_ENDED,
        (ended_call) => this.findRunner(ended_call.call_id)?.abort(),
      ),
      // The database was reseeded: the calls are gone, so only memory is cleared.
      this.live_event_bus.subscribe(LIVE_EVENT.DEMO_RESET, () => {
        this.logger.log('Demo reset received: clearing simulator state');
        this.abortEverything();
        this.broadcastStatus();
      }),
    );
  }

  private findRunner(call_id: string): SimulatedCallRunner | undefined {
    return [...this.runners].find((runner) => runner.call_id === call_id);
  }

  private launchRunner(script: CallScript): void {
    const runner = new SimulatedCallRunner({
      script,
      bank_name: this.app_config.bank_name,
      getSpeed: () => this.speed,
      createCall: (new_call) => this.calls_service.createCall(new_call),
      addTurn: (call_id, new_turn) =>
        this.calls_service.addTurn(call_id, new_turn),
      dispatchTool: (call_id, tool_name, tool_args) =>
        this.call_tools_service.dispatchTool(call_id, tool_name, tool_args),
      markInstructionApplied: (call_id, intervention_id) =>
        this.interventions_service.markInstructionApplied(
          call_id,
          intervention_id,
        ),
      approveIdentityPush: (notification_id) =>
        this.engine_api_client.respondToNotification(
          notification_id,
          'APPROVED',
        ),
      endCall: (call_id, end_call) =>
        this.calls_service.endCall(call_id, end_call),
    });
    this.runners.add(runner);
    void runner.run().finally(() => this.forgetRunner(runner));
  }

  private forgetRunner(runner: SimulatedCallRunner): void {
    if (!this.runners.delete(runner)) {
      return;
    }
    if (this.runners.size === 0 && this.start_timers.size === 0) {
      this.is_running = false;
    }
    this.broadcastStatus();
  }

  private abortEverything(): SimulatedCallRunner[] {
    this.start_timers.forEach((start_timer) => clearTimeout(start_timer));
    this.start_timers.clear();
    const aborted_runners = [...this.runners];
    this.runners.clear();
    aborted_runners.forEach((runner) => runner.abort());
    this.is_running = false;
    return aborted_runners;
  }

  private async stopAndEndCalls(): Promise<void> {
    const aborted_runners = this.abortEverything();
    for (const runner of aborted_runners) {
      if (!runner.call_id) {
        continue;
      }
      try {
        await this.calls_service.endCall(runner.call_id, {
          ended_by: 'SYSTEM',
        });
      } catch (error) {
        this.logger.warn(
          `Could not end simulated call ${runner.call_id}: ${(error as Error).message}`,
        );
      }
    }
  }

  private broadcastStatus(): SimulatorStatus {
    const simulator_status = this.getStatus();
    this.live_broadcaster.emitToRooms(
      LIVE_EVENT.SIMULATOR_STATUS,
      simulator_status,
      [STAFF_ROOM],
    );
    return simulator_status;
  }
}
