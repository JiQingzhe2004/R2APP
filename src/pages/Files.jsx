import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  DialogDescription,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { 
  RefreshCw, Trash2, Download, Copy, List, LayoutGrid, TextSearch, XCircle, FolderPlus, UploadCloud, FolderClosed, EllipsisVertical, Search, ArrowUpDown
} from 'lucide-react';
import { formatBytes, getFileIcon, getFileTypeDescription } from '@/lib/file-utils.jsx';
import { useNotifications } from '@/contexts/NotificationContext';
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUploads } from '@/contexts/UploadsContext';
import { useOutletContext } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

function FilesSkeletonLoader({ viewMode }) {
  if (viewMode === 'list') {
    return (
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Skeleton className="h-5 w-5" />
              </TableHead>
              <TableHead className="w-[50px]">
                <Skeleton className="h-6 w-6" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="text-right">
                <Skeleton className="h-4 w-12" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(8)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-5 w-5" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-6" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-3/4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-5/6" />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-5 w-5 rounded-sm" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function FilesPage() {
  const { activeProfileId, isSearchDialogOpen, setIsSearchDialogOpen, bucket } = useOutletContext();
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
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [sortField, setSortField] = useState('date'); // 'date' | 'size' | 'name'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const { addNotification } = useNotifications();
  const { addUploads } = useUploads();
  const observer = useRef();
  const navigate = useNavigate();

  const handleFileSelectAndUpload = async () => {
    const selectedPaths = await window.api.showOpenDialog();
    if (selectedPaths) {
      const newUploads = selectedPaths.map(path => {
        const key = `${currentPrefix}${path.split(/[\\/]/).pop()}`;
        return { path, key };
      });

      if (newUploads.length > 0) {
        addUploads(newUploads);
        toast.info(`${newUploads.length} 个文件已加入上传队列。`);
        navigate('/uploads');
      }
    }
  };

  const fetchFiles = useCallback(async (prefix, options = {}) => {
    const { isLoadMore = false, isSearch = false } = options;

    if (!activeProfileId) {
      setLoading(false);
      setError('没有活动的存储桶配置。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetchPrefix = typeof prefix === 'string' ? prefix : currentPrefix;
      const token = isLoadMore ? nextToken : undefined;
      const result = await window.api.listObjects({ 
        continuationToken: token, 
        prefix: fetchPrefix, 
        delimiter: isSearch ? undefined : '/' 
      });

      if (result.success) {
        let newFiles = result.data.files;
        if (fetchPrefix && !isSearch) {
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
  }, [nextToken, currentPrefix, activeProfileId]);

  const lastFileElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextToken && !isSearching) {
        fetchFiles(searchTerm || currentPrefix, { isLoadMore: true, isSearch: !!searchTerm });
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, nextToken, currentPrefix, searchTerm, fetchFiles]);

  useEffect(() => {
    const getActiveSettings = async () => {
        const fullSettings = await window.api.getSettings();
        if (!fullSettings || !fullSettings.activeProfileId || !fullSettings.profiles) return null;
        const baseSettings = fullSettings.settings || {};
        const activeProfile = fullSettings.profiles.find(p => p.id === fullSettings.activeProfileId);
        if (!activeProfile) return null;
        const newSettings = { ...baseSettings, ...activeProfile };
        setSettings(newSettings);
        return newSettings;
    };
    
    const initialize = async () => {
      await getActiveSettings();
      setCurrentPrefix('');
      setSearchTerm('');
      setInputSearchTerm('');
      setFiles([]);
      setNextToken(null);
      fetchFiles('', { isSearch: false });
    };

    initialize();
  }, [activeProfileId]);

  useEffect(() => {
    if (!isSearching) return;

    const handleResults = (results) => {
      setLoading(true);
      setFiles(prev => [...prev, ...results]);
    };
    const handleEnd = () => {
      setLoading(false);
      setIsSearching(false);
    };
    const handleError = (error) => {
      setError(error);
      setLoading(false);
      setIsSearching(false);
    };

    const removeResultsListener = window.api.onSearchResults(handleResults);
    const removeEndListener = window.api.onSearchEnd(handleEnd);
    const removeErrorListener = window.api.onSearchError(handleError);
    
    return () => {
      removeResultsListener();
      removeEndListener();
      removeErrorListener();
    };
  }, [isSearching]);

  const handleSearch = () => {
    setIsSearchDialogOpen(false);
    setFiles([]);
    setNextToken(null);
    setCurrentPrefix('');
    const newSearchTerm = inputSearchTerm;
    setSearchTerm(newSearchTerm);
    
    if (newSearchTerm) {
      setIsSearching(true);
      setError(null);
      setLoading(true);
      window.api.startSearch(newSearchTerm);
    } else {
      fetchFiles('', { isSearch: false });
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setInputSearchTerm('');
    setFiles([]);
    setNextToken(null);
    setCurrentPrefix('');
    fetchFiles('', { isSearch: false });
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
      fetchFiles(currentPrefix, { isSearch: false });
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
    fetchFiles(newPrefix, { isSearch: false });
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
        fetchFiles(currentPrefix, { isSearch: false });
      }
      // After a delete, always refresh the current view from scratch.
      fetchFiles(currentPrefix, { isSearch: false });
    } else {
      const message = `删除失败: ${result.error}`;
      toast.error(message);
      addNotification({ message: `删除 "${fileToDelete}" 失败`, type: 'error' });
    }
    setFileToDelete(null);
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;

    const filesToDelete = Array.from(selectedFiles);
    const promises = filesToDelete.map(key => {
      const isDir = key.endsWith('/');
      return isDir ? window.api.deleteFolder(key) : window.api.deleteObject(key);
    });

    const results = await Promise.all(promises);

    let successCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      const key = filesToDelete[index];
      if (result.success) {
        successCount++;
        const message = key.endsWith('/') ? `文件夹 "${key}" 已删除` : `文件 "${key}" 已删除`;
        addNotification({ message, type: 'success' });
      } else {
        errorCount++;
        const message = `删除 "${key}" 失败: ${result.error}`;
        addNotification({ message, type: 'error' });
      }
    });
    
    if (successCount > 0) {
      toast.success(`${successCount} 个项目已成功删除。`);
    }
    if (errorCount > 0){
      toast.error(`${errorCount} 个项目删除失败。`);
    }

    setSelectedFiles(new Set());
    fetchFiles(currentPrefix, { isSearch: false });
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

    if (settings.type === 'cos' && settings.region && (settings.bucket || settings.bucketName)) {
      const bucket = settings.bucket || settings.bucketName;
      return `https://${bucket}.cos.${settings.region}.myqcloud.com/${key}`;
    }

    return null;
  };

  const handleDownload = (key) => {
      window.api.downloadFile(key);
      toast.success(`已加入下载队列: ${key}`);
  }

  const handleBulkDownload = () => {
    if (selectedFiles.size === 0) return;
    const filesToDownload = Array.from(selectedFiles).filter(key => {
      const file = files.find(f => (f.key || f.Key) === key);
      return file && !file.isFolder;
    });
    
    filesToDownload.forEach(key => {
      window.api.downloadFile(key);
    });

    if (filesToDownload.length > 0) {
      toast.success(`${filesToDownload.length} 个文件已加入下载队列。`);
    }
    
    setSelectedFiles(new Set());
      navigate('/downloads');
  };

  const handleSelectionChange = (key, checked) => {
    setSelectedFiles(prev => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(key);
      } else {
        newSelected.delete(key);
      }
      return newSelected;
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allFileKeys = files.filter(f => !f.isFolder).map(f => f.key || f.Key);
      setSelectedFiles(new Set(allFileKeys));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const sortedFiles = useMemo(() => {
    const items = [...files];
    const compare = (a, b) => {
      const aIsDir = !!a.isFolder;
      const bIsDir = !!b.isFolder;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;

      const aKey = (a.key || a.Key) || '';
      const bKey = (b.key || b.Key) || '';

      if (sortField === 'name') {
        const aNameRel = aKey.startsWith(currentPrefix) ? aKey.slice(currentPrefix.length) : aKey;
        const bNameRel = bKey.startsWith(currentPrefix) ? bKey.slice(currentPrefix.length) : bKey;
        const aName = a.isFolder ? aNameRel.slice(0, -1) : aNameRel;
        const bName = b.isFolder ? bNameRel.slice(0, -1) : bNameRel;
        const aVal = (aName || '').toLowerCase();
        const bVal = (bName || '').toLowerCase();
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }

      let aVal;
      let bVal;
      if (sortField === 'size') {
        aVal = a.size ?? a.Size ?? 0;
        bVal = b.size ?? b.Size ?? 0;
      } else { // date
        const aDate = a.lastModified ?? a.LastModified;
        const bDate = b.lastModified ?? b.LastModified;
        aVal = aDate ? new Date(aDate).getTime() : 0;
        bVal = bDate ? new Date(bDate).getTime() : 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return aKey.localeCompare(bKey);
    };

    return items.sort(compare);
  }, [files, sortField, sortOrder, currentPrefix]);

  const renderBreadcrumbs = () => {
    if (searchTerm) return null;

    const parts = currentPrefix.split('/').filter(p => p);
    return (
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
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
        {viewMode === 'card' && (
          <div className="flex items-center">
            <Checkbox
              id="card-select-all-breadcrumb"
              checked={files.length > 0 && files.filter(f => !f.isFolder).length > 0 && selectedFiles.size === files.filter(f => !f.isFolder).length}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
            />
            <Label htmlFor="card-select-all-breadcrumb" className="ml-2 font-medium text-sm">
              全选
            </Label>
          </div>
        )}
      </div>
    );
  };

  const renderFileCards = () => (
    <div className="space-y-4">
      {sortedFiles.map((file, index) => {
        const isLastElement = sortedFiles.length === index + 1;
        const key = file.key || file.Key;
        const size = file.size || file.Size;
        const lastModified = file.lastModified || file.LastModified;
        const publicUrl = file.publicUrl || getPublicUrl(key);
        const isDir = file.isFolder;

        const handleCardClick = async (e) => {
          if (e.target.closest('button') || e.target.closest('input[type="checkbox"]')) return;
          
          if (isDir) {
            handlePrefixChange(key);
          } else {
            const fileName = key.split('/').pop();
            let behavior = 'preview';
            try {
              const result = await window.api.getSetting('open-behavior');
              behavior = (result && result.success && result.value) ? result.value : 'preview';
            } catch {}
            if (behavior === 'download') {
              handleDownload(key);
            } else {
              const resolvedBucket = settings?.bucketName || settings?.bucket || bucket;
              const isSmms = settings?.type === 'smms';
              const isPicui = settings?.type === 'picui';
              const publicUrlInline = file.publicUrl || getPublicUrl(key);
              window.api.openPreviewWindow({
                fileName: fileName,
                filePath: currentPrefix,
                bucket: resolvedBucket,
                publicUrl: (isSmms || isPicui) ? publicUrlInline : undefined
              });
            }
          }
        };

        return (
          <Card key={key} ref={isLastElement ? lastFileElementRef : null} className={`p-4 ${selectedFiles.has(key) ? 'border-primary' : ''}`} onClick={handleCardClick} style={{ cursor: isDir ? 'pointer' : 'default' }}>
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
              <div className="flex-shrink-0 pt-1">
                <Checkbox
                  id={`card-checkbox-${key}`}
                  checked={selectedFiles.has(key)}
                  onCheckedChange={(checked) => handleSelectionChange(key, checked)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isDir}
                />
              </div>
            </div>
            {!isDir && publicUrl && (
              <div className="mt-4 flex items-center gap-2">
                  <Input readOnly value={publicUrl} className="bg-muted flex-1"/>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => handleCopyUrl(publicUrl)}><Copy className="h-4 w-4"/></Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>复制链接</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => handleDownload(key)} disabled={downloading[key]}>
                          <Download className="h-4 w-4"/>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>下载</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(key)} disabled={downloading[key]}><Trash2 className="h-4 w-4"/></Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>删除</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
              </div>
            )}
            {!isDir && !publicUrl && (
               <div className="mt-4 flex items-center justify-end gap-2">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => handleDownload(key)} disabled={downloading[key]}>
                          <Download className="h-4 w-4"/>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>下载</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(key)} disabled={downloading[key]}><Trash2 className="h-4 w-4"/></Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>删除</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
              </div>
            )}
             {isDir && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(key)}><Trash2 className="h-4 w-4"/></Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>删除文件夹</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={files.length > 0 && files.filter(f => !f.isFolder).length > 0 && selectedFiles.size === files.filter(f => !f.isFolder).length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>文件名</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>上次修改</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedFiles.map((file, index) => {
                    const isLastElement = sortedFiles.length === index + 1;
                    const key = file.key || file.Key;
                    const size = file.size || file.Size;
                    const lastModified = file.lastModified || file.LastModified;
                    const publicUrl = file.publicUrl || getPublicUrl(key);
                    const isDir = file.isFolder;
                    
                    const handleRowClick = async () => {
                      if (isDir) {
                        handlePrefixChange(key);
                      } else {
                        const fileName = key.split('/').pop();
                        let behavior = 'preview';
                        try {
                          const result = await window.api.getSetting('open-behavior');
                          behavior = (result && result.success && result.value) ? result.value : 'preview';
                        } catch {}
                        if (behavior === 'download') {
                          handleDownload(key);
                        } else {
                          const resolvedBucket = settings?.bucketName || settings?.bucket || bucket;
                          window.api.openPreviewWindow({
                            fileName: fileName,
                            filePath: currentPrefix,
                            bucket: resolvedBucket,
                          });
                        }
                      }
                    };

                    return (
                        <TableRow 
                          key={key} 
                          ref={isLastElement ? lastFileElementRef : null} 
                          onClick={handleRowClick} 
                          style={{ cursor: isDir ? 'pointer' : 'default' }}
                          className={selectedFiles.has(key) ? 'bg-muted/50' : ''}
                        >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                id={`list-checkbox-${key}`}
                                checked={selectedFiles.has(key)}
                                onCheckedChange={(checked) => handleSelectionChange(key, checked)}
                                disabled={isDir}
                              />
                            </TableCell>
                            <TableCell>{isDir ? <FolderClosed /> : getFileIcon(file)}</TableCell>
                            <TableCell className="font-semibold max-w-xs truncate" title={key}>
                                {isDir ? key.replace(currentPrefix, '').slice(0, -1) : key.replace(currentPrefix, '')}
                            </TableCell>
                            <TableCell>{!isDir ? formatBytes(size) : ''}</TableCell>
                            <TableCell>{new Date(lastModified).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                                {!isDir && (
                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleCopyUrl(publicUrl); }}><Copy className="h-4 w-4"/></Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>复制链接</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDownload(key);}} disabled={downloading[key]}><Download className="h-4 w-4"/></Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>下载</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteClick(key);}} disabled={downloading[key]}><Trash2 className="h-4 w-4" color="hsl(var(--destructive))"/></Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>删除</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {isDir && (
                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteClick(key); }}><Trash2 className="h-4 w-4" color="hsl(var(--destructive))"/></Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>删除文件夹</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
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
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{files.length} 个文件</span>
                
                <TooltipProvider delayDuration={0}>
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(val) => val && setViewMode(val)}
                    aria-label="View mode"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem
                          value="card"
                          aria-label="Card view"
                          className={`rounded-lg px-3 h-10 ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>卡片视图</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem
                          value="list"
                          aria-label="List view"
                          className={`rounded-lg px-3 h-10 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
                        >
                          <List className="h-4 w-4" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>列表视图</p>
                      </TooltipContent>
                    </Tooltip>
                  </ToggleGroup>
                </TooltipProvider>

                <TooltipProvider delayDuration={0}>
                  <DropdownMenu>
                    <Tooltip>
                      <DropdownMenuTrigger asChild>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" aria-label="排序">
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                      </DropdownMenuTrigger>
                      <TooltipContent>
                        <p>排序</p>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>排序方式</DropdownMenuLabel>
                      <DropdownMenuRadioGroup value={sortField} onValueChange={setSortField}>
                        <DropdownMenuRadioItem value="date">按日期</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="size">按大小</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="name">按名称</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>顺序</DropdownMenuLabel>
                      <DropdownMenuRadioGroup value={sortOrder} onValueChange={setSortOrder}>
                        <DropdownMenuRadioItem value="desc">降序</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="asc">升序</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={() => fetchFiles(currentPrefix, { isSearch: false })} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>刷新列表</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setIsCreateFolderDialogOpen(true)}>
                  <FolderPlus className="h-4 w-4" />
                </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>创建文件夹</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleFileSelectAndUpload}>
                  <UploadCloud className="h-4 w-4" />
                </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>上传文件</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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

        {loading && files.length === 0 ? (
          <FilesSkeletonLoader viewMode={viewMode} />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-4 text-red-500">
            错误: {error}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {renderBreadcrumbs()}
              </div>
              <div className="flex items-center gap-2">
                {selectedFiles.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">已选择 {selectedFiles.size} 个项目</span>
                    <Button variant="outline" size="sm" onClick={handleBulkDownload}>
                      <Download className="mr-2 h-4 w-4" />
                      下载所选
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除所选
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {files.length > 0 ? (
                <>
                  {viewMode === 'card' ? renderFileCards() : renderFileList()}
                  {loading && <div className="text-center p-4">加载中...</div>}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  没有文件
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>搜索文件</DialogTitle>
            <DialogDescription>
              搜索当前存储桶文件
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="relative flex w-full max-w-3xl mx-auto items-center">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="search"
                value={inputSearchTerm}
                onChange={(e) => setInputSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="输入文件名或前缀进行搜索..."
                className="pl-12 h-12 rounded-l-full rounded-r-none border-r-0"
              />
              <Button onClick={handleSearch} className="h-12 px-6 rounded-l-none rounded-r-full" aria-label="执行搜索">
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </div>
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
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>
              输入新文件夹的名称。它将被创建在当前目录下
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folder-name"></Label>
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="col-span-3"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="例如：我的照片"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateFolder}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 