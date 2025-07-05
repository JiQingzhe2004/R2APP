import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Card, CardContent } from '@/components/ui/Card';
import { UploadCloud, File, X, CheckCircle } from 'lucide-react';

export default function UploadsPage() {
  const [filesToUpload, setFilesToUpload] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    console.log('UploadsPage mounted. Checking window.api:', window.api);
  }, []);

  const handleFileSelect = async () => {
    const selectedPaths = await window.api.showOpenDialog();
    if (selectedPaths) {
      addFilesByPath(selectedPaths);
    }
  };

  const addFilesByPath = (paths) => {
    const newFiles = paths.map(path => {
      if (!path || typeof path !== 'string') {
        // This is the fallback check. If this logs, the restart didn't work.
        console.error("Could not get file path. The main process config is likely not loaded correctly. Please ensure the app is fully restarted.");
        return null;
      };
      const key = path.split(/[\\/]/).pop();
      if (filesToUpload.find(f => f.path === path)) return null;
      return { path, key, status: 'pending' };
    }).filter(Boolean);

    if (newFiles.length > 0) {
      setFilesToUpload(prev => [...prev, ...newFiles]);
    }
  };

  useEffect(() => {
    const removeProgressListener = window.api.onUploadProgress(({ key, percentage }) => {
      setUploadProgress(prev => ({
        ...prev,
        [key]: { ...prev[key], percentage, status: percentage === 100 ? 'completed' : 'uploading' }
      }));
    });

    return () => {
      removeProgressListener();
    };
  }, []);

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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    console.log('Drop event files:', e.dataTransfer.files);
    
    const paths = Array.from(e.dataTransfer.files).map(f => {
      console.log('Processing dropped file object:', f);
      console.log('File path property:', f.path);
      return f.path;
    });

    if (paths.length > 0 && paths.every(p => p)) {
      addFilesByPath(paths);
    } else {
       console.error("Could not get file path from drop event. This indicates a sandbox issue.");
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    for (const file of filesToUpload) {
      if (file.status === 'pending') {
        setUploadProgress(prev => ({ ...prev, [file.key]: { percentage: 0, status: 'uploading' } }));
        const result = await window.api.uploadFile(file.path, file.key);
        if (!result.success) {
          setUploadProgress(prev => ({ ...prev, [file.key]: { ...prev[file.key], status: 'error', error: result.error } }));
        }
      }
    }
    setIsUploading(false);
  };
  
  const removeFile = (key) => {
    setFilesToUpload(files => files.filter(f => f.key !== key));
    setUploadProgress(progress => {
      const newProgress = { ...progress };
      delete newProgress[key];
      return newProgress;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">上传文件</h1>
        <p className="text-muted-foreground">选择或拖拽文件到此区域进行上传。</p>
      </div>

      <Card 
        className={`p-8 border-2 border-dashed ${isDragging ? 'border-primary' : ''}`}
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

      {filesToUpload.length > 0 && (
        <div className="space-y-4">
           <h2 className="text-xl font-semibold">待上传列表</h2>
          <div className="space-y-2">
            {filesToUpload.map(file => {
              const progress = uploadProgress[file.key];
              return (
                <Card key={file.key} className="p-4 flex items-center space-x-4">
                  <File className="h-6 w-6 text-muted-foreground" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{file.key}</p>
                    {progress && progress.status !== 'pending' && (
                        <Progress value={progress.percentage} className="h-2" />
                    )}
                    {progress && progress.status === 'error' && (
                        <p className="text-xs text-red-500">{progress.error}</p>
                    )}
                  </div>
                  {progress && progress.status === 'completed' ? (
                     <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <Button variant="ghost" size="icon" onClick={() => removeFile(file.key)} disabled={isUploading}>
                       <X className="h-4 w-4" />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
           <Button onClick={handleUpload} disabled={isUploading || !filesToUpload.some(f=>f.status === 'pending')}>
            {isUploading ? '正在上传...' : `上传 ${filesToUpload.length} 个文件`}
          </Button>
        </div>
      )}
    </div>
  );
} 