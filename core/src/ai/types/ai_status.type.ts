import { AiCapability } from './ai_capability.enum';
import { AiProviderName } from './ai_provider_name.type';

export interface CapabilityStatus {
  provider: string;
  model: string;
  voice?: string;
  staff_voice?: string;
  // Configured, supports the capability, answered the probe and lists the model.
  is_reachable: boolean;
  detail: string;
}

export interface ProviderStatus {
  capabilities: AiCapability[];
  is_configured: boolean;
}

export interface AiStatus {
  capabilities: {
    chat: CapabilityStatus;
    transcribe: CapabilityStatus;
    synthesize: CapabilityStatus;
  };
  providers: Record<AiProviderName, ProviderStatus>;
  checked_at: string;
}
