import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster, toast } from 'sonner';
import { Layout, LayoutBody } from '@/components/ui/layout'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { UpdateProvider, useUpdate } from './contexts/UpdateContext';
import { UploadsProvider } from './contexts/UploadsContext';
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
import DashboardPage from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import FilesPage from './pages/Files';
import UploadsPage from './pages/Uploads';
import DownloadsPage from './pages/Downloads';
import AboutPage from './pages/About';
import ReleaseNotesPage from './pages/ReleaseNotes';
import PreviewPage from './pages/PreviewPage';
import UpdatePage from './pages/Update';
import AnnouncementsPage from './pages/Announcements';
import AIChatPage from './pages/AIChatPage';

function AppUpdateDialog() {
  const { updateInfo, isUpdateModalOpen, setIsUpdateModalOpen } = useUpdate();
  const navigate = useNavigate();

  // 当更新对话框打开时，同时显示系统通知
  useEffect(() => {
    if (isUpdateModalOpen && updateInfo) {
      // 使用主进程发送系统通知
      if (window.api && window.api.showNotification) {
        window.api.showNotification({
          title: '发现新版本',
          body: `版本 ${updateInfo.version} 可用，点击前往下载`,
          icon: '/src/assets/icon.ico',
          requireInteraction: true,
          tag: 'update-available',
          silent: false
        });
      }
    }
  }, [isUpdateModalOpen, updateInfo]);

  // 监听通知点击事件
  useEffect(() => {
    if (window.api && window.api.onNotificationClicked) {
      const removeListener = window.api.onNotificationClicked((data) => {
        if (data.tag === 'update-available') {
          // 关闭对话框
          setIsUpdateModalOpen(false);
          // 跳转到更新页面
          navigate('/update');
        }
      });
      
      return removeListener;
    }
  }, [setIsUpdateModalOpen, navigate]);

  const handleGoToUpdate = () => {
    navigate('/update');
    setIsUpdateModalOpen(false);
  };

  return (
    <AlertDialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>发现新版本！</AlertDialogTitle>
          <AlertDialogDescription>
            已检测到新版本 {updateInfo?.version}。是否立即前往应用更新页面进行更新？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>稍后吧</AlertDialogCancel>
          <AlertDialogAction onClick={handleGoToUpdate}>去更新</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function MainLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [r2Status, setR2Status] = useState({ loading: true, success: false, message: '正在检查连接...' });
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const { notifications, unreadCount, addNotification, markAllAsRead, clearNotifications, removeNotification } = useNotifications();
  const navigate = useNavigate();

  const checkStatus = useCallback(async () => {
    setR2Status({ loading: true, success: false, message: '正在检查连接...' });
    try {
      const result = await window.api.checkStatus();
      setR2Status({ loading: false, success: result.success, message: result.success ? '存储连接正常' : result.error });
    } catch (error) {
      setR2Status({ loading: false, success: false, message: `检查失败: ${error.message}` });
    }
  }, []);

  const refreshState = useCallback(async () => {
    const data = await window.api.getSettings();
    setProfiles(data.profiles || []);
    setActiveProfileId(data.activeProfileId || null);
    await checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    refreshState();
    const intervalId = setInterval(checkStatus, 60000); // 每 60 秒检查一次

    return () => clearInterval(intervalId);
  }, [refreshState, checkStatus]);

  // 接收主进程的导航指令（用于右键上传唤醒后跳转到上传页）
  useEffect(() => {
    const remove = window.api.onNavigate((path) => {
      if (typeof path !== 'string') return;
      if (path.startsWith('/settings')) {
        // 支持通过查询参数控制激活的设置页 Tab 或动作
        const url = new URL('app://' + path);
        const tab = url.searchParams.get('tab');
        const action = url.searchParams.get('action');
        navigate('/settings', { state: { tab, action } });
      } else {
        navigate(path);
      }
    });
    return () => remove && remove();
  }, [navigate]);

  const handleProfileSwitch = async (profileId) => {
    const currentProfiles = await window.api.getSettings().then(d => d.profiles);
    await window.api.saveProfiles({ profiles: currentProfiles, activeProfileId: profileId });
    await refreshState();
    const switchedProfile = currentProfiles.find(p => p.id === profileId);
    if (switchedProfile) {
        toast.success(`已切换到存储桶: ${switchedProfile.name}`);
        addNotification({ message: `已切换到: ${switchedProfile.name}`, type: 'info' });
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  }

  return (
    <Layout>
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      <LayoutBody>
        <Header 
          onSearchClick={() => setIsSearchDialogOpen(true)} 
          r2Status={r2Status}
          profiles={profiles}
          activeProfileId={activeProfileId}
          onProfileSwitch={handleProfileSwitch}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllAsRead}
          onClearNotifications={clearNotifications}
          onRemoveNotification={removeNotification}
        />
        <AnnouncementBanner />
        <main className="relative flex-1 overflow-auto p-4">
          <Outlet context={{ activeProfileId, isSearchDialogOpen, setIsSearchDialogOpen, refreshState }}/>
        </main>
      </LayoutBody>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <UpdateProvider>
          <NotificationProvider>
            <UploadsProvider>
      <Toaster richColors position="top-center" />
              <Routes>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/files" element={<FilesPage />} />
                  <Route path="/ai-chat" element={<AIChatPage />} />
                  <Route path="/uploads" element={<UploadsPage />} />
                  <Route path="/downloads" element={<DownloadsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/announcements" element={<AnnouncementsPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/releasenotes" element={<ReleaseNotesPage />} />
                  <Route path="/update" element={<UpdatePage />} />
                </Route>
                <Route path="/preview" element={<PreviewPage />} />
              </Routes>
              <AppUpdateDialog />
            </UploadsProvider>
      </NotificationProvider>
        </UpdateProvider>
    </ThemeProvider>
    </Router>
  )
}

export default App 