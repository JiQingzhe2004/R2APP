import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { useTheme } from '@/components/theme-provider';

export default function AppSettings() {
  const { theme, setTheme } = useTheme();
  const [openBehavior, setOpenBehavior] = useState('preview');

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
            <Label htmlFor="pref-open-preview">单击文件行为</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={openBehavior==='preview' ? 'default' : 'outline'} onClick={() => saveOpenBehavior('preview')}>预览</Button>
              <Button size="sm" variant={openBehavior==='download' ? 'default' : 'outline'} onClick={() => saveOpenBehavior('download')}>直接下载</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

