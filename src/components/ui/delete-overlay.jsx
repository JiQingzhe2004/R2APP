import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 删除操作遮罩层组件
 * 在删除操作进行时显示，防止用户重复操作
 */
export function DeleteOverlay({ 
  isVisible, 
  message = "正在删除中...", 
  count = null,
  className = "" 
}) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center",
      className
    )}>
      <div className="bg-background rounded-lg border shadow-lg p-6 max-w-sm mx-4">
        <div className="flex flex-col items-center gap-4">
          {/* 删除图标和加载动画 */}
          <div className="relative">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-destructive" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-20 h-20 animate-spin text-destructive/30" />
            </div>
          </div>
          
          {/* 删除状态文本 */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              删除中
            </h3>
            <p className="text-sm text-muted-foreground">
              {count ? `正在删除 ${count} 个项目...` : message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              请稍候，请勿关闭窗口
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 删除状态 Hook
 * 用于管理删除操作的加载状态
 */
export function useDeleteState() {
  const [deleteState, setDeleteState] = React.useState({
    isDeleting: false,
    count: 0,
    message: "正在删除中..."
  });

  const startDelete = (count = 1, message = "正在删除中...") => {
    setDeleteState({
      isDeleting: true,
      count,
      message
    });
  };

  const endDelete = () => {
    setDeleteState({
      isDeleting: false,
      count: 0,
      message: "正在删除中..."
    });
  };

  return {
    deleteState,
    startDelete,
    endDelete
  };
}
