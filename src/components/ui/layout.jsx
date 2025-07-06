import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { UploadCloud } from 'lucide-react';

const Layout = React.forwardRef(({ className, children, ...props }, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if leaving the window itself
    if (e.relatedTarget === null) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      try {
        const filePaths = await window.api.getFilePaths(droppedFiles);
        if (filePaths && filePaths.length > 0) {
          navigate('/uploads', { state: { newFilePaths: filePaths } });
        }
      } catch (error) {
        console.error("Error getting file paths:", error);
      }
    }
  };

  return (
    <div
      ref={ref}
      className={cn('h-screen w-full flex relative', className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      {...props}
    >
      {children}
      {isDragging && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50 pointer-events-none">
          <UploadCloud className="h-24 w-24 text-white animate-bounce" />
          <p className="mt-4 text-2xl font-bold text-white">松开即可上传</p>
        </div>
      )}
    </div>
  );
});
Layout.displayName = 'Layout';

const LayoutHeader = React.forwardRef(({ className, ...props }, ref) => (
  <header
    ref={ref}
    className={cn('h-14 flex items-center gap-4 border-b bg-muted/40 px-6', className)}
    {...props}
  />
));
LayoutHeader.displayName = 'LayoutHeader';


const LayoutBody = React.forwardRef(({ className, ...props }, ref) => (
  <main
    ref={ref}
    className={cn('flex-1 flex flex-col overflow-hidden', className)}
    {...props}
  />
));
LayoutBody.displayName = 'LayoutBody';

export { Layout, LayoutHeader, LayoutBody }; 