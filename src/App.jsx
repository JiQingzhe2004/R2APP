import { useState } from 'react';
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from 'sonner';
import { Layout, LayoutBody } from '@/components/ui/layout'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import FilesPage from './pages/Files';
import UploadsPage from './pages/Uploads';
import DownloadsPage from './pages/Downloads';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster richColors position="top-center" />
      <Router>
        <Layout>
          <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
          <LayoutBody>
            <Header onSearchClick={() => setIsSearchDialogOpen(true)} />
            <main className="flex-1 p-6 overflow-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/files" element={<FilesPage isSearchOpen={isSearchDialogOpen} onSearchOpenChange={setIsSearchDialogOpen} />} />
                <Route path="/uploads" aname="uploads" element={<UploadsPage />} />
                <Route path="/downloads" element={<DownloadsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </LayoutBody>
        </Layout>
      </Router>
    </ThemeProvider>
  )
}

export default App 