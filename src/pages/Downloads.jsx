import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Card } from '@/components/ui/Card';
import { Download, CheckCircle, AlertTriangle, X, Trash2, FolderOpen } from 'lucide-react';
import { getFileIcon, formatBytes } from '@/lib/file-utils.jsx';
import { useNotifications } from '@/contexts/NotificationContext';

export default function DownloadsPage() {
    const [tasks, setTasks] = useState({});
    const { addNotification } = useNotifications();
    const tasksRef = useRef(tasks);
    tasksRef.current = tasks;

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold">下载管理 ({activeTasks.length})</h1>
            <p className="text-muted-foreground">管理您的文件下载</p>
        </div>
        <Button variant="outline" onClick={() => window.api.clearCompletedDownloads()} disabled={taskValues.every(t => t.status !== 'completed')}>
            <Trash2 className="mr-2 h-4 w-4" />
            清除已完成
        </Button>
      </div>

      {taskValues.length === 0 ? (
         <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
            <Download className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">暂无下载任务</h3>
            <p className="mt-1 text-sm text-muted-foreground">从文件管理页面开始下载后，会在这里显示。</p>
        </div>
      ) : (
        <div className="space-y-4">
            {taskValues.map(task => (
                <Card key={task.id} className="p-4">
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
                                <Button variant="ghost" size="icon" onClick={() => window.api.showItemInFolder(task.filePath)}>
                                   <FolderOpen className="h-4 w-4" />
                                </Button>
                           )}
                           {task.status === 'completed' && <CheckCircle className="h-6 w-6 text-green-500" />}
                           {task.status === 'error' && <AlertTriangle className="h-6 w-6 text-red-500" />}
                           <Button variant="ghost" size="icon" onClick={() => window.api.deleteDownloadTask(task.id)}>
                               <X className="h-4 w-4" />
                           </Button>
                       </div>
                   </div>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
} 