import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Bell
} from 'lucide-react';
import { getApiUrl } from '../config/api';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'normal' | 'high';
  link?: string;
  showDate: boolean;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface AnnouncementForm {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'normal' | 'high';
  link: string;
  showDate: boolean;
  startDate: string;
  endDate: string;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>({
    title: '',
    content: '',
    type: 'info',
    priority: 'normal',
    link: '',
    showDate: true,
    startDate: new Date().toISOString().slice(0, 16),
    endDate: ''
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const getToken = () => {
    return localStorage.getItem('token');
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl('/announcements')}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.data || []);
      } else {
        setError('获取公告列表失败');
      }
    } catch (error) {
      console.error('获取公告失败:', error);
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title || !form.content) {
      setError('请填写标题和内容');
      return;
    }

    try {
      const url = editingId 
        ? `${getApiUrl('/announcements')}/${editingId}`
        : `${getApiUrl('/announcements')}`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          type: form.type,
          priority: form.priority,
          link: form.link || undefined,
          showDate: form.showDate,
          startDate: form.startDate,
          endDate: form.endDate || undefined
        }),
      });

      if (response.ok) {
        setShowForm(false);
        setEditingId(null);
        resetForm();
        fetchAnnouncements();
      } else {
        const data = await response.json();
        setError(data.error || '操作失败');
      }
    } catch (error) {
      console.error('保存公告失败:', error);
      setError('网络错误');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这个公告吗？')) {
      return;
    }

    try {
      const response = await fetch(`${getApiUrl('/announcements')}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        fetchAnnouncements();
      } else {
        setError('删除失败');
      }
    } catch (error) {
      console.error('删除公告失败:', error);
      setError('网络错误');
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setForm({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      link: announcement.link || '',
      showDate: announcement.showDate,
      startDate: announcement.startDate.slice(0, 16),
      endDate: announcement.endDate ? announcement.endDate.slice(0, 16) : ''
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      title: '',
      content: '',
      type: 'info',
      priority: 'normal',
      link: '',
      showDate: true,
      startDate: new Date().toISOString().slice(0, 16),
      endDate: ''
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="h-4 w-4" />;
      case 'warning': return <AlertCircle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      case 'success': return <CheckCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">公告管理</h1>
          <p className="text-muted-foreground">管理和发布应用公告</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          发布公告
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-50 dark:text-red-200 dark:bg-red-900/50 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? '编辑公告' : '发布新公告'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">标题 *</Label>
                  <Input
                    id="title"
                    value={form.title}
                                         onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="公告标题"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">类型</Label>
                  <select
                    id="type"
                    value={form.type}
                                         onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="info">信息</option>
                    <option value="warning">警告</option>
                    <option value="error">错误</option>
                    <option value="success">成功</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">优先级</Label>
                  <select
                    id="priority"
                    value={form.priority}
                                         onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="low">低</option>
                    <option value="normal">普通</option>
                    <option value="high">高</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link">链接（可选）</Label>
                  <Input
                    id="link"
                    value={form.link}
                                         onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, link: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">开始时间</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={form.startDate}
                                         onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">结束时间（可选）</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={form.endDate}
                                         onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">内容 *</Label>
                <Textarea
                  id="content"
                  value={form.content}
                  onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="公告内容"
                  required
                  rows={6}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="showDate"
                  type="checkbox"
                  checked={form.showDate}
                  onChange={(e) => setForm(prev => ({ ...prev, showDate: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="showDate">显示发布时间</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingId ? '更新' : '发布'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  暂无公告
                </h3>
                <p className="text-sm text-muted-foreground">
                  点击"发布公告"按钮创建第一个公告
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{announcement.title}</CardTitle>
                      <Badge className={getTypeColor(announcement.type)}>
                        {getTypeIcon(announcement.type)}
                        <span className="ml-1">{announcement.type}</span>
                      </Badge>
                      {announcement.priority === 'high' && (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          重要
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(announcement)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(announcement.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed mb-4">
                  {announcement.content}
                </p>
                {announcement.link && (
                  <a
                    href={announcement.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-500 text-sm inline-flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    查看链接
                  </a>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
