import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import {
  Send,
  Bot,
  User,
  Settings,
  RefreshCw,
  Copy,
  Check,
  MessageSquare,
  Sparkles,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';
import { AIConfigManager } from '@/services/ai/aiConfigManager';
import { AIProviderFactory } from '@/services/ai/providers/providerFactory';
import AIIcon from '@/components/ai/AIIcon';
import ChatMessage from '@/components/ai/ChatMessage';
import ChatInput from '@/components/ai/ChatInput';

/**
 * AI对话页面
 */
export default function AIChatPage() {
  const [configManager] = useState(() => new AIConfigManager());
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState(null);
  
  const messagesEndRef = useRef(null);

  // 加载配置列表
  useEffect(() => {
    loadConfigs();
  }, []);

  // 监听Header中的AI配置变化
  useEffect(() => {
    const handleAIConfigChange = (event) => {
      const newConfig = event.detail;
      setSelectedConfig(newConfig);
      toast.success(`已切换到: ${newConfig.name}`);
    };

    window.addEventListener('ai-config-changed', handleAIConfigChange);
    return () => {
      window.removeEventListener('ai-config-changed', handleAIConfigChange);
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConfigs = () => {
    const allConfigs = configManager.getAllConfigs();
    setConfigs(allConfigs);
    
    // 自动选择默认配置
    const defaultConfig = allConfigs.find(config => config.isDefault && config.enabled);
    if (defaultConfig) {
      setSelectedConfig(defaultConfig);
    } else if (allConfigs.length > 0) {
      setSelectedConfig(allConfigs[0]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConfig) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
      config: selectedConfig
    };

    // 添加用户消息
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // 创建AI回复消息（用于流式输出）
    const aiMessageId = Date.now() + 1;
    const aiMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      thinking: '', // 添加思考内容字段
      timestamp: new Date().toISOString(),
      config: selectedConfig,
      isStreaming: true
    };

    // 添加空的AI消息
    setMessages(prev => [...prev, aiMessage]);

    try {
      // 创建AI提供商实例
      const provider = AIProviderFactory.createProvider(selectedConfig);
      
      // 准备上下文消息 - 获取历史对话作为上下文
      const contextMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
             // 发送消息并处理流式响应
       // 思考链功能由各个AI提供商根据AI.md文档自动启用
       const response = await provider.sendMessage(inputMessage.trim(), {
         stream: true, // 启用流式输出
         context: contextMessages // 添加上下文消息
       });

      if (response.success) {
        // 处理流式响应
        if (response.data.stream) {
          // 流式输出开始，设置isLoading为false
          setIsLoading(false);
          
          // 如果是流式响应，逐字更新内容
          let fullContent = '';
          let thinkingContent = '';
          
          for await (const chunk of response.data.stream) {
            console.log(`[AIChatPage] 接收到数据块:`, chunk);
            // 统一的思考链处理 - 现在所有提供商都返回统一格式
            if (chunk.type === 'thinking') {
              console.log(`[AIChatPage] 处理思考链内容:`, chunk.content);
              thinkingContent += chunk.content;
              setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, thinking: thinkingContent }
                  : msg
              ));
            } else if (chunk.type === 'content') {
              console.log(`[AIChatPage] 处理普通内容:`, chunk.content);
              // 处理正常内容
              fullContent += chunk.content;
              setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, content: fullContent }
                  : msg
              ));
            } else {
              console.log(`[AIChatPage] 未知数据类型:`, chunk.type);
            }
          }
          
          // 流式输出完成，更新最终状态
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { 
                  ...msg, 
                  content: fullContent,
                  thinking: thinkingContent,
                  isStreaming: false,
                  usage: response.data.usage
                }
              : msg
          ));
        } else {
          console.log(`[AIChatPage] 处理非流式响应:`, response.data);
          // 非流式响应，直接更新
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { 
                  ...msg, 
                  content: response.data.response,
                  thinking: response.data.thinking || '', // 使用统一的思考内容
                  isStreaming: false,
                  usage: response.data.usage
                }
              : msg
          ));
          setIsLoading(false);
        }
        
        toast.success('消息发送成功');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      toast.error(`发送失败: ${error.message}`);
      
      // 更新错误消息
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              content: `发送失败: ${error.message}`,
              thinking: '', // 错误时清空思考内容
              isStreaming: false,
              isError: true
            }
          : msg
      ));
      setIsLoading(false);
    }
  };

  // 清空对话
  const handleClearChat = () => {
    if (confirm('确定要清空所有对话吗？')) {
      setMessages([]);
      toast.success('对话已清空');
    }
  };

  // 重新生成特定消息
  const handleRegenerateMessage = async (message) => {
    // 找到这条消息之前的用户消息
    const messageIndex = messages.findIndex(m => m.id === message.id);
    if (messageIndex <= 0) return;
    
    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;

    // 移除这条AI消息
    setMessages(prev => prev.filter(m => m.id !== message.id));
    
    // 重新发送用户消息
    setInputMessage(userMessage.content);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  // 重新生成最后一条AI回复
  const handleRegenerate = async () => {
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    if (!lastUserMessage) return;

    // 移除最后一条AI回复
    setMessages(prev => prev.filter(msg => msg.role === 'user' || msg.id !== prev[prev.length - 1]?.id));
    
    // 重新发送
    setInputMessage(lastUserMessage.content);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 mt-0">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {selectedConfig ? (
              <div className="flex flex-col items-center gap-4">
                <AIIcon type={selectedConfig.type} className="h-20 w-20" />
                <div>
                  <h3 className="text-lg font-medium mb-2">开始与 {selectedConfig.name} 对话</h3>
                  <p className="text-sm">输入消息开始对话</p>
                </div>
              </div>
            ) : (
              <>
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">开始与AI对话</h3>
                <p className="mb-6">选择AI提供商并输入消息开始对话</p>
                <Button onClick={() => window.location.hash = '#/settings'}>
                  <Settings className="h-4 w-4 mr-2" />
                  配置AI服务
                </Button>
              </>
            )}
          </div>
        ) : (
          messages.map(message => (
            <ChatMessage
              key={message.id}
              message={message}
              onRegenerate={handleRegenerateMessage}
            />
          ))
        )}
        
        {/* 加载状态 - 只在非流式输出时显示 */}
        {isLoading && !messages.some(msg => msg.isStreaming) && (
          <div className="flex justify-start mb-4">
            <div className="flex max-w-[80%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground mr-2 flex items-center justify-center">
                {selectedConfig ? (
                  <AIIcon type={selectedConfig.type} className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 w-4" />
                )}
              </div>
              <div className="bg-muted text-foreground rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI正在思考中...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <ChatInput
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        handleSendMessage={handleSendMessage}
        selectedConfig={selectedConfig}
        isLoading={isLoading}
      />

    </div>
  );
}
