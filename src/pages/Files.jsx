import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { 
  RefreshCw, Trash2, Download, Copy, List, LayoutGrid
} from 'lucide-react';
import { formatBytes, getFileIcon, getFileTypeDescription } from '@/lib/file-utils.jsx';

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [settings, setSettings] = useState(null);
  const [downloading, setDownloading] = useState({});
  const [fileToDelete, setFileToDelete] = useState(null);
  const [viewMode, setViewMode] = useState('card');
  const observer = useRef();
  const navigate = useNavigate();

  const lastFileElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextToken) {
        fetchFiles(true);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, nextToken]);

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
  }, [fetchFiles]);

  const handleDeleteClick = (key) => {
    setFileToDelete(key);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    
    const result = await window.api.deleteObject(fileToDelete);
    if (result.success) {
      toast.success('文件删除成功');
      setFiles(prev => prev.filter(file => file.Key !== fileToDelete));
    } else {
      toast.error(`删除失败: ${result.error}`);
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
    if (!settings || !settings.publicDomain) return null;
    let domain = settings.publicDomain;
    if (domain.endsWith('/')) {
      domain = domain.slice(0, -1);
    }
    if (!/^(https?:\/\/)/i.test(domain)) {
      domain = `https://${domain}`;
    }
    return `${domain}/${key}`;
  }

  const handleDownload = (key) => {
      window.api.downloadFile(key);
      toast.success(`已加入下载队列: ${key}`);
      navigate('/downloads');
  }

  const renderFileCards = () => (
    <div className="space-y-4">
      {files.map((file, index) => {
        const isLastElement = files.length === index + 1;
        const publicUrl = getPublicUrl(file.Key);
        return (
          <Card key={file.Key} ref={isLastElement ? lastFileElementRef : null} className="p-4">
            <div className="flex items-start gap-4">
              {getFileIcon(file.Key)}
              <div className="flex-1 min-w-0">
                <p className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis" title={file.Key}>
                  {file.Key}
                </p>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span>{getFileTypeDescription(file.Key)}</span>
                  <span>{formatBytes(file.Size)}</span>
                  <span>上次修改: {new Date(file.LastModified).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            {publicUrl && (
              <div className="mt-4 flex items-center gap-2">
                  <Input readOnly value={publicUrl} className="bg-muted flex-1"/>
                  <Button variant="outline" size="icon" onClick={() => handleCopyUrl(publicUrl)}><Copy className="h-4 w-4"/></Button>
                  <Button variant="outline" size="icon" onClick={() => handleDownload(file.Key)} disabled={downloading[file.Key]}>
                      <Download className="h-4 w-4"/>
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(file.Key)} disabled={downloading[file.Key]}><Trash2 className="h-4 w-4"/></Button>
              </div>
            )}
            {!publicUrl && (
               <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleDownload(file.Key)} disabled={downloading[file.Key]}>
                      <Download className="h-4 w-4"/>
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(file.Key)} disabled={downloading[file.Key]}><Trash2 className="h-4 w-4"/></Button>
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
                    const publicUrl = getPublicUrl(file.Key);
                    return (
                        <TableRow key={file.Key} ref={isLastElement ? lastFileElementRef : null}>
                            <TableCell>{getFileIcon(file.Key)}</TableCell>
                            <TableCell className="font-medium">{file.Key}</TableCell>
                            <TableCell>{formatBytes(file.Size)}</TableCell>
                            <TableCell>{new Date(file.LastModified).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {publicUrl && <Button variant="ghost" size="icon" onClick={() => handleCopyUrl(publicUrl)}><Copy className="h-4 w-4"/></Button>}
                                    <Button variant="ghost" size="icon" onClick={() => handleDownload(file.Key)} disabled={downloading[file.Key]}>
                                        <Download className="h-4 w-4"/>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(file.Key)} disabled={downloading[file.Key]}><Trash2 className="h-4 w-4"/></Button>
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
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">存储的文件</h1>
            <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{files.length} 个文件</span>
                <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value)} variant="outline" size="sm">
                    <ToggleGroupItem value="card" aria-label="Card view">
                        <LayoutGrid className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="list" aria-label="List view">
                        <List className="h-4 w-4" />
                    </ToggleGroupItem>
                </ToggleGroup>
                <Button onClick={() => fetchFiles(false)} disabled={loading} variant="outline">
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading && !nextToken ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
            </div>
          </div>
          {error && <div className="mt-4 text-red-500 p-4 bg-red-500/10 rounded-md">错误: {error}</div>}
        </div>

        <div className="flex-1 overflow-y-auto -mr-6 pr-6">
          {loading && files.length === 0 && <div className="text-center p-8">正在加载文件...</div>}
          
          {!loading && files.length === 0 && !error && (
              <div className="text-center p-8 text-muted-foreground">
                  <p>没有找到文件。</p>
                  <p className="mt-2 text-sm">尝试点击右上角的刷新按钮，或者检查您的存储桶配置。</p>
              </div>
          )}
          
          {viewMode === 'card' ? renderFileCards() : renderFileList()}
          
          {loading && files.length > 0 && <div className="text-center p-4">正在加载更多文件...</div>}
          
          {!loading && !nextToken && files.length > 0 && (
            <div className="text-center p-4 text-muted-foreground">已加载所有文件。</div>
          )}
        </div>
      </div>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确定要删除吗？</AlertDialogTitle>
          <AlertDialogDescription>
            此操作无法撤销。文件 "{fileToDelete}" 将被永久删除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setFileToDelete(null)}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDelete}>删除</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 