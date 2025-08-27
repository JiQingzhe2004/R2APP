import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/components/theme-provider';
import { toast } from 'sonner';
import { User, Upload, X } from 'lucide-react';

export default function AppSettings() {
  const { theme, setTheme } = useTheme();
  const [openBehavior, setOpenBehavior] = useState('preview');
  const [closeAction, setCloseAction] = useState('minimize-to-tray');
  const [trayIcon, setTrayIcon] = useState('');
  const [trayIconChoice, setTrayIconChoice] = useState('default');
  const [userAvatar, setUserAvatar] = useState('');
  const [userAvatarType, setUserAvatarType] = useState('default');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await window.api.getSetting('open-behavior');
        const value = (result && result.success && result.value) ? result.value : 'preview';
        if (mounted) setOpenBehavior(value);
        // Persist default if missing
        if (!result || !result.value) {
          await window.api.setSetting('open-behavior', 'preview');
        }

        const closeRes = await window.api.getSetting('close-action');
        const closeVal = (closeRes && closeRes.success && closeRes.value) ? closeRes.value : 'minimize-to-tray';
        if (mounted) setCloseAction(closeVal);
        if (!closeRes || !closeRes.value) {
          await window.api.setSetting('close-action', 'minimize-to-tray');
        }

        const trayChoiceRes = await window.api.getSetting('tray-icon-choice');
        if (mounted && trayChoiceRes && trayChoiceRes.success && trayChoiceRes.value) {
          setTrayIconChoice(trayChoiceRes.value);
        }

        const avatarRes = await window.api.getSetting('user-avatar');
        if (mounted && avatarRes && avatarRes.success && avatarRes.value) {
          setUserAvatar(avatarRes.value);
        }

        const avatarTypeRes = await window.api.getSetting('user-avatar-type');
        if (mounted && avatarTypeRes && avatarTypeRes.success && avatarTypeRes.value) {
          setUserAvatarType(avatarTypeRes.value);
        }
      } catch {
        // fall back silently
      }
    })();
    return () => { mounted = false; };
  }, []);

  const saveOpenBehavior = (behavior) => {
    try {
      window.api.setSetting('open-behavior', behavior);
      setOpenBehavior(behavior);
    } catch {}
  };

  const saveCloseAction = (value) => {
    try {
      window.api.setSetting('close-action', value);
      setCloseAction(value);
    } catch {}
  };

  const resetTrayIcon = async () => {
    try {
      await window.api.setSetting('tray-icon-choice', 'default');
      setTrayIconChoice('default');
      toast.success('已切换为默认原生图标');
    } catch {}
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target.result;
          await window.api.setSetting('user-avatar', base64);
          await window.api.setSetting('user-avatar-type', 'custom');
          setUserAvatar(base64);
          setUserAvatarType('custom');
          toast.success('头像上传成功');
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast.error('头像上传失败');
      }
    }
  };

  const resetAvatar = async () => {
    try {
      await window.api.setSetting('user-avatar', '');
      await window.api.setSetting('user-avatar-type', 'default');
      setUserAvatar('');
      setUserAvatarType('default');
      toast.success('已重置为默认头像');
    } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>应用设置</CardTitle>
        <CardDescription>配置应用相关的偏好与行为。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pref-theme">首选主题</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue placeholder="选择主题" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">浅色</SelectItem>
                <SelectItem value="dark">深色</SelectItem>
                <SelectItem value="system">跟随系统</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>关闭按钮行为</Label>
            <Select value={closeAction} onValueChange={saveCloseAction}>
              <SelectTrigger>
                <SelectValue placeholder="选择关闭行为" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimize-to-tray">最小化到托盘</SelectItem>
                <SelectItem value="exit">直接退出</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pref-open-preview">单击文件行为</Label>
            <Select value={openBehavior} onValueChange={saveOpenBehavior}>
              <SelectTrigger>
                <SelectValue placeholder="选择文件行为" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preview">预览</SelectItem>
                <SelectItem value="download">直接下载</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>托盘图标</Label>
            <Select value={trayIconChoice} onValueChange={async (value) => { 
              await window.api.setSetting('tray-icon-choice', value); 
              setTrayIconChoice(value); 
            }}>
              <SelectTrigger>
                <SelectValue placeholder="选择托盘图标" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认原生</SelectItem>
                <SelectItem value="light">浅色图标</SelectItem>
                <SelectItem value="dark">深色图标</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">选择托盘图标：默认为彩色图标，可根据喜好&系统颜色选择！😁</div>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-border my-6"></div>

        <div className="space-y-2">
          <Label>用户头像（AI对话界面）</Label>
          <div className="flex items-center gap-3">
            {/* 头像预览 */}
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
              {userAvatarType === 'custom' && userAvatar ? (
                <img src={userAvatar} alt="用户头像" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            
            {/* 上传按钮 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('avatar-upload').click()}
              >
                <Upload className="w-4 h-4 mr-1" />
                上传头像
              </Button>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              {userAvatarType === 'custom' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAvatar}
                >
                  <X className="w-4 h-4 mr-1" />
                  重置
                </Button>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">支持 JPG、PNG、GIF 格式，建议尺寸 128x128 像素</div>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-border my-6"></div>

        <div className="space-y-2">
          <Label>Windows 资源管理器右键上传</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={async () => {
              const r = await window.api.registerShellUploadMenu();
              if (r && r.success) {
                toast.success('右键上传菜单已注册');
              } else {
                toast.error(`注册失败：${r?.error || '未知错误'}`);
              }
            }}>注册右键菜单</Button>
            <Button size="sm" variant="outline" onClick={async () => {
              const r = await window.api.unregisterShellUploadMenu();
              if (r && r.success) {
                toast.success('右键上传菜单已移除');
              } else {
                toast.error(`移除失败：${r?.error || '未知错误'}`);
              }
            }}>移除右键菜单</Button>
          </div>
          <div className="text-xs text-muted-foreground">仅支持 Windows。注册后，可在资源管理器右键文件直接"上传到 CS-Explorer"。</div>
        </div>
      </CardContent>
    </Card>
  );
}

