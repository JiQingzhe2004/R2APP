import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { 
  RefreshCw, Trash2, Download, Copy, List, LayoutGrid, TextSearch, XCircle
} from 'lucide-react';
import { formatBytes, getFileIcon, getFileTypeDescription } from '@/lib/file-utils.jsx';
import { useNotifications } from '@/contexts/NotificationContext';

export default function FilesPage({ isSearchOpen, onSearchOpenChange }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [settings, setSettings] = useState(null);
  const [downloading, setDownloading] = useState({});
  const [fileToDelete, setFileToDelete] = useState(null);
  const [viewMode, setViewMode] = useState('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [inputSearchTerm, setInputSearchTerm] = useState('');
  const { addNotification } = useNotifications();
  const observer = useRef();
  const navigate = useNavigate();

  const lastFileElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextToken) {
        fetchFiles(searchTerm, true);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, nextToken, searchTerm]);

  useEffect(() => {
    const getActiveSettings = (fullSettings) => {
        if (!fullSettings || !fullSettings.activeProfileId || !fullSettings.profiles) return null;
        const baseSettings = fullSettings.settings || {};
        const activeProfile = fullSettings.profiles.find(p => p.id === fullSettings.activeProfileId);
        if (!activeProfile) return null;
        return { ...baseSettings, ...activeProfile };
    };
    window.api.getSettings().then(fullSettings => {
        const activeSettings = getActiveSettings(fullSettings);
        setSettings(activeSettings);
    });
    fetchFiles('');
  }, []);

  const fetchFiles = useCallback(async (prefix, isLoadMore = false) => {
    setLoading(true);
    setError(null);
    try {
      const token = isLoadMore ? nextToken : undefined;
      const result = await window.api.listObjects({ continuationToken: token, prefix });
      if (result.success) {
        setFiles(prev => isLoadMore ? [...prev, ...result.data.files] : result.data.files);
        setNextToken(result.data.nextContinuationToken);
      } else {
        setError(result.error);
        setFiles([]);
        setNextToken(null);
      }
    } catch (err) {
      setError(err.message);
      setFiles([]);
      setNextToken(null);
    } finally {
      setLoading(false);
    }
  }, [nextToken]);

  const handleSearch = () => {
    setSearchTerm(inputSearchTerm);
    onSearchOpenChange(false);
    setFiles([]);
    setNextToken(null);
    fetchFiles(inputSearchTerm, false);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setInputSearchTerm('');
    setFiles([]);
    setNextToken(null);
    fetchFiles('', false);
  };

  const handleDeleteClick = (key) => {
    setFileToDelete(key);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    
    const result = await window.api.deleteObject(fileToDelete);
    if (result.success) {
      toast.success('文件删除成功');
      addNotification({ message: `文件 "${fileToDelete}" 已删除`, type: 'success' });
      setFiles(prev => prev.filter(file => (file.key || file.Key) !== fileToDelete));
    } else {
      toast.error(`删除失败: ${result.error}`);
      addNotification({ message: `删除文件 "${fileToDelete}" 失败`, type: 'error' });
    }
    setFileToDelete(null);
  };

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url).then(() => {
        toast.success('URL 已复制到剪贴板');
    }, () => {
        toast.error('复制失败');
    });
  };

  const getPublicUrl = (key) => {
    if (!settings) return null;

    if (settings.publicDomain) {
      let domain = settings.publicDomain;
      if (domain.endsWith('/')) {
        domain = domain.slice(0, -1);
      }
      if (!/^(https?:\/\/)/i.test(domain)) {
        domain = `https://${domain}`;
      }
      return `${domain}/${key}`;
    }

    if (settings.type === 'r2' && settings.accountId && settings.bucketName) {
      return `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${key}`;
    }
    
    if (settings.type === 'oss' && settings.region && settings.bucket) {
      return `https://${settings.bucket}.${settings.region}.aliyuncs.com/${key}`;
    }

    return null;
  };

  const handleDownload = (key) => {
      window.api.downloadFile(key);
      toast.success(`已加入下载队列: ${key}`);
      navigate('/downloads');
  }

  const renderFileCards = () => (
    <div className="space-y-4">
      {files.map((file, index) => {
        const isLastElement = files.length === index + 1;
        const key = file.key || file.Key;
        const size = file.size || file.Size;
        const lastModified = file.lastModified || file.LastModified;
        const publicUrl = getPublicUrl(key);
        return (
          <Card key={key} ref={isLastElement ? lastFileElementRef : null} className="p-4">
            <div className="flex items-start gap-4">
              {getFileIcon(file)}
              <div className="flex-1 min-w-0">
                <p className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis" title={key}>
                  {key}
                </p>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span>{getFileTypeDescription(file)}</span>
                  <span>{formatBytes(size)}</span>
                  <span>上次修改: {new Date(lastModified).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            {publicUrl && (
              <div className="mt-4 flex items-center gap-2">
                  <Input readOnly value={publicUrl} className="bg-muted flex-1"/>
                  <Button variant="outline" size="icon" onClick={() => handleCopyUrl(publicUrl)}><Copy className="h-4 w-4"/></Button>
                  <Button variant="outline" size="icon" onClick={() => handleDownload(key)} disabled={downloading[key]}>
                      <Download className="h-4 w-4"/>
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(key)} disabled={downloading[key]}><Trash2 className="h-4 w-4"/></Button>
              </div>
            )}
            {!publicUrl && (
               <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleDownload(key)} disabled={downloading[key]}>
                      <Download className="h-4 w-4"/>
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(key)} disabled={downloading[key]}><Trash2 className="h-4 w-4"/></Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  );

  const renderFileList = () => (
    <Card>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>文件名</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>上次修改</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {files.map((file, index) => {
                    const isLastElement = files.length === index + 1;
                    const key = file.key || file.Key;
                    const size = file.size || file.Size;
                    const lastModified = file.lastModified || file.LastModified;
                    const publicUrl = getPublicUrl(key);
                    return (
                        <TableRow key={key} ref={isLastElement ? lastFileElementRef : null}>
                            <TableCell>{getFileIcon(file)}</TableCell>
                            <TableCell className="font-medium max-w-xs truncate" title={key}>
                              {key}
                            </TableCell>
                            <TableCell>{formatBytes(size)}</TableCell>
                            <TableCell>{new Date(lastModified).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {publicUrl && <Button variant="ghost" size="icon" onClick={() => handleCopyUrl(publicUrl)}><Copy className="h-4 w-4"/></Button>}
                                    <Button variant="ghost" size="icon" onClick={() => handleDownload(key)} disabled={downloading[key]}>
                                        <Download className="h-4 w-4"/>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(key)} disabled={downloading[key]}>
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    </Card>
  );

  return (
    <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
      <Dialog open={isSearchOpen} onOpenChange={onSearchOpenChange}>
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 mb-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">存储的文件</h1>
              <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{files.length} 个文件</span>
                  
                  <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value)} aria-label="View mode">
                    <ToggleGroupItem value="card" aria-label="Card view">
                      <LayoutGrid className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="list" aria-label="List view">
                      <List className="h-4 w-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <Button variant="outline" onClick={() => fetchFiles(searchTerm, false)} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
              </div>
            </div>
            {searchTerm && (
              <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                      搜索结果: <strong>{searchTerm}</strong>
                  </p>
                  <Button variant="ghost" size="icon" onClick={clearSearch}>
                      <XCircle className="h-4 w-4" />
                  </Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {viewMode === 'card' ? renderFileCards() : renderFileList()}
            {loading && <div className="text-center p-4">加载中...</div>}
            {error && <div className="text-center p-4 text-red-500">错误: {error}</div>}
            {!loading && files.length === 0 && <div className="text-center p-4">没有文件</div>}
          </div>
        </div>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>搜索文件</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              id="search"
              value={inputSearchTerm}
              onChange={(e) => setInputSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入文件前缀进行搜索..."
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSearch}>搜索</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确定要删除吗?</AlertDialogTitle>
          <AlertDialogDescription>
            这个操作无法撤销。 "{fileToDelete}" 将从您的 R2 存储桶中永久删除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setFileToDelete(null)}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDelete}>确定</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 