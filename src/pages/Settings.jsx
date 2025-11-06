import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Button } from "@/components/ui/Button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from 'sonner'
import { useNotifications } from '@/contexts/NotificationContext';
import { 
  User, KeyRound, Container, Globe, Plug, Save, PlusCircle, Trash2, 
  Cloud, Server, Settings as SettingsIcon, ChevronDown, ChevronRight,
  Database, Shield, MapPin, Link2, HardDrive, Edit2, Check, X, FolderOpen, Image
} from 'lucide-react'
import AppSettings from './AppSettings';

// 导入云服务图标
import CloudflareIcon from '@/assets/cloudico/Cloudflare.svg';
import AliyunIcon from '@/assets/cloudico/阿里云.svg';
import TencentIcon from '@/assets/cloudico/腾讯云.svg';
import GiteeIcon from '@/assets/cloudico/GITEE.svg';
import GoogleCloudIcon from '@/assets/cloudico/谷歌云.svg';
import LskyIcon from '@/assets/cloudico/lsky.ico';
import SmmsIcon from '@/assets/cloudico/smms.app.png';
import HuaweiIcon from '@/assets/cloudico/华为云.svg';

import { v4 as uuidv4 } from 'uuid';
import { useOutletContext } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Separator } from "@/components/ui/separator"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import BucketSelector from '@/components/BucketSelector'

const R2_TEMPLATE = {
  type: 'r2',
  name: '新 R2 配置',
  accountId: '',
  accessKeyId: '',
  secretAccessKey: '',
  bucketName: '',
  storageQuotaGB: 10,
  storageQuotaUnit: 'GB',
  createdAt: new Date().toISOString(),
};

const OSS_TEMPLATE = {
  type: 'oss',
  name: '新 OSS 配置',
  accessKeyId: '',
  accessKeySecret: '',
  region: '',
  bucket: '',
  endpoint: '',
  storageQuotaGB: 10,
  storageQuotaUnit: 'GB',
  createdAt: new Date().toISOString(),
};

const COS_TEMPLATE = {
  type: 'cos',
  name: '新 COS 配置',
  secretId: '',
  secretKey: '',
  region: '',
  bucket: '',
  storageQuotaGB: 10,
  storageQuotaUnit: 'GB',
  createdAt: new Date().toISOString(),
};

const SMMS_TEMPLATE = {
  type: 'smms',
  name: '新 SM.MS 配置',
  smmsToken: '',
  storageQuotaGB: 10,
  storageQuotaUnit: 'GB',
  createdAt: new Date().toISOString(),
};

const LSKY_TEMPLATE = {
  type: 'lsky',
  name: '新兰空图床配置',
  lskyToken: '',
  lskyUrl: '',
  albumId: '',
  permission: 1,
  storageQuotaGB: 10,
  storageQuotaUnit: 'GB',
  createdAt: new Date().toISOString(),
};

const GITEE_TEMPLATE = {
  type: 'gitee',
  name: '新 Gitee 配置',
  accessToken: '',
  owner: '',
  repo: '',
  branch: 'main',
  storageQuotaGB: 10,
  storageQuotaUnit: 'GB',
  createdAt: new Date().toISOString(),
};

const GCS_TEMPLATE = {
  type: 'gcs',
  name: '新 GCS 配置',
  projectId: '',
  bucketName: '',
  credentials: '',
  keyFilename: '',
  proxyConfig: {
    enabled: false,
    proxyUrl: '',
    proxyHost: '',
    proxyPort: '',
    proxyProtocol: 'http',
    proxyUsername: '',
    proxyPassword: ''
  },
  storageQuotaGB: 10,
  storageQuotaUnit: 'GB',
  createdAt: new Date().toISOString(),
};

const OBS_TEMPLATE = {
  type: 'obs',
  name: '新华为云 OBS 配置',
  accessKeyId: '',
  secretAccessKey: '',
  region: 'cn-north-4',
  bucket: '',
  endpoint: '',
  storageQuotaGB: 10,
  storageQuotaUnit: 'GB',
  createdAt: new Date().toISOString(),
};

const PROVIDER_INFO = {
  r2: {
    name: 'Cloudflare R2',
    icon: CloudflareIcon,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    description: 'Cloudflare 的对象存储服务，兼容 S3 API'
  },
  oss: {
    name: '阿里云 OSS',
    icon: AliyunIcon,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: '阿里云对象存储服务'
  },
  cos: {
    name: '腾讯云 COS',
    icon: TencentIcon,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    description: '腾讯云对象存储服务'
  },
  smms: {
    name: 'SM.MS 图床',
    icon: SmmsIcon,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    description: '免费图床服务，支持多种图片格式'
  },
  lsky: {
    name: '兰空图床',
    icon: LskyIcon,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: '标准的兰空图床，支持多种存储策略'
  },
  gitee: {
    name: 'Gitee 仓库',
    icon: GiteeIcon,
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    description: '使用 Gitee 仓库作为文件存储，支持版本控制'
  },
  gcs: {
    name: 'Google Cloud',
    icon: GoogleCloudIcon,
    color: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
    description: 'Google 云存储服务，企业级对象存储'
  },
  obs: {
    name: '华为云 OBS',
    icon: HuaweiIcon,
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    description: '华为云对象存储服务，企业级云存储'
  }
};

const ProfileCard = ({ profile, isActive, onActivate, onChange, onTest, onRemove, onSave, isTesting, isSaving }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(profile.name);
  const [showBucketSelector, setShowBucketSelector] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const providerInfo = PROVIDER_INFO[profile.type] || {
    name: '未知服务',
    icon: Cloud,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    description: '未知的存储服务类型'
  };

  const handleNameSave = async () => {
    // 先更新配置
    onChange(profile.id, { target: { name: 'name', value: tempName } });
    setIsEditingName(false);
    
    // 直接使用更新后的配置进行保存
    const updatedProfile = { ...profile, name: tempName };
    try {
      await onSave(profile.id, updatedProfile);
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  };

  const handleNameCancel = () => {
    setTempName(profile.name);
    setIsEditingName(false);
  };

  return (
    <Card className={`transition-all ${isActive ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            
            <RadioGroupItem 
              value={profile.id} 
              id={`radio-${profile.id}`}
              checked={isActive}
              onClick={() => onActivate(profile.id)}
            />
            
            <div className="flex items-center gap-2">
              {typeof providerInfo.icon === 'string' ? (
                <img src={providerInfo.icon} alt={providerInfo.name} className="h-5 w-5" />
              ) : (
                <providerInfo.icon className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={`text-xs font-bold py-1 px-2.5 rounded-full ${providerInfo.color}`}>
                {profile.type.toUpperCase()}
              </span>
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="h-7 w-48"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave();
                    if (e.key === 'Escape') handleNameCancel();
                  }}
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleNameSave}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleNameCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold">{profile.name}</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setTempName(profile.name);
                    setIsEditingName(true);
                  }}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onTest(profile.id)} 
              disabled={isTesting || isSaving}
            >
              <Plug className="mr-2 h-4 w-4" />
              {isTesting ? '测试中...' : '测试'}
            </Button>
            <Button 
              size="sm" 
              variant="default" 
              onClick={() => onSave(profile.id)} 
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? '保存中...' : '保存'}
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)} 
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {!isExpanded && (
          <CardDescription className="mt-2 text-xs">
            {providerInfo.description}
            {profile.bucket || profile.bucketName ? 
              ` • 存储桶: ${profile.bucket || profile.bucketName}` : ''}
          </CardDescription>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          <Separator />
          
          {profile.type === 'r2' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`accountId-${profile.id}`} className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    账户 ID
                  </Label>
                  <Input 
                    id={`accountId-${profile.id}`} 
                    name="accountId" 
                    value={profile.accountId} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 Cloudflare 账户 ID" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`bucketName-${profile.id}`} className="flex items-center gap-2">
                    <Container className="h-4 w-4" />
                    存储桶名称
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      id={`bucketName-${profile.id}`} 
                      name="bucketName" 
                      value={profile.bucketName} 
                      onChange={(e) => onChange(profile.id, e)} 
                      placeholder="您的 R2 存储桶名称" 
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowBucketSelector(true)}
                      title="选择存储桶"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`accessKeyId-${profile.id}`} className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    访问密钥 ID
                  </Label>
                  <Input 
                    id={`accessKeyId-${profile.id}`} 
                    name="accessKeyId" 
                    value={profile.accessKeyId} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 R2 访问密钥 ID" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`secretAccessKey-${profile.id}`} className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    秘密访问密钥
                  </Label>
                  <Input 
                    id={`secretAccessKey-${profile.id}`} 
                    name="secretAccessKey" 
                    type="password" 
                    value={profile.secretAccessKey} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 R2 秘密访问密钥" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`publicDomain-${profile.id}`} className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  自定义域名
                </Label>
                <Input 
                  id={`publicDomain-${profile.id}`} 
                  name="publicDomain" 
                  value={profile.publicDomain || ''} 
                  onChange={(e) => onChange(profile.id, e)} 
                  placeholder="例如: https://cdn.yourdomain.com (可选)" 
                />
                <p className="text-xs text-muted-foreground">
                  配置自定义域名后，文件访问将使用您的域名而不是默认的R2域名，务必正确解析！
                </p>
              </div>
            </>
          )}

          {profile.type === 'oss' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`accessKeyId-${profile.id}`} className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    AccessKey ID
                  </Label>
                  <Input 
                    id={`accessKeyId-${profile.id}`} 
                    name="accessKeyId" 
                    value={profile.accessKeyId} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 OSS AccessKey ID" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`accessKeySecret-${profile.id}`} className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    AccessKey Secret
                  </Label>
                  <Input 
                    id={`accessKeySecret-${profile.id}`} 
                    name="accessKeySecret" 
                    type="password" 
                    value={profile.accessKeySecret} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 OSS AccessKey Secret" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`bucket-${profile.id}`} className="flex items-center gap-2">
                    <Container className="h-4 w-4" />
                    存储空间名称
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      id={`bucket-${profile.id}`} 
                      name="bucket" 
                      value={profile.bucket} 
                      onChange={(e) => onChange(profile.id, e)} 
                      placeholder="您的 OSS 存储空间名称" 
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowBucketSelector(true)}
                      title="选择存储桶"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`region-${profile.id}`} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    地域
                  </Label>
                  <Input 
                    id={`region-${profile.id}`} 
                    name="region" 
                    value={profile.region} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="例如: oss-cn-hangzhou" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`publicDomain-${profile.id}`} className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  自定义域名
                </Label>
                <Input 
                  id={`publicDomain-${profile.id}`} 
                  name="publicDomain" 
                  value={profile.publicDomain || ''} 
                  onChange={(e) => onChange(profile.id, e)} 
                  placeholder="例如: https://cdn.yourdomain.com (可选)" 
                />
                <p className="text-xs text-muted-foreground">
                  配置自定义域名后，文件访问将使用您的域名而不是默认的OSS域名，务必正确解析！
                </p>
              </div>
            </>
          )}

          {profile.type === 'cos' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`secretId-${profile.id}`} className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    SecretId
                  </Label>
                  <Input 
                    id={`secretId-${profile.id}`} 
                    name="secretId" 
                    value={profile.secretId} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 COS SecretId" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`secretKey-${profile.id}`} className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    SecretKey
                  </Label>
                  <Input 
                    id={`secretKey-${profile.id}`} 
                    name="secretKey" 
                    type="password" 
                    value={profile.secretKey} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 COS SecretKey" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`bucket-${profile.id}`} className="flex items-center gap-2">
                    <Container className="h-4 w-4" />
                    存储桶名称
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      id={`bucket-${profile.id}`} 
                      name="bucket" 
                      value={profile.bucket} 
                      onChange={(e) => onChange(profile.id, e)} 
                      placeholder="格式: name-appid" 
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowBucketSelector(true)}
                      title="选择存储桶"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`region-${profile.id}`} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    地域
                  </Label>
                  <Input 
                    id={`region-${profile.id}`} 
                    name="region" 
                    value={profile.region} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="例如: ap-guangzhou" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`publicDomain-${profile.id}`} className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  自定义域名
                </Label>
                <Input 
                  id={`publicDomain-${profile.id}`} 
                  name="publicDomain" 
                  value={profile.publicDomain || ''} 
                  onChange={(e) => onChange(profile.id, e)} 
                  placeholder="例如: https://cdn.yourdomain.com (可选)" 
                />
                <p className="text-xs text-muted-foreground">
                  配置自定义域名后，文件访问将使用您的域名而不是默认的COS域名，务必正确解析！
                </p>
              </div>
            </>
          )}

          {profile.type === 'gitee' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`accessToken-${profile.id}`} className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Access Token
                  </Label>
                  <Input 
                    id={`accessToken-${profile.id}`} 
                    name="accessToken" 
                    type="password" 
                    value={profile.accessToken} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 Gitee Access Token" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`owner-${profile.id}`} className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    仓库所有者
                  </Label>
                  <Input 
                    id={`owner-${profile.id}`} 
                    name="owner" 
                    value={profile.owner} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="Gitee 用户名或组织名" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`repo-${profile.id}`} className="flex items-center gap-2">
                    <Container className="h-4 w-4" />
                    仓库名称
                  </Label>
                  <Input 
                    id={`repo-${profile.id}`} 
                    name="repo" 
                    value={profile.repo} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="仓库名称" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`branch-${profile.id}`} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    分支名称
                  </Label>
                  <Input 
                    id={`branch-${profile.id}`} 
                    name="branch" 
                    value={profile.branch} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="例如: main, master" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`publicDomain-${profile.id}`} className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  自定义域名
                </Label>
                <Input 
                  id={`publicDomain-${profile.id}`} 
                  name="publicDomain" 
                  value={profile.publicDomain || ''} 
                  onChange={(e) => onChange(profile.id, e)} 
                  placeholder="例如: https://cdn.yourdomain.com (可选)" 
                />
                <p className="text-xs text-muted-foreground">
                  配置自定义域名后，文件访问将使用您的域名而不是默认的Gitee域名，务必正确解析！
                </p>
              </div>
            </>
          )}

          {profile.type === 'gcs' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`projectId-${profile.id}`} className="flex items-center gap-2">
                    <Container className="h-4 w-4" />
                    项目 ID
                  </Label>
                  <Input 
                    id={`projectId-${profile.id}`} 
                    name="projectId" 
                    value={profile.projectId} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 GCP 项目 ID" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`bucketName-${profile.id}`} className="flex items-center gap-2">
                    <Container className="h-4 w-4" />
                    存储桶名称
                  </Label>
                  <Input 
                    id={`bucketName-${profile.id}`} 
                    name="bucketName" 
                    value={profile.bucketName} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 GCS 存储桶名称" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`credentials-${profile.id}`} className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  服务账号 JSON 密钥（JSON 格式）
                </Label>
                <textarea 
                  id={`credentials-${profile.id}`} 
                  name="credentials" 
                  value={profile.credentials || ''} 
                  onChange={(e) => onChange(profile.id, e)} 
                  placeholder='粘贴服务账号 JSON 密钥内容，例如: {"type":"service_account",...}'
                  rows={4}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  从 GCP 控制台下载的服务账号 JSON 密钥文件内容
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`keyFilename-${profile.id}`} className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  或者指定密钥文件路径
                </Label>
                <Input 
                  id={`keyFilename-${profile.id}`} 
                  name="keyFilename" 
                  value={profile.keyFilename || ''} 
                  onChange={(e) => onChange(profile.id, e)} 
                  placeholder="例如: /path/to/service-account-key.json (可选)" 
                />
                <p className="text-xs text-muted-foreground">
                  如果不想直接粘贴 JSON，可以指定密钥文件的绝对路径
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`publicDomain-${profile.id}`} className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  自定义域名
                </Label>
                <Input 
                  id={`publicDomain-${profile.id}`} 
                  name="publicDomain" 
                  value={profile.publicDomain || ''} 
                  onChange={(e) => onChange(profile.id, e)} 
                  placeholder="例如: https://cdn.yourdomain.com (可选)" 
                />
                <p className="text-xs text-muted-foreground">
                  配置自定义域名后，文件访问将使用您的域名而不是默认的 GCS 域名
                </p>
              </div>

              <Separator className="my-4" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">网络代理配置</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      当您无法正常访问时，可以配置代理来解决。正常访问则可以不开启！
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`proxyEnabled-${profile.id}`}
                      checked={profile.proxyConfig?.enabled || false}
                      onChange={(e) => {
                        const newProxyConfig = {
                          ...(profile.proxyConfig || {}),
                          enabled: e.target.checked
                        };
                        onChange(profile.id, { target: { name: 'proxyConfig', value: newProxyConfig } });
                      }}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`proxyEnabled-${profile.id}`} className="cursor-pointer">
                      启用代理
                    </Label>
                  </div>
                </div>

                {profile.proxyConfig?.enabled && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor={`proxyUrl-${profile.id}`} className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        代理 URL（完整格式）
                      </Label>
                      <Input 
                        id={`proxyUrl-${profile.id}`}
                        value={profile.proxyConfig?.proxyUrl || ''}
                        onChange={(e) => {
                          const newProxyConfig = {
                            ...(profile.proxyConfig || {}),
                            proxyUrl: e.target.value
                          };
                          onChange(profile.id, { target: { name: 'proxyConfig', value: newProxyConfig } });
                        }}
                        placeholder="例如: http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
                      />
                      <p className="text-xs text-muted-foreground">
                        推荐：直接填写完整的代理 URL，包括协议、主机和端口
                      </p>
                    </div>

                    <div className="text-center text-xs text-muted-foreground my-2">
                      或者分别配置以下选项
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`proxyProtocol-${profile.id}`}>协议</Label>
                        <select
                          id={`proxyProtocol-${profile.id}`}
                          value={profile.proxyConfig?.proxyProtocol || 'http'}
                          onChange={(e) => {
                            const newProxyConfig = {
                              ...(profile.proxyConfig || {}),
                              proxyProtocol: e.target.value
                            };
                            onChange(profile.id, { target: { name: 'proxyConfig', value: newProxyConfig } });
                          }}
                          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`proxyHost-${profile.id}`}>主机</Label>
                        <Input 
                          id={`proxyHost-${profile.id}`}
                          value={profile.proxyConfig?.proxyHost || ''}
                          onChange={(e) => {
                            const newProxyConfig = {
                              ...(profile.proxyConfig || {}),
                              proxyHost: e.target.value
                            };
                            onChange(profile.id, { target: { name: 'proxyConfig', value: newProxyConfig } });
                          }}
                          placeholder="127.0.0.1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`proxyPort-${profile.id}`}>端口</Label>
                        <Input 
                          id={`proxyPort-${profile.id}`}
                          value={profile.proxyConfig?.proxyPort || ''}
                          onChange={(e) => {
                            const newProxyConfig = {
                              ...(profile.proxyConfig || {}),
                              proxyPort: e.target.value
                            };
                            onChange(profile.id, { target: { name: 'proxyConfig', value: newProxyConfig } });
                          }}
                          placeholder="7890"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`proxyUsername-${profile.id}`}>用户名（可选）</Label>
                        <Input 
                          id={`proxyUsername-${profile.id}`}
                          value={profile.proxyConfig?.proxyUsername || ''}
                          onChange={(e) => {
                            const newProxyConfig = {
                              ...(profile.proxyConfig || {}),
                              proxyUsername: e.target.value
                            };
                            onChange(profile.id, { target: { name: 'proxyConfig', value: newProxyConfig } });
                          }}
                          placeholder="如果代理需要认证"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`proxyPassword-${profile.id}`}>密码（可选）</Label>
                        <Input 
                          id={`proxyPassword-${profile.id}`}
                          type="password"
                          value={profile.proxyConfig?.proxyPassword || ''}
                          onChange={(e) => {
                            const newProxyConfig = {
                              ...(profile.proxyConfig || {}),
                              proxyPassword: e.target.value
                            };
                            onChange(profile.id, { target: { name: 'proxyConfig', value: newProxyConfig } });
                          }}
                          placeholder="如果代理需要认证"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const result = await window.api.testProxyConnection(profile.proxyConfig);
                            if (result.success) {
                              toast.success('代理测试成功', { description: result.message });
                            } else {
                              toast.error('代理测试失败', { description: result.error });
                            }
                          } catch (error) {
                            toast.error('代理测试失败', { description: error.message });
                          }
                        }}
                      >
                        <Plug className="h-4 w-4 mr-2" />
                        测试代理连接
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {profile.type === 'obs' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`accessKeyId-${profile.id}`} className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Access Key ID
                  </Label>
                  <Input 
                    id={`accessKeyId-${profile.id}`} 
                    name="accessKeyId" 
                    value={profile.accessKeyId} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的华为云 Access Key ID" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`secretAccessKey-${profile.id}`} className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Secret Access Key
                  </Label>
                  <Input 
                    id={`secretAccessKey-${profile.id}`} 
                    name="secretAccessKey" 
                    type="password" 
                    value={profile.secretAccessKey} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的华为云 Secret Access Key" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`region-${profile.id}`} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    区域
                  </Label>
                  <Select 
                    value={profile.region} 
                    onValueChange={(value) => onChange(profile.id, { target: { name: 'region', value } })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择区域" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cn-north-4">华北-北京四（cn-north-4）</SelectItem>
                      <SelectItem value="cn-north-1">华北-北京一（cn-north-1）</SelectItem>
                      <SelectItem value="cn-east-3">华东-上海一（cn-east-3）</SelectItem>
                      <SelectItem value="cn-east-2">华东-上海二（cn-east-2）</SelectItem>
                      <SelectItem value="cn-south-1">华南-广州（cn-south-1）</SelectItem>
                      <SelectItem value="ap-southeast-1">亚太-香港（ap-southeast-1）</SelectItem>
                      <SelectItem value="ap-southeast-3">亚太-新加坡（ap-southeast-3）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`bucket-${profile.id}`} className="flex items-center gap-2">
                    <Container className="h-4 w-4" />
                    存储桶名称
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      id={`bucket-${profile.id}`} 
                      name="bucket" 
                      value={profile.bucket} 
                      onChange={(e) => onChange(profile.id, e)} 
                      placeholder="您的 OBS 存储桶名称" 
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowBucketSelector(true)}
                      title="选择存储桶"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`publicDomain-${profile.id}`} className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  自定义域名
                </Label>
                <Input 
                  id={`publicDomain-${profile.id}`} 
                  name="publicDomain" 
                  value={profile.publicDomain || ''} 
                  onChange={(e) => onChange(profile.id, e)} 
                  placeholder="例如: https://cdn.yourdomain.com (可选)" 
                />
                <p className="text-xs text-muted-foreground">
                  配置自定义域名后，文件访问将使用您的域名
                </p>
              </div>
            </>
          )}

          {profile.type === 'smms' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`smmsToken-${profile.id}`} className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    SM.MS Token
                  </Label>
                  <Input 
                    id={`smmsToken-${profile.id}`} 
                    name="smmsToken" 
                    value={profile.smmsToken} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="您的 SM.MS Token" 
                  />
                </div>
              </div>
            </>
          )}

          {profile.type === 'lsky' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`lskyUrl-${profile.id}`} className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    图床API地址
                  </Label>
                  <Input 
                    id={`lskyUrl-${profile.id}`} 
                    name="lskyUrl" 
                    value={profile.lskyUrl || ''} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="例如: https://your-lsky-domain.com" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`lskyToken-${profile.id}`} className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    API Token
                  </Label>
                  <Input 
                    id={`lskyToken-${profile.id}`} 
                    name="lskyToken" 
                    value={profile.lskyToken || ''} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="Bearer token，如：Bearer 1|xxxxx" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`lskyAlbum-${profile.id}`} className="flex items-center gap-2">
                    相册ID
                  </Label>
                  <Input 
                    id={`lskyAlbum-${profile.id}`} 
                    name="albumId" 
                    value={profile.albumId || ''} 
                    onChange={(e) => onChange(profile.id, e)} 
                    placeholder="可选，相册ID" 
                  />
                </div>
              </div>
            </>
          )}

          <Separator />
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              存储配额
            </Label>
            <div className="flex gap-2">
              <Input 
                id={`storageQuotaGB-${profile.id}`} 
                name="storageQuotaGB" 
                type="number"
                value={profile.storageQuotaGB || ''} 
                onChange={(e) => onChange(profile.id, e)} 
                placeholder="默认: 10"
                className="flex-1"
              />
              <Select 
                value={profile.storageQuotaUnit || 'GB'} 
                onValueChange={(value) => onChange(profile.id, { target: { name: 'storageQuotaUnit', value } })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MB">MB</SelectItem>
                  <SelectItem value="GB">GB</SelectItem>
                  <SelectItem value="TB">TB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      )}
      
      <BucketSelector
        profile={profile}
        isOpen={showBucketSelector}
        onClose={() => setShowBucketSelector(false)}
        onSelect={(bucketName) => {
          const fieldName = profile.type === 'r2' ? 'bucketName' : 'bucket';
          onChange(profile.id, { target: { name: fieldName, value: bucketName } });
        }}
      />
      
      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除配置</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除配置 "{profile.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemove(profile.id);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default function SettingsPage() {
  const { refreshState } = useOutletContext();
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const { addNotification } = useNotifications();
  
  const [isTesting, setIsTesting] = useState({}); // Track by profile id
  const [isSaving, setIsSaving] = useState({}); // Track by profile id
  const [activeTab, setActiveTab] = useState('profiles'); // profiles | app

  const fetchSettings = useCallback(async () => {
    const data = await window.api.getSettings();
    if (data.profiles && data.profiles.length > 0 && data.profiles[0].type) {
       // New structure already in place
       setProfiles(data.profiles || []);
    } else {
      // Temporary migration logic for old structure.
      console.log("旧数据结构，将进行迁移...");
      const migratedProfiles = (data.profiles || []).map(p => ({
        ...R2_TEMPLATE,
        id: p.id || uuidv4(),
        name: p.name,
        bucketName: p.bucketName,

        accountId: data.settings?.accountId || '',
        accessKeyId: data.settings?.accessKeyId || '',
        secretAccessKey: data.settings?.secretAccessKey || '',
      }));
      setProfiles(migratedProfiles);
    }
    setActiveProfileId(data.activeProfileId || null);
  }, []);

  useEffect(() => {
    fetchSettings();
    // 处理从托盘传来的导航状态（通过 App.jsx 传递 state）
    const { state } = window.history;
    const usr = state && state.usr ? state.usr : null;
    if (usr && usr.tab) {
      setActiveTab(usr.tab);
    }
  }, [fetchSettings]);

  // 确保所有配置都有创建时间字段
  useEffect(() => {
    if (profiles.length > 0) {
      const updatedProfiles = profiles.map(profile => {
        if (!profile.createdAt) {
          return { ...profile, createdAt: new Date().toISOString() };
        }
        return profile;
      });
      if (JSON.stringify(updatedProfiles) !== JSON.stringify(profiles)) {
        setProfiles(updatedProfiles);
      }
    }
  }, [profiles.length]);

  const handleProfileChange = (id, e) => {
    const { name, value } = e.target;
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, [name]: value } : p));
  };
  
  const handleAddProfile = (type) => {
    const templates = {
      'r2': R2_TEMPLATE,
      'oss': OSS_TEMPLATE,
      'cos': COS_TEMPLATE,
      'smms': SMMS_TEMPLATE,
      'lsky': LSKY_TEMPLATE,
      'gitee': GITEE_TEMPLATE,
      'gcs': GCS_TEMPLATE,
      'obs': OBS_TEMPLATE
    };
    const template = templates[type] || R2_TEMPLATE;
    const newProfile = {
      id: uuidv4(),
      ...template,
      name: `新${type.toUpperCase()}配置 ${profiles.filter(p=>p.type === type).length + 1}`,
      createdAt: new Date().toISOString(), // 添加创建时间
    };
    const newProfiles = [newProfile, ...profiles]; // 新配置放在最前面
    setProfiles(newProfiles);
    if (newProfiles.length === 1) {
      setActiveProfileId(newProfile.id);
    }
    setActiveTab('profiles');
  };

  const handleRemoveProfile = async (id) => {
    const newProfiles = profiles.filter(p => p.id !== id);
    setProfiles(newProfiles);
    if (activeProfileId === id) {
      setActiveProfileId(newProfiles.length > 0 ? newProfiles[0].id : null);
    }
    
    // 自动保存配置
    try {
      await window.api.saveProfiles({ profiles: newProfiles, activeProfileId: newProfiles.length > 0 ? newProfiles[0].id : null });
      addNotification({ message: '配置已删除并保存', type: 'success' });
    } catch (error) {
      console.error('保存配置失败:', error);
      addNotification({ message: '删除配置失败', type: 'error' });
    }
  };

  const handleTestConnection = async (profileId) => {
    const profileToTest = profiles.find(p => p.id === profileId);
    if (!profileToTest) return;

    setIsTesting(prev => ({...prev, [profileId]: true}));
    const toastId = toast.loading(`正在测试配置 "${profileToTest.name}"...`);
    
    const result = await window.api.testConnection(profileToTest);

    if (result.success) {
      toast.success(result.message, { id: toastId });
    } else {
      toast.error(result.error, { id: toastId });
    }
    setIsTesting(prev => ({...prev, [profileId]: false}));
  };

  const handleSaveProfile = async (profileId, updatedProfile = null) => {
    const profileToSave = updatedProfile || profiles.find(p => p.id === profileId);
    if (!profileToSave) return;

    setIsSaving(prev => ({...prev, [profileId]: true}));
    const toastId = toast.loading(`正在保存配置 "${profileToSave.name}"...`);
    
    // 更新本地状态中的配置
    const updatedProfiles = profiles.map(p => 
      p.id === profileId ? profileToSave : p
    );
    
    const result = await window.api.saveProfiles({ 
      profiles: updatedProfiles, // 保存所有配置，而不是只保存单个配置
      activeProfileId: activeProfileId === profileId ? profileId : null 
    });

    if (result.success) {
      toast.success(`配置 "${profileToSave.name}" 已成功保存！`, { id: toastId });
      addNotification({ message: '配置已成功保存', type: 'success' });
      // 更新本地状态
      setProfiles(updatedProfiles);
      if (refreshState) {
        refreshState();
      }
    } else {
      toast.error(result.error || '保存失败，请检查配置并重试。', { id: toastId });
      addNotification({ message: '配置保存失败', type: 'error' });
    }
    setIsSaving(prev => ({...prev, [profileId]: false}));
  };
  


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profiles" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            存储配置
          </TabsTrigger>

          <TabsTrigger value="app" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            应用设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>存储服务配置</CardTitle>
              <CardDescription>
                管理您的云存储服务配置。支持多个配置文件，可随时切换活动配置。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 添加配置按钮 - 移到上面 */}
              <div className="flex justify-center mb-6">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      添加存储配置
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuItem onClick={() => handleAddProfile('r2')}>
                      <img src={CloudflareIcon} alt="Cloudflare R2" className="mr-2 h-4 w-4" />
                      <span>Cloudflare R2</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddProfile('oss')}>
                      <img src={AliyunIcon} alt="阿里云 OSS" className="mr-2 h-4 w-4" />
                      <span>阿里云 OSS</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddProfile('cos')}>
                      <img src={TencentIcon} alt="腾讯云 COS" className="mr-2 h-4 w-4" />
                      <span>腾讯云 COS</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddProfile('smms')}>
                      <img src={SmmsIcon} alt="SM.MS 图床" className="mr-2 h-4 w-4" />
                      <span>SM.MS 图床</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddProfile('lsky')}>
                      <img src={LskyIcon} alt="兰空图床" className="mr-2 h-4 w-4" />
                      <span>兰空图床</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddProfile('gitee')}>
                      <img src={GiteeIcon} alt="Gitee 仓库" className="mr-2 h-4 w-4" />
                      <span>Gitee 仓库</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddProfile('gcs')}>
                      <img src={GoogleCloudIcon} alt="Google Cloud" className="mr-2 h-4 w-4" />
                      <span>Google Cloud</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddProfile('obs')}>
                      <img src={HuaweiIcon} alt="华为云 OBS" className="mr-2 h-4 w-4" />
                      <span>华为云 OBS</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {profiles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">尚未配置任何存储服务</p>
                  <p className="text-sm mb-6">请添加一个存储配置以开始使用</p>
                </div>
              ) : (
                <RadioGroup value={activeProfileId} onValueChange={setActiveProfileId}>
                  <div className="space-y-4">
                    {profiles
                      .sort((a, b) => {
                        // 按创建时间排序，最新的在前面
                        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return timeB - timeA;
                      })
                      .map((profile) => (
                        <ProfileCard
                          key={profile.id}
                          profile={profile}
                          isActive={activeProfileId === profile.id}
                          onActivate={setActiveProfileId}
                          onChange={handleProfileChange}
                          onTest={handleTestConnection}
                          onRemove={handleRemoveProfile}
                          onSave={handleSaveProfile}
                          isTesting={isTesting[profile.id]}
                          isSaving={isSaving[profile.id]}
                        />
                      ))}
                  </div>
                </RadioGroup>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        

        <TabsContent value="app" className="mt-6">
          <AppSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}