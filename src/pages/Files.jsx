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
  RefreshCw, Trash2, Download, Copy, List, LayoutGrid, TextSearch, XCircle, FolderPlus, UploadCloud, FolderClosed
} from 'lucide-react';
import { formatBytes, getFileIcon, getFileTypeDescription } from '@/lib/file-utils.jsx';
import { useNotifications } from '@/contexts/NotificationContext';
import FilePreview from '@/components/FilePreview';

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
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const { addNotification } = useNotifications();
  const observer = useRef();
  const navigate = useNavigate();

  const handleFileSelectAndUpload = async () => {
    const selectedPaths = await window.api.showOpenDialog();
    if (selectedPaths) {
      const newUploads = selectedPaths.map(path => {
        const fileName = path.split(/[\\/]/).pop();
        const key = `${currentPrefix}${fileName}`;
        // Do NOT start the upload here.
        // Let UploadsPage handle the initiation.
        return { path, key, status: 'pending' };
      });

      if (newUploads.length > 0) {
        toast.info(`${newUploads.length} 个文件已加入上传队列。`);
        // Navigate to uploads page with all the necessary info
        navigate('/uploads', { state: { newUploads: newUploads } });
      }
    }
  };

  const lastFileElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextToken) {
        fetchFiles(currentPrefix, true);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, nextToken, currentPrefix]);

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
    fetchFiles('', false);
  }, []);

  const fetchFiles = useCallback(async (prefix, isLoadMore = false) => {
    setLoading(true);
    setError(null);
    try {
      const fetchPrefix = typeof prefix === 'string' ? prefix : currentPrefix;
      const token = isLoadMore ? nextToken : undefined;
      const result = await window.api.listObjects({ continuationToken: token, prefix: fetchPrefix, delimiter: '/' });
      if (result.success) {
        let newFiles = result.data.files;
        if (fetchPrefix) {
          newFiles = newFiles.filter(f => (f.key || f.Key) !== fetchPrefix);
        }
        setFiles(prev => isLoadMore ? [...prev, ...newFiles] : newFiles);
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
  }, [nextToken, currentPrefix]);

  const handleSearch = () => {
    onSearchOpenChange(false);
    setFiles([]);
    setNextToken(null);
    const newSearchTerm = inputSearchTerm;
    setSearchTerm(newSearchTerm);
    setCurrentPrefix('');
    fetchFiles(newSearchTerm, false);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setInputSearchTerm('');
    setFiles([]);
    setNextToken(null);
    setCurrentPrefix('');
    fetchFiles('', false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName) {
      toast.error('文件夹名称不能为空');
      return;
    }
    const folderName = `${currentPrefix}${newFolderName}/`;
    
    const result = await window.api.createFolder(folderName);

    if (result.success) {
      toast.success(`文件夹 "${newFolderName}" 创建成功`);
      addNotification({ message: `文件夹 "${newFolderName}" 已创建`, type: 'success' });
      fetchFiles(currentPrefix);
    } else {
      toast.error(`创建失败: ${result.error}`);
      addNotification({ message: `创建文件夹 "${newFolderName}" 失败`, type: 'error' });
    }
    setIsCreateFolderDialogOpen(false);
    setNewFolderName('');
  };

  const handlePrefixChange = (newPrefix) => {
    setSearchTerm('');
    setInputSearchTerm('');
    setCurrentPrefix(newPrefix);
    setFiles([]);
    setNextToken(null);
    fetchFiles(newPrefix, false);
  };

  const handleDeleteClick = (key) => {
    setFileToDelete(key);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    
    const isDir = fileToDelete.endsWith('/');
    const result = isDir 
      ? await window.api.deleteFolder(fileToDelete)
      : await window.api.deleteObject(fileToDelete);

    if (result.success) {
      const message = isDir ? `文件夹 "${fileToDelete}" 删除成功` : `文件 "${fileToDelete}" 删除成功`;
      toast.success(message);
      addNotification({ message: message.replace('成功', '已删除'), type: 'success' });
      
      if (isDir) {
        fetchFiles(currentPrefix);
      }
      // After a delete, always refresh the current view from scratch.
      fetchFiles(currentPrefix);
    } else {
      const message = `删除失败: ${result.error}`;
      toast.error(message);
      addNotification({ message: `删除 "${fileToDelete}" 失败`, type: 'error' });
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

  const renderBreadcrumbs = () => {
    if (searchTerm) return null;

    const parts = currentPrefix.split('/').filter(p => p);
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 px-1">
        <span
          className="cursor-pointer hover:text-primary"
          onClick={() => handlePrefixChange('')}
        >
          全部文件
        </span>
        {parts.map((part, index) => {
          const path = parts.slice(0, index + 1).join('/') + '/';
          return (
            <span key={path} className="flex items-center gap-1.5">
              <span>/</span>
              <span
                className="cursor-pointer hover:text-primary"
                onClick={() => handlePrefixChange(path)}
              >
                {part}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  const renderFileCards = () => (
    <div className="space-y-4">
      {files.map((file, index) => {
        const isLastElement = files.length === index + 1;
        const key = file.key || file.Key;
        const size = file.size || file.Size;
        const lastModified = file.lastModified || file.LastModified;
        const publicUrl = getPublicUrl(key);
        const isDir = file.isFolder;

        const handleCardClick = (e) => {
          if (e.target.closest('button')) return;
          if (isDir) {
            handlePrefixChange(key);
          } else {
            setPreviewFile(file);
          }
        };

        return (
          <Card key={key} ref={isLastElement ? lastFileElementRef : null} className="p-4" onClick={handleCardClick} style={{ cursor: isDir ? 'pointer' : 'default' }}>
            <div className="flex items-start gap-4">
              {isDir ? <FolderClosed /> : getFileIcon(file)}
              <div className="flex-1 min-w-0">
                <p className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis" title={key}>
                  {isDir ? key.replace(currentPrefix, '').slice(0, -1) : key.replace(currentPrefix, '')}
                </p>
                <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>{getFileTypeDescription(file)}</span>
                  {!isDir && <span>{formatBytes(size)}</span>}
                  <span>上次修改: {new Date(lastModified).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            {!isDir && publicUrl && (
              <div className="mt-4 flex items-center gap-2">
                  <Input readOnly value={publicUrl} className="bg-muted flex-1"/>
                  <Button variant="outline" size="icon" onClick={() => handleCopyUrl(publicUrl)}><Copy className="h-4 w-4"/></Button>
                  <Button variant="outline" size="icon" onClick={() => handleDownload(key)} disabled={downloading[key]}>
                      <Download className="h-4 w-4"/>
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(key)} disabled={downloading[key]}><Trash2 className="h-4 w-4"/></Button>
              </div>
            )}
            {!isDir && !publicUrl && (
               <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleDownload(key)} disabled={downloading[key]}>
                      <Download className="h-4 w-4"/>
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(key)} disabled={downloading[key]}><Trash2 className="h-4 w-4"/></Button>
              </div>
            )}
             {isDir && (
                <div className="mt-4 flex items-center justify-end gap-2">
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(key)}><Trash2 className="h-4 w-4"/></Button>
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
                    const isDir = file.isFolder;
                    
                    const handleRowClick = () => {
                      if (isDir) {
                        handlePrefixChange(key);
                      } else {
                        setPreviewFile(file);
                      }
                    };

                    return (
                        <TableRow key={key} ref={isLastElement ? lastFileElementRef : null} onClick={handleRowClick} style={{ cursor: isDir ? 'pointer' : 'default' }}>
                            <TableCell>{isDir ? <FolderClosed /> : getFileIcon(file)}</TableCell>
                            <TableCell className="font-semibold max-w-xs truncate" title={key}>
                                {isDir ? key.replace(currentPrefix, '').slice(0, -1) : key.replace(currentPrefix, '')}
                            </TableCell>
                            <TableCell>{!isDir ? formatBytes(size) : ''}</TableCell>
                            <TableCell>{new Date(lastModified).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                                {!isDir && (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleCopyUrl(publicUrl); }}><Copy className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDownload(key);}} disabled={downloading[key]}><Download className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteClick(key);}} disabled={downloading[key]}><Trash2 className="h-4 w-4" color="hsl(var(--destructive))"/></Button>
                                  </>
                                )}
                                {isDir && (
                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteClick(key); }}><Trash2 className="h-4 w-4" color="hsl(var(--destructive))"/></Button>
                                )}
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    </Card>
  );

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">存储的文件</h1>
            <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{files.length} 个文件</span>
                
                <ToggleGroup type="single" value={viewMode} onValueChange={setViewMode} aria-label="View mode">
                  <ToggleGroupItem value="card" aria-label="Card view">
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="List view">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>

                <Button variant="outline" onClick={() => fetchFiles(currentPrefix, false)} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setIsCreateFolderDialogOpen(true)}>
                  <FolderPlus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleFileSelectAndUpload}>
                  <UploadCloud className="h-4 w-4" />
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

        {renderBreadcrumbs()}

        <div className="flex-1 overflow-auto">
          {viewMode === 'card' ? renderFileCards() : renderFileList()}
          {loading && <div className="text-center p-4">加载中...</div>}
          {error && <div className="text-center p-4 text-red-500">错误: {error}</div>}
          {!loading && files.length === 0 && <div className="text-center p-4">没有文件</div>}
        </div>
      </div>
      
      <Dialog open={isSearchOpen} onOpenChange={onSearchOpenChange}>
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
      
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
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

      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新文件夹</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="folder-name" className="text-right">
                文件夹名称
              </Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="col-span-3"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="例如：我的照片"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateFolder}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilePreview
        file={previewFile}
        publicUrl={previewFile ? getPublicUrl(previewFile.key) : null}
        open={!!previewFile}
        onOpenChange={() => setPreviewFile(null)}
      />
    </>
  );
} 