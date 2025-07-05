import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Button } from "@/components/ui/Button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from 'sonner'
import { User, KeyRound, Container, Globe, Plug, Save, PlusCircle, Trash2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid';

export default function SettingsPage({ onSettingsSaved }) {
  const [baseSettings, setBaseSettings] = useState({ accountId: '', accessKeyId: '', secretAccessKey: '' });
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  
  const [isTesting, setIsTesting] = useState({}); // Track by profile id
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    const data = await window.api.getSettings();
    setBaseSettings(data.settings || { accountId: '', accessKeyId: '', secretAccessKey: '' });
    setProfiles(data.profiles || []);
    setActiveProfileId(data.activeProfileId || null);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleBaseSettingChange = (e) => {
    const { name, value } = e.target;
    setBaseSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileChange = (id, e) => {
    const { name, value } = e.target;
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, [name]: value } : p));
  };
  
  const handleAddProfile = () => {
    const newProfile = {
      id: uuidv4(),
      name: `新配置 ${profiles.length + 1}`,
      bucketName: '',
      publicDomain: '',
    };
    const newProfiles = [...profiles, newProfile];
    setProfiles(newProfiles);
    // If it's the first profile, make it active
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
    
    const result = await window.api.testR2Connection({ settings: baseSettings, profile: profileToTest });

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

    const basePromise = window.api.saveBaseSettings(baseSettings);
    const profilesPromise = window.api.saveProfiles({ profiles, activeProfileId });

    const [baseResult, profilesResult] = await Promise.all([basePromise, profilesPromise]);

    if (baseResult.success && profilesResult.success) {
      toast.success('所有设置已成功保存！', { id: toastId });
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } else {
      toast.error('保存失败，请检查配置并重试。', { id: toastId });
    }
    setIsSaving(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基础连接设置</CardTitle>
          <CardDescription>
            这些信息对于所有存储库配置都是通用的。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountId">账户 ID (Account ID)</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="accountId" name="accountId" value={baseSettings.accountId} onChange={handleBaseSettingChange} placeholder="您的 Cloudflare 账户 ID" required className="pl-10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessKeyId">访问密钥 ID (Access Key ID)</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="accessKeyId" name="accessKeyId" value={baseSettings.accessKeyId} onChange={handleBaseSettingChange} placeholder="您的 R2 访问密钥 ID" required className="pl-10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secretAccessKey">秘密访问密钥 (Secret Access Key)</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="secretAccessKey" name="secretAccessKey" type="password" value={baseSettings.secretAccessKey} onChange={handleBaseSettingChange} placeholder="您的 R2 秘密访问密钥" required className="pl-10" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>存储库配置</CardTitle>
          <CardDescription>
            管理您的不同 R2 存储桶。选择一个作为当前活动配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={activeProfileId} onValueChange={setActiveProfileId}>
            {profiles.map((profile) => (
              <div key={profile.id} className="p-4 border rounded-lg flex items-start gap-4">
                <div className="mt-1">
                   <RadioGroupItem value={profile.id} id={`r-${profile.id}`} />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${profile.id}`}>配置名称</Label>
                      <Input id={`name-${profile.id}`} name="name" value={profile.name} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="例如: '开发环境'"/>
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor={`bucketName-${profile.id}`}>存储桶名称</Label>
                       <Input id={`bucketName-${profile.id}`} name="bucketName" value={profile.bucketName} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="您的存储桶名称" />
                    </div>
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor={`publicDomain-${profile.id}`}>自定义域名 (可选)</Label>
                     <Input id={`publicDomain-${profile.id}`} name="publicDomain" value={profile.publicDomain} onChange={(e) => handleProfileChange(profile.id, e)} placeholder="例如: files.example.com"/>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button size="sm" type="button" variant="ghost" onClick={() => handleTestConnection(profile.id)} disabled={isTesting[profile.id] || isSaving}>
                      <Plug className="mr-2 h-4 w-4" />
                      {isTesting[profile.id] ? '测试中...' : '测试'}
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
          <Button type="button" variant="outline" onClick={handleAddProfile} className="mt-4 w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            添加新配置
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" type="button" onClick={handleSaveAll} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? '正在保存...' : '保存所有设置'}
        </Button>
      </div>
    </div>
  )
} 