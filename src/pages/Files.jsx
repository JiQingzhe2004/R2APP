import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { RefreshCw, Trash2, Download, Copy, Archive, FileJson, File as FileIcon } from 'lucide-react';

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const getFileIcon = (key) => {
  if (key.endsWith('.zip') || key.endsWith('.gz') || key.endsWith('.tar')) return <Archive className="h-10 w-10 text-primary" />;
  if (key.endsWith('.json')) return <FileJson className="h-10 w-10 text-primary" />;
  return <FileIcon className="h-10 w-10 text-muted-foreground" />;
};

const getFileTypeDescription = (key) => {
    if (key.endsWith('.zip') || key.endsWith('.gz') || key.endsWith('.tar')) return '压缩文件';
    if (key.endsWith('.json')) return 'JSON 文件';
    const ext = key.split('.').pop();
    if (ext && ext !== key) return `${ext.toUpperCase()} 文件`;
    return '文件';
}

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [settings, setSettings] = useState(null);
  const [downloading, setDownloading] = useState({});

  useEffect(() => {
    window.api.getSettings().then(setSettings);
  }, []);

  const fetchFiles = useCallback(async (isLoadMore = false) => {
    setLoading(true);
    setError(null);
    try {
      const token = isLoadMore ? nextToken : undefined;
      const result = await window.api.listObjects(token);
      if (result.success) {
        setFiles(prev => isLoadMore ? [...prev, ...result.data.files] : result.data.files);
        setNextToken(result.data.nextContinuationToken);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [nextToken]);

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (key) => {
    if (confirm(`确定要删除文件 "${key}" 吗？此操作无法撤销。`)) {
      const result = await window.api.deleteObject(key);
      if (result.success) {
        alert('文件删除成功');
        setFiles(prev => prev.filter(file => file.Key !== key));
      } else {
        alert(`删除失败: ${result.error}`);
      }
    }
  };

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url).then(() => {
        alert('URL 已复制到剪贴板');
    }, () => {
        alert('复制失败');
    });
  };

  const getPublicUrl = (key) => {
    if (!settings || !settings.publicDomain) return null;
    const domain = settings.publicDomain.endsWith('/') ? settings.publicDomain.slice(0, -1) : settings.publicDomain;
    return `${domain}/${key}`;
  }

  const handleDownload = async (key) => {
      setDownloading(prev => ({...prev, [key]: true}));
      const result = await window.api.downloadFile(key);
      if (!result.success && result.error !== '用户取消了下载。') {
          alert(`下载失败: ${result.error}`);
      }
      setDownloading(prev => ({...prev, [key]: false}));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">存储的文件</h1>
        <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{files.length} 个文件</span>
            <Button onClick={() => fetchFiles(false)} disabled={loading} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading && !nextToken ? 'animate-spin' : ''}`} />
              刷新
            </Button>
        </div>
      </div>

      {error && <div className="text-red-500 p-4 bg-red-500/10 rounded-md">错误: {error}</div>}
      
      {loading && files.length === 0 && <div className="text-center p-8">正在加载文件...</div>}
      
      {!loading && files.length === 0 && !error && <div className="text-center p-8 text-muted-foreground">没有找到文件。</div>}
      
      <div className="space-y-4">
        {files.map((file) => {
          const publicUrl = getPublicUrl(file.Key);
          return (
            <Card key={file.Key} className="p-4">
              <div className="flex items-start gap-4">
                {getFileIcon(file.Key)}
                <div className="flex-1">
                  <p className="font-semibold">{file.Key}</p>
                  <div className="text-sm text-muted-foreground flex items-center gap-4">
                    <span>{getFileTypeDescription(file.Key)}</span>
                    <span>{formatBytes(file.Size)}</span>
                    <span>上次修改: {new Date(file.LastModified).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              {publicUrl && (
                <div className="mt-4 flex items-center gap-2">
                    <Input readOnly value={publicUrl} className="bg-muted"/>
                    <Button variant="outline" size="icon" onClick={() => handleCopyUrl(publicUrl)}><Copy className="h-4 w-4"/></Button>
                    <Button variant="outline" size="icon" onClick={() => handleDownload(file.Key)} disabled={downloading[file.Key]}>
                        {downloading[file.Key] ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(file.Key)}><Trash2 className="h-4 w-4"/></Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
      
      {nextToken && (
        <div className="flex justify-center mt-6">
            <Button onClick={() => fetchFiles(true)} disabled={loading}>
              {loading ? '正在加载...' : '加载更多'}
            </Button>
        </div>
      )}
    </div>
  );
} 