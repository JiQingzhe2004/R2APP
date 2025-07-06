import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderClosed } from 'lucide-react';

const FolderItem = ({ folder, onSelect, selectedPrefix }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const hasChildren = true; // Assume it might have children to show the chevron
  const isSelected = selectedPrefix === folder.key;

  const fetchChildren = async () => {
    setLoading(true);
    const result = await window.api.listObjects({ prefix: folder.key, delimiter: '/' });
    setLoading(false);
    if (result.success) {
      const childFolders = result.data.files.filter(f => f.isFolder);
      setChildren(childFolders);
    }
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    const newOpenState = !isOpen;
    setIsOpen(newOpenState);
    if (newOpenState && children.length === 0) {
      fetchChildren();
    }
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelect(folder.key);
  };

  const folderName = folder.key.split('/').filter(Boolean).pop();

  return (
    <div className="pl-4">
      <div 
        className={`flex items-center p-1 rounded-md cursor-pointer ${isSelected ? 'bg-muted' : 'hover:bg-muted/50'}`}
        onClick={handleSelect}
      >
        <div onClick={handleToggle} className="p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700">
          {hasChildren ? (
            isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <span className="w-4 inline-block" />
          )}
        </div>
        {isOpen ? <Folder size={16} className="mx-2" /> : <FolderClosed size={16} className="mx-2" />}
        <span className="text-sm truncate">{folderName}</span>
      </div>
      {isOpen && (
        <div className="border-l border-gray-200 dark:border-gray-700 ml-3">
          {loading && <div className="pl-4 text-sm">正在加载...</div>}
          {!loading && children.map(child => (
            <FolderItem 
              key={child.key} 
              folder={child} 
              onSelect={onSelect} 
              selectedPrefix={selectedPrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FolderItem; 