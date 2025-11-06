import React, { useState, useEffect, useRef } from 'react';
import { getFileIcon, isImage, isVideo, isAudio } from '@/lib/file-utils';
import { PreviewHeader } from '@/components/PreviewHeader';
import CodePreview from '@/components/CodePreview';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import LottieAnimation from '@/components/LottieAnimation';
import LoadingLottie from '@/assets/lottie/loding.lottie';
import ErrorLottie from '@/assets/lottie/error.lottie';
// removed inline context menu

const compressedExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'];

const LoadingSpinner = () => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="w-64 h-64">
      <LottieAnimation 
        src={LoadingLottie}
        autoplay={true}
        loop={true}
        speed={1}
      />
    </div>
  </div>
);

export default function PreviewPage() {
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [error, setError] = useState('');
  const [isText, setIsText] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posterUrl, setPosterUrl] = useState('');
  const imgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const loadingStartTimeRef = useRef(0);
  // removed inline context menu state

  // 确保加载动画至少显示 2 秒
  const finishLoading = () => {
    const elapsed = Date.now() - loadingStartTimeRef.current;
    const minLoadingTime = 2000; // 2 秒
    
    if (elapsed < minLoadingTime) {
      setTimeout(() => {
        setLoading(false);
      }, minLoadingTime - elapsed);
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    const getFileFromURL = async () => {
      loadingStartTimeRef.current = Date.now();
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
          finishLoading();
          return;
        }

        const filePath = params.get('filePath');
        const bucket = params.get('bucket');

        if (!fileName || !bucket) {
          setError('无效的文件信息。');
          finishLoading();
          return;
        }

        const routedPublicUrl = new URLSearchParams(window.location.hash.split('?')[1]).get('publicUrl');
        const publicUrl = routedPublicUrl || await window.api.getPresignedUrl(bucket, `${filePath}${fileName}`);
        
        if (!publicUrl) {
          throw new Error('无法获取文件预览链接。');
        }
        
        setFile({ fileName, filePath, bucket, publicUrl });
        
        if (isImage(fileName)) {
          // 所有存储服务都使用直接URL加载，就像浏览器一样
          const img = new Image();
          img.onload = () => {
            window.api.resizePreviewWindow({ width: img.naturalWidth, height: img.naturalHeight });
            finishLoading();
          }
          img.onerror = (error) => {
            setError(`图片加载失败: ${publicUrl}`);
            finishLoading();
          }
          img.src = publicUrl;
        } else if (isVideo(fileName)) {
          // 所有存储服务都使用直接URL加载，就像浏览器一样
          const video = document.createElement('video');
          // 更快拿到元数据以便尽快调整窗口尺寸
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
             window.api.resizePreviewWindow({ width: video.videoWidth, height: video.videoHeight });
             finishLoading();
          }
          video.onerror = () => {
            setError('视频加载失败。');
            finishLoading();
          }
          video.src = publicUrl;

          // 异步尝试查找首帧海报（同路径同名的 .jpg/.png/.webp）
          const baseKey = `${filePath}${fileName}`;
          const dotIndex = baseKey.lastIndexOf('.');
          const withoutExt = dotIndex > -1 ? baseKey.slice(0, dotIndex) : baseKey;
          const posterKeys = [
            `${withoutExt}.jpg`,
            `${withoutExt}.png`,
            `${withoutExt}.webp`,
          ];
          const testImage = (url) => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
          });
          (async () => {
            for (const k of posterKeys) {
              try {
                const signed = await window.api.getPresignedUrl(bucket, k);
                if (signed) {
                  const ok = await testImage(signed);
                  if (ok) {
                    setPosterUrl(signed);
                    break;
                  }
                }
              } catch (_) {
                // ignore and try next
              }
            }
          })();
        } else if (isAudio(fileName)) {
            // For audio, we don't need to wait for metadata to show the player
            finishLoading();
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
                finishLoading();
            }
        }

      } catch (e) {
        console.error("加载预览时出错:", e);
        setError(`加载预览时出错: ${e.message}`);
        finishLoading();
      }
    };

    getFileFromURL();
  }, [window.location.hash]);

  const handleZoom = (delta) => {
    setZoom(prev => Math.min(5, Math.max(0.1, parseFloat((prev + delta).toFixed(2)))));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownload = async () => {
    if (!file) return;
    const key = `${file.filePath}${file.fileName}`;
    try {
      await window.api.downloadFile(key);
      toast.success('文件下载已开始');
    } catch (error) {
      toast.error('下载失败');
    }
  };

  const handleShare = async () => {
    if (!file) return;
    try {
      const dataUrl = await QRCode.toDataURL(file.publicUrl, { width: 200, margin: 1 });
      setQrDataUrl(dataUrl);
      setIsShareOpen(true);
    } catch {
      // 退化到复制
      try {
        await navigator.clipboard.writeText(file.publicUrl);
        toast.success('已复制预览链接到剪贴板');
      } catch {
        toast.error('分享失败');
      }
    }
  };

  const handleCopy = async () => {
    if (!file) return;
    if (isText) {
      // 复制文本内容
      try {
        await navigator.clipboard.writeText(fileContent);
        toast.success('已复制文件内容到剪贴板');
      } catch {
        toast.error('复制失败');
      }
    } else {
      // 复制文件链接
      try {
        await navigator.clipboard.writeText(file.publicUrl);
        toast.success('已复制文件链接到剪贴板');
      } catch {
        toast.error('复制失败');
      }
    }
  };

  // removed inline context menu handlers

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      handleZoom(delta);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [imgRef.current]);

  const renderPreview = () => {
    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="w-66 h-66 mb-4">
            <LottieAnimation 
              src={ErrorLottie}
              autoplay={true}
              loop={true}
              speed={1}
            />
          </div>
          <div className="text-red-500 text-center text-lg">{error}</div>
        </div>
      );
    }

    if (!file) {
      // This case might be hit briefly before loading is set, or if something unexpected happens.
      return null;
    }

    if (isImage(file.fileName)) {
      return <img 
        ref={imgRef}
        src={file.publicUrl} 
        alt={file.fileName} 
        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'center center' }}
        className="max-w-full max-h-full object-contain select-none"
        draggable="false"
        onDragStart={(e) => e.preventDefault()}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />;
    }
    if (isVideo(file.fileName)) {
      return <video 
        src={file.publicUrl} 
        controls 
        autoPlay 
        playsInline
        preload="auto"
        poster={posterUrl || undefined}
        className="max-w-full max-h-full select-none"
        draggable="false"
        onDragStart={(e) => e.preventDefault()}
      />;
    }
    if (isAudio(file.fileName)) {
      return (
        <div className="w-full max-w-2xl mx-auto p-8">
          <div className="bg-card border rounded-lg p-6 shadow-lg">
            {/* 音频文件图标和标题 */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{file.fileName}</h2>
              <p className="text-sm text-muted-foreground">音频文件</p>
            </div>

            {/* 音频播放器 */}
            <div className="mb-6">
              <audio 
                src={file.publicUrl} 
                controls 
                autoPlay 
                className="w-full h-12"
                preload="metadata"
              />
            </div>

            {/* 音频波形可视化（模拟） */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-1 h-16">
                {Array.from({ length: 50 }, (_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary/30 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 60 + 20}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '2s'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
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
    <div className="preview-page flex flex-col h-screen bg-background">
      <PreviewHeader 
        fileName={file ? file.fileName : '...'} 
        isImage={file ? isImage(file.fileName) : false}
        onZoomIn={() => handleZoom(0.1)}
        onZoomOut={() => handleZoom(-0.1)}
        onRotate={handleRotate}
        onDownload={handleDownload}
        onShare={handleShare}
        onCopy={handleCopy}
      />
      <main className="flex-1 flex items-center justify-center overflow-hidden">
        {renderPreview()}
      </main>

      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分享</DialogTitle>
            <DialogDescription>使用手机微信扫描二维码，或复制链接发送。</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrDataUrl && <img src={qrDataUrl} alt="分享二维码" className="w-48 h-48" />}
            <div className="text-xs text-muted-foreground">链接有效期约 15 分钟</div>
            <button
              className="px-3 py-2 rounded-md border hover:bg-accent"
              onClick={async () => {
                try { await navigator.clipboard.writeText(file.publicUrl); toast.success('链接已复制'); }
                catch { toast.error('复制失败'); }
              }}
            >复制链接</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 