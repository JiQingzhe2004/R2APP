import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Card } from '@/components/ui/Card';
import { UploadCloud, File, X, CheckCircle, PauseCircle, PlayCircle } from 'lucide-react';
import { useUploads } from '@/contexts/UploadsContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';

export default function UploadsPage() {
  const [isDragging, setIsDragging] = useState(false);
  const { 
    uploads, 
    isUploading, 
    addUploads, 
    startAllUploads, 
    removeUpload, 
    clearAll,
    clearCompleted,
    pauseUpload,
    resumeUpload
  } = useUploads();
  const { addNotification } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.newUploads) {
      addUploads(location.state.newUploads);
      // Clear the state to prevent re-adding files on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, addUploads]);

  const handleFileSelect = async () => {
    const selectedPaths = await window.api.showOpenDialog();
    if (selectedPaths) {
      const newUploads = selectedPaths.map((path) => ({
        path,
        key: path.split(/[\\/]/).pop(),
      }));
      addUploads(newUploads);
    }
  };

  const addFilesByPath = (paths) => {
    const newUploads = paths.map(path => {
      if (!path || typeof path !== 'string') {
        console.error("Could not get file path.");
        return null;
      };
      const key = path.split(/[\\/]/).pop();
      return { path, key };
    }).filter(Boolean);

    addUploads(newUploads);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const filePaths = [];
      for (const file of files) {
        try {
          const filePath = await window.api.getPathForFile(file);
          if (filePath) {
            filePaths.push(filePath);
    } else {
            addNotification({ message: `获取 ${file.name} 的路径失败`, type: 'error' });
          }
        } catch (err) {
          console.error('获取文件路径失败:', err);
          addNotification({ message: `获取 ${file.name} 的路径失败: ${err.message}`, type: 'error' });
        }
      }

      if (filePaths.length > 0) {
        addFilesByPath(filePaths);
    }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">上传文件</h1>
        <p className="text-muted-foreground">选择或拖拽文件到此区域进行上传。</p>
      </div>

      <Card 
        className={`p-8 border-2 border-dashed ${isDragging ? 'border-primary' : 'border-border'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">选择要上传的文件</h3>
          <p className="mt-1 text-sm text-muted-foreground">或者将文件拖放到这里</p>
          <div className="mt-6">
            <Button onClick={handleFileSelect} disabled={isUploading}>选择文件</Button>
          </div>
        </div>
      </Card>

      {uploads.length > 0 && (
        <div className="flex justify-end gap-2 mt-4">
            {uploads.some(u => u.status === 'completed' || u.status === 'error') && (
              <Button variant="outline" onClick={clearCompleted} disabled={isUploading}>
                清除已完成/失败
              </Button>
            )}
            <Button variant="outline" onClick={clearAll} disabled={isUploading}>
                清空列表
            </Button>
            <Button onClick={startAllUploads} disabled={isUploading || uploads.every(u => u.status !== 'pending')}>
                {isUploading ? '正在上传...' : '全部上传'}
            </Button>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="space-y-4">
           <h2 className="text-xl font-semibold">待上传列表</h2>
          <div className="space-y-2">
            {uploads.map(file => {
              const displayName = file.key.split('/').pop();
              return (
                <Card key={file.id} className="p-4 flex items-center space-x-4">
                  <File className="h-6 w-6 text-muted-foreground" />
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm font-medium leading-none truncate" title={displayName}>{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate" title={file.path}>{file.path}</p>
                    {file.status !== 'pending' && file.status !== 'completed' && file.status !== 'error' && (
                        <div className="flex items-center space-x-2">
                            <Progress 
                                value={file.progress} 
                                className="h-2 flex-1" 
                                indicatorClassName={cn({
                                    'bg-gray-400 animate-none': file.status === 'paused',
                                })}
                            />
                            {file.status === 'paused' && <span className="text-xs text-muted-foreground">已暂停</span>}
                        </div>
                    )}
                    {file.status === 'error' && (
                        <p className="text-xs text-red-500">{file.error}</p>
                    )}
                  </div>
                  {file.status === 'completed' ? (
                    <div className="flex items-center">
                      <CheckCircle className="h-6 w-6 text-green-500 mr-1" />
                      <Button variant="ghost" size="icon" onClick={() => removeUpload(file.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      {file.status === 'uploading' && (
                        <Button variant="ghost" size="icon" onClick={() => pauseUpload(file.id)}>
                          <PauseCircle className="h-6 w-6" />
                        </Button>
                      )}
                      {file.status === 'paused' && (
                        <Button variant="ghost" size="icon" onClick={() => resumeUpload(file.id)}>
                          <PlayCircle className="h-6 w-6" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => removeUpload(file.id)} disabled={file.status === 'uploading'}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 