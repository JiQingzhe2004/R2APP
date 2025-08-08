import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster, toast } from 'sonner';
import { Layout, LayoutBody } from '@/components/ui/layout'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
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

function AppUpdateDialog() {
  const { updateInfo, isUpdateModalOpen, setIsUpdateModalOpen } = useUpdate();
  const navigate = useNavigate();

  const handleGoToUpdate = () => {
    navigate('/update');
    setIsUpdateModalOpen(false);
  }

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
        <main className="relative flex-1 overflow-auto p-6">
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
                  <Route path="/uploads" element={<UploadsPage />} />
                  <Route path="/downloads" element={<DownloadsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
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