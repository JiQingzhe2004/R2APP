import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/components/theme-provider';
import { toast } from 'sonner';

export default function AppSettings() {
  const { theme, setTheme } = useTheme();
  const [openBehavior, setOpenBehavior] = useState('preview');
  const [closeAction, setCloseAction] = useState('minimize-to-tray');
  const [trayIcon, setTrayIcon] = useState('');
  const [trayIconChoice, setTrayIconChoice] = useState('default');

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

