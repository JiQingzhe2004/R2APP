import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/components/theme-provider';
import { toast } from 'sonner';
import { User, Upload, X, Database, Trash2, Download, RefreshCw, ChevronsUpDown } from 'lucide-react';
import DownloadSettings from '@/components/DownloadSettings';
import { MorphingMenu } from "@/components/ui/morphing-menu"
import { cn } from '@/lib/utils'


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
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>应用设置</CardTitle>
        <CardDescription>配置应用相关的偏好与行为。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pref-theme">首选主题</Label>
            <MorphingMenu
              className="w-full h-10 z-30"
              triggerClassName="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground"
              direction="top-left"
              collapsedRadius="20px"
              expandedRadius="20px"
              expandedWidth={300}
              trigger={
                <div className="flex w-full items-center justify-between px-3 text-sm font-medium">
                  <span className="truncate">
                    {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
                </div>
              }
            >
              <div className="flex flex-col p-2 gap-1">
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  选择主题
                </div>
                <div className="h-px bg-border mx-2 my-1" />
                {[
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                  { value: 'system', label: '跟随系统' }
                ].map(item => (
                  <div
                    key={item.value}
                    onClick={() => setTheme(item.value)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      theme === item.value && "bg-accent"
                    )}
                  >
                    {theme === item.value && (
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                    )}
                    <span className={cn("ml-6", theme !== item.value && "ml-6")}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </MorphingMenu>
          </div>
          <div className="space-y-2">
            <Label>关闭按钮行为</Label>
            <MorphingMenu
              className="w-full h-10 z-20"
              triggerClassName="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground"
              direction="top-left"
              collapsedRadius="20px"
              expandedRadius="20px"
              expandedWidth={300}
              trigger={
                <div className="flex w-full items-center justify-between px-3 text-sm font-medium">
                  <span className="truncate">
                    {closeAction === 'minimize-to-tray' ? '最小化到托盘' : '直接退出'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
                </div>
              }
            >
              <div className="flex flex-col p-2 gap-1">
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  选择关闭行为
                </div>
                <div className="h-px bg-border mx-2 my-1" />
                {[
                  { value: 'minimize-to-tray', label: '最小化到托盘' },
                  { value: 'exit', label: '直接退出' }
                ].map(item => (
                  <div
                    key={item.value}
                    onClick={() => saveCloseAction(item.value)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      closeAction === item.value && "bg-accent"
                    )}
                  >
                    {closeAction === item.value && (
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                    )}
                    <span className={cn("ml-6", closeAction !== item.value && "ml-6")}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </MorphingMenu>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pref-open-preview">单击文件行为</Label>
            <MorphingMenu
              className="w-full h-10 z-10"
              triggerClassName="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground"
              direction="top-left"
              collapsedRadius="20px"
              expandedRadius="20px"
              expandedWidth={300}
              trigger={
                <div className="flex w-full items-center justify-between px-3 text-sm font-medium">
                  <span className="truncate">
                    {openBehavior === 'preview' ? '预览' : '直接下载'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
                </div>
              }
            >
              <div className="flex flex-col p-2 gap-1">
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  选择文件行为
                </div>
                <div className="h-px bg-border mx-2 my-1" />
                {[
                  { value: 'preview', label: '预览' },
                  { value: 'download', label: '直接下载' }
                ].map(item => (
                  <div
                    key={item.value}
                    onClick={() => saveOpenBehavior(item.value)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      openBehavior === item.value && "bg-accent"
                    )}
                  >
                    {openBehavior === item.value && (
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                    )}
                    <span className={cn("ml-6", openBehavior !== item.value && "ml-6")}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </MorphingMenu>
          </div>
          <div className="space-y-2">
            <Label>托盘图标</Label>
            <MorphingMenu
              className="w-full h-10 z-0"
              triggerClassName="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground"
              direction="top-left"
              collapsedRadius="20px"
              expandedRadius="20px"
              expandedWidth={300}
              trigger={
                <div className="flex w-full items-center justify-between px-3 text-sm font-medium">
                  <span className="truncate">
                    {trayIconChoice === 'default' ? '默认原生' : trayIconChoice === 'light' ? '浅色图标' : '深色图标'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
                </div>
              }
            >
              <div className="flex flex-col p-2 gap-1">
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  选择托盘图标
                </div>
                <div className="h-px bg-border mx-2 my-1" />
                {[
                  { value: 'default', label: '默认原生' },
                  { value: 'light', label: '浅色图标' },
                  { value: 'dark', label: '深色图标' }
                ].map(item => (
                  <div
                    key={item.value}
                    onClick={async () => {
                      await window.api.setSetting('tray-icon-choice', item.value);
                      setTrayIconChoice(item.value);
                    }}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      trayIconChoice === item.value && "bg-accent"
                    )}
                  >
                    {trayIconChoice === item.value && (
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                    )}
                    <span className={cn("ml-6", trayIconChoice !== item.value && "ml-6")}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </MorphingMenu>
            <div className="text-xs text-muted-foreground">选择托盘图标：默认为彩色图标，可根据喜好&系统颜色选择！😁</div>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-border my-6"></div>

        {/* 下载设置 */}
        <DownloadSettings />

        {/* 分隔线 */}
        <div className="border-t border-border my-6"></div>

        <div className="space-y-2">
            <Label>Windows 资源管理器右键上传</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={async () => {
                const r = await window.api.registerShellUploadMenu();
                if (r && r.success) {
                  toast.success('右键上传菜单已注册');
                } else {
                  toast.error(`注册失败：${r?.error || '未知错误'}`);
                }
              }}>注册右键菜单</Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={async () => {
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

