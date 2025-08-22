import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import 'highlight.js/styles/github-dark.css';

// 代码块组件，带复制按钮 - 参考ChatGPT样式
const CodeBlock = ({ children, className, ...props }) => {
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const language = className ? className.replace('language-', '') : '';

  const handleCopy = async () => {
    if (isCopying) return;
    
    setIsCopying(true);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(children);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = children;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      toast.success('代码已复制到剪贴板', {
        description: `已复制 ${children.length} 个字符`,
        duration: 2000,
      });
      
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('复制失败:', err);
      toast.error('复制失败', {
        description: err.message || '请手动选择代码进行复制',
        duration: 4000,
      });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="custom-code-block">
      <div className="code-header">
        {language && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-xs font-mono text-gray-300 uppercase">
              {language}
            </span>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={isCopying}
          title={copied ? '已复制' : '复制代码'}
          className="h-6 w-6 p-0 opacity-70 hover:opacity-100 transition-all duration-200 bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCopying ? (
            <div className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />
          ) : copied ? (
            <Check className="h-3 w-3 text-green-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      
      <div className="code-content">
        <code>{children}</code>
      </div>
    </div>
  );
};

// 内联代码组件 - 简化样式，避免冲突
const InlineCode = ({ children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(children);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = children;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      toast.success('已复制', { duration: 1500 });
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error('复制失败');
    }
  };

  // 添加调试信息
  console.log('InlineCode rendered:', children);

  return (
    <code 
      className="inline-code"
      onClick={handleCopy}
      title={copied ? '已复制' : '点击复制'}
    >
      {children}
    </code>
  );
};

// 短代码块组件 - 参考ChatGPT样式
const ShortCodeBlock = ({ children, className, ...props }) => {
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const language = className ? className.replace('language-', '') : '';

  const handleCopy = async () => {
    if (isCopying) return;
    
    setIsCopying(true);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(children);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = children;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      toast.success('已复制', { duration: 1500 });
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error('复制失败');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="short-code-block">
      <div className="code-header">
        {language && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-500"></div>
            <span className="text-xs font-mono text-gray-300 uppercase">
              {language}
            </span>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={isCopying}
          title={copied ? '已复制' : '复制代码'}
          className="h-5 w-5 p-0 opacity-70 hover:opacity-100 transition-all duration-200 bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCopying ? (
            <div className="w-2.5 h-2.5 border border-gray-300 border-t-transparent rounded-full animate-spin" />
          ) : copied ? (
            <Check className="h-2.5 w-2.5 text-green-400" />
          ) : (
            <Copy className="h-2.5 w-2.5" />
          )}
        </Button>
      </div>
      
      <div className="code-content">
        <code>{children}</code>
      </div>
    </div>
  );
};

// 链接组件
const Link = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary hover:underline"
  >
    {children}
  </a>
);

// 表格组件
const Table = ({ children }) => (
  <div className="overflow-x-auto my-4">
    <table className="w-full border-collapse border border-border">
      {children}
    </table>
  </div>
);

// 表格行组件
const TableRow = ({ children }) => (
  <tr className="border-b border-border">
    {children}
  </tr>
);

// 表格单元格组件
const TableCell = ({ children, isHeader = false }) => {
  const Component = isHeader ? 'th' : 'td';
  return (
    <Component className={`px-3 py-2 text-left ${isHeader ? 'font-medium bg-muted/50' : ''}`}>
      {children}
    </Component>
  );
};

// 引用块组件
const Blockquote = ({ children }) => (
  <blockquote className="border-l-4 border-blue-500 pl-4 py-3 my-4 bg-blue-50 dark:bg-blue-900/20 italic text-gray-700 dark:text-gray-300 rounded-r-lg">
    {children}
  </blockquote>
);

// 列表组件
const List = ({ children, ordered = false }) => {
  const Component = ordered ? 'ol' : 'ul';
  return (
    <Component className={`my-4 ${ordered ? 'list-decimal' : 'list-disc'} ml-6 space-y-2`}>
      {children}
    </Component>
  );
};

// 列表项组件
const ListItem = ({ children }) => (
  <li className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
    {children}
  </li>
);

// 标题组件
const Heading = ({ level, children }) => {
  const sizes = {
    1: 'text-2xl font-bold',
    2: 'text-xl font-semibold',
    3: 'text-lg font-medium',
    4: 'text-base font-medium',
    5: 'text-sm font-medium',
    6: 'text-xs font-medium'
  };

  const Component = `h${level}`;
  return (
    <Component className={`${sizes[level]} mt-6 mb-3 text-gray-900 dark:text-gray-100 font-semibold`}>
      {children}
    </Component>
  );
};

// 分割线组件
const HorizontalRule = () => (
  <hr className="my-6 border-border" />
);

export default function MarkdownRenderer({ content }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          code: ({ node, inline, className, children, ...props }) => {
            // 添加调试信息
            console.log('Code component called:', { inline, className, children: String(children).substring(0, 50) });
            
            // 内联代码：使用单反引号包裹的代码，应该嵌入到文本中
            if (inline) {
              console.log('Rendering inline code:', children);
              return <InlineCode {...props}>{children}</InlineCode>;
            }
            
            // 代码块：使用三反引号包裹的代码，根据长度选择样式
            const codeContent = String(children);
            const lines = codeContent.split('\n');
            const isShortCode = codeContent.length <= 120 && 
                               lines.length <= 4 && 
                               lines.every(line => line.length <= 80);
            
            console.log('Code block info:', { 
              length: codeContent.length, 
              lines: lines.length, 
              isShortCode 
            });
            
            // 在AI刚输出时就创建正确的代码块
            if (isShortCode) {
              console.log('Rendering short code block');
              return <ShortCodeBlock className={className} {...props}>{children}</ShortCodeBlock>;
            }
            
            console.log('Rendering full code block');
            return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
          },
          // 确保段落内的内联代码正确渲染
          p: ({ children, ...props }) => (
            <p className="text-sm leading-relaxed mb-4 last:mb-0 text-gray-800 dark:text-gray-200" {...props}>
              {children}
            </p>
          ),
          // 其他组件保持不变
          a: Link,
          table: Table,
          tr: TableRow,
          th: ({ children }) => <TableCell isHeader>{children}</TableCell>,
          td: ({ children }) => <TableCell>{children}</TableCell>,
          blockquote: Blockquote,
          ul: ({ children }) => <List>{children}</List>,
          ol: ({ children }) => <List ordered>{children}</List>,
          li: ListItem,
          h1: ({ children }) => <Heading level={1}>{children}</Heading>,
          h2: ({ children }) => <Heading level={2}>{children}</Heading>,
          h3: ({ children }) => <Heading level={3}>{children}</Heading>,
          h4: ({ children }) => <Heading level={4}>{children}</Heading>,
          h5: ({ children }) => <Heading level={5}>{children}</Heading>,
          h6: ({ children }) => <Heading level={6}>{children}</Heading>,
          hr: HorizontalRule,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
