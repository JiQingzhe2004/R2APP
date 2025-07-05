import { ThemeProvider } from "@/components/theme-provider"
import { Layout, LayoutBody } from '@/components/ui/layout'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import FilesPage from './pages/Files';
import UploadsPage from './pages/Uploads';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <Layout>
          <Sidebar />
          <LayoutBody>
            <Header />
            <main className="flex-1 p-6 overflow-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/files" element={<FilesPage />} />
                <Route path="/uploads" aname="uploads" element={<UploadsPage />} />
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