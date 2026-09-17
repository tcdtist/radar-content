import { EntityType } from '../db/types';

export interface ExtractedEntity {
  name: string;
  type: EntityType;
}

export interface StructuredExtraction {
  summary: string;
  evidence: string[];
  counter: string[];
  context: string[];
  verification_questions: string[];
  entities: ExtractedEntity[];
  topic_tags: string[];
}

export interface GeminiContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}
