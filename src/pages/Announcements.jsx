import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bell, 
  RefreshCw, 
  ExternalLink, 
  Calendar, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  XCircle,
  Filter,
  Search,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationContext';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, active, archived
  const [searchTerm, setSearchTerm] = useState('');
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const result = await window.api.getAnnouncements();
      
      if (result.success && result.data) {
        setAnnouncements(result.data);
      } else {
        setError(result.error || '获取公告失败');
        addNotification({ message: '获取公告失败', type: 'error' });
      }
    } catch (error) {
      console.error('获取公告失败:', error);
      setError('获取公告失败');
      addNotification({ message: '获取公告失败', type: 'error' });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      await window.api.clearAnnouncementCache();
      addNotification({ message: '公告缓存已清除', type: 'success' });
      fetchAnnouncements(false);
    } catch (error) {
      console.error('清除缓存失败:', error);
      addNotification({ message: '清除缓存失败', type: 'error' });
    }
  };

  const getAnnouncementTypeIcon = (type) => {
    switch (type) {
      case 'info':
        return <Info className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getAnnouncementTypeStyles = (type) => {
    switch (type) {
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/50',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-200',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-950/50',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-800 dark:text-yellow-200',
          badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-950/50',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200',
          badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        };
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-950/50',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-800 dark:text-green-200',
          badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-950/50',
          border: 'border-gray-200 dark:border-gray-800',
          text: 'text-gray-800 dark:text-gray-200',
          badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        };
    }
  };

  const isAnnouncementActive = (announcement) => {
    const now = new Date();
    const startDate = new Date(announcement.startDate);
    const endDate = announcement.endDate ? new Date(announcement.endDate) : null;
    
    return now >= startDate && (!endDate || now <= endDate);
  };

  const filteredAnnouncements = announcements
    .filter(announcement => {
      // 过滤条件
      if (filter === 'active' && !isAnnouncementActive(announcement)) return false;
      if (filter === 'archived' && isAnnouncementActive(announcement)) return false;
      
      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          announcement.title.toLowerCase().includes(searchLower) ||
          announcement.content.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="rounded-3xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">公告中心</h1>
          <p className="text-muted-foreground">查看最新的应用公告和重要信息</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={clearCache} className="rounded-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            清除缓存
          </Button>
          <Button onClick={() => fetchAnnouncements()} className="rounded-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 过滤和搜索 */}
      <Card className="rounded-3xl">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
            {/* 筛选器 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">状态筛选:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className="h-8 px-3 rounded-full"
                >
                  全部
                </Button>
                <Button
                  variant={filter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('active')}
                  className="h-8 px-3 rounded-full"
                >
                  活跃
                </Button>
                <Button
                  variant={filter === 'archived' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('archived')}
                  className="h-8 px-3 rounded-full"
                >
                  已归档
                </Button>
              </div>
            </div>
            
            {/* 搜索框 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="搜索公告标题或内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-full text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* 统计信息 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>共 {announcements.length} 条公告</span>
                {(searchTerm || filter !== 'all') && (
                  <span>，筛选出 {filteredAnnouncements.length} 条</span>
                )}
              </div>
              {(searchTerm || filter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setFilter('all');
                  }}
                  className="h-6 px-2 text-xs rounded-full"
                >
                  清除筛选
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="rounded-3xl border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              <span>获取公告失败: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAnnouncements.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              {searchTerm ? (
                <>
                  <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-muted-foreground mb-2">
                    没有找到匹配的公告
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    搜索 "{searchTerm}" 没有返回任何结果
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchTerm('')}
                      className="rounded-full"
                    >
                      清除搜索
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilter('all')}
                      className="rounded-full"
                    >
                      显示全部
                    </Button>
                  </div>
                </>
              ) : filter !== 'all' ? (
                <>
                  <Filter className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-muted-foreground mb-2">
                    没有{filter === 'active' ? '活跃' : '已归档'}的公告
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    当前筛选条件下没有可显示的公告
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilter('all')}
                    className="rounded-full"
                  >
                    查看全部公告
                  </Button>
                </>
              ) : (
                <>
                  <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-muted-foreground mb-2">
                    暂无公告
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    当前没有可显示的公告，请稍后再来查看
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchAnnouncements()}
                    className="rounded-full"
                  >
                    刷新公告
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAnnouncements.map((announcement) => {
            const styles = getAnnouncementTypeStyles(announcement.type);
            const isActive = isAnnouncementActive(announcement);
            
            return (
              <Card
                key={announcement.id}
                className={cn(
                  'rounded-3xl transition-all duration-200 hover:shadow-md',
                  !isActive && 'opacity-75'
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', styles.bg)}>
                        {getAnnouncementTypeIcon(announcement.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">{announcement.title}</CardTitle>
                          <Badge className={cn('text-xs', styles.badge)}>
                            {announcement.type}
                          </Badge>
                          {announcement.priority === 'high' && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
                              重要
                            </Badge>
                          )}
                          {!isActive && (
                            <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 text-xs">
                              已归档
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>发布时间: {formatDate(announcement.createdAt)}</span>
                          </div>
                          {announcement.endDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>结束时间: {formatDate(announcement.endDate)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-sm leading-relaxed mb-4">
                    {announcement.content}
                  </p>
                  
                  {announcement.link && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(announcement.link, '_blank')}
                      className="rounded-full"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      查看详情
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
