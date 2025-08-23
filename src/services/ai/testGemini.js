/**
 * Gemini提供商测试脚本
 * 用于验证Gemini提供商的基本功能
 */

import { GeminiProvider } from './providers/geminiProvider';
import { AIProviderType } from './types';

// 测试配置
const testConfig = {
  id: 'test_gemini',
  name: '测试Gemini配置',
  type: AIProviderType.GOOGLE,
  apiKey: 'YOUR_GEMINI_API_KEY', // 需要替换为实际的API密钥
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxTokens: 1000,
  enabled: true,
  useProxy: false
};

/**
 * 测试Gemini提供商
 */
async function testGeminiProvider() {
  console.log('开始测试Gemini提供商...');
  
  try {
    // 创建Gemini提供商实例
    const provider = new GeminiProvider(testConfig);
    console.log('✅ Gemini提供商创建成功');
    
    // 测试连接
    console.log('测试连接...');
    const connectionResult = await provider.testConnection();
    console.log('连接测试结果:', connectionResult);
    
    if (connectionResult.success) {
      console.log('✅ 连接测试成功');
      
      // 测试发送消息
      console.log('测试发送消息...');
      const messageResult = await provider.sendMessage('你好，请简单介绍一下你自己');
      console.log('消息测试结果:', messageResult);
      
      if (messageResult.success) {
        console.log('✅ 消息测试成功');
        console.log('AI回复:', messageResult.content);
      } else {
        console.log('❌ 消息测试失败:', messageResult.error);
      }
      
      // 测试获取模型列表
      console.log('测试获取模型列表...');
      const models = await provider.getModels();
      console.log('可用模型:', models);
      
      // 测试思考功能（仅限2.5系列模型）
      if (testConfig.model.includes('2.5')) {
        console.log('测试思考功能...');
        const thinkingResult = await provider.sendMessage('请解释一下量子计算的基本原理', {
          reasoningEffort: 'medium',
          thinkingConfig: {
            thinkingBudget: 1000,
            includeThoughts: true
          }
        });
        console.log('思考功能测试结果:', thinkingResult);
      }
      
    } else {
      console.log('❌ 连接测试失败:', connectionResult.message);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

/**
 * 测试流式响应
 */
async function testStreamingResponse() {
  console.log('开始测试流式响应...');
  
  try {
    const provider = new GeminiProvider(testConfig);
    
    const stream = await provider.sendMessage('请写一首关于春天的短诗', {
      stream: true
    });
    
    console.log('开始接收流式响应...');
    for await (const chunk of stream) {
      if (chunk.done) {
        console.log('\n✅ 流式响应完成');
        console.log('完整内容:', chunk.fullContent);
        console.log('使用统计:', chunk.usage);
      } else {
        process.stdout.write(chunk.content);
      }
    }
    
  } catch (error) {
    console.error('❌ 流式响应测试失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  // Node.js环境
  testGeminiProvider().then(() => {
    console.log('基本功能测试完成');
    return testStreamingResponse();
  }).then(() => {
    console.log('所有测试完成');
  }).catch(console.error);
}

// 导出测试函数供其他模块使用
export { testGeminiProvider, testStreamingResponse };
