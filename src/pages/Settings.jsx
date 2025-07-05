import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Button } from "@/components/ui/Button"
import { toast } from 'sonner'
import { User, KeyRound, Container, Globe, Plug, Save } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: '',
    publicDomain: ''
  })
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    window.api.getSettings().then(savedSettings => {
      if (savedSettings) {
        setSettings(current => ({ ...current, ...savedSettings }))
      }
    })
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setSettings(prev => ({ ...prev, [name]: value }))
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    const toastId = toast.loading('正在测试连接...')
    const result = await window.api.testConnection(settings)
    if (result.success) {
      toast.success(result.message, { id: toastId })
    } else {
      toast.error(result.error, { id: toastId })
    }
    setIsTesting(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    const toastId = toast.loading('正在保存设置...')
    const result = await window.api.saveSettings(settings)
    if (result.success) {
      toast.success('设置已成功保存！', { id: toastId })
    } else {
      toast.error('保存失败，请重试。', { id: toastId })
    }
    setIsSaving(false)
  }

  return (
    <div className="p-4 sm:p-6">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>R2 连接设置</CardTitle>
            <CardDescription>
              输入您的 Cloudflare R2 凭证、存储桶和公开域名信息。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountId">账户 ID (Account ID)</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="accountId" name="accountId" value={settings.accountId} onChange={handleChange} placeholder="您的 Cloudflare 账户 ID" required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessKeyId">访问密钥 ID (Access Key ID)</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="accessKeyId" name="accessKeyId" value={settings.accessKeyId} onChange={handleChange} placeholder="您的 R2 访问密钥 ID" required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretAccessKey">秘密访问密钥 (Secret Access Key)</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="secretAccessKey" name="secretAccessKey" type="password" value={settings.secretAccessKey} onChange={handleChange} placeholder="您的 R2 秘密访问密钥" required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bucketName">存储桶名称 (Bucket Name)</Label>
              <div className="relative">
                <Container className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="bucketName" name="bucketName" value={settings.bucketName} onChange={handleChange} placeholder="您要管理的存储桶名称" required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="publicDomain">自定义域名 (可选)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="publicDomain" name="publicDomain" value={settings.publicDomain || ''} onChange={handleChange} placeholder="例如: files.example.com" className="pl-10" />
              </div>
              <p className="text-sm text-muted-foreground">
                输入您绑定的域名，无需填写 https://。
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end items-center">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting || isSaving}>
                <Plug className="mr-2 h-4 w-4" />
                {isTesting ? '测试中...' : '测试连接'}
              </Button>
              <Button type="submit" disabled={isTesting || isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? '保存中...' : '保存设置'}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
} 