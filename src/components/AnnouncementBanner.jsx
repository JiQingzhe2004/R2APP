import React, { useState, useEffect } from 'react';
import { AlertCircle, X, ExternalLink, Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState(
    JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]')
  );

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const result = await window.api.getAnnouncements();
      
      if (result.success && result.data) {
        // 过滤出未关闭且有效的公告
        const validAnnouncements = result.data.filter(announcement => {
          const now = new Date();
          const startDate = new Date(announcement.startDate);
          const endDate = announcement.endDate ? new Date(announcement.endDate) : null;
          
          // 检查是否在有效期内
          const isActive = now >= startDate && (!endDate || now <= endDate);
          
          // 检查是否已被用户关闭
          const isDismissed = dismissedAnnouncements.includes(announcement.id);
          
          return isActive && !isDismissed;
        });
        
        setAnnouncements(validAnnouncements);
      } else {
        setError(result.error || '获取公告失败');
      }
    } catch (error) {
      console.error('获取公告失败:', error);
      setError('获取公告失败');
    } finally {
      setLoading(false);
    }
  };

  const dismissAnnouncement = (announcementId) => {
    const newDismissed = [...dismissedAnnouncements, announcementId];
    setDismissedAnnouncements(newDismissed);
    localStorage.setItem('dismissedAnnouncements', JSON.stringify(newDismissed));
    
    // 从当前显示列表中移除
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
  };

  const getAnnouncementTypeStyles = (type) => {
    switch (type) {
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/50',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-200',
          icon: 'text-blue-500'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-950/50',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: 'text-yellow-500'
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-950/50',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200',
          icon: 'text-red-500'
        };
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-950/50',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-800 dark:text-green-200',
          icon: 'text-green-500'
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-950/50',
          border: 'border-gray-200 dark:border-gray-800',
          text: 'text-gray-800 dark:text-gray-200',
          icon: 'text-gray-500'
        };
    }
  };

  if (loading) {
    return null; // 加载时不显示任何内容
  }

  if (error || announcements.length === 0) {
    return null; // 没有公告或出错时不显示
  }

  return (
    <div className="space-y-2">
      {announcements.map((announcement) => {
        const styles = getAnnouncementTypeStyles(announcement.type);
        
        return (
          <div
            key={announcement.id}
            className={cn(
              'relative p-4 border rounded-lg shadow-sm',
              styles.bg,
              styles.border
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('flex-shrink-0 mt-0.5', styles.icon)}>
                <Bell className="h-5 w-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn('text-sm font-semibold', styles.text)}>
                    {announcement.title}
                  </h3>
                  {announcement.priority === 'high' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                      重要
                    </span>
                  )}
                </div>
                
                <p className={cn('text-sm leading-relaxed', styles.text)}>
                  {announcement.content}
                </p>
                
                {announcement.link && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('h-7 px-3 text-xs', styles.border, styles.text)}
                      onClick={() => window.open(announcement.link, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      查看详情
                    </Button>
                  </div>
                )}
                
                {announcement.showDate && (
                  <p className={cn('text-xs mt-2 opacity-75', styles.text)}>
                    发布时间: {new Date(announcement.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-6 w-6 p-0 flex-shrink-0', styles.text)}
                onClick={() => dismissAnnouncement(announcement.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
