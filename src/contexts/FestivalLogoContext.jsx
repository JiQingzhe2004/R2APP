import { createContext, useState, useEffect, useContext, useRef } from 'react';
import BlackLogo from '@/assets/BlackLOGO.png';
import WhiteLogo from '@/assets/WhiteLOGO.png';
import { useTheme } from '@/components/theme-provider';

const FestivalLogoContext = createContext();

export function useFestivalLogo() {
  const context = useContext(FestivalLogoContext);
  if (context === undefined) {
    throw new Error('useFestivalLogo must be used within a FestivalLogoProvider');
  }
  return context;
}

export function FestivalLogoProvider({ children }) {
  const { theme } = useTheme();
  const [festivalLogo, setFestivalLogo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastCheckDate = useRef(new Date().toDateString());

  useEffect(() => {
    let mounted = true;
    let checkInterval = null;

    async function fetchFestivalLogo() {
      try {
        const logoUrl = await window.api.getFestivalLogo();
        if (mounted) {
          setFestivalLogo(logoUrl);
          setIsLoading(false);
        }
      } catch (error) {
        console.warn('[FestivalLogoContext] 获取节日Logo失败:', error);
        if (mounted) {
          setFestivalLogo(null);
          setIsLoading(false);
        }
      }
    }

    // 检查日期是否变化（轻量级检查，只比较日期字符串）
    function checkDateChange() {
      const now = new Date();
      const currentDate = now.toDateString();
      
      if (currentDate !== lastCheckDate.current) {
        lastCheckDate.current = currentDate;
        return true; // 日期变化了
      }
      return false;
    }

    // 初始获取
    fetchFestivalLogo();

    // 使用窗口焦点事件 + 定期检查的组合方案
    // 当窗口获得焦点时检查（用户切换回应用时）
    const handleFocus = () => {
      if (mounted && checkDateChange()) {
        // 如果日期变化了，重新获取Logo
        fetchFestivalLogo();
      }
    };

    // 定期检查（每6小时检查一次，减少频率）
    // 这样即使应用长时间运行，也能在节日过期后及时更新
    checkInterval = setInterval(() => {
      if (mounted) {
        // 先检查日期是否变化（轻量级）
        if (checkDateChange()) {
          fetchFestivalLogo();
        } else {
          // 即使日期没变化，也定期检查一次（防止配置更新）
          fetchFestivalLogo();
        }
      }
    }, 6 * 60 * 60 * 1000); // 6小时

    // 监听窗口焦点事件
    window.addEventListener('focus', handleFocus);
    
    // 页面可见性变化时也检查（用户切换标签页回来时）
    const handleVisibilityChange = () => {
      if (mounted && !document.hidden && checkDateChange()) {
        fetchFestivalLogo();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 如果有节日Logo，使用节日Logo；否则根据主题使用默认Logo
  const logoUrl = festivalLogo || (theme === 'dark' ? BlackLogo : WhiteLogo);

  return (
    <FestivalLogoContext.Provider value={{ logoUrl, isLoading, isFestival: !!festivalLogo }}>
      {children}
    </FestivalLogoContext.Provider>
  );
}

