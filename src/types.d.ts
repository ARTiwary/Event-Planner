// Shared type definitions (used through JSDoc; there is no build step).

export interface Config {
  apiKey: string;
  model: string;
  port: number;
  trustProxy: boolean;
  upstreamTimeoutMs: number;
  rateLimitPlan: number;
  rateLimitChat: number;
  rateWindowMs: number;
  maxBodyBytes: number;
}

export type EventType = 'Wedding' | 'Birthday' | 'Community event';

export interface PlanInput {
  eventType: EventType;
  guests: number;
  budget: number;
  currency: string;
  date: string;
  location: string;
  style: string;
  needs: string;
  focus: string;
  notes: string;
  priorities: string[];
}

export interface BudgetLine { category: string; percent: number; tips: string; amount: number }
export interface TimelineStage { when: string; tasks: string[] }
export interface Vendor { vendor: string; priority: 'must' | 'nice'; ask: string[]; estPercent: number; estAmount: number }
export interface Idea { type: string; idea: string }

export interface Plan {
  title: string;
  summary: string;
  budget: BudgetLine[];
  timeline: TimelineStage[];
  vendors: Vendor[];
  ideas: Idea[];
  risks: string[];
  budgetTotal: number;
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ModelMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface GroqClient {
  call(messages: ModelMessage[], options?: { json?: boolean; lean?: boolean }): Promise<string>;
}

export type ValidationResult = { ok: true; value: PlanInput } | { ok: false; errors: string[] };
export interface RateResult { allowed: boolean; retryAfter: number }
export type Logger = (...args: unknown[]) => void;
