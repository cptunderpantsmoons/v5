declare module '@google/genai' {
  export interface GenerationConfig {
    responseMimeType?: string;
    responseSchema?: any;
    responseModalities?: Modality[];
    speechConfig?: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: string;
        };
      };
    };
  }

  export enum Modality {
    TEXT = 'text',
    AUDIO = 'audio',
    IMAGE = 'image',
    VIDEO = 'video'
  }

  export interface ContentPart {
    text?: string;
    inlineData?: {
      data: string;
      mimeType: string;
    };
  }

  export interface Content {
    parts: ContentPart[];
  }

  export interface GenerateContentResponse {
    text: string;
    candidates?: Array<{
      content: {
        parts: ContentPart[];
      };
    }>;
  }

  export class GoogleGenAI {
    constructor(options: { apiKey: string });
    models: {
      generateContent: (config: {
        model: string;
        contents: Content;
        config?: GenerationConfig;
      }) => Promise<GenerateContentResponse>;
    };
  }

  export const Type: {
    OBJECT: 'object';
    ARRAY: 'array';
    STRING: 'string';
    NUMBER: 'number';
    BOOLEAN: 'boolean';
    NULL: 'null';
  };
}