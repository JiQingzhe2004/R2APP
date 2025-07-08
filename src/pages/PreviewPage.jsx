import React, { useState, useEffect } from 'react';
import { getFileIcon, isImage, isVideo, isAudio } from '@/lib/file-utils';
import { PreviewHeader } from '@/components/PreviewHeader';
import CodePreview from '@/components/CodePreview';

const compressedExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'];

const LoadingSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function PreviewPage() {
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [error, setError] = useState('');
  const [isText, setIsText] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getFileFromURL = async () => {
      setLoading(true);
      setError('');
      setFile(null);
      setFileContent('');
      setIsText(false);

      try {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const fileName = params.get('fileName');

        const extension = fileName?.split('.').pop().toLowerCase();
        if (fileName && compressedExtensions.includes(extension)) {
          setFile({ fileName });
          setError('压缩文件请下载后查看');
          setLoading(false);
          return;
        }

        const filePath = params.get('filePath');
        const bucket = params.get('bucket');

        if (!fileName || !bucket) {
          setError('无效的文件信息。');
          setLoading(false);
          return;
        }

        const publicUrl = await window.api.getPresignedUrl(bucket, `${filePath}${fileName}`);
        if (!publicUrl) {
          throw new Error('无法获取文件预览链接。');
        }
        
        setFile({ fileName, filePath, bucket, publicUrl });
        
        if (isImage(fileName)) {
          const img = new Image();
          img.onload = () => {
            window.api.resizePreviewWindow({ width: img.naturalWidth, height: img.naturalHeight });
            setLoading(false);
          }
          img.onerror = () => {
            setError('图片加载失败。');
            setLoading(false);
          }
          img.src = publicUrl;
        } else if (isVideo(fileName)) {
          const video = document.createElement('video');
          video.onloadedmetadata = () => {
             window.api.resizePreviewWindow({ width: video.videoWidth, height: video.videoHeight });
             setLoading(false);
          }
          video.onerror = () => {
            setError('视频加载失败。');
            setLoading(false);
          }
          video.src = publicUrl;
        } else if (isAudio(fileName)) {
            // For audio, we don't need to wait for metadata to show the player
            setLoading(false);
        } else {
            // Handle text and other files
            try {
                const result = await window.api.getObjectContent(bucket, `${filePath}${fileName}`);
                if (result.success) {
                    setFileContent(result.content);
                    setIsText(true);
                } else {
                    console.warn(`Could not get content via main process: ${result.error}`);
                }
            } catch (e) {
                console.error(`Error calling getObjectContent:`, e);
            } finally {
                setLoading(false);
            }
        }

      } catch (e) {
        console.error("加载预览时出错:", e);
        setError(`加载预览时出错: ${e.message}`);
        setLoading(false);
      }
    };

    getFileFromURL();
  }, [window.location.hash]);

  const renderPreview = () => {
    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
      return <div className="flex items-center justify-center h-full p-4 text-red-500 text-center">{error}</div>;
    }

    if (!file) {
      // This case might be hit briefly before loading is set, or if something unexpected happens.
      return null;
    }

    if (isImage(file.fileName)) {
      return <img 
        src={file.publicUrl} 
        alt={file.fileName} 
        className="max-w-full max-h-full object-contain select-none"
        draggable="false"
        onDragStart={(e) => e.preventDefault()}
      />;
    }
    if (isVideo(file.fileName)) {
      return <video 
        src={file.publicUrl} 
        controls 
        autoPlay 
        className="max-w-full max-h-full select-none"
        draggable="false"
        onDragStart={(e) => e.preventDefault()}
      />;
    }
    if (isAudio(file.fileName)) {
      return <div className="p-8"><audio src={file.publicUrl} controls autoPlay className="w-full" /></div>;
    }
    if (isText) {
      return <CodePreview code={fileContent} fileName={file.fileName} />;
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full">
        {getFileIcon(file)}
        <p className="mt-4">{file.fileName}</p>
        <p className="text-sm text-gray-500">不支持预览此文件类型。</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <PreviewHeader fileName={file ? file.fileName : '...'} />
      <main className="flex-1 flex items-center justify-center overflow-hidden">
        {renderPreview()}
      </main>
    </div>
  );
} 