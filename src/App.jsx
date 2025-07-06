import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster, toast } from 'sonner';
import { Layout, LayoutBody } from '@/components/ui/layout'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import DashboardPage from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import FilesPage from './pages/Files';
import UploadsPage from './pages/Uploads';
import DownloadsPage from './pages/Downloads';
import AboutPage from './pages/About';

function AppContent() {
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
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage key={activeProfileId} />} />
            <Route path="/files" element={<FilesPage key={activeProfileId} isSearchOpen={isSearchDialogOpen} onSearchOpenChange={setIsSearchDialogOpen} />} />
            <Route path="/uploads" aname="uploads" element={<UploadsPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/settings" element={<SettingsPage onSettingsSaved={refreshState} />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
      </LayoutBody>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster richColors position="top-center" />
      <NotificationProvider>
        <Router>
          <AppContent />
        </Router>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App 