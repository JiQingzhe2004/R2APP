import React, { useState, useEffect, useRef, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/Progress"
import { Button } from '@/components/ui/Button'
import { FileText, HardDrive, ChartColumnBig, Activity, Server, RefreshCw, Upload, Download, Trash2, CheckCircle, XCircle, AlertCircle, PackageSearch, Cloud, Settings, Plus, BarChart3, TrendingUp, Database } from 'lucide-react'
import { formatBytes } from '@/lib/file-utils.jsx'
import { useNotifications } from '@/contexts/NotificationContext'
import { Separator } from "@/components/ui/separator"
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

// 仪表盘空状态插画组件
function DashboardEmptyStateIllustration({ hasSettings, onGoToSettings }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] p-8 text-center">
      <div className="relative mb-8">
        {/* 主插画 */}
        <div className="w-40 h-40 bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-indigo-950 dark:to-purple-900 rounded-full flex items-center justify-center mb-6">
          <div className="relative">
            <BarChart3 className="w-20 h-20 text-indigo-500 dark:text-indigo-400" />
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900 dark:to-emerald-800 rounded-full flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        
        {/* 装饰性元素 */}
        <div className="absolute -top-4 -left-4 w-6 h-6 bg-gradient-to-br from-blue-100 to-cyan-200 dark:from-blue-900 dark:to-cyan-800 rounded-full flex items-center justify-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        </div>
        <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-gradient-to-br from-purple-100 to-pink-200 dark:from-purple-900 dark:to-pink-800 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
        </div>
      </div>
      
      <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {hasSettings ? '选择存储配置' : '配置存储服务'}
      </h3>
      
      <p className="text-gray-600 dark:text-gray-400 max-w-lg mb-8 leading-relaxed text-lg">
        {hasSettings 
          ? '您还没有选择活跃的存储配置。请选择一个配置来查看详细的存储统计和活动记录。'
          : '您还没有配置任何存储服务。请先添加一个存储配置来开始使用仪表盘功能。'
        }
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-12">
        <Button 
          onClick={onGoToSettings} 
          className="flex items-center gap-2 px-8 py-4 text-lg"
          size="lg"
        >
          <Settings className="w-6 h-6" />
          {hasSettings ? '选择配置' : '添加配置'}
        </Button>
        
        {!hasSettings && (
          <Button 
            variant="outline" 
            onClick={onGoToSettings}
            className="flex items-center gap-2 px-8 py-4 text-lg"
            size="lg"
          >
            <Plus className="w-6 h-6" />
            了解存储服务
          </Button>
        )}
      </div>
      
      {/* 功能提示 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-lg">存储统计</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">实时查看文件数量、存储使用情况和空间利用率</p>
        </div>
        
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-lg">活动监控</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">跟踪文件上传、下载、删除等操作记录</p>
        </div>
        
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-lg">状态监控</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">监控存储服务连接状态和健康度</p>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " 年前";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " 月前";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " 天前";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " 小时前";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " 分钟前";
  return Math.floor(seconds) + " 秒前";
}

function DashboardSkeleton() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-8" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Fragment key={i}>
                <div className="flex items-center">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="ml-4 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
                {i < 2 && <Separator />}
              </Fragment>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const { activeProfileId } = useOutletContext();
  const [stats, setStats] = useState({ totalCount: 0, totalSize: 0, bucketName: '', storageQuotaGB: 0, storageQuotaUnit: 'GB' })
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [r2Status, setR2Status] = useState({ loading: true, success: false, message: '正在检查连接...' })
  const [error, setError] = useState(null)
  const [visibleActivityCount, setVisibleActivityCount] = useState(5)
  const [hasAnyProfiles, setHasAnyProfiles] = useState(false) // 新增：检查是否有任何配置
  const { addNotification } = useNotifications()
  const loadMoreButtonRef = useRef(null);
  const navigate = useNavigate();

  // 检查是否有任何配置
  useEffect(() => {
    const checkProfiles = async () => {
      try {
        const settings = await window.api.getSettings();
        setHasAnyProfiles(settings?.profiles?.length > 0);
      } catch (error) {
        console.error('检查配置失败:', error);
        setHasAnyProfiles(false);
      }
    };
    checkProfiles();
  }, []);

  const fetchData = async (keepLoading = false) => {
    if (!keepLoading) {
      setLoading(true)
    }
    setError(null)
    setVisibleActivityCount(5)

    const statusResult = await window.api.checkStatus()
    setR2Status({ 
      loading: false, 
      success: statusResult.success, 
      message: statusResult.success ? '连接正常' : statusResult.error 
    })

    if(statusResult.success) {
      const statsResult = await window.api.getBucketStats()
      if (statsResult.success) {
        setStats(statsResult.data)
      } else {
        setError(statsResult.error)
        addNotification({ message: `获取统计信息失败: ${statsResult.error}`, type: 'error' })
      }
    } else {
      setStats({ totalCount: 0, totalSize: 0, bucketName: 'N/A', storageQuotaGB: 0, storageQuotaUnit: 'GB' })
    }

    const activitiesResult = await window.api.getRecentActivities()
    if (activitiesResult.success) {
      setActivities(activitiesResult.data)
    } else {
      addNotification({ message: `获取最近活动失败: ${activitiesResult.error}`, type: 'error' })
    }

    if (!keepLoading) {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!activeProfileId) {
      setLoading(false);
      return;
    }
    fetchData()
    
    const removeListener = window.api.onActivityUpdated(() => {
        fetchData(true);
    });

    return () => removeListener();

  }, [activeProfileId])

  // 存储桶切换时进行无感刷新（保留页面，不闪烁）
  useEffect(() => {
    if (!activeProfileId) return;
    fetchData(true);
  }, [activeProfileId])

  useEffect(() => {
    if (loadMoreButtonRef.current) {
      loadMoreButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [visibleActivityCount]);

  const handleDeleteActivity = async (activityId) => {
    const result = await window.api.deleteRecentActivity(activityId);
    if (result.success) {
      setActivities(prev => prev.filter(a => a.id !== activityId));
      addNotification({ message: '活动记录已删除', type: 'success' });
    } else {
      addNotification({ message: `删除失败: ${result.error}`, type: 'error' });
    }
  };

  const handleClearActivities = async () => {
    const result = await window.api.clearRecentActivities();
    if (result.success) {
      setActivities([]);
      setVisibleActivityCount(5);
      addNotification({ message: '最近活动已清除', type: 'success' });
    } else {
      addNotification({ message: `清除失败: ${result.error}`, type: 'error' });
    }
  };

  // 将存储配额转换为字节
  const convertQuotaToBytes = (quota, unit) => {
    const value = quota || 0;
    switch (unit?.toUpperCase()) {
      case 'MB':
        return value * 1024 * 1024;
      case 'GB':
        return value * 1024 * 1024 * 1024;
      case 'TB':
        return value * 1024 * 1024 * 1024 * 1024;
      default:
        return value * 1024 * 1024 * 1024; // 默认GB
    }
  };

  const totalQuotaBytes = convertQuotaToBytes(stats.storageQuotaGB, stats.storageQuotaUnit);
  const storageUsagePercent = totalQuotaBytes > 0 ? (stats.totalSize / totalQuotaBytes) * 100 : 0;

  const getStatusIcon = () => {
    if (r2Status.loading) return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (r2Status.success) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };
  
  const ActivityIcon = ({ type }) => {
    if (type.startsWith('upload')) return <Upload className="h-5 w-5 text-blue-500" />;
    if (type.startsWith('download')) return <Download className="h-5 w-5 text-green-500" />;
    if (type.startsWith('delete')) return <Trash2 className="h-5 w-5 text-red-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  // 没有活跃配置时显示插画
  if (!activeProfileId) {
    return <DashboardEmptyStateIllustration hasSettings={hasAnyProfiles} onGoToSettings={() => navigate('/settings')} />;
  }

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">仪表盘</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>
      </div>
      
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-semibold">数据加载出错</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">文件总数</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
              <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCount}</div>
            <p className="text-xs text-muted-foreground">当前存储桶中的对象总数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已用存储</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50">
              <HardDrive className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
            <p className="text-xs text-muted-foreground">当前存储桶的总大小</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">使用率</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/50">
              <ChartColumnBig className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storageUsagePercent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">存储空间使用百分比</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">存储桶</CardTitle>
             <div className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-full",
                {
                  "bg-gray-100 dark:bg-gray-700": r2Status.loading,
                  "bg-green-100 dark:bg-green-900/50": r2Status.success,
                  "bg-red-100 dark:bg-red-900/50": !r2Status.loading && !r2Status.success
                }
              )}>
              {r2Status.success && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              )}
              <Server className={cn("relative h-4 w-4", {
                "text-gray-500 dark:text-gray-400": r2Status.loading,
                "text-green-500 dark:text-green-400": r2Status.success,
                "text-red-500 dark:text-red-400": !r2Status.loading && !r2Status.success
              })} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate" title={stats.bucketName}>
              {stats.bucketName || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {getStatusIcon()} 
              <span>{r2Status.message}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
       <Card>
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>存储使用情况</span>
              <PackageSearch className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
         </CardHeader>
         <CardContent>
             <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>已用空间</span>
                    <span>{`${formatBytes(stats.totalSize)} / ${stats.storageQuotaGB ? stats.storageQuotaGB + ' ' + stats.storageQuotaUnit : '未设置'}`}</span>
                </div>
                <div className="relative">
                  <Progress value={storageUsagePercent} />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold">
                    {storageUsagePercent.toFixed(1)}%
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <span>最近活动</span>
                <Activity className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
              <Button variant="destructive" size="sm" onClick={handleClearActivities} disabled={activities.length === 0}>
                <Trash2 className="h-4 w-4 mr-1" />
                清除记录
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <>
                <div className="space-y-4">
                  {activities.slice(0, visibleActivityCount).map((activity, index) => (
                    <Fragment key={activity.id}>
                      <div className="flex items-center">
                        <ActivityIcon type={activity.type} />
                        <div className="ml-4 flex-1 min-w-0">
                          <p className="text-sm font-medium leading-none truncate" title={activity.message}>{activity.message}</p>
                          <p className="text-sm text-muted-foreground">{timeAgo(activity.timestamp)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={() => handleDeleteActivity(activity.id)}>
                          <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                      {index < activities.slice(0, visibleActivityCount).length - 1 && <Separator />}
                    </Fragment>
                  ))}
                </div>
                {visibleActivityCount < activities.length && (
                  <div className="flex justify-center mt-4" ref={loadMoreButtonRef}>
                    <Button variant="outline" onClick={() => setVisibleActivityCount(prev => prev + 5)}>
                      加载更多
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-muted-foreground py-4">暂无最近活动</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 