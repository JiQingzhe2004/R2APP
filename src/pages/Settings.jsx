import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Button } from "@/components/ui/Button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from 'sonner'
import { useNotifications } from '@/contexts/NotificationContext';
import { User, KeyRound, Container, Globe, Plug, Save, PlusCircle, Trash2, Cloud, Server, Settings as SettingsIcon } from 'lucide-react'
import AppSettings from './AppSettings';
import { v4 as uuidv4 } from 'uuid';
import { useOutletContext } from 'react-router-dom';

const R2_TEMPLATE = {
  type: 'r2',
  name: '新 R2 配置',
  accountId: '',
  accessKeyId: '',
  secretAccessKey: '',
  bucketName: '',
  publicDomain: '',
  storageQuotaGB: 10,
};

const OSS_TEMPLATE = {
  type: 'oss',
  name: '新 OSS 配置',
  accessKeyId: '',
  accessKeySecret: '',
  region: '',
  bucket: '',
  endpoint: '',
  publicDomain: '',
  storageQuotaGB: 10,
};

const ProfileForm = ({ profile, onSave, onRemove, onTest }) => {
  const [formData, setFormData] = useState(profile);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`accountId-${profile.id}`}>账户 ID (Account ID)</Label>
          <Input id={`accountId-${profile.id}`} name="accountId" value={formData.accountId} onChange={handleChange} placeholder="您的 Cloudflare 账户 ID" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`bucketName-${profile.id}`}>存储桶名称</Label>
          <Input id={`bucketName-${profile.id}`} name="bucketName" value={formData.bucketName} onChange={handleChange} placeholder="您的 R2 存储桶名称" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`accessKeyId-${profile.id}`}>访问密钥 ID</Label>
          <Input id={`accessKeyId-${profile.id}`} name="accessKeyId" value={formData.accessKeyId} onChange={handleChange} placeholder="您的 R2 访问密钥 ID" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`secretAccessKey-${profile.id}`}>秘密访问密钥</Label>
          <Input id={`secretAccessKey-${profile.id}`} name="secretAccessKey" type="password" value={formData.secretAccessKey} onChange={handleChange} placeholder="您的 R2 秘密访问密钥" />
        </div>
      </div>
    </>
  );
};

export default function SettingsPage() {
  const { refreshState } = useOutletContext();
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const { addNotification } = useNotifications();
  
  const [isTesting, setIsTesting] = useState({}); // Track by profile id
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profiles'); // profiles | app

  const fetchSettings = useCallback(async () => {
    // This will need to be adjusted once the main process is updated
    const data = await window.api.getSettings();
    if (data.profiles && data.profiles.length > 0 && data.profiles[0].type) {
       // New structure already in place
       setProfiles(data.profiles || []);
    } else {
      // Temporary migration logic for old structure.
      // This helps with transitioning without losing old settings.
      console.log("旧数据结构，将进行迁移...");
      const migratedProfiles = (data.profiles || []).map(p => ({
        ...R2_TEMPLATE,
        id: p.id || uuidv4(),
        name: p.name,
        bucketName: p.bucketName,
        publicDomain: p.publicDomain,
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
  }, [fetchSettings]);

  const handleProfileChange = (id, e) => {
    const { name, value } = e.target;
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, [name]: value } : p));
  };
  
  const handleAddProfile = (type) => {
    const newProfile = {
      id: uuidv4(),
      ...(type === 'r2' ? R2_TEMPLATE : OSS_TEMPLATE),
      name: `新${type.toUpperCase()}配置 ${profiles.filter(p=>p.type === type).length + 1}`,
    };
    const newProfiles = [...profiles, newProfile];
    setProfiles(newProfiles);
    if (newProfiles.length === 1) {
      setActiveProfileId(newProfile.id);
    }
  };

  const handleRemoveProfile = (id) => {
    const newProfiles = profiles.filter(p => p.id !== id);
    setProfiles(newProfiles);
    if (activeProfileId === id) {
      setActiveProfileId(newProfiles.length > 0 ? newProfiles[0].id : null);
    }
  };

  const handleTestConnection = async (profileId) => {
    const profileToTest = profiles.find(p => p.id === profileId);
    if (!profileToTest) return;

    setIsTesting(prev => ({...prev, [profileId]: true}));
    const toastId = toast.loading(`正在测试配置 "${profileToTest.name}"...`);
    
    // The IPC handler 'test-connection' will need to be implemented in the backend
    const result = await window.api.testConnection(profileToTest);

    if (result.success) {
      toast.success(result.message, { id: toastId });
    } else {
      toast.error(result.error, { id: toastId });
    }
    setIsTesting(prev => ({...prev, [profileId]: false}));
  };
  
  const handleSaveAll = async () => {
    setIsSaving(true);
    const toastId = toast.loading('正在保存所有设置...');

    // This IPC handler will replace the separate save handlers
    const result = await window.api.saveProfiles({ profiles, activeProfileId });

    if (result.success) {
      toast.success('所有设置已成功保存！', { id: toastId });
      addNotification({ message: '设置已成功保存', type: 'success' });
      await fetchSettings();
      if (refreshState) {
        refreshState();
      }
    } else {
      toast.error(result.error || '保存失败，请检查配置并重试。', { id: toastId });
      addNotification({ message: '设置保存失败', type: 'error' });
    }
    setIsSaving(false);
  };

  const renderProfileForm = (profile) => {
    if (profile.type === 'r2') {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`accountId-${profile.id}`}>账户 ID (Account ID)</Label>
              <Input id={`accountId-${profile.id}`} name="accountId" value={profile.accountId} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="您的 Cloudflare 账户 ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`bucketName-${profile.id}`}>存储桶名称</Label>
              <Input id={`bucketName-${profile.id}`} name="bucketName" value={profile.bucketName} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="您的 R2 存储桶名称" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`accessKeyId-${profile.id}`}>访问密钥 ID</Label>
              <Input id={`accessKeyId-${profile.id}`} name="accessKeyId" value={profile.accessKeyId} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="您的 R2 访问密钥 ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`secretAccessKey-${profile.id}`}>秘密访问密钥</Label>
              <Input id={`secretAccessKey-${profile.id}`} name="secretAccessKey" type="password" value={profile.secretAccessKey} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="您的 R2 秘密访问密钥" />
            </div>
          </div>
        </>
      );
    }

    if (profile.type === 'oss') {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`accessKeyId-${profile.id}`}>AccessKey ID</Label>
              <Input id={`accessKeyId-${profile.id}`} name="accessKeyId" value={profile.accessKeyId} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="您的 OSS AccessKey ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`accessKeySecret-${profile.id}`}>AccessKey Secret</Label>
              <Input id={`accessKeySecret-${profile.id}`} name="accessKeySecret" type="password" value={profile.accessKeySecret} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="您的 OSS AccessKey Secret" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor={`bucket-${profile.id}`}>存储空间名称 (Bucket)</Label>
              <Input id={`bucket-${profile.id}`} name="bucket" value={profile.bucket} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="您的 OSS 存储空间名称" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`region-${profile.id}`}>地域 (Region)</Label>
              <Input id={`region-${profile.id}`} name="region" value={profile.region} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="例如: oss-cn-hangzhou" />
            </div>
          </div>
        </>
      )
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant={activeTab === 'profiles' ? 'default' : 'outline'} onClick={() => setActiveTab('profiles')}>
          <Cloud className="mr-2 h-4 w-4" /> 桶配置
        </Button>
        <Button variant={activeTab === 'app' ? 'default' : 'outline'} onClick={() => setActiveTab('app')}>
          <SettingsIcon className="mr-2 h-4 w-4" /> 应用设置
        </Button>
      </div>

      {activeTab === 'profiles' && (
      <Card>
        <CardHeader>
          <CardTitle>存储库配置</CardTitle>
          <CardDescription>
            管理您的 R2 或 OSS 存储配置。选择一个作为当前活动配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={activeProfileId} onValueChange={setActiveProfileId} className="space-y-4">
            {profiles.map((profile) => (
              <div key={profile.id} className="p-4 border rounded-lg flex items-start gap-4 transition-all">
                <div className="mt-1">
                   <RadioGroupItem value={profile.id} id={`r-${profile.id}`} />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <span className={`text-xs font-bold py-1 px-2.5 rounded-full ${profile.type === 'r2' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                        {profile.type.toUpperCase()}
                      </span>
                      <Input 
                        id={`name-${profile.id}`} 
                        name="name" 
                        value={profile.name} 
                        onChange={(e) => handleProfileChange(profile.id, e)} 
                        placeholder="配置名称"
                        className="text-lg font-semibold border-none shadow-none p-0 focus-visible:ring-0 w-auto"
                      />
                    </div>
                  </div>

                  {renderProfileForm(profile)}
                  
                   <div className="space-y-2">
                    <Label htmlFor={`publicDomain-${profile.id}`}>自定义域名 (可选)</Label>
                     <Input id={`publicDomain-${profile.id}`} name="publicDomain" value={profile.publicDomain} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="例如: files.example.com"/>
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor={`storageQuotaGB-${profile.id}`}>存储配额 (GB)</Label>
                    <Input 
                      id={`storageQuotaGB-${profile.id}`} 
                      name="storageQuotaGB" 
                      type="number"
                      value={profile.storageQuotaGB || ''} 
                      onChange={(e) => handleProfileChange(profile.id, e)} 
                      placeholder="默认: 10"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                    <Button size="sm" type="button" variant="ghost" onClick={() => handleTestConnection(profile.id)} disabled={isTesting[profile.id] || isSaving}>
                      <Plug className="mr-2 h-4 w-4" />
                      {isTesting[profile.id] ? '测试中...' : '测试连接'}
                    </Button>
                     <Button size="sm" type="button" variant="destructive" onClick={() => handleRemoveProfile(profile.id)} disabled={isSaving}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => handleAddProfile('r2')} className="flex-1">
              <Cloud className="mr-2 h-4 w-4" />
              添加 R2 配置
            </Button>
            <Button type="button" variant="outline" onClick={() => handleAddProfile('oss')} className="flex-1">
              <Server className="mr-2 h-4 w-4" />
              添加 OSS 配置
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {activeTab === 'app' && (
        <AppSettings />
      )}

      <div className="flex justify-end">
        <Button size="lg" type="button" onClick={handleSaveAll} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? '正在保存...' : '保存所有设置'}
        </Button>
      </div>
    </div>
  )
} 