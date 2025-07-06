import React, { useState, useEffect } from 'react';
import FolderItem from './FolderItem';

const FolderTree = ({ onSelectFolder, selectedPrefix }) => {
  const [rootFolders, setRootFolders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRootFolders = async () => {
      setLoading(true);
      const result = await window.api.listObjects({ prefix: '', delimiter: '/' });
      setLoading(false);
      if (result.success) {
        const folders = result.data.files.filter(f => f.isFolder);
        setRootFolders(folders);
      }
    };
    fetchRootFolders();
  }, []);

  return (
    <div className="p-2">
       <h3 className="font-semibold text-lg mb-2 px-2">文件夹</h3>
      {loading && <div className="text-sm">正在加载...</div>}
      {!loading && rootFolders.map(folder => (
        <FolderItem 
          key={folder.key} 
          folder={folder} 
          onSelect={onSelectFolder} 
          selectedPrefix={selectedPrefix}
        />
      ))}
       {!loading && rootFolders.length === 0 && (
        <div className="text-sm text-muted-foreground px-2">没有文件夹</div>
      )}
    </div>
  );
};

export default FolderTree; 