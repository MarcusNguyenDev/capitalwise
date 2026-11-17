import {
  ChatRequest,
  ChatToolDefinition,
} from '../../ai/types/chat_request.type';
import { ChatStreamEvent } from '../../ai/types/chat_stream_event.type';
import { SpeechStream } from '../../ai/types/speech_stream.type';
import { SpeechRequest } from '../../ai/types/speech_synthesis.type';
import { TranscriptionStream } from '../../ai/types/transcription_stream.type';
import { ToolOutcome } from '../../call_tools/types/tool_outcome.type';
import { CallCommand } from '../../interventions/types/call_command.type';
import { HoldStart } from '../../calls/call_hold.service';
import { CallUsage } from '../../calls/types/call_metrics.type';
import { HoldPolicy } from '../../hold_buffer/hold.policy';
import { EnergyVoiceActivityDetector } from '../../turn_detection/energy_voice_activity.detector';
import { AgentRoom } from './agent_room.type';

export interface VoiceAgentSettings {
  bank_name: string;
  // Tool results are shown to the model in this time zone.
  bank_time_zone: string;
  system_prompt: string;
  tools: ChatToolDefinition[];
  ai_voice: string;
  staff_voice: string;
  is_hold_tone_enabled: boolean;
  is_human_active_at_start: boolean;
  // Self-hosted chat backends only: a paid API is never sent the extra request.
  is_prompt_warm_up_enabled: boolean;
  // Cost guards (AI_MAX_CALL_COST_USD, AI_MAX_LIVE_CALL_MINUTES,
  // AI_IDLE_HANGUP_SECONDS).
  max_call_cost_usd: number;
  max_call_ms: number;
  idle_hangup_ms: number;
}

// Everything one call's voice agent needs from the rest of core. The agent
// talks to the AI only through `ai` (AiService) and never knows the backend.
export interface VoiceAgentSessionDependencies {
  call_id: string;
  settings: VoiceAgentSettings;
  agent_room: AgentRoom;
  hold_policy: HoldPolicy;
  voice_activity_detector: EnergyVoiceActivityDetector;
  ai: {
    chat: (chat_request: ChatRequest) => AsyncIterable<ChatStreamEvent>;
    // One per call, opened when the agent joins.
    openTranscriptionStream: () => TranscriptionStream;
    synthesizeStream: (speech_request: SpeechRequest) => SpeechStream;
    // Closes the speech connections kept for this call.
    releaseSpeechSessions: () => void;
  };
  getPhraseAudio: (phrase_text: string, voice: string) => Promise<Int16Array>;
  calls: {
    addTurn: (
      call_id: string,
      new_turn: {
        speaker: 'AI' | 'CUSTOMER';
        text: string;
        latency_ms?: number;
      },
    ) => Promise<unknown>;
    // Resolves with the call's estimated cost so far (USD).
    recordUsage: (
      call_id: string,
      usage: Partial<CallUsage>,
    ) => Promise<number>;
    recordTtsDrift: (call_id: string) => Promise<unknown>;
    endCall: (
      call_id: string,
      end_call: { ended_by: 'CUSTOMER' | 'SYSTEM' },
    ) => Promise<unknown>;
  };
  dispatchTool: (
    call_id: string,
    tool_name: string,
    tool_args: Record<string, unknown>,
  ) => Promise<ToolOutcome>;
  hold: {
    startHold: (call_id: string, hold_start: HoldStart) => Promise<void>;
    endHold: (call_id: string) => Promise<number>;
  };
  markInstructionApplied: (
    call_id: string,
    intervention_id: string,
  ) => Promise<unknown>;
  emitTranscriptDelta: (
    delta: string,
    item_id: string,
    speaker: 'AI' | 'CUSTOMER',
  ) => void;
  // Called once the session has stopped and released everything.
  onStopped: () => void;
}

export type VoiceAgentCommand = Pick<
  CallCommand,
  'command' | 'text' | 'intervention_id' | 'staff_name'
>;
