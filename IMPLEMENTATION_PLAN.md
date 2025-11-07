# Implementation Plan: OpenRouter Integration with NVIDIA Nemotron Nano 12B 2 VL

## Overview

This plan focuses on integrating OpenRouter API with specific emphasis on using NVIDIA Nemotron Nano 12B 2 VL (`nvidia/nemotron-nano-12b-v2-vl`) for OCR and document processing tasks.

## Key Model Specifications

### NVIDIA Nemotron Nano 12B 2 VL
- **Model ID**: `nvidia/nemotron-nano-12b-v2-vl`
- **Cost**: FREE
- **Context Length**: 128,000 tokens
- **Specialization**: OCR, document intelligence, multimodal comprehension
- **Architecture**: Hybrid Transformer-Mamba for higher throughput and lower latency
- **Strengths**: 
  - Leading results on OCRBench v2
  - Chart reasoning and multimodal comprehension
  - Video understanding with Efficient Video Sampling (EVS)
  - Optimized for financial document processing

## Implementation Strategy

### Phase 1: Core OpenRouter Integration

#### 1.1 OpenRouter Client Implementation
```typescript
// services/api/openRouterClient.ts
export class OpenRouterClient {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chatCompletion(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Financial Report Generator'
      },
      body: JSON.stringify({
        ...request,
        // Prioritize Nemotron Nano for OCR tasks
        model: request.model.includes('ocr') || request.hasImages 
          ? 'nvidia/nemotron-nano-12b-v2-vl' 
          : request.model
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    return await response.json();
  }
}
```

#### 1.2 Specialized OCR Service
```typescript
// services/ocr/nemotronOcrService.ts
export class NemotronOcrService {
  private apiClient: OpenRouterClient;

  constructor(apiClient: OpenRouterClient) {
    this.apiClient = apiClient;
  }

  async extractTextFromImage(imageFile: File): Promise<string> {
    const base64Image = await this.fileToBase64(imageFile);
    
    const response = await this.apiClient.chatCompletion({
      model: 'nvidia/nemotron-nano-12b-v2-vl',
      messages: [
        {
          role: 'system',
          content: `You are an expert OCR system specialized in financial documents. 
          Extract all text, numbers, and table data from the provided image with high accuracy.
          Preserve the structure and formatting of financial statements, balance sheets, and income statements.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text and financial data from this document image:'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageFile.type};base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1 // Low temperature for accuracy
    });

    return response.choices[0].message.content;
  }

  async extractFinancialData(imageFile: File): Promise<FinancialDataExtraction> {
    const base64Image = await this.fileToBase64(imageFile);
    
    const response = await this.apiClient.chatCompletion({
      model: 'nvidia/nemotron-nano-12b-v2-vl',
      messages: [
        {
          role: 'system',
          content: `You are a financial document analysis expert. Extract structured financial data from the provided image.
          Return data in JSON format with the following structure:
          {
            "revenue": {"items": [{"name": "string", "amount": "number"}], "total": "number"},
            "expenses": {"items": [{"name": "string", "amount": "number"}], "total": "number"},
            "assets": {"items": [{"name": "string", "amount": "number"}], "total": "number"},
            "liabilities": {"items": [{"name": "string", "amount": "number"}], "total": "number"},
            "equity": {"items": [{"name": "string", "amount": "number"}], "total": "number"}
          }`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract structured financial data from this financial statement:'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageFile.type};base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.1
    });

    return JSON.parse(response.choices[0].message.content);
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data URL prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
```

### Phase 2: File Processing Pipeline

#### 2.1 Unified File Processor
```typescript
// services/fileProcessor.ts
export class FileProcessor {
  private ocrService: NemotronOcrService;
  private pdfProcessor: PdfProcessor;
  private excelProcessor: ExcelProcessor;

  constructor(apiClient: OpenRouterClient) {
    this.ocrService = new NemotronOcrService(apiClient);
    this.pdfProcessor = new PdfProcessor();
    this.excelProcessor = new ExcelProcessor();
  }

  async processFile(file: File): Promise<ProcessedFile> {
    switch (file.type) {
      case 'application/pdf':
        return await this.processPdfFile(file);
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await this.processExcelFile(file);
      default:
        if (file.type.startsWith('image/')) {
          return await this.processImageFile(file);
        }
        throw new Error(`Unsupported file type: ${file.type}`);
    }
  }

  private async processImageFile(file: File): Promise<ProcessedFile> {
    const extractedText = await this.ocrService.extractTextFromImage(file);
    const financialData = await this.ocrService.extractFinancialData(file);
    
    return {
      fileName: file.name,
      fileType: file.type,
      extractedText,
      financialData,
      processedAt: new Date().toISOString(),
      confidence: 0.9 // Nemotron Nano has high OCR accuracy
    };
  }

  private async processPdfFile(file: File): Promise<ProcessedFile> {
    // Convert PDF pages to images
    const pageImages = await this.pdfProcessor.convertToImages(file);
    
    // Process each page with Nemotron Nano OCR
    const pageTexts = await Promise.all(
      pageImages.map(image => this.ocrService.extractTextFromImage(image))
    );
    
    const extractedText = pageTexts.join('\n\n--- Page Break ---\n\n');
    
    // Extract financial data from first few pages
    const financialData = await this.ocrService.extractFinancialData(pageImages[0]);
    
    return {
      fileName: file.name,
      fileType: file.type,
      extractedText,
      financialData,
      processedAt: new Date().toISOString(),
      confidence: 0.95
    };
  }
}
```

### Phase 3: Financial Report Generation

#### 3.1 Report Generation Service
```typescript
// services/financialReportService.ts
export class FinancialReportService {
  private apiClient: OpenRouterClient;
  private fileProcessor: FileProcessor;

  constructor(apiClient: OpenRouterClient) {
    this.apiClient = apiClient;
    this.fileProcessor = new FileProcessor(apiClient);
  }

  async generateReport(
    file2024: File,
    file2025: File,
    companyName: string,
    model: string = 'anthropic/claude-3.5-sonnet'
  ): Promise<ReportData> {
    // Process both files using Nemotron Nano for OCR
    const [processed2024, processed2025] = await Promise.all([
      this.fileProcessor.processFile(file2024),
      this.fileProcessor.processFile(file2025)
    ]);

    // Generate comprehensive report using selected model
    const response = await this.apiClient.chatCompletion({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert financial accountant specializing in Australian financial reporting standards.
          Generate a comprehensive financial report based on the provided 2024 and 2025 financial data.
          Ensure mathematical accuracy and consistency across all statements.`
        },
        {
          role: 'user',
          content: `Generate a complete 2025 financial report for ${companyName} with the following data:

2024 Financial Data:
${JSON.stringify(processed2024.financialData, null, 2)}

2025 Financial Data:
${JSON.stringify(processed2025.financialData, null, 2)}

Please generate:
1. Income Statement (revenue, expenses, net profit)
2. Balance Sheet (assets, liabilities, equity)
3. Cash Flow Statement
4. Key Performance Indicators
5. Notes to Financial Statements

Ensure all calculations are mathematically correct and consistent.`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
      temperature: 0.2
    });

    const reportData = JSON.parse(response.choices[0].message.content);
    
    // Add metadata
    return {
      ...reportData,
      companyName,
      reportYear: '2025',
      dateGenerated: new Date().toISOString(),
      sourceFiles: {
        2024: processed2024.fileName,
        2025: processed2025.fileName
      }
    };
  }
}
```

### Phase 4: Model Selection Strategy

#### 4.1 Intelligent Model Router
```typescript
// services/modelRouter.ts
export class ModelRouter {
  private static readonly MODEL_MAPPING = {
    // OCR and document processing - Always use Nemotron Nano
    ocr: 'nvidia/nemotron-nano-12b-v2-vl',
    
    // Financial analysis - High quality models
    analysis: 'anthropic/claude-3.5-sonnet',
    
    // Report generation - Balanced quality and speed
    generation: 'openai/gpt-4o',
    
    // Error correction - High reasoning capability
    correction: 'anthropic/claude-3.5-sonnet',
    
    // Audio generation - Specialized TTS models
    audio: 'elevenlabs/eleven-multilingual-v2'
  };

  static getModelForTask(task: string, hasImages: boolean = false): string {
    if (task === 'ocr' || hasImages) {
      return this.MODEL_MAPPING.ocr;
    }
    
    return this.MODEL_MAPPING[task] || this.MODEL_MAPPING.analysis;
  }

  static getOptimalModel(
    taskType: 'ocr' | 'analysis' | 'generation' | 'correction' | 'audio',
    requirements: {
      hasImages?: boolean;
      priority?: 'speed' | 'quality' | 'cost';
    } = {}
  ): string {
    const baseModel = this.getModelForTask(taskType, requirements.hasImages);
    
    // Adjust based on priority
    if (requirements.priority === 'cost' && taskType !== 'ocr') {
      // Use more cost-effective models for non-OCR tasks
      const costOptimized = {
        analysis: 'google/gemini-2.0-flash-thinking-exp',
        generation: 'google/gemini-2.0-flash-thinking-exp',
        correction: 'google/gemini-2.0-flash-thinking-exp'
      };
      
      return costOptimized[taskType] || baseModel;
    }
    
    return baseModel;
  }
}
```

### Phase 5: UI Integration Updates

#### 5.1 Update ApiConfig Component
- Add Nemotron Nano as default OCR model
- Show model capabilities and pricing
- Add file type detection and model recommendation
- Display cost savings with free Nemotron model

#### 5.2 Update File Upload Component
- Add preview for uploaded images
- Show OCR processing progress
- Display confidence scores
- Allow manual correction of extracted text

#### 5.3 Update Report Generation
- Show model selection with recommendations
- Display processing stages with progress
- Show cost estimates before generation
- Add real-time progress updates

## Implementation Benefits

### 1. Cost Optimization
- **Free OCR Processing**: Nemotron Nano is completely free
- **Intelligent Routing**: Use appropriate models for different tasks
- **Cost Tracking**: Monitor usage and optimize spending

### 2. Performance Benefits
- **High Accuracy**: Nemotron Nano achieves leading OCR results
- **Fast Processing**: Hybrid Transformer-Mamba architecture
- **Low Latency**: Optimized for document processing

### 3. Quality Improvements
- **Specialized Models**: Use best model for each task
- **Financial Expertise**: Models fine-tuned for financial documents
- **Consistency**: Mathematical verification and error correction

## Migration Steps

### Step 1: Infrastructure Setup
1. Install required dependencies
2. Set up OpenRouter client
3. Configure API key management
4. Implement error handling

### Step 2: OCR Integration
1. Implement Nemotron Nano OCR service
2. Add file processing pipeline
3. Test with various document types
4. Validate extraction accuracy

### Step 3: Report Generation
1. Replace mock implementations
2. Integrate with real OpenRouter models
3. Add model selection logic
4. Implement verification system

### Step 4: UI Updates
1. Update components for real API responses
2. Add progress indicators
3. Implement error handling
4. Add cost monitoring

### Step 5: Testing and Optimization
1. Test with real financial documents
2. Optimize model selection
3. Fine-tune prompts
4. Performance testing

## Security Considerations

1. **API Key Security**: Secure storage and transmission
2. **Data Privacy**: Minimize data exposure
3. **Input Validation**: Sanitize all inputs
4. **Error Handling**: Sanitize error messages
5. **Rate Limiting**: Prevent abuse

This implementation plan leverages the free and powerful NVIDIA Nemotron Nano 12B 2 VL model for OCR tasks while using other optimized models for different aspects of financial report generation.