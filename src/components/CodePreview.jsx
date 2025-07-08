import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import atomDark from 'react-syntax-highlighter/dist/esm/styles/prism/atom-dark';
import { Button } from './ui/Button';
import { Check, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getLanguage } from '@/lib/language-map';

export default function CodePreview({ code, fileName }) {
  const language = getLanguage(fileName);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  return (
    <div className="relative w-full h-full">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 h-8 w-8"
              onClick={handleCopy}
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="sr-only">{isCopied ? '已复制' : '复制'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isCopied ? '已复制!' : '复制'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SyntaxHighlighter
        language={language}
        style={atomDark}
        customStyle={{
          width: '100%',
          height: '100%',
          margin: 0,
          backgroundColor: 'hsl(var(--background))',
          paddingTop: '40px' // Add padding to avoid overlap with button
        }}
        showLineNumbers={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
} 