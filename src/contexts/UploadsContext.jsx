import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const UploadsContext = createContext();

export const useUploads = () => useContext(UploadsContext);

export const UploadsProvider = ({ children }) => {
  const [uploads, setUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const removeProgressListener = window.api.onUploadProgress(({ key, percentage, error }) => {
      setUploads(prevUploads => {
        return prevUploads.map(upload => {
          if (upload.key === key) {
            if (error) {
              return { ...upload, status: 'error', error };
            }
            const isCompleted = percentage === 100;
            return {
              ...upload,
              status: isCompleted ? 'completed' : 'uploading',
              progress: percentage,
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
  };

  return (
    <UploadsContext.Provider value={value}>
      {children}
    </UploadsContext.Provider>
  );
}; 