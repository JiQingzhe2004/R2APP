import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import atomDark from 'react-syntax-highlighter/dist/esm/styles/prism/atom-dark';
import { getLanguage } from '@/lib/language-map';

export default function CodePreview({ code, fileName }) {
  const language = getLanguage(fileName);

  return (
    <div className="w-full h-full">
      <SyntaxHighlighter
        language={language}
        style={atomDark}
        customStyle={{
          width: '100%',
          height: '100%',
          margin: 0,
          backgroundColor: 'hsl(var(--background))'
        }}
        showLineNumbers={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
} 