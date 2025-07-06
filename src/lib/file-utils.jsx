import { Archive, FileJson, File as FileIcon, FileImage, FileText, FileVideo, FileAudio, Code, AppWindow } from 'lucide-react';

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const fileTypeMappings = [
  { type: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'], icon: <FileImage className="h-10 w-10 text-blue-500" /> },
  { type: '视频', extensions: ['mp4', 'mov', 'avi', 'mkv'], icon: <FileVideo className="h-10 w-10 text-red-500" /> },
  { type: '音频', extensions: ['mp3', 'wav', 'flac', 'aac'], icon: <FileAudio className="h-10 w-10 text-green-500" /> },
  { type: '文档', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'], icon: <FileText className="h-10 w-10 text-yellow-500" /> },
  { type: '压缩包', extensions: ['zip', 'rar', '7z', 'tar', 'gz'], icon: <Archive className="h-10 w-10 text-orange-500" /> },
  { type: '代码', extensions: ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'html', 'css'], icon: <Code className="h-10 w-10 text-indigo-500" /> },
  { type: 'JSON', extensions: ['json'], icon: <FileJson className="h-10 w-10 text-purple-500" /> },
  { type: '应用', extensions: ['exe', 'app', 'dmg'], icon: <AppWindow className="h-10 w-10 text-gray-500" /> },
];

export const getFileMeta = (file) => {
  const key = file.key || file.Key; // Handle both 'key' and 'Key'
  if (!key) return { description: '未知文件', icon: <FileIcon className="h-10 w-10 text-muted-foreground" /> };
  
  const extension = key.split('.').pop()?.toLowerCase();
  if (!extension) return { description: '文件', icon: <FileIcon className="h-10 w-10 text-muted-foreground" /> };

  for (const mapping of fileTypeMappings) {
    if (mapping.extensions.includes(extension)) {
      return { description: mapping.type, icon: mapping.icon };
    }
  }

  return { 
    description: `${extension.toUpperCase()} 文件`, 
    icon: <FileIcon className="h-10 w-10 text-muted-foreground" /> 
  };
};

export const getFileIcon = (file) => {
  return getFileMeta(file).icon;
};

export const getFileTypeDescription = (file) => {
  return getFileMeta(file).description;
} 