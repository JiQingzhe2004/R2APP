import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { Download, FolderOpen, RefreshCw } from 'lucide-react';

export default function DownloadSettings() {
  const [downloadPath, setDownloadPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDownloadPath();
  }, []);

  const loadDownloadPath = async () => {
    try {
      const result = await window.api.getSetting('download-path');
      if (result && result.success && result.value) {
        setDownloadPath(result.value);
      } else {
        // 如果没有设置，使用默认下载路径
        const defaultPath = await window.api.getDefaultDownloadPath();
        if (defaultPath && defaultPath.success) {
          setDownloadPath(defaultPath.path);
        }
      }
    } catch (error) {
      console.error('Failed to load download path:', error);
    }
  };

  const handleSelectPath = async () => {
    try {
      console.log('开始选择下载路径...');
      setIsLoading(true);
      
      const result = await window.api.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择下载文件夹'
      });
      
      console.log('选择结果:', result);
      
      if (result && result.success && result.filePaths && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        console.log('选择的路径:', selectedPath);
        setDownloadPath(selectedPath);
        
        // 保存设置
        const saveResult = await window.api.setSetting('download-path', selectedPath);
        if (saveResult && saveResult.success) {
          toast.success('下载路径已更新');
        } else {
          toast.error('保存下载路径失败');
        }
      } else if (result && result.success && result.filePaths && result.filePaths.length === 0) {
        console.log('用户取消了选择');
      } else {
        console.error('选择失败:', result);
        toast.error('选择下载路径失败');
      }
    } catch (error) {
      console.error('Failed to select download path:', error);
      toast.error('选择下载路径失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPath = async () => {
    try {
      setIsLoading(true);
      const result = await window.api.getDefaultDownloadPath();
      if (result && result.success) {
        setDownloadPath(result.path);
        
        // 保存设置
        const saveResult = await window.api.setSetting('download-path', result.path);
        if (saveResult && saveResult.success) {
          toast.success('已重置为默认下载路径');
        } else {
          toast.error('重置下载路径失败');
        }
      }
    } catch (error) {
      console.error('Failed to reset download path:', error);
      toast.error('重置下载路径失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePathChange = async (e) => {
    const newPath = e.target.value;
    setDownloadPath(newPath);
    
    // 延迟保存，避免频繁保存
    clearTimeout(window.pathSaveTimeout);
    window.pathSaveTimeout = setTimeout(async () => {
      try {
        const saveResult = await window.api.setSetting('download-path', newPath);
        if (saveResult && saveResult.success) {
          toast.success('下载路径已更新');
        } else {
          toast.error('保存下载路径失败');
        }
      } catch (error) {
        console.error('Failed to save download path:', error);
        toast.error('保存下载路径失败');
      }
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          <h3 className="text-lg font-semibold">下载设置</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          配置文件下载的存储位置和相关选项。
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="download-path">下载路径</Label>
          <div className="flex gap-2">
            <Input
              id="download-path"
              value={downloadPath}
              onChange={handlePathChange}
              placeholder="选择下载文件夹路径"
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleSelectPath}
              disabled={isLoading}
              title="选择文件夹"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleResetPath}
              disabled={isLoading}
              title="重置为默认路径"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            设置文件下载的默认存储位置。默认使用系统下载（Downloads）文件夹。
          </p>
        </div>
      </div>
    </div>
  );
}
