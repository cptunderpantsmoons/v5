# Financial Report Generator - Setup Guide

## Overview

This application uses OpenRouter API to access multiple AI models for financial report generation, including:
- **NVIDIA Nemotron Nano 12B 2 VL** (FREE) - For OCR processing
- **Google Gemini 2.0 Flash** (FREE) - For error correction
- **xAI Grok 4 Fast** ($0.20/M input, $0.50/M output) - For financial analysis

## Prerequisites

- Node.js 18+ and npm/pnpm
- OpenRouter API key
- Modern web browser with JavaScript enabled

## Quick Start

### 1. Get OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai)
2. Sign up for a free account
3. Navigate to API Keys section
4. Create a new API key (starts with `sk-or-v1-`)
5. Copy the key for setup

### 2. Install Dependencies

```bash
# Using npm
npm install

# Using pnpm (recommended)
pnpm install
```

### 3. Configure API Key

#### Option A: Environment Variable (Recommended)
```bash
# Create .env file
echo "OPENROUTER_API_KEY=your-api-key-here" > .env

# Or set in your shell
export OPENROUTER_API_KEY=your-api-key-here
```

#### Option B: In-App Configuration
1. Launch the application
2. Navigate to API Configuration
3. Select "OpenRouter" as provider
4. Enter your API key
5. Click "Validate" to confirm
6. Click "Save" to store securely

### 4. Run the Application

```bash
# Development mode
npm run dev

# Or using pnpm
pnpm dev
```

Visit `http://localhost:3000` in your browser.

## Model Configuration

### Free Models (No Cost)
- **NVIDIA Nemotron Nano 12B 2 VL**
  - Purpose: OCR and document processing
  - Context: 128K tokens
  - Vision: Yes
  - Cost: FREE

- **Google Gemini 2.0 Flash**
  - Purpose: Error correction and fast processing
  - Context: 1M tokens
  - Vision: Yes
  - Tools: Yes
  - Cost: FREE

### Paid Models (Usage-Based)
- **xAI Grok 4 Fast**
  - Purpose: Advanced financial analysis
  - Context: 2M tokens
  - Vision: Yes
  - Tools: Yes
  - Reasoning: Yes
  - Cost: $0.20/M input, $0.50/M output

## Cost Optimization

The application automatically optimizes model selection based on:

1. **Task Type**
   - OCR → Nemotron Nano (FREE)
   - Correction → Gemini Flash (FREE)
   - Analysis → Grok 4 Fast (PAID)

2. **Budget Constraints**
   - Set maximum cost per request
   - Daily/monthly spending limits
   - Automatic fallback to free models

3. **Priority Settings**
   - **Cost**: Prefer free models
   - **Speed**: Prefer fastest models
   - **Quality**: Prefer models with reasoning

## Usage Monitoring

### Track Your Usage
1. Navigate to API Configuration
2. View "Usage Information" section
3. Monitor:
   - Daily costs and token usage
   - Monthly spending
   - Model-specific breakdowns

### Set Limits
1. In API Configuration, set your limits:
   - Daily limit: Default $10
   - Monthly limit: Default $100
2. Application will warn when approaching limits
3. Automatic switching to free models when limits reached

## File Processing

### Supported Formats
- **PDF Documents**: Financial statements, reports
- **Images**: JPG, PNG for OCR processing
- **Spreadsheets**: XLSX, XLS for data extraction

### Processing Pipeline
1. **Upload** → File validation and type detection
2. **OCR** → Nemotron Nano extracts text (FREE)
3. **Analysis** → Grok 4 processes financial data (PAID)
4. **Generation** → Creates structured report (PAID)
5. **Correction** → Gemini Flash validates math (FREE)

### Best Practices
- Use high-quality PDFs for best OCR results
- Ensure images are clear and well-lit
- For spreadsheets, include headers and clear formatting
- Large files may take longer to process

## Troubleshooting

### Common Issues

#### API Key Problems
```
Error: "OpenRouter API key is required"
```
**Solution**: 
1. Verify API key starts with `sk-or-v1-`
2. Check for extra spaces or characters
3. Validate key in API Configuration

#### Network Issues
```
Error: "Network connection error"
```
**Solution**:
1. Check internet connection
2. Verify firewall settings
3. Try again after a few minutes

#### Rate Limiting
```
Error: "Too many requests"
```
**Solution**:
1. Wait 1-2 minutes
2. Upgrade to paid plan if needed
3. Use batch processing for multiple files

#### File Processing Errors
```
Error: "Unsupported file type"
```
**Solution**:
1. Use supported formats (PDF, JPG, PNG, XLSX)
2. Check file size (max 10MB)
3. Ensure files are not password-protected

### Performance Optimization

#### For Faster Processing
1. Use smaller files when possible
2. Select "Speed" priority in model settings
3. Process during off-peak hours

#### For Cost Savings
1. Select "Cost" priority in model settings
2. Set daily/monthly limits
3. Use free models when acceptable

#### For Better Quality
1. Select "Quality" priority in model settings
2. Use high-resolution documents
3. Enable reasoning for complex analysis

## Advanced Configuration

### Custom Model Selection
```javascript
// In your application code
const modelSelection = client.selectOptimalModel('analysis', {
  priority: 'quality',
  hasImages: true,
  maxTokens: 4000
}, {
  maxCostPerRequest: 5.00
});
```

### Retry Configuration
```javascript
// Customize retry behavior
const options = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
};
```

### Circuit Breaker Settings
```javascript
// Prevent cascading failures
const circuitBreaker = new CircuitBreaker(
  5,    // failure threshold
  60000, // timeout (ms)
  30000  // reset timeout (ms)
);
```

## Security Considerations

### API Key Protection
- Keys are stored encrypted in browser localStorage
- Never share API keys publicly
- Regularly rotate your API keys
- Monitor usage for unauthorized access

### Data Privacy
- Documents are processed securely
- No data is stored permanently
- Financial data is handled with care
- Consider sensitive information in uploads

## Support

### Getting Help
1. **Documentation**: Check this guide first
2. **Error Messages**: Look for specific error codes
3. **Community**: OpenRouter Discord community
4. **Issues**: Report bugs with detailed information

### Reporting Issues
Include in your report:
- API key (first 4 characters only)
- Error message and code
- File type and size
- Browser and version
- Steps to reproduce

## Updates and Maintenance

### Version Updates
1. Check for updates regularly
2. Backup API keys before updating
3. Review changelog for breaking changes
4. Test with sample files after update

### Maintenance Tasks
- Monthly: Review usage and costs
- Quarterly: Rotate API keys
- Annually: Update dependencies
- As needed: Clear cache and localStorage

## Migration from Previous Versions

### From Mock API
1. Export existing configurations
2. Get OpenRouter API key
3. Import configurations
4. Test with sample documents

### From Direct Gemini API
1. Existing Gemini keys may work
2. Re-validate with OpenRouter
3. Update model selections
4. Compare costs and performance

## Performance Benchmarks

### Expected Processing Times
- **OCR (1 page PDF)**: 2-5 seconds
- **Analysis (Financial report)**: 10-30 seconds
- **Correction (Validation)**: 5-15 seconds
- **Total workflow**: 30-60 seconds

### Cost Estimates
- **Small report (1-2 pages)**: $0.50-1.00
- **Medium report (3-5 pages)**: $1.00-2.50
- **Large report (10+ pages)**: $2.50-5.00

*Note: OCR and correction steps are FREE with Nemotron Nano and Gemini Flash.*

## FAQ

**Q: Can I use the app without an API key?**
A: No, OpenRouter API key is required for AI model access.

**Q: Are there any free usage limits?**
A: Nemotron Nano and Gemini Flash are free. Grok 4 Fast charges per token.

**Q: How accurate is the OCR processing?**
A: Nemotron Nano provides high accuracy for financial documents, especially with clear scans.

**Q: Can I switch between providers?**
A: Yes, you can configure multiple providers and switch between them.

**Q: Is my financial data secure?**
A: Yes, data is processed securely and not stored permanently on servers.

**Q: What happens if I hit usage limits?**
A: The app automatically switches to free models and warns you about limits.

---

For additional support, visit the [OpenRouter documentation](https://openrouter.ai/docs) or check the application's built-in help section.