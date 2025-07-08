import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const UploadsContext = createContext();

export const useUploads = () => useContext(UploadsContext);

export const UploadsProvider = ({ children }) => {
  const [uploads, setUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const isInitialLoad = useRef(true);

  // Load state from store on initial mount
  useEffect(() => {
    const loadState = async () => {
      const storedUploads = await window.api.getUploadsState();
      if (storedUploads && storedUploads.length > 0) {
        const processedUploads = storedUploads.map(u => {
          if (u.status === 'uploading') {
            // Treat uploads that were in progress as paused, since the app was closed.
            return { ...u, status: 'paused', error: '上传已中断' };
          }
          return u;
        });
        setUploads(processedUploads);
      }
      // Set a short timeout to prevent saving the initial (potentially empty) state
      // right back to the store before the loaded state is processed.
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
    };
    loadState();
  }, []);

  // Save state to store whenever it changes
  useEffect(() => {
    if (!isInitialLoad.current) {
      window.api.setUploadsState(uploads);
    }
  }, [uploads]);

  useEffect(() => {
    const removeProgressListener = window.api.onUploadProgress(({ key, percentage, error, status }) => {
      setUploads(prevUploads => {
        return prevUploads.map(upload => {
          if (upload.key === key) {
            const baseProgress = upload.resumed_from || 0;
            const newProgress = percentage || 0;
            // Calculate total progress based on what was already uploaded + new progress
            const totalProgress = baseProgress + (newProgress * (100 - baseProgress) / 100);

            // A specific status from the main process (like 'paused') takes precedence.
            if (status) {
              return { 
                ...upload, 
                status: status, 
                error: error, // Can still hold a message like "Upload paused"
                progress: totalProgress,
              };
            }

            // If there's an error without a specific status, it's a failure.
            if (error) {
              return { ...upload, status: 'error', error, resumed_from: 0 };
            }
            
            // Otherwise, it's a normal progress update.
            const isCompleted = totalProgress >= 100;
            return {
              ...upload,
              status: isCompleted ? 'completed' : 'uploading',
              progress: isCompleted ? 100 : totalProgress,
              error: null, // Clear previous errors on new progress
              resumed_from: isCompleted ? 0 : upload.resumed_from,
            };
          }
          return upload;
        });
      });
    });

    return () => {
      if (removeProgressListener) {
        removeProgressListener();
      }
    };
  }, []);
  
  const addUploads = (newUploadsData) => {
    const newUploads = newUploadsData
      .map(uploadData => ({
        id: uuidv4(),
        path: uploadData.path,
        key: uploadData.key,
        status: 'pending',
        progress: 0,
        resumed_from: 0, // Track progress to resume from
      }))
      .filter(newUpload => !uploads.some(existing => existing.path === newUpload.path));

    if (newUploads.length > 0) {
      setUploads(prev => [...prev, ...newUploads]);
    }
  };

  const startAllUploads = async () => {
    setIsUploading(true);
    const pendingUploads = uploads.filter(u => u.status === 'pending');
    
    for (const upload of pendingUploads) {
      setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'uploading' } : u));
      await window.api.uploadFile({ filePath: upload.path, key: upload.key });
    }

    setIsUploading(false);
  };
  
  const pauseUpload = async (id) => {
    const upload = uploads.find(u => u.id === id);
    if (upload && upload.status === 'uploading') {
      await window.api.pauseUpload(upload.key);
      // When pausing, we record the current progress in 'resumed_from'
      setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'paused', resumed_from: u.progress } : u));
    }
  };

  const resumeUpload = async (id) => {
    const upload = uploads.find(u => u.id === id);
    if (upload && upload.status === 'paused') {
      await window.api.resumeUpload({ filePath: upload.path, key: upload.key });
      setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'uploading' } : u));
    }
  };

  const removeUpload = (id) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };
  
  const clearCompleted = () => {
    setUploads(prev => prev.filter(u => u.status !== 'completed' && u.status !== 'error'));
  };

  const clearAll = () => {
    // We shouldn't clear uploads that are in progress.
    const inProgress = uploads.some(u => u.status === 'uploading');
    if (inProgress) {
        // Maybe show a toast notification here
        return;
    }
    setUploads([]);
  };

  const value = {
    uploads,
    isUploading,
    addUploads,
    startAllUploads,
    removeUpload,
    clearAll,
    clearCompleted,
    pauseUpload,
    resumeUpload,
  };

  return (
    <UploadsContext.Provider value={value}>
      {children}
    </UploadsContext.Provider>
  );
}; 