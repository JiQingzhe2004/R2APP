import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import LottieAnimation from '@/components/LottieAnimation';
import WelcomeLottie from '@/assets/lottie/Welcome.lottie';
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
import { MorphingMenu } from "@/components/ui/morphing-menu"
import { cn } from '@/lib/utils';
import { 
  RefreshCw, Trash2, Download, Copy, List, LayoutGrid, TextSearch, XCircle, FolderPlus, UploadCloud, FolderClosed, EllipsisVertical, Search, ArrowUpDown, Cloud, Settings, Plus, ChevronsUpDown, Check, QrCode
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
import { DeleteOverlay, useDeleteState } from '@/components/ui/delete-overlay';
import QRCode from 'qrcode';

function FileQrMenu({ publicUrl }) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (!publicUrl) {
      setQrCodeUrl('');
      return;
    }
    QRCode.toDataURL(publicUrl, { width: 200, margin: 1 })
      .then((url) => setQrCodeUrl(url))
      .catch(() => setQrCodeUrl(''));
  }, [publicUrl]);

  if (!publicUrl) return null;

  return (
    <MorphingMenu
      className="h-9 w-9 z-50"
      triggerClassName="w-9 h-9 rounded-full border bg-background hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
      direction="top-right"
      collapsedRadius="18px"
      expandedRadius="24px"
      expandedWidth={260}
      trigger={
        <div className="flex w-full h-full items-center justify-center">
          <QrCode className="h-4 w-4" />
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="text-sm font-medium w-full text-center border-b pb-2">
          扫码打开文件链接
        </div>
        <div className="bg-white p-2 rounded-lg">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="文件链接二维码" className="w-40 h-40" />
          ) : (
            <div className="w-40 h-40 flex items-center justify-center text-muted-foreground text-xs">
              生成中...
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground text-center px-2">
          使用微信或浏览器扫描二维码即可访问该文件链接
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="w-full rounded-full"
          onClick={() => {
            navigator.clipboard
              .writeText(publicUrl)
              .then(() => toast.success('链接已复制'))
              .catch(() => toast.error('复制失败'));
          }}
        >
          <Copy className="w-3 h-3 mr-2" />
          复制链接
        </Button>
      </div>
    </MorphingMenu>
  );
}

// 空状态插画组件
function EmptyStateIllustration({ hasSettings, onGoToSettings }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
      <div className="relative mb-8">
        {/* 主插画 */}
        <div className="w-32 h-32 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 rounded-full flex items-center justify-center mb-4">
          <Cloud className="w-16 h-16 text-blue-500 dark:text-blue-400" />
        </div>
        
        {/* 装饰性元素 */}
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900 dark:to-emerald-800 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
        </div>
        <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-gradient-to-br from-purple-100 to-violet-200 dark:from-purple-900 dark:to-violet-800 rounded-full flex items-center justify-center">
          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
        </div>
      </div>
      
      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {hasSettings ? '选择存储配置' : '配置存储服务'}
      </h3>
      
      <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
        {hasSettings 
          ? '您还没有选择活跃的存储配置。请选择一个配置来开始管理您的文件。'
          : '您还没有配置任何存储服务。请先添加一个存储配置来开始使用。'
        }
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Button 
          onClick={onGoToSettings} 
          className="flex items-center gap-2 px-6 py-3"
        >
          <Settings className="w-5 h-5" />
          {hasSettings ? '选择配置' : '添加配置'}
        </Button>
        
        {!hasSettings && (
          <Button 
            variant="outline" 
            onClick={onGoToSettings}
            className="flex items-center gap-2 px-6 py-3"
          >
            <Plus className="w-5 h-5" />
            了解存储服务
          </Button>
        )}
      </div>
      
      {/* 功能提示 */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">上传文件</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">支持拖拽上传，批量处理</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-3">
            <FolderClosed className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">文件管理</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">创建文件夹，组织文件</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Download className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">快速下载</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">一键下载，分享链接</p>
        </div>
      </div>
    </div>
  );
}

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
  const { activeProfileId, bucket, searchTerm, setSearchTerm } = useOutletContext();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [settings, setSettings] = useState(null);
  const [downloading, setDownloading] = useState({});
  const [fileToDelete, setFileToDelete] = useState(null);
  const [viewMode, setViewMode] = useState('card');
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sortField, setSortField] = useState('date'); // 'date' | 'size' | 'name'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [hasAnyProfiles, setHasAnyProfiles] = useState(false); // 新增：检查是否有任何配置
  const { addNotification } = useNotifications();
  const { addUploads } = useUploads();
  const { deleteState, startDelete, endDelete } = useDeleteState();
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
        if (!fullSettings || !fullSettings.profiles) {
          setHasAnyProfiles(false);
          return null;
        }
        
        // 检查是否有任何配置
        setHasAnyProfiles(fullSettings.profiles.length > 0);
        
        if (!fullSettings.activeProfileId || fullSettings.profiles.length === 0) return null;
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
      setFiles([]);
      setNextToken(null);
      fetchFiles('', { isSearch: false });
    };

    initialize();
  }, [activeProfileId]);

  useEffect(() => {
    if (searchTerm) {
       setFiles([]);
       setNextToken(null);
       setCurrentPrefix('');
       setIsSearching(true);
       setError(null);
       setLoading(true);
       window.api.startSearch(searchTerm);
    } else if (isSearching) {
       setIsSearching(false);
       setFiles([]);
       setNextToken(null);
       fetchFiles('', { isSearch: false });
    }
   }, [searchTerm]);

  useEffect(() => {
    if (!isSearching) return;

    const handleResults = (results) => {
      setLoading(true);
      setFiles(prev => [...prev, ...results]);
    };
    const handleEnd = () => {
      setLoading(false);
      // Don't set isSearching(false) here if we want to stay in "search result view" mode?
      // But previous code did. Let's stick to previous behavior for now, or improve it.
      // If I set it to false, the "Loading..." indicator stops.
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

   const clearSearch = () => {
    setSearchTerm('');
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
    const itemType = isDir ? '文件夹' : '文件';
    
    // 开始删除，显示遮罩层
    startDelete(1, `正在删除${itemType}...`);
    
    try {
      const result = isDir 
        ? await window.api.deleteFolder(fileToDelete)
        : await window.api.deleteObject(fileToDelete);

      if (result.success) {
        const message = `${itemType} "${fileToDelete}" 删除成功`;
        toast.success(message);
        addNotification({ message: message.replace('成功', '已删除'), type: 'success' });
        
        // After a delete, always refresh the current view from scratch.
        fetchFiles(currentPrefix, { isSearch: false });
      } else {
        const message = `删除失败: ${result.error}`;
        toast.error(message);
        addNotification({ message: `删除 "${fileToDelete}" 失败`, type: 'error' });
      }
    } catch (error) {
      const message = `删除失败: ${error.message}`;
      toast.error(message);
      addNotification({ message: `删除 "${fileToDelete}" 失败`, type: 'error' });
    } finally {
      // 结束删除，隐藏遮罩层
      endDelete();
      setFileToDelete(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedFiles.size === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const confirmBulkDelete = async () => {
    setShowBulkDeleteDialog(false);
    if (selectedFiles.size === 0) return;

    const filesToDelete = Array.from(selectedFiles);
    const deleteCount = filesToDelete.length;
    
    // 开始批量删除，显示遮罩层
    startDelete(deleteCount, `正在删除 ${deleteCount} 个项目...`);
    
    try {
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

      fetchFiles(currentPrefix, { isSearch: false });
    } catch (error) {
      toast.error(`批量删除失败: ${error.message}`);
      addNotification({ message: '批量删除操作失败', type: 'error' });
    } finally {
      // 结束删除，隐藏遮罩层
      endDelete();
      setSelectedFiles(new Set());
    }
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

    // 优先使用自定义域名
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

    // R2 默认域名
    if (settings.type === 'r2' && settings.accountId && settings.bucketName) {
      return `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${key}`;
    }
    
    // 阿里云 OSS 默认域名
    if (settings.type === 'oss' && settings.region && settings.bucket) {
      return `https://${settings.bucket}.${settings.region}.aliyuncs.com/${key}`;
    }

    // 腾讯云 COS 默认域名
    if (settings.type === 'cos' && settings.region && (settings.bucket || settings.bucketName)) {
      const bucket = settings.bucket || settings.bucketName;
      return `https://${bucket}.cos.${settings.region}.myqcloud.com/${key}`;
    }

    // Google Cloud 默认域名
    if (settings.type === 'gcs' && (settings.bucketName || settings.bucket)) {
      const bucket = settings.bucketName || settings.bucket;
      return `https://storage.googleapis.com/${bucket}/${key}`;
    }

    // 华为云 OBS 默认域名
    if (settings.type === 'obs' && settings.region && settings.bucket) {
      const endpoint = settings.endpoint || `obs.${settings.region}.myhuaweicloud.com`;
      return `https://${settings.bucket}.${endpoint}/${key}`;
    }

    // 对于 SM.MS、Lsky、Gitee，如果没有配置自定义域名，返回占位符
    // 这些服务的 URL 通常由服务器返回，在 file.publicUrl 中
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
      <div className="flex justify-between items-center px-1">
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
              const isLsky = settings?.type === 'lsky';
              const publicUrlInline = file.publicUrl || getPublicUrl(key);
              window.api.openPreviewWindow({
                fileName: fileName,
                filePath: currentPrefix,
                bucket: resolvedBucket,
                publicUrl: (isSmms || isLsky) ? publicUrlInline : undefined
              });
            }
          }
        };

        return (
          <Card key={key} ref={isLastElement ? lastFileElementRef : null} className={`p-4 rounded-[24px] ${selectedFiles.has(key) ? 'border-primary' : ''}`} onClick={handleCardClick} style={{ cursor: isDir ? 'pointer' : 'default' }}>
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
            {!isDir && (
              <div className="mt-4 flex items-center gap-2">
                  <Input 
                    readOnly 
                    value={publicUrl || '暂无公开链接（请配置自定义域名）'} 
                    className={`flex-1 rounded-full ${publicUrl ? 'bg-muted' : 'bg-muted text-muted-foreground italic'}`}
                  />
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <FileQrMenu publicUrl={publicUrl} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{publicUrl ? '二维码' : '无可用链接'}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="rounded-full"
                          onClick={() => handleCopyUrl(publicUrl)}
                          disabled={!publicUrl}
                        >
                          <Copy className="h-4 w-4"/>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{publicUrl ? '复制链接' : '无可用链接'}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="rounded-full" onClick={() => handleDownload(key)} disabled={downloading[key]}>
                          <Download className="h-4 w-4"/>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>下载</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" className="rounded-full" onClick={() => handleDeleteClick(key)} disabled={downloading[key]}><Trash2 className="h-4 w-4"/></Button>
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
                        <Button variant="destructive" size="icon" className="rounded-full" onClick={() => handleDeleteClick(key)}><Trash2 className="h-4 w-4"/></Button>
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
    <Card className="rounded-[24px]">
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
                                        <div onClick={(e) => e.stopPropagation()}>
                                          <FileQrMenu publicUrl={publicUrl} />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{publicUrl ? '二维码' : '无可用链接'}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="rounded-full"
                                          onClick={(e) => { e.stopPropagation(); handleCopyUrl(publicUrl); }}
                                        >
                                          <Copy className="h-4 w-4"/>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>复制链接</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleDownload(key);}} disabled={downloading[key]}><Download className="h-4 w-4"/></Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>下载</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleDeleteClick(key);}} disabled={downloading[key]}><Trash2 className="h-4 w-4" color="hsl(var(--destructive))"/></Button>
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
                                        <Button variant="ghost" size="icon" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleDeleteClick(key); }}><Trash2 className="h-4 w-4" color="hsl(var(--destructive))"/></Button>
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
            {activeProfileId && (
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
                            className={`rounded-full w-10 h-10 p-0 ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
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
                            className={`rounded-full w-10 h-10 p-0 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
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
                    <MorphingMenu
                        className="w-10 h-10 z-40"
                        triggerClassName="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground"
                        direction="top-right"
                        collapsedRadius="20px"
                        expandedRadius="24px"
                        expandedWidth={240}
                        trigger={
                            <div className="flex w-full h-full items-center justify-center">
                                <ArrowUpDown className="h-4 w-4" />
                            </div>
                        }
                    >
                        <div className="flex flex-col p-2 gap-1">
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                排序方式
                            </div>
                            <div className="h-px bg-border mx-2 my-1" />
                            {[
                                { value: 'date', label: '按日期' },
                                { value: 'size', label: '按大小' },
                                { value: 'name', label: '按名称' }
                            ].map(option => (
                                <div
                                    key={option.value}
                                    onClick={() => setSortField(option.value)}
                                    className={cn(
                                        "relative flex cursor-pointer select-none items-center rounded-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                                        sortField === option.value && "bg-accent"
                                    )}
                                >
                                    {sortField === option.value && (
                                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                        </span>
                                    )}
                                    <span className="ml-6">{option.label}</span>
                                </div>
                            ))}
                            <div className="h-px bg-border mx-2 my-1" />
                             <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                顺序
                            </div>
                            {[
                                { value: 'desc', label: '降序' },
                                { value: 'asc', label: '升序' }
                            ].map(option => (
                                <div
                                    key={option.value}
                                    onClick={() => setSortOrder(option.value)}
                                    className={cn(
                                        "relative flex cursor-pointer select-none items-center rounded-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                                        sortOrder === option.value && "bg-accent"
                                    )}
                                >
                                    {sortOrder === option.value && (
                                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                        </span>
                                    )}
                                    <span className="ml-6">{option.label}</span>
                                </div>
                            ))}
                        </div>
                    </MorphingMenu>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="rounded-full w-10 h-10" onClick={() => fetchFiles(currentPrefix, { isSearch: false })} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>刷新列表</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full w-10 h-10" onClick={() => setIsCreateFolderDialogOpen(true)}>
                  <FolderPlus className="h-4 w-4" />
                </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>创建文件夹</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full w-10 h-10" onClick={handleFileSelectAndUpload}>
                  <UploadCloud className="h-4 w-4" />
                </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>上传文件</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
              </div>
            )}
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

        {/* 没有活跃配置时显示插画 */}
        {!activeProfileId ? (
          <EmptyStateIllustration 
            hasSettings={hasAnyProfiles} 
            onGoToSettings={() => navigate('/settings')} 
          />
        ) : loading && files.length === 0 ? (
          <FilesSkeletonLoader viewMode={viewMode} />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-4 text-red-500">
            错误: {error}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1">
                {renderBreadcrumbs()}
              </div>
              <div className="flex items-center gap-2">
                {selectedFiles.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">已选择 {selectedFiles.size} 个项目</span>
                    <Button variant="outline" size="sm" onClick={handleBulkDownload} className="rounded-full">
                      <Download className="mr-2 h-4 w-4" />
                      下载所选
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="rounded-full">
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除所选
                    </Button>
                  </>
                )}
                {viewMode === 'card' && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                    <Label htmlFor="select-all-card" className="text-sm text-muted-foreground cursor-pointer">全选</Label>
                    <Checkbox
                      id="select-all-card"
                      checked={files.length > 0 && files.filter(f => !f.isFolder).length > 0 && selectedFiles.size === files.filter(f => !f.isFolder).length}
                      onCheckedChange={handleSelectAll}
                    />
                  </div>
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
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
                  <div className="w-64 h-64 mb-6">
                    <LottieAnimation 
                      src={WelcomeLottie}
                      autoplay={true}
                      loop={true}
                      speed={1}
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    当前文件夹为空
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    上传一些文件开始使用吧
                  </p>
                  <Button 
                    onClick={handleFileSelectAndUpload}
                    className="flex items-center gap-2"
                  >
                    <UploadCloud className="w-4 h-4" />
                    上传文件
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除吗?</AlertDialogTitle>
            <AlertDialogDescription>
              这个操作无法撤销。 "{fileToDelete}" 将从您的 R2 存储桶中永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDelete(null)} className="rounded-full">取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="rounded-full">确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这些项目吗?</AlertDialogTitle>
            <AlertDialogDescription>
              您即将删除 {selectedFiles.size} 个项目。此操作无法撤销，被删除的项目将无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBulkDeleteDialog(false)} className="rounded-full">取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="rounded-full">确定</AlertDialogAction>
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
      
      {/* 删除操作遮罩层 */}
      <DeleteOverlay 
        isVisible={deleteState.isDeleting}
        message={deleteState.message}
        count={deleteState.count > 1 ? deleteState.count : null}
      />
    </>
  );
} 
