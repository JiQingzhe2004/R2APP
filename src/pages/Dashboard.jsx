import { useState, useEffect, useRef, Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Progress } from "@/components/ui/Progress"
import { Button } from '@/components/ui/Button'
import { FileText, HardDrive, ChartColumnBig, Activity, Server, RefreshCw, Upload, Download, Trash2, CheckCircle, XCircle, AlertCircle, PackageSearch, ChevronDown, ChevronUp } from 'lucide-react'
import { formatBytes } from '@/lib/file-utils.jsx'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { Separator } from "@/components/ui/separator"
import React from 'react'

function timeAgo(dateString) {
  const date = new Date(dateString)
  const seconds = Math.floor((new Date() - date) / 1000)
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + " 年前"
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + " 个月前"
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + " 天前"
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + " 小时前"
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + " 分钟前"
  return "刚刚"
}

const ActivityIcon = ({ type }) => {
  switch (type) {
    case 'upload':
      return <Upload className="h-4 w-4 text-green-500" />
    case 'download':
      return <Download className="h-4 w-4 text-blue-500" />
    case 'delete':
      return <Trash2 className="h-4 w-4 text-red-500" />
    default:
      return <FileText className="h-4 w-4 text-gray-500" />
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalCount: 0, totalSize: 0, bucketName: '' })
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [r2Status, setR2Status] = useState({ loading: true, success: false, message: '正在检查连接...' })
  const [error, setError] = useState(null)
  const [visibleActivityCount, setVisibleActivityCount] = useState(5)
  const { addNotification } = useNotifications()
  const loadMoreButtonRef = useRef(null);

  const fetchData = async (keepLoading = false) => {
    if (!keepLoading) {
      setLoading(true)
    }
    setError(null)
    setVisibleActivityCount(5) // Reset on refresh

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
      setStats({ totalCount: 0, totalSize: 0, bucketName: 'N/A' })
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
    fetchData()
    
    const removeListener = window.api.onActivityUpdated(() => {
        fetchData(true);
    });

    return () => removeListener();

  }, [])

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
      setVisibleActivityCount(5); // Reset on clear
      addNotification({ message: '最近活动已清除', type: 'success' });
    } else {
      addNotification({ message: `清除失败: ${result.error}`, type: 'error' });
    }
  };

  const totalQuotaBytes = (stats.storageQuotaGB || 0) * 1024 * 1024 * 1024;
  const storageUsagePercent = totalQuotaBytes > 0 ? (stats.totalSize / totalQuotaBytes) * 100 : 0;

  const getStatusIcon = () => {
    if (r2Status.loading) return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (r2Status.success) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

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
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalCount}</div>
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
            <div className="text-2xl font-bold">{loading ? '...' : formatBytes(stats.totalSize)}</div>
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
              {loading ? '...' : stats.bucketName || 'N/A'}
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
                    <span>{`${formatBytes(stats.totalSize)} / ${stats.storageQuotaGB ? stats.storageQuotaGB + ' GB' : '未设置'}`}</span>
                </div>
                <Progress value={storageUsagePercent} />
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>0%</span>
                    <span>{storageUsagePercent.toFixed(1)}% 已使用</span>
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
            {loading ? (
              <div className="text-center text-muted-foreground">正在加载活动...</div>
            ) : activities.length > 0 ? (
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