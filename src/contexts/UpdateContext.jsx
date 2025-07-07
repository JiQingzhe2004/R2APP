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

  useEffect(() => {
    // This effect should run only once to set up listeners and initial check
    console.log('UpdateProvider mounted. Setting up listeners and checking for updates.');
    window.api.checkForUpdates();

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
    quitAndInstallUpdate
  };

  return (
    <UpdateContext.Provider value={value}>
      {children}
    </UpdateContext.Provider>
  );
} 