import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { useTheme } from '@/components/theme-provider';
import { toast } from 'sonner';

export default function AppSettings() {
  const { theme, setTheme } = useTheme();
  const [openBehavior, setOpenBehavior] = useState('preview');
  const [closeAction, setCloseAction] = useState('minimize-to-tray');

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
            <div className="flex gap-2">
              <Button size="sm" variant={theme==='light' ? 'default' : 'outline'} onClick={() => setTheme('light')}>浅色</Button>
              <Button size="sm" variant={theme==='dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}>深色</Button>
              <Button size="sm" variant={theme==='system' ? 'default' : 'outline'} onClick={() => setTheme('system')}>跟随系统</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>关闭按钮行为</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={closeAction==='minimize-to-tray' ? 'default' : 'outline'} onClick={() => saveCloseAction('minimize-to-tray')}>最小化到托盘</Button>
              <Button size="sm" variant={closeAction==='exit' ? 'default' : 'outline'} onClick={() => saveCloseAction('exit')}>直接退出</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pref-open-preview">单击文件行为</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={openBehavior==='preview' ? 'default' : 'outline'} onClick={() => saveOpenBehavior('preview')}>预览</Button>
              <Button size="sm" variant={openBehavior==='download' ? 'default' : 'outline'} onClick={() => saveOpenBehavior('download')}>直接下载</Button>
            </div>
          </div>
        </div>

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
          <div className="text-xs text-muted-foreground">仅支持 Windows。注册后，可在资源管理器右键文件直接“上传到 R2 存储桶”。</div>
        </div>
      </CardContent>
    </Card>
  );
}

