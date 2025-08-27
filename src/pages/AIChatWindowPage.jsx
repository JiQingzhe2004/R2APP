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
  Trash2,
  Minus,
  Square,
  X,
  ChevronsUpDown,
  PanelLeftClose,
  PanelRightClose
} from 'lucide-react';
import { AIConfigManager } from '@/services/ai/aiConfigManager';
import { AIProviderFactory } from '@/services/ai/providers/providerFactory';
import AIIcon from '@/components/ai/AIIcon';
import ChatMessage from '@/components/ai/ChatMessage';
import ChatInput from '@/components/ai/ChatInput';
import chatStorage from '@/services/chat/chatStorage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

/**
 * AI对话独立窗口页面
 */
export default function AIChatWindowPage() {
  const [configManager] = useState(() => new AIConfigManager());
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);

  // 加载配置列表和对话历史
  useEffect(() => {
    loadConfigs();
    checkWindowMaximized();
    loadChatSessions();
    // 同步AI配置到数据库
    syncAIConfigsToDatabase();
  }, []);

  // 当对话ID改变时加载对应的对话历史
  useEffect(() => {
    if (currentSessionId) {
      loadChatHistory();
    }
  }, [currentSessionId]);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 自动保存对话历史
  useEffect(() => {
    console.log('[自动保存] 检查条件:', {
      messagesLength: messages.length,
      hasCurrentSessionId: !!currentSessionId,
      currentSessionId: currentSessionId
    });
    
    if (messages.length > 0 && currentSessionId) {
      console.log('[自动保存] 触发保存，延迟1秒');
      // 延迟保存，避免频繁保存
      const timeoutId = setTimeout(() => {
        saveChatHistory();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentSessionId]);

  // 生成对话名称
  const generateConversationName = (messages) => {
    if (messages.length === 0) {
      return `对话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // 获取第一条用户消息的前20个字符作为对话名称
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      const content = firstUserMessage.content.trim();
      if (content.length > 0) {
        const truncatedContent = content.length > 20 ? content.substring(0, 20) + '...' : content;
        return truncatedContent;
      }
    }
    
    return `对话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  };

  const checkWindowMaximized = async () => {
    try {
      const maximized = await window.api.isWindowMaximized();
      setIsMaximized(maximized);
    } catch (error) {
      console.error('检查窗口状态失败:', error);
    }
  };

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

  // 同步AI配置到数据库
  const syncAIConfigsToDatabase = async () => {
    try {
      console.log('[AIChatWindowPage] 开始同步AI配置到数据库...');
      
      // 获取所有AI配置
      const allConfigs = configManager.getAllConfigs();
      
      if (allConfigs.length === 0) {
        console.log('[AIChatWindowPage] 没有AI配置需要同步');
        return;
      }
      
      // 为每个配置创建数据库记录
      for (const config of allConfigs) {
        try {
          // 使用现有的数据库API保存配置
          await window.api.chatSaveConfig({
            id: config.id,
            name: config.name,
            type: config.type,
            model: config.model
          });
          console.log(`[AIChatWindowPage] 已同步配置: ${config.name}`);
        } catch (error) {
          console.error(`[AIChatWindowPage] 同步配置 ${config.name} 失败:`, error);
        }
      }
      
      console.log('[AIChatWindowPage] AI配置同步完成');
    } catch (error) {
      console.error('[AIChatWindowPage] AI配置同步失败:', error);
    }
  };

  // 加载对话列表
  const loadChatSessions = async () => {
    try {
      const conversations = await chatStorage.getConversations();
      
      setChatSessions(conversations);
      
      // 如果没有当前对话且有对话存在，选择第一个对话
      if (!currentSessionId && conversations.length > 0) {
        console.log('[loadChatSessions] 设置当前对话ID:', conversations[0].id);
        setCurrentSessionId(conversations[0].id);
      }
      
      // 如果没有对话，确保currentSessionId为null
      if (conversations.length === 0) {
        setCurrentSessionId(null);
      }
      
      console.log('[loadChatSessions] 加载完成:', {
        conversationsCount: conversations.length,
        currentSessionId: currentSessionId,
        conversations: conversations.map(c => ({ id: c.id, name: c.name }))
      });
    } catch (error) {
      console.error('加载对话列表失败:', error);
    }
  };

  // 加载对话历史
  const loadChatHistory = async () => {
    if (!currentSessionId) return;
    
    try {
      const history = await chatStorage.loadChatHistory(currentSessionId);
             if (history.length > 0) {
         // 处理历史消息，确保AI消息有配置信息
         const processedHistory = history.map(msg => {
           if (msg.role === 'assistant' && !msg.config) {
             // 如果没有配置信息，尝试从configs中找到对应的配置
             const configId = msg.configId || 'default';
             const config = configs.find(c => c.id === configId);
             return { ...msg, config: config || configs[0] };
           }
           // 如果消息已经有配置信息，确保配置信息完整
           if (msg.role === 'assistant' && msg.config) {
             // 检查配置信息是否完整，如果不完整则从当前配置列表中补充
             const currentConfig = configs.find(c => c.id === msg.config.id);
             if (currentConfig) {
               return { ...msg, config: { ...msg.config, ...currentConfig } };
             }
           }
           return msg;
         });
         
                   setMessages(processedHistory);
        toast.success(`已加载 ${history.length} 条历史对话`);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('加载对话历史失败:', error);
      setMessages([]);
    }
  };

  // 保存对话历史
  const saveChatHistory = async () => {
    if (!currentSessionId || messages.length === 0) {
      console.log('[saveChatHistory] 跳过保存:', {
        hasCurrentSessionId: !!currentSessionId,
        messagesLength: messages.length
      });
      return;
    }
    
    try {
      console.log('[saveChatHistory] 开始保存对话历史:', {
        conversationId: currentSessionId,
        messageCount: messages.length
      });
      
      // 确保消息对象包含所有必要字段
      const messagesToSave = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content || '',
        thinking: msg.thinking || '',
        timestamp: msg.timestamp,
        isError: msg.isError || false,
        usage: msg.usage || null,
        config: msg.config ? {
          id: msg.config.id,
          name: msg.config.name,
          type: msg.config.type,
          model: msg.config.model,
          temperature: msg.config.temperature,
          maxTokens: msg.config.maxTokens,
          isDefault: msg.config.isDefault,
          enabled: msg.config.enabled
        } : null // 保存完整的AI配置信息，包括logo和名字
      }));
      
      await chatStorage.saveChatHistory(messagesToSave, currentSessionId, {
        name: generateConversationName(messages),
        participants: chatSessions.find(c => c.id === currentSessionId)?.participants || []
      });
      console.log('[saveChatHistory] 对话历史保存成功');
    } catch (error) {
      console.error('保存对话历史失败:', error);
    }
  };

  const scrollToBottom = () => {
    const messagesEnd = document.getElementById('messages-end');
    if (messagesEnd) {
      messagesEnd.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 滚动到指定消息
  const scrollToMessage = (messageId) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    if (!selectedConfig) {
      toast.error('请先选择AI模型');
      return;
    }

    // 如果没有当前对话，提示用户创建新对话
    if (!currentSessionId) {
      toast.error('请先创建新对话');
      return;
    }

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

    // 使用当前的会话ID
    const sessionIdToUse = currentSessionId;

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
    const contextMessages = [...messages, userMessage].map(msg => ({
      role: msg.role,
      content: msg.content
    }));
      
      // 发送消息并处理流式响应
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
            console.log(`[AIChatWindowPage] 接收到数据块:`, chunk);
            // 统一的思考链处理 - 现在所有提供商都返回统一格式
            if (chunk.type === 'thinking') {
              console.log(`[AIChatWindowPage] 处理思考链内容:`, chunk.content);
              thinkingContent += chunk.content;
              setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, thinking: thinkingContent }
                  : msg
              ));
            } else if (chunk.type === 'content') {
              console.log(`[AIChatWindowPage] 处理普通内容:`, chunk.content);
              // 处理正常内容
              fullContent += chunk.content;
              setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, content: fullContent }
                  : msg
              ));
            } else {
              console.log(`[AIChatWindowPage] 未知数据类型:`, chunk.type);
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
          console.log(`[AIChatWindowPage] 处理非流式响应:`, response.data);
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
        
        // 更新对话列表中的消息数量和参与者
        const updatedConversation = {
          name: generateConversationName([...messages, userMessage]), // 更新对话名称
          messageCount: messages.length + 2, // 用户消息 + AI回复
          lastMessageTime: new Date().toISOString(),
          participants: chatSessions.find(c => c.id === sessionIdToUse)?.participants.includes(selectedConfig.id) 
            ? chatSessions.find(c => c.id === sessionIdToUse).participants 
            : [...(chatSessions.find(c => c.id === sessionIdToUse)?.participants || []), selectedConfig.id]
        };
         
        setChatSessions(prev => prev.map(conversation => 
          conversation.id === sessionIdToUse 
            ? { 
                ...conversation, 
                ...updatedConversation
              }
            : conversation
        ));
        
        // 更新数据库中的对话信息
        chatStorage.updateConversationInfo(sessionIdToUse, {
          name: generateConversationName([...messages, userMessage]),
          ...updatedConversation
        }).catch(error => {
          console.error('更新对话信息失败:', error);
        });
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



  // 新增对话
  const startNewChat = () => {
    // 生成新的对话ID（不依赖特定AI配置）
    const newConversationId = `conversation_${Date.now()}`;
    
    console.log('[startNewChat] 创建新对话:', {
      newConversationId: newConversationId
    });
    
    // 创建新的对话对象
    const newConversation = {
      id: newConversationId,
      name: generateConversationName([]),
      messageCount: 0,
      lastMessageTime: new Date().toISOString(),
      participants: [] // 参与对话的AI列表
    };
    
    // 设置新的对话为当前对话
    setCurrentSessionId(newConversationId);
    setMessages([]);
    setInputMessage('');
    
    // 将对话添加到列表顶部
    setChatSessions(prev => [newConversation, ...prev]);
    
    // 立即保存一个空的对话到数据库，确保对话存在
    chatStorage.saveChatHistory([], newConversationId, newConversation).catch(error => {
      console.error('保存新对话失败:', error);
    });
    
    toast.success('已创建新对话');
  };

  // 清空对话
  const handleClearChat = async () => {
    if (!currentSessionId) return;
    
    if (confirm('确定要清空当前对话吗？此操作将同时清空本地存储的对话历史。')) {
      try {
        setMessages([]);
        await chatStorage.clearChatHistory(currentSessionId);
        
        // 更新对话列表中的消息数量
        const updatedConversation = {
          messageCount: 0,
          lastMessageTime: new Date().toISOString()
        };
        
        setChatSessions(prev => prev.map(conversation => 
          conversation.id === currentSessionId 
            ? { 
                ...conversation, 
                ...updatedConversation
              }
            : conversation
        ));
        
        // 更新数据库中的对话信息
        chatStorage.updateConversationInfo(currentSessionId, {
          name: generateConversationName([]),
          ...updatedConversation
        }).catch(error => {
          console.error('更新对话信息失败:', error);
        });
        
        toast.success('对话已清空');
      } catch (error) {
        console.error('清空对话失败:', error);
        toast.error('清空对话失败');
      }
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

  // 处理AI配置切换
  const handleAIConfigSwitch = (configId) => {
    const config = configs.find(c => c.id === configId);
    setSelectedConfig(config);
  };

  // 切换对话
  const switchSession = (conversationId) => {
    console.log('[switchSession] 切换到对话:', conversationId);
    setCurrentSessionId(conversationId);
    setMessages([]);
    setInputMessage('');
  };

  // 删除对话
  const deleteSession = async (conversationId) => {
    if (confirm('确定要删除这个对话吗？此操作将永久删除所有相关对话记录。')) {
      try {
        // 如果删除的是当前对话，先切换到其他对话
        if (conversationId === currentSessionId) {
          const otherConversations = chatSessions.filter(c => c.id !== conversationId);
          if (otherConversations.length > 0) {
            setCurrentSessionId(otherConversations[0].id);
            setMessages([]);
            setInputMessage('');
          } else {
            setCurrentSessionId(null);
            setMessages([]);
            setInputMessage('');
          }
        }
        
        // 从数据库中删除对话
        await chatStorage.deleteConversation(conversationId);
        
        // 从对话列表中移除
        setChatSessions(prev => prev.filter(c => c.id !== conversationId));
        
        toast.success('对话已删除');
      } catch (error) {
        console.error('删除对话失败:', error);
        toast.error('删除对话失败');
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 固定头部 */}
      <header 
        className="sticky top-0 z-10 h-14 flex items-center justify-between border-b bg-muted/40 px-4"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
              
          {/* 模型配置信息 */}
          {selectedConfig && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{selectedConfig.model}</span>
              <span>•</span>
              <span>温度: {selectedConfig.temperature}</span>
              <span>•</span>
              <span>最大Token: {selectedConfig.maxTokens}</span>
            </div>
          )}

          {/* AI模型选择器 */}
          {configs.length > 0 ? (
            <div className="flex items-center gap-4">
              <Select value={selectedConfig?.id} onValueChange={handleAIConfigSwitch}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {selectedConfig && (
                        <AIIcon type={selectedConfig.type} className="h-4 w-4" />
                      )}
                      <span className="truncate">
                        {selectedConfig?.name || '选择AI模型'}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {configs.filter(config => config.enabled).map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      <div className="flex items-center gap-2">
                        <AIIcon type={config.type} className="h-4 w-4" />
                        <span>{config.name}</span>
                        {config.isDefault && (
                          <span className="text-xs text-muted-foreground">(默认)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">请先配置AI服务</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* 窗口控制按钮 */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.api.minimizeWindow()}>
              <Minus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.api.maximizeWindow()}>
              {isMaximized ? <Square className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/90" onClick={() => window.api.closeWindow()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <div className="flex-1 flex min-h-0">
                 {/* 历史对话侧边栏 */}
         <TooltipProvider>
           <div className={`${isSidebarCollapsed ? 'w-12' : 'w-64'} border-r bg-muted/20 flex flex-col transition-all duration-300 ease-in-out`}>
             <div className="p-4 border-b bg-background/50">
               <div className="flex items-center justify-between">
                                                                       {!isSidebarCollapsed && <h3 className="font-medium text-sm">对话列表</h3>}
                 <div className="flex items-center gap-1">
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={startNewChat}
                         className={`${isSidebarCollapsed ? 'h-6 w-6 p-0' : 'h-6 px-2 text-xs'} hover:bg-primary/10 hover:text-primary`}
                       >
                         <Plus className="h-3 w-3" />
                       </Button>
                     </TooltipTrigger>
                                           <TooltipContent side="bottom">
                        新建对话
                      </TooltipContent>
                   </Tooltip>
                   {!isSidebarCollapsed && (
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           onClick={handleClearChat}
                           className="h-6 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
                           disabled={messages.length === 0}
                         >
                           <Trash2 className="h-3 w-3" />
                         </Button>
                       </TooltipTrigger>
                                               <TooltipContent side="bottom">
                          清空当前对话
                        </TooltipContent>
                     </Tooltip>
                   )}
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                         className="h-6 w-6 p-0"
                       >
                         {isSidebarCollapsed ? (
                           <PanelRightClose className="h-3 w-3" />
                         ) : (
                           <PanelLeftClose className="h-3 w-3" />
                         )}
                       </Button>
                     </TooltipTrigger>
                     <TooltipContent side="bottom">
                       {isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                     </TooltipContent>
                   </Tooltip>
                 </div>
               </div>
             </div>
             
                           <div className="flex-1 overflow-y-auto p-2">
                {isSidebarCollapsed ? (
                  // 折叠状态显示图标
                                     <div className="space-y-1">
                     {chatSessions.slice(0, 10).map((session) => (
                       <ContextMenu key={session.id}>
                         <ContextMenuTrigger>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <div
                                 className={`w-8 h-8 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-center ${
                                   currentSessionId === session.id ? 'bg-primary/20' : ''
                                 }`}
                                 onClick={() => switchSession(session.id)}
                               >
                                                                   <MessageSquare className="w-4 h-4 text-primary" />
                               </div>
                             </TooltipTrigger>
                             <TooltipContent side="right" className="max-w-xs">
                               <div className="text-xs">
                                 <div className="font-medium mb-1">{session.name}</div>
                                 <div className="text-muted-foreground">
                                   {session.messageCount} 条消息
                                 </div>
                               </div>
                             </TooltipContent>
                           </Tooltip>
                         </ContextMenuTrigger>
                         <ContextMenuContent>
                           <ContextMenuItem 
                             onClick={() => deleteSession(session.id)}
                             className="text-destructive focus:text-destructive"
                           >
                             <Trash2 className="h-4 w-4 mr-2" />
                             删除对话
                           </ContextMenuItem>
                         </ContextMenuContent>
                       </ContextMenu>
                     ))}
                   </div>
              ) : (
                // 展开状态显示完整内容
                <>
                  {chatSessions.length === 0 ? (
                                         <div className="text-center py-8 text-muted-foreground text-sm">
                       <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                       <p>暂无对话</p>
                       <p className="text-xs mt-1">点击"新建对话"开始新的对话</p>
                     </div>
                  ) : (
                                         <div className="space-y-1">
                       {chatSessions.map((session) => {
                         const timestamp = session.lastMessageTime 
                           ? new Date(session.lastMessageTime).toLocaleString('zh-CN', {
                               month: 'short',
                               day: 'numeric',
                               hour: '2-digit',
                               minute: '2-digit'
                             })
                           : '新对话';
                         
                         return (
                           <ContextMenu key={session.id}>
                             <ContextMenuTrigger>
                               <div
                                 className={`p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border ${
                                   currentSessionId === session.id 
                                     ? 'border-primary/30 bg-primary/10' 
                                     : 'border-transparent hover:border-muted-foreground/20'
                                 }`}
                                 onClick={() => switchSession(session.id)}
                               >
                                 <div className="flex items-start gap-2">
                                                                       <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                      <MessageSquare className="w-3 h-3 text-primary" />
                                    </div>
                                   <div className="flex-1 min-w-0">
                                     <div className="text-sm font-medium truncate mb-1 text-foreground">
                                       {session.name}
                                     </div>
                                     <div className="text-xs text-muted-foreground">
                                       {session.messageCount} 条消息
                                     </div>
                                     <div className="text-xs text-muted-foreground">
                                       {timestamp}
                                     </div>
                                   </div>
                                 </div>
                               </div>
                             </ContextMenuTrigger>
                             <ContextMenuContent>
                               <ContextMenuItem 
                                 onClick={() => deleteSession(session.id)}
                                 className="text-destructive focus:text-destructive"
                               >
                                 <Trash2 className="h-4 w-4 mr-2" />
                                 删除对话
                               </ContextMenuItem>
                             </ContextMenuContent>
                           </ContextMenu>
                         );
                       })}
                     </div>
                  )}
                </>
              )}
           </div>
         </div>
       </TooltipProvider>

        {/* 主聊天区域 */}
        <div className="flex-1 flex flex-col">
                     {/* 可滚动的消息列表区域 */}
           <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
                           {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {selectedConfig ? (
                    <div className="flex flex-col items-center gap-4">
                      <AIIcon type={selectedConfig.type} className="h-20 w-20" />
                      <div>
                        <h3 className="text-lg font-medium mb-2">开始与 {selectedConfig.name} 对话</h3>
                                                 <p className="text-sm mb-4">点击下方按钮创建新对话</p>
                         <Button onClick={startNewChat} className="gap-2">
                           <Plus className="h-4 w-4" />
                           新建对话
                         </Button>
                      </div>
                    </div>
                  ) : (
                   <>
                     <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                     <h3 className="text-lg font-medium mb-2">开始与AI对话</h3>
                     <p className="mb-6">选择AI提供商并输入消息开始对话</p>
                     <Button onClick={() => window.api.openSettings()}>
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
            
            <div id="messages-end" />
          </div>

                     {/* 固定底部输入区域 */}
           <div className="sticky bottom-0 z-10 bg-background border-t">
                           <ChatInput
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                handleSendMessage={handleSendMessage}
                selectedConfig={selectedConfig}
                isLoading={isLoading}
                currentSessionId={currentSessionId}
              />
           </div>
        </div>
      </div>
    </div>
  );
}
