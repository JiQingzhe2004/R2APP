import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { User, Bot, AlertCircle, Copy, Check, ChevronUp, Atom } from 'lucide-react';
import { toast } from 'sonner';
import AIIcon from '@/components/ai/AIIcon';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import MarkdownRenderer from '@/components/ai/MarkdownRenderer';

/**
 * 聊天消息组件
 */
export default function ChatMessage({ message, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [thinkingStartTime, setThinkingStartTime] = useState(null);
  const [thinkingDuration, setThinkingDuration] = useState(0);
  const { userAvatar, userAvatarType } = useUserAvatar();
  const isUser = message.role === 'user';
  const isError = message.isError;

  // 计算思考时长
  useEffect(() => {
    if (message.thinking && !thinkingStartTime) {
      setThinkingStartTime(Date.now());
    }
    
    if (message.thinking && !message.isStreaming && thinkingStartTime) {
      const duration = ((Date.now() - thinkingStartTime) / 1000).toFixed(2);
      setThinkingDuration(duration);
    }
  }, [message.thinking, message.isStreaming, thinkingStartTime]);

  // 实时更新思考时长（仅在思考过程中）
  useEffect(() => {
    let interval;
    if (message.thinking && message.isStreaming && thinkingStartTime) {
      interval = setInterval(() => {
        const duration = ((Date.now() - thinkingStartTime) / 1000).toFixed(2);
        setThinkingDuration(duration);
      }, 100); // 每100ms更新一次
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [message.thinking, message.isStreaming, thinkingStartTime]);

  // 复制消息内容
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  // 渲染思考链
  const renderThinking = () => {
    if (!message.thinking) return null;

    const isThinking = message.isStreaming;
    const hasCompleted = !message.isStreaming && thinkingDuration > 0;
    const showDuration = thinkingDuration > 0;

    return (
      <div className="mb-3 w-full transition-all duration-300 ease-in-out">
        {/* 思考链头部 */}
        <div className="flex items-center gap-2 mb-2">
          {/* 展开/收起按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex-shrink-0"
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
          >
            <ChevronUp 
              className={`h-4 w-4 text-blue-600 dark:text-blue-400 transition-transform duration-300 ease-in-out ${
                thinkingExpanded ? 'rotate-0' : 'rotate-180'
              }`} 
            />
          </Button>
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Atom className="w-4 h-4 text-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
              已深度思考 {showDuration && `(耗时 ${thinkingDuration} 秒)`}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {hasCompleted && (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600 dark:text-green-400">已完成</span>
                </>
              )}
              {isThinking && (
                <span className="text-xs text-blue-600 dark:text-blue-400">思考中...</span>
              )}
            </div>
          </div>
        </div>
        
        {/* 思考内容容器 */}
        <div className="relative">
          {/* 左侧竖线 */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-300 dark:bg-blue-600"></div>
          
          {/* 思考内容 */}
          <div 
            className={`text-sm text-blue-600 dark:text-blue-400 whitespace-pre-wrap break-words overflow-hidden transition-all duration-300 ease-in-out pl-4 ${
              thinkingExpanded 
                ? 'max-h-[1000px] opacity-100' 
                : 'max-h-0 opacity-0'
            }`}
          >
            {message.thinking}
          </div>
        </div>
      </div>
    );
  };

  // 渲染消息内容
  const renderContent = () => {
    if (isError) {
      return (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span>{message.content}</span>
        </div>
      );
    }

    // 处理流式输出，添加圆点等待效果
    if (message.isStreaming) {
      return (
        <div className="space-y-3">
          {/* 思考过程（如果存在） */}
          {renderThinking()}
          
          {/* 主要回答内容 */}
          <div className="inline">
            <span className="whitespace-pre-wrap">{message.content}</span>
            <span className="inline-block w-2 h-2 bg-current rounded-full dot-pulse ml-1"></span>
          </div>
        </div>
      );
    }

    // AI消息使用Markdown渲染，用户消息使用普通文本
    if (!isUser) {
      return (
        <div className="space-y-3">
          {/* 思考过程（如果存在） */}
          {renderThinking()}
          
          {/* 主要回答内容 */}
          <MarkdownRenderer content={message.content} />
        </div>
      );
    }

    // 用户消息使用普通文本渲染
    return (
      <div className="whitespace-pre-wrap">
        {message.content}
      </div>
    );
  };

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3 ${
        isUser 
          ? 'max-w-[85%]' 
          : 'w-[85%]' // AI消息使用百分比宽度
      }`}>
        {/* 头像 - 用户消息头像在右侧，AI消息头像在左侧 */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : isError
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
        }`}>
          {isUser ? (
            userAvatarType === 'custom' && userAvatar ? (
              <img src={userAvatar} alt="用户头像" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4" />
            )
          ) : isError ? (
            <AlertCircle className="w-4 w-4" />
          ) : (
            // AI消息使用对应AI提供商的logo
            message.config ? (
              <AIIcon type={message.config.type} className="w-5 h-5" />
            ) : (
              <Bot className="w-4 h-4" />
            )
          )}
        </div>
        
        {/* 消息内容及操作区域容器 */}
        <div className="flex flex-col flex-1 min-w-0">
                  {/* 消息内容 */}
        <div className={`rounded-2xl px-4 ${
          isUser 
            ? 'py-3 bg-primary text-primary-foreground' 
            : isError
              ? 'py-3 bg-destructive/10 text-destructive border border-destructive/20'
              : 'pt-0 pb-3 text-foreground' // AI回复去掉上边距和背景
        }`}>
          {renderContent()}
        </div>
          
          {/* 操作按钮区域和时间信息（放在同一行） */}
          <div className={`flex items-center gap-2 mt-2 ${isUser ? 'justify-end' : 'justify-start'} flex-wrap`}>
            {/* 用户消息：操作按钮在前，时间在后 */}
            {isUser ? (
              <>
                {/* 操作按钮 */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted/50"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                
                {/* 时间 */}
                <span className="text-xs text-primary/70">
                  {formatTime(message.timestamp)}
                </span>
              </>
            ) : (
              <>
                {/* AI消息：时间在前，操作按钮在后 */}
                {/* 时间 */}
                <span className="text-xs text-muted-foreground">
                  {formatTime(message.timestamp)}
                </span>
                
                {/* 使用统计 */}
                {message.usage && (
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {message.usage.prompt_tokens || 0} + {message.usage.completion_tokens || 0} = {message.usage.total_tokens || 'N/A'} tokens
                    </Badge>
                  </div>
                )}
                
                {/* 配置信息 */}
                {message.config && (
                  <Badge variant="secondary" className="text-xs">
                    {message.config.name}
                  </Badge>
                )}
                
                {/* 操作按钮 */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted/50"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>

                  {/* 重新生成按钮（仅对AI消息显示） */}
                  {!isError && onRegenerate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-muted/50"
                      onClick={() => onRegenerate(message)}
                      title="重新生成"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
