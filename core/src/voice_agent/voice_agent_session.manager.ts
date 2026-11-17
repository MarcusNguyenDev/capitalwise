import { dispose } from '@livekit/rtc-node';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { AiService } from '../ai/ai.service';
import { listChatToolDefinitions } from '../call_tools/constants/tool_definitions.constant';
import { CallToolsService } from '../call_tools/call_tools.service';
import { CallHoldService } from '../calls/call_hold.service';
import { CallsService } from '../calls/calls.service';
import { CallRow } from '../calls/types/call_row.type';
import { appConfig } from '../config/app.config';
import { costGuardConfig } from '../config/cost_guard.config';
import { aiConfig } from '../config/ai.config';
import { holdBufferConfig } from '../config/hold_buffer.config';
import { HoldPolicy } from '../hold_buffer/hold.policy';
import { PhraseAudioCache } from '../hold_buffer/phrase_audio.cache';
import { InterventionsService } from '../interventions/interventions.service';
import { CallCommand } from '../interventions/types/call_command.type';
import {
  AI_AGENT_DISPLAY_NAME,
  AI_AGENT_IDENTITY,
  buildCallRoomName,
} from '../livekit/constants/call_room.constant';
import { LivekitRoomsService } from '../livekit/livekit_rooms.service';
import { LivekitTokensService } from '../livekit/livekit_tokens.service';
import {
  INTERNAL_EVENT,
  LIVE_EVENT,
} from '../live/constants/live_event_names.constant';
import {
  buildCallRoom,
  STAFF_ROOM,
} from '../live/constants/live_rooms.constant';
import { LiveBroadcaster } from '../live/live_broadcaster.service';
import { LiveEventBus } from '../live/live_event_bus.service';
import { PromptsService } from '../prompts/prompts.service';
import { VoiceActivityDetectorFactory } from '../turn_detection/voice_activity_detector.factory';
import { VoiceAgentStartFailedError } from './errors/voice_agent_start_failed.error';
import { LivekitAgentRoom } from './livekit_agent.room';
import { AgentRoom } from './types/agent_room.type';
import { VoiceAgentSessionDependencies } from './types/voice_agent_session_dependencies.type';
import { VoiceAgentSession } from './voice_agent.session';
import { describeCallDate } from './describe_call_date.util';

// One voice agent per LIVE call, in-process. Starts them, routes supervisor
// commands to them and makes sure none outlives its call.
@Injectable()
export class VoiceAgentSessionManager
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(VoiceAgentSessionManager.name);
  private readonly sessions = new Map<string, VoiceAgentSession>();
  private readonly starting_sessions = new Map<string, Promise<void>>();
  private readonly unsubscribe_functions: (() => void)[] = [];

  constructor(
    private readonly ai_service: AiService,
    private readonly phrase_audio_cache: PhraseAudioCache,
    private readonly calls_service: CallsService,
    private readonly call_hold_service: CallHoldService,
    private readonly call_tools_service: CallToolsService,
    private readonly interventions_service: InterventionsService,
    private readonly prompts_service: PromptsService,
    private readonly livekit_tokens_service: LivekitTokensService,
    private readonly livekit_rooms_service: LivekitRoomsService,
    private readonly live_event_bus: LiveEventBus,
    private readonly live_broadcaster: LiveBroadcaster,
    private readonly voice_activity_detector_factory: VoiceActivityDetectorFactory,
    @Inject(appConfig.KEY)
    private readonly app_config: ConfigType<typeof appConfig>,
    @Inject(aiConfig.KEY)
    private readonly ai_config: ConfigType<typeof aiConfig>,
    @Inject(holdBufferConfig.KEY)
    private readonly hold_buffer_config: ConfigType<typeof holdBufferConfig>,
    @Inject(costGuardConfig.KEY)
    private readonly cost_guard_config: ConfigType<typeof costGuardConfig>,
  ) {}

  onModuleInit(): void {
    this.unsubscribe_functions.push(
      this.live_event_bus.subscribe<CallCommand>(
        INTERNAL_EVENT.CALL_COMMAND,
        (call_command) =>
          this.sessions.get(call_command.call_id)?.handleCommand(call_command),
      ),
      this.live_event_bus.subscribe<{ call_id: string }>(
        INTERNAL_EVENT.CALL_ENDED,
        (ended_call) => this.stopSession(ended_call.call_id, 'the call ended'),
      ),
      this.live_event_bus.subscribe(LIVE_EVENT.DEMO_RESET, () =>
        this.stopAllSessions('demo reset'),
      ),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.unsubscribe_functions.forEach((unsubscribe) => unsubscribe());
    await this.stopAllSessions('core is shutting down');
    await dispose();
  }

  hasSession(call_id: string): boolean {
    return this.sessions.has(call_id) || this.starting_sessions.has(call_id);
  }

  // A line the caller typed on the phone. False when no agent is listening on
  // the call (never started, stopped, or the caller has not joined yet).
  acceptTypedCustomerMessage(call_id: string, typed_text: string): boolean {
    return (
      this.sessions.get(call_id)?.acceptTypedCustomerMessage(typed_text) ??
      false
    );
  }

  // Idempotent: a second session request for the same call reuses the agent.
  startSession(call: CallRow): Promise<void> {
    if (this.sessions.has(call.call_id)) {
      return Promise.resolve();
    }
    const starting_session = this.starting_sessions.get(call.call_id);
    if (starting_session) {
      return starting_session;
    }
    const start_promise = this.createAndStartSession(call).finally(() =>
      this.starting_sessions.delete(call.call_id),
    );
    this.starting_sessions.set(call.call_id, start_promise);
    return start_promise;
  }

  private stopSession(call_id: string, stop_reason: string): void {
    void this.sessions.get(call_id)?.stop(stop_reason);
  }

  private async stopAllSessions(stop_reason: string): Promise<void> {
    await Promise.all(
      [...this.sessions.values()].map((session) => session.stop(stop_reason)),
    );
  }

  private async createAndStartSession(call: CallRow): Promise<void> {
    const room_name = buildCallRoomName(call.call_id);
    const [voice_agent_instructions, agent_token] = await Promise.all([
      this.prompts_service.getVoiceAgentInstructions(),
      this.livekit_tokens_service.mintToken({
        room_name,
        identity: AI_AGENT_IDENTITY,
        display_name: AI_AGENT_DISPLAY_NAME,
        can_publish: true,
      }),
    ]);
    const agent_room = new LivekitAgentRoom({
      server_url: this.livekit_rooms_service.readServerUrl(),
      token: agent_token,
      room_name,
    });
    const session = new VoiceAgentSession(
      this.buildDependencies(call, {
        agent_room,
        // Fixed for the whole call, so the prompt prefix stays cacheable.
        system_prompt: `${voice_agent_instructions.instructions}\n\n${describeCallDate(new Date(), this.app_config.bank_time_zone)}`,
        onStopped: () => {
          if (this.sessions.get(call.call_id) === session) {
            this.sessions.delete(call.call_id);
          }
        },
      }),
    );
    this.sessions.set(call.call_id, session);
    try {
      await session.start();
      this.logger.log(`Voice agent joined ${room_name}`);
    } catch (error) {
      await session.stop('could not join the room');
      throw new VoiceAgentStartFailedError(
        call.call_id,
        (error as Error).message,
      );
    }
  }

  private buildDependencies(
    call: CallRow,
    session_parts: {
      agent_room: AgentRoom;
      system_prompt: string;
      onStopped: () => void;
    },
  ): VoiceAgentSessionDependencies {
    return {
      call_id: call.call_id,
      settings: {
        bank_name: this.app_config.bank_name,
        bank_time_zone: this.app_config.bank_time_zone,
        system_prompt: session_parts.system_prompt,
        tools: listChatToolDefinitions(),
        ai_voice: this.ai_config.synthesize.ai_voice,
        staff_voice: this.ai_config.synthesize.staff_voice,
        is_hold_tone_enabled: this.hold_buffer_config.is_tone_enabled,
        is_human_active_at_start: call.status === 'HUMAN_ACTIVE',
        // A paid chat API is never sent the extra warm-up request.
        is_prompt_warm_up_enabled: this.ai_config.chat.provider !== 'openai',
        max_call_cost_usd: this.cost_guard_config.max_call_cost_usd,
        max_call_ms: this.cost_guard_config.max_live_call_minutes * 60_000,
        idle_hangup_ms: this.cost_guard_config.idle_hangup_seconds * 1_000,
      },
      agent_room: session_parts.agent_room,
      hold_policy: new HoldPolicy(this.hold_buffer_config),
      voice_activity_detector:
        this.voice_activity_detector_factory.createDetector(),
      ai: {
        chat: (chat_request) => this.ai_service.chat(chat_request),
        openTranscriptionStream: () =>
          this.ai_service.openTranscriptionStream(),
        synthesizeStream: (speech_request) =>
          this.ai_service.synthesizeStream(speech_request),
        releaseSpeechSessions: () =>
          this.ai_service.releaseSpeechSessions(call.call_id),
      },
      getPhraseAudio: (phrase_text, voice) =>
        this.phrase_audio_cache.getPhraseAudio(phrase_text, voice),
      calls: {
        addTurn: (call_id, new_turn) =>
          this.calls_service.addTurn(call_id, new_turn),
        recordUsage: async (call_id, usage) =>
          (await this.calls_service.recordMetrics(call_id, { usage })).metrics
            .estimated_cost_usd ?? 0,
        recordTtsDrift: (call_id) => this.calls_service.recordTtsDrift(call_id),
        endCall: (call_id, end_call) =>
          this.calls_service.endCall(call_id, end_call),
      },
      dispatchTool: (call_id, tool_name, tool_args) =>
        this.call_tools_service.dispatchTool(call_id, tool_name, tool_args),
      hold: {
        startHold: (call_id, hold_start) =>
          this.call_hold_service.startHold(call_id, hold_start),
        endHold: (call_id) => this.call_hold_service.endHold(call_id),
      },
      markInstructionApplied: (call_id, intervention_id) =>
        this.interventions_service.markInstructionApplied(
          call_id,
          intervention_id,
        ),
      emitTranscriptDelta: (delta, item_id, speaker) =>
        this.live_broadcaster.emitToRooms(
          LIVE_EVENT.CALL_TRANSCRIPT_DELTA,
          { call_id: call.call_id, speaker, delta, item_id },
          [STAFF_ROOM, buildCallRoom(call.call_id)],
        ),
      onStopped: session_parts.onStopped,
    };
  }
}
