import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Card } from '@/components/ui/Card';
import { Download, CheckCircle, AlertTriangle, X, Trash2, FolderOpen, Cloud, Settings, Plus, Zap, Clock, HardDrive } from 'lucide-react';
import { getFileIcon, formatBytes } from '@/lib/file-utils.jsx';
import { useNotifications } from '@/contexts/NotificationContext';
import { useOutletContext } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { DeleteOverlay, useDeleteState } from '@/components/ui/delete-overlay';

// 下载页面空状态插画组件
function DownloadsEmptyStateIllustration({ hasSettings, onGoToSettings }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] p-8 text-center">
      <div className="relative mb-8">
        {/* 主插画 */}
        <div className="w-40 h-40 bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-950 dark:to-blue-900 rounded-full flex items-center justify-center mb-6">
          <div className="relative">
            <Download className="w-20 h-20 text-sky-500 dark:text-sky-400" />
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900 dark:to-emerald-800 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        
        {/* 装饰性元素 */}
        <div className="absolute -top-4 -left-4 w-6 h-6 bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900 dark:to-indigo-800 rounded-full flex items-center justify-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        </div>
        <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-gradient-to-br from-cyan-100 to-sky-200 dark:from-cyan-900 dark:to-sky-800 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 bg-cyan-500 rounded-full"></div>
        </div>
      </div>
      
      <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {hasSettings ? '选择存储配置' : '配置存储服务'}
      </h3>
      
      <p className="text-gray-600 dark:text-gray-400 max-w-lg mb-8 leading-relaxed text-lg">
        {hasSettings 
          ? '您还没有选择活跃的存储配置。请选择一个配置来开始下载文件。'
          : '您还没有配置任何存储服务。请先添加一个存储配置来开始下载文件。'
        }
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-12">
        <Button 
          onClick={onGoToSettings} 
          className="flex items-center gap-2 px-8 py-4 text-lg rounded-full"
          size="lg"
        >
          <Settings className="w-6 h-6" />
          {hasSettings ? '选择配置' : '添加配置'}
        </Button>
        
        {!hasSettings && (
          <Button 
            variant="outline" 
            onClick={onGoToSettings}
            className="flex items-center gap-2 px-8 py-4 text-lg rounded-full"
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
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-lg">快速下载</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">支持多线程下载，提升传输速度</p>
        </div>
        
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-lg">任务管理</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">智能任务调度，支持暂停和恢复</p>
        </div>
        
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <HardDrive className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-lg">本地管理</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">自动组织下载文件，便于查找</p>
        </div>
      </div>
    </div>
  );
}

export default function DownloadsPage() {
    const [tasks, setTasks] = useState({});
    const [hasAnyProfiles, setHasAnyProfiles] = useState(false); // 新增：检查是否有任何配置
    const { activeProfileId } = useOutletContext(); // 获取活跃配置ID
    const { addNotification } = useNotifications();
    const { deleteState, startDelete, endDelete } = useDeleteState();
    const navigate = useNavigate();
    const tasksRef = useRef(tasks);
    tasksRef.current = tasks;

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

    useEffect(() => {
        window.api.getAllDownloads().then(initialTasks => {
            setTasks(initialTasks || {});
        });

        const removeProgressListener = window.api.onDownloadUpdate(({ type, task, data }) => {
            if (type === 'start') {
                setTasks(prev => ({ ...prev, [task.id]: { ...task, speed: 0 } }));
            } else if (type === 'progress') {
                const existingTask = tasksRef.current[data.id];
                if (existingTask) {
                    if (data.status === 'completed' && existingTask.status !== 'completed') {
                        addNotification({ message: `文件 "${existingTask.key}" 下载完成`, type: 'success' });
                    } else if (data.status === 'error' && existingTask.status !== 'error') {
                        addNotification({ message: `文件 "${existingTask.key}" 下载失败: ${data.error}`, type: 'error' });
                    }
                }
                
                setTasks(prev => {
                    const currentTask = prev[data.id];
                    if (!currentTask) return prev;
                    return {
                        ...prev,
                        [data.id]: {
                            ...currentTask,
                            progress: data.progress,
                            status: data.status || currentTask.status,
                            speed: data.speed || currentTask.speed,
                            error: data.error
                        }
                    };
                });
            }
        });

        const removeClearedListener = window.api.onDownloadsCleared((newTasks) => {
            setTasks(newTasks);
        });

        return () => {
            removeProgressListener();
            removeClearedListener();
        };
    }, [addNotification]);
    
    const taskValues = Object.values(tasks).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const activeTasks = taskValues.filter(t => t.status !== 'completed' && t.status !== 'error');
    
    // 处理清除已完成下载
    const handleClearCompleted = async () => {
        const completedTasks = taskValues.filter(t => t.status === 'completed');
        if (completedTasks.length === 0) return;
        
        startDelete(completedTasks.length, '正在清除已完成的下载...');
        
        try {
            await window.api.clearCompletedDownloads();
            // 成功后会通过事件监听器自动更新状态
        } catch (error) {
            console.error('清除下载失败:', error);
            addNotification({ message: '清除下载失败', type: 'error' });
        } finally {
            endDelete();
        }
    };
    
    // 处理删除单个下载任务
    const handleDeleteTask = async (taskId) => {
        startDelete(1, '正在删除下载任务...');
        
        try {
            await window.api.deleteDownloadTask(taskId);
            // 成功后会通过事件监听器自动更新状态
        } catch (error) {
            console.error('删除下载任务失败:', error);
            addNotification({ message: '删除下载任务失败', type: 'error' });
        } finally {
            endDelete();
        }
    };
    
    const renderTaskStatus = (task) => {
        switch (task.status) {
            case 'downloading':
                const speed = task.speed ? `${formatBytes(task.speed)}/s` : '...';
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">{speed}</span>
                        <Progress value={task.progress} className="w-full h-2" />
                        <span className="text-sm font-medium w-12 text-right">{task.progress}%</span>
                    </div>
                );
            case 'completed':
                return <p className="text-sm text-green-500">下载完成</p>;
            case 'error':
                 return <p className="text-sm text-red-500">下载失败: {task.error}</p>;
            default:
                return <p className="text-sm text-muted-foreground">正在准备下载...</p>;
        }
    }

  // 没有活跃配置时显示插画
  if (!activeProfileId) {
    return <DownloadsEmptyStateIllustration hasSettings={hasAnyProfiles} onGoToSettings={() => navigate('/settings')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold">下载管理 ({activeTasks.length})</h1>
            <p className="text-muted-foreground">管理您的文件下载</p>
        </div>
        <Button variant="outline" onClick={handleClearCompleted} disabled={taskValues.every(t => t.status !== 'completed')} className="rounded-full">
            <Trash2 className="mr-2 h-4 w-4" />
            清除已完成
        </Button>
      </div>

      {taskValues.length === 0 ? (
         <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-[24px]">
            <Download className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">暂无下载任务</h3>
            <p className="mt-1 text-sm text-muted-foreground">从文件管理页面开始下载后，会在这里显示。</p>
        </div>
      ) : (
        <div className="space-y-4">
            {taskValues.map(task => (
                <Card key={task.id} className="p-4 rounded-[24px]">
                   <div className="flex items-center gap-4">
                       {getFileIcon(task.key)}
                       <div className="flex-1 min-w-0">
                           <p className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis" title={task.key}>
                               {task.key}
                           </p>
                           {renderTaskStatus(task)}
                       </div>
                       <div className="flex items-center gap-2">
                           {task.status === 'completed' && (
                                <Button variant="ghost" size="icon" onClick={() => window.api.showItemInFolder(task.filePath)} className="rounded-full">
                                   <FolderOpen className="h-4 w-4" />
                                </Button>
                           )}
                           {task.status === 'completed' && <CheckCircle className="h-6 w-6 text-green-500" />}
                           {task.status === 'error' && <AlertTriangle className="h-6 w-6 text-red-500" />}
                           <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="rounded-full">
                               <X className="h-4 w-4" />
                           </Button>
                       </div>
                   </div>
                </Card>
            ))}
        </div>
      )}
      
      {/* 删除操作遮罩层 */}
      <DeleteOverlay 
        isVisible={deleteState.isDeleting}
        message={deleteState.message}
        count={deleteState.count > 1 ? deleteState.count : null}
      />
    </div>
  );
} 