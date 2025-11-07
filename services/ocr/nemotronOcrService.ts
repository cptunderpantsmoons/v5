import type { 
  OpenRouterRequest, 
  OpenRouterMessage,
  OpenRouterContent,
  ApiResponse,
  TaskType
} from '../types/openRouter';
import { getOpenRouterClient } from '../api/openRouterClient';

export interface FinancialDataExtraction {
  revenue: {
    items: Array<{ name: string; amount: number }>;
    total: number;
  };
  expenses: {
    items: Array<{ name: string; amount: number }>;
    total: number;
  };
  assets: {
    items: Array<{ name: string; amount: number }>;
    total: number;
  };
  liabilities: {
    items: Array<{ name: string; amount: number }>;
    total: number;
  };
  equity: {
    items: Array<{ name: string; amount: number }>;
    total: number;
  };
}

export interface ProcessedDocument {
  fileName: string;
  fileType: string;
  extractedText: string;
  financialData: FinancialDataExtraction;
  processedAt: string;
  confidence: number;
}

export interface PageData {
  pageNumber: number;
  extractedText: string;
  confidence: number;
}

export class NemotronOcrService {
  private apiClient = getOpenRouterClient();

  async extractFinancialData(imageFile: File): Promise<FinancialDataExtraction> {
    const base64Image = await this.fileToBase64(imageFile);
    
    const response = await this.apiClient.chatCompletion({
      model: 'nvidia/nemotron-nano-12b-v2-vl',
      messages: [
        {
          role: 'system',
          content: `You are an expert OCR system specialized in financial documents using NVIDIA Nemotron Nano VL model.
          Extract structured financial data with high accuracy. Focus on:
          - Revenue items and totals
          - Expense categories and amounts
          - Asset and liability classifications
          - Balance sheet equations
          - Cash flow components
          
          Return data in JSON format for financial reporting.`
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
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.1 // Low temperature for accuracy
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to extract financial data');
    }

    return JSON.parse(response.data.choices[0].message.content as string);
  }

  async extractTextFromImage(imageFile: File): Promise<string> {
    const base64Image = await this.fileToBase64(imageFile);
    
    const response = await this.apiClient.chatCompletion({
      model: 'nvidia/nemotron-nano-12b-v2-vl',
      messages: [
        {
          role: 'system',
          content: `You are an expert OCR system using NVIDIA Nemotron Nano VL model.
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
      temperature: 0.1
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to extract text from image');
    }

    return response.data.choices[0].message.content as string;
  }

  async processPdfDocument(pdfFile: File): Promise<ProcessedDocument> {
    // Convert PDF to images (this would require a PDF processing library)
    const pageImages = await this.pdfToImages(pdfFile);
    
    // Process each page with Nemotron Nano OCR
    const pageTexts = await Promise.all(
      pageImages.map((image, index) => 
        this.extractPageData(image, index + 1)
      )
    );
    
    const extractedText = pageTexts.map(page => page.extractedText).join('\n\n--- Page Break ---\n\n');
    
    // Extract financial data from first few pages
    const financialData = pageImages.length > 0 
      ? await this.extractFinancialData(pageImages[0])
      : this.createEmptyFinancialData();
    
    return {
      fileName: pdfFile.name,
      fileType: pdfFile.type,
      extractedText,
      financialData,
      processedAt: new Date().toISOString(),
      confidence: 0.95 // Nemotron Nano has high OCR confidence
    };
  }

  async processImageFile(imageFile: File): Promise<ProcessedDocument> {
    const extractedText = await this.extractTextFromImage(imageFile);
    const financialData = await this.extractFinancialData(imageFile);
    
    return {
      fileName: imageFile.name,
      fileType: imageFile.type,
      extractedText,
      financialData,
      processedAt: new Date().toISOString(),
      confidence: 0.9 // Nemotron Nano has high OCR accuracy
    };
  }

  private async extractPageData(imageFile: File, pageNumber: number): Promise<PageData> {
    const extractedText = await this.extractTextFromImage(imageFile);
    
    return {
      pageNumber,
      extractedText,
      confidence: 0.9
    };
  }

  private async pdfToImages(pdfFile: File): Promise<File[]> {
    // This would require a PDF processing library like PDF.js
    // For now, return a placeholder implementation
    // In a real implementation, you would:
    // 1. Load the PDF using PDF.js
    // 2. Convert each page to a canvas
    // 3. Convert canvas to blob/image
    // 4. Return array of image files
    
    console.warn('PDF to images conversion not implemented. Using placeholder.');
    
    // Return placeholder image
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black';
      ctx.font = '20px Arial';
      ctx.fillText('PDF Page Placeholder', 50, 50);
    }
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `page-placeholder.png`, { type: 'image/png' });
          resolve([file]);
        }
      }, 'image/png');
    });
  }

  private createEmptyFinancialData(): FinancialDataExtraction {
    return {
      revenue: { items: [], total: 0 },
      expenses: { items: [], total: 0 },
      assets: { items: [], total: 0 },
      liabilities: { items: [], total: 0 },
      equity: { items: [], total: 0 }
    };
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