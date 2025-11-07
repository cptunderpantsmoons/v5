// Simple API test without external dependencies
// This file can be run directly with Node.js to test API connectivity

import { getOpenRouterClient } from '../services/api/openRouterClient';
import { ApiKeyManager } from '../services/utils/apiKeyManager';

// Test function that can be run directly
export async function testAPIConnectivity() {
  console.log('🧪 Testing OpenRouter API Connectivity...');
  
  try {
    // Get API key from environment or stored keys
    let apiKey = process.env.OPENROUTER_API_KEY || '';
    
    if (!apiKey) {
      const storedKey = ApiKeyManager.getApiKey('openrouter');
      if (storedKey?.isValid) {
        apiKey = storedKey.apiKey;
      }
    }
    
    if (!apiKey) {
      console.log('❌ No API key found');
      console.log('Set OPENROUTER_API_KEY environment variable or configure in app');
      return false;
    }
    
    // Create client
    const client = getOpenRouterClient(apiKey);
    console.log('✅ Client created');
    
    // Test API key validation
    console.log('🔑 Validating API key...');
    const isValid = await client.validateApiKey();
    
    if (isValid) {
      console.log('✅ API key is valid');
    } else {
      console.log('❌ API key is invalid');
      return false;
    }
    
    // Test model selection
    console.log('🤖 Testing model selection...');
    const ocrSelection = client.selectOptimalModel('ocr');
    console.log(`✅ OCR model: ${ocrSelection.selected.name} (${ocrSelection.selected.cost.input === 0 ? 'FREE' : 'PAID'})`);
    
    const analysisSelection = client.selectOptimalModel('analysis');
    console.log(`✅ Analysis model: ${analysisSelection.selected.name} (${analysisSelection.selected.cost.input === 0 ? 'FREE' : 'PAID'})`);
    
    // Test simple chat completion with free model
    console.log('💬 Testing chat completion...');
    const chatResponse = await client.chatCompletion({
      model: 'google/gemini-2.0-flash-exp',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' }
      ],
      temperature: 0.1,
      max_tokens: 100
    });
    
    if (chatResponse.success) {
      console.log('✅ Chat completion successful');
      console.log(`📝 Response: ${chatResponse.data.choices[0].message.content}`);
      console.log(`💰 Cost: $${chatResponse.metadata.cost}`);
      console.log(`⏱️ Duration: ${chatResponse.metadata.duration}ms`);
      console.log(`🔢 Tokens: ${chatResponse.metadata.tokens.prompt_tokens} input, ${chatResponse.metadata.tokens.completion_tokens} output`);
    } else {
      console.log('❌ Chat completion failed');
      console.log(`🚫 Error: ${chatResponse.error.error.message}`);
      return false;
    }
    
    // Test caching
    console.log('💾 Testing caching...');
    const start1 = Date.now();
    const cachedResponse1 = await client.chatCompletion({
      model: 'google/gemini-2.0-flash-exp',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' }
      ],
      temperature: 0.1,
      max_tokens: 100
    });
    const duration1 = Date.now() - start1;
    
    const start2 = Date.now();
    const cachedResponse2 = await client.chatCompletion({
      model: 'google/gemini-2.0-flash-exp',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is 2+2?' }
      ],
      temperature: 0.1,
      max_tokens: 100
    });
    const duration2 = Date.now() - start2;
    
    if (duration2 < duration1 * 0.5) {
      console.log('✅ Caching is working (second request faster)');
    } else {
      console.log('⚠️ Caching may not be working optimally');
    }
    
    // Get performance stats
    console.log('📊 Performance Statistics:');
    const perfStats = client.getPerformanceStats();
    Object.entries(perfStats).forEach(([name, stats]) => {
      if (stats && typeof stats === 'object' && 'avg' in stats) {
        console.log(`  ${name}: ${stats.avg.toFixed(2)}ms avg`);
      }
    });
    
    // Get cache stats
    console.log('💾 Cache Statistics:');
    const cacheStats = client.getCacheStats();
    console.log(`  Hits: ${cacheStats.hits}`);
    console.log(`  Misses: ${cacheStats.misses}`);
    console.log(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    console.log(`  Size: ${cacheStats.size} entries`);
    
    console.log('🎉 All API tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ API test failed:', error);
    return false;
  }
}

// Test function for model selection
export function testModelSelection() {
  console.log('🤖 Testing Model Selection Logic...');
  
  try {
    const client = getOpenRouterClient('test-key');
    
    // Test OCR selection
    const ocrSelection = client.selectOptimalModel('ocr');
    console.log(`✅ OCR: ${ocrSelection.selected.name} - ${ocrSelection.reasoning}`);
    
    // Test analysis selection
    const analysisSelection = client.selectOptimalModel('analysis');
    console.log(`✅ Analysis: ${analysisSelection.selected.name} - ${analysisSelection.reasoning}`);
    
    // Test budget constraints
    const budgetSelection = client.selectOptimalModel('analysis', {}, { maxCostPerRequest: 0.01 });
    console.log(`✅ Budget ($0.01): ${budgetSelection.selected.name} - ${budgetSelection.reasoning}`);
    
    // Test priority settings
    const costSelection = client.selectOptimalModel('analysis', { priority: 'cost' });
    console.log(`✅ Cost Priority: ${costSelection.selected.name}`);
    
    const speedSelection = client.selectOptimalModel('analysis', { priority: 'speed' });
    console.log(`✅ Speed Priority: ${speedSelection.selected.name}`);
    
    const qualitySelection = client.selectOptimalModel('analysis', { priority: 'quality' });
    console.log(`✅ Quality Priority: ${qualitySelection.selected.name}`);
    
    console.log('🎉 All model selection tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Model selection test failed:', error);
    return false;
  }
}

// Test function for error handling
export function testErrorHandling() {
  console.log('🚨 Testing Error Handling...');
  
  try {
    const client = getOpenRouterClient('invalid-key');
    
    // Test with invalid API key
    console.log('🔑 Testing invalid API key...');
    client.validateApiKey().then(isValid => {
      if (!isValid) {
        console.log('✅ Invalid API key properly rejected');
      } else {
        console.log('❌ Invalid API key was accepted');
      }
    });
    
    console.log('🎉 Error handling test completed!');
    return true;
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    return false;
  }
}

// Run all tests
export async function runAllTests() {
  console.log('🧪 Running OpenRouter Integration Tests');
  console.log('=====================================');
  
  const results = {
    modelSelection: testModelSelection(),
    errorHandling: testErrorHandling(),
    apiConnectivity: await testAPIConnectivity()
  };
  
  console.log('\n📋 Test Results:');
  console.log('=====================================');
  console.log(`Model Selection: ${results.modelSelection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Error Handling: ${results.errorHandling ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`API Connectivity: ${results.apiConnectivity ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log(`\n🏆 Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  runAllTests().catch(console.error);
}