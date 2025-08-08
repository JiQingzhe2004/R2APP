import React, { createContext, useState, useEffect, useContext } from 'react';

const UpdateContext = createContext();

export function useUpdate() {
  return useContext(UpdateContext);
}

export function UpdateProvider({ children }) {
  const [status, setStatus] = useState('idle'); // idle, checking, available, not-available, downloading, downloaded, error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progressInfo, setProgressInfo] = useState({ percent: 0 });
  const [errorInfo, setErrorInfo] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState(() => {
    try {
      return localStorage.getItem('last-checked-update-time') || null;
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    // This effect should run only once to set up listeners and initial check
    console.log('UpdateProvider mounted. Setting up listeners and checking for updates.');
    // Trigger initial check with timestamp record
    checkForUpdates();

    const listeners = [
      window.api.onUpdateAvailable((info) => {
        console.log('Context: Update available', info);
        setStatus('available');
        setUpdateInfo(info);
        setIsUpdateModalOpen(true); // Open the initial dialog
      }),
      window.api.onUpdateNotAvailable(() => {
        console.log('Context: Update not available');
        setStatus('not-available');
      }),
      window.api.onUpdateDownloadProgress((info) => {
        console.log('Context: Download progress', info);
        setStatus('downloading');
        setProgressInfo(info);
      }),
      window.api.onUpdateDownloaded((info) => {
        console.log('Context: Update downloaded', info);
        setStatus('downloaded');
        setUpdateInfo(info);
      }),
      window.api.onUpdateError((err) => {
        console.error('Context: Update error', err);
        setStatus('error');
        setErrorInfo(err);
      })
    ];
    
    // Cleanup function
    return () => {
      console.log('UpdateProvider unmounted. Cleaning up listeners.');
      listeners.forEach(removeListener => {
        if (typeof removeListener === 'function') {
          // Assuming the API returns a function to unsubscribe
          removeListener();
        }
      });
    };
  }, []);

  const checkForUpdates = () => {
    setStatus('checking');
    const now = new Date().toLocaleString();
    setLastCheckedTime(now);
    try {
      localStorage.setItem('last-checked-update-time', now);
    } catch (_) {}
    window.api.checkForUpdates();
  };

  const downloadUpdate = () => {
    setStatus('downloading');
    window.api.downloadUpdate();
  };

  const quitAndInstallUpdate = () => {
    window.api.quitAndInstallUpdate();
  };
  
  const value = {
    status,
    updateInfo,
    progressInfo,
    errorInfo,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    checkForUpdates,
    downloadUpdate,
    quitAndInstallUpdate,
    lastCheckedTime,
  };

  return (
    <UpdateContext.Provider value={value}>
      {children}
    </UpdateContext.Provider>
  );
} 