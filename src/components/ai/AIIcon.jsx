import React from 'react';
import { Settings } from 'lucide-react';

// 导入SVG图标
import ZhipuIcon from '@/assets/AI-svg/zhipu-color.svg';
import OpenAIIcon from '@/assets/AI-svg/openai.svg';
import AnthropicIcon from '@/assets/AI-svg/anthropic.svg';
import GeminiIcon from '@/assets/AI-svg/gemini-color.svg';
import DeepSeekIcon from '@/assets/AI-svg/deepseek-color.svg';

/**
 * AI提供商图标组件
 * 支持明暗主题适配
 */
export default function AIIcon({ type, className = "h-5 w-5" }) {
  const getIcon = () => {
    switch (type) {
      case 'zhipu':
        return (
          <div className={`${className} ai-icon`}>
            <img 
              src={ZhipuIcon} 
              alt="智谱AI" 
              className="w-full h-full" 
            />
          </div>
        );
      case 'openai':
        return (
          <div className={`${className} ai-icon`}>
            <img 
              src={OpenAIIcon} 
              alt="OpenAI" 
              className="w-full h-full" 
            />
          </div>
        );
      case 'anthropic':
        return (
          <div className={`${className} ai-icon`}>
            <img 
              src={AnthropicIcon} 
              alt="Anthropic" 
              className="w-full h-full" 
            />
          </div>
        );
      case 'gemini':
        return (
          <div className={`${className} ai-icon`}>
            <img 
              src={GeminiIcon} 
              alt="Google AI" 
              className="w-full h-full" 
            />
          </div>
        );
      case 'deepseek':
        return (
          <div className={`${className} ai-icon`}>
            <img 
              src={DeepSeekIcon} 
              alt="DeepSeek" 
              className="w-full h-full" 
            />
          </div>
        );
      case 'custom':
        return (
          <div className={`${className} ai-icon`}>
            <Settings className="w-full h-full custom-icon" />
          </div>
        );
      default:
        return (
          <div className={`${className} ai-icon`}>
            <Settings className="w-full h-full custom-icon" />
          </div>
        );
    }
  };

  return getIcon();
}
