import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from './ui/Button';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Loader2 } from 'lucide-react';

const isImage = (fileName = '') => {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const lowercasedName = fileName.toLowerCase();
  return imageExtensions.some(ext => lowercasedName.endsWith(ext));
};

const isCode = (fileName = '') => {
  const codeExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.html', '.py', '.java',
    '.c', '.cpp', '.cs', '.go', '.rb', '.php', '.rs', '.swift', '.kt', '.md'
  ];
  const lowercasedName = fileName.toLowerCase();
  return codeExtensions.some(ext => lowercasedName.endsWith(ext));
};

const FilePreview = ({ file, publicUrl, open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const fileName = file ? file.key.split('/').pop() : '';

  useEffect(() => {
    if (open && file && isCode(fileName)) {
      const fetchContent = async () => {
        setLoading(true);
        setError('');
        setContent('');
        try {
          const result = await window.api.getObjectContent(file.key);
          if (result.success) {
            setContent(result.content);
          } else {
            setError(result.error);
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchContent();
    }
  }, [open, file, fileName]);

  if (!file) return null;
  
  const renderPreviewContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (error) {
       return (
        <div className="text-center py-8">
          <p className="text-red-500">{error}</p>
        </div>
       )
    }

    if (isImage(fileName)) {
      if (!publicUrl) {
        return <div className="text-center py-8 text-muted-foreground">无法生成图片预览链接。</div>;
      }
      return (
        <div className="flex justify-center items-center p-4">
          <img
            src={publicUrl}
            alt={`Preview of ${fileName}`}
            className="max-w-full max-h-[70vh] object-contain"
          />
        </div>
      );
    }
    
    if (isCode(fileName)) {
      return (
        <SyntaxHighlighter language={fileName.split('.').pop()} style={atomDark} showLineNumbers>
          {content}
        </SyntaxHighlighter>
      );
    }

    // Fallback for unsupported types
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">此文件类型不支持预览。</p>
        <p className="text-sm text-muted-foreground mt-2">文件名: {fileName}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {renderPreviewContent()}
        </div>
        <DialogFooter className="mt-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview; 