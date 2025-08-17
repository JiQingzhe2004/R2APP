import { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { 
  Container, 
  Search, 
  RefreshCw, 
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from "@/components/ui/skeleton"

const BucketSelector = ({ profile, onSelect, isOpen, onClose }) => {
  const [buckets, setBuckets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBucket, setSelectedBucket] = useState(profile?.bucket || profile?.bucketName || '');
  const [manualBucket, setManualBucket] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  const fetchBuckets = async () => {
    if (!profile) return;
    
    setIsLoading(true);
    try {
      // 这里需要在后端实现获取存储桶列表的API
      const result = await window.api.listBuckets(profile);
      
      if (result.success) {
        setBuckets(result.buckets || []);
        if (result.buckets.length === 0) {
          setIsManualMode(true);
          toast.info('未找到存储桶，请手动输入存储桶名称');
        }
      } else {
        // 如果获取失败，切换到手动模式
        setIsManualMode(true);
        toast.error(result.error || '获取存储桶列表失败，请手动输入');
      }
    } catch (error) {
      console.error('Failed to fetch buckets:', error);
      setIsManualMode(true);
      toast.error('获取存储桶列表失败，请手动输入');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && profile) {
      // 如果已有存储桶配置，默认使用手动模式
      if (profile.bucket || profile.bucketName) {
        setIsManualMode(true);
        setManualBucket(profile.bucket || profile.bucketName || '');
      } else {
        fetchBuckets();
      }
    }
  }, [isOpen, profile]);

  const filteredBuckets = buckets.filter(bucket => 
    bucket.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirm = () => {
    const bucketToUse = isManualMode ? manualBucket : selectedBucket;
    
    if (!bucketToUse) {
      toast.error('请选择或输入存储桶名称');
      return;
    }

    onSelect(bucketToUse);
    onClose();
  };

  const getProviderSpecificHelp = () => {
    if (!profile) return null;
    
    switch (profile.type) {
      case 'cos':
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>腾讯云 COS 存储桶格式：name-appid</p>
            <p>例如：mybucket-1250000000</p>
          </div>
        );
      case 'oss':
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>阿里云 OSS 存储空间名称</p>
            <p>例如：my-oss-bucket</p>
          </div>
        );
      case 'r2':
        return (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Cloudflare R2 存储桶名称</p>
            <p>例如：my-r2-bucket</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Container className="h-5 w-5" />
            选择存储桶
          </DialogTitle>
          <DialogDescription>
            {isManualMode ? '手动输入存储桶名称' : '从列表中选择或手动输入存储桶'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isManualMode && (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索存储桶..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchBuckets}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : filteredBuckets.length > 0 ? (
                  <div className="p-2">
                    {filteredBuckets.map((bucket) => (
                      <button
                        key={bucket.name}
                        className={`w-full text-left p-2 rounded hover:bg-accent transition-colors flex items-center justify-between ${
                          selectedBucket === bucket.name ? 'bg-accent' : ''
                        }`}
                        onClick={() => setSelectedBucket(bucket.name)}
                      >
                        <div className="flex items-center gap-2">
                          <Container className="h-4 w-4 text-muted-foreground" />
                          <span>{bucket.name}</span>
                        </div>
                        {selectedBucket === bucket.name && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>未找到存储桶</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center">
                <Button
                  variant="link"
                  onClick={() => {
                    setIsManualMode(true);
                    setManualBucket(selectedBucket);
                  }}
                >
                  手动输入存储桶名称
                </Button>
              </div>
            </>
          )}

          {isManualMode && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manual-bucket">存储桶名称</Label>
                <Input
                  id="manual-bucket"
                  value={manualBucket}
                  onChange={(e) => setManualBucket(e.target.value)}
                  placeholder="输入存储桶名称"
                />
                {getProviderSpecificHelp()}
              </div>

              {buckets.length > 0 && (
                <div className="flex items-center justify-center">
                  <Button
                    variant="link"
                    onClick={() => {
                      setIsManualMode(false);
                      setSelectedBucket(manualBucket);
                    }}
                  >
                    从列表选择
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BucketSelector;
