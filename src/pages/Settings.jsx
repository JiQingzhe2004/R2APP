import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Button } from "@/components/ui/Button"

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: '',
    publicDomain: ''
  })
  const [statusMessage, setStatusMessage] = useState('')
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
    setStatusMessage('正在测试连接...')
    const result = await window.api.testConnection(settings)
    setStatusMessage(result.success ? result.message : result.error)
    setIsTesting(false)
    setTimeout(() => setStatusMessage(''), 5000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setStatusMessage('正在保存...')
    const result = await window.api.saveSettings(settings)
    setStatusMessage(result.success ? '设置已成功保存！' : '保存失败，请重试。')
    setIsSaving(false)
    setTimeout(() => setStatusMessage(''), 3000)
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
              <Input id="accountId" name="accountId" value={settings.accountId} onChange={handleChange} placeholder="您的 Cloudflare 账户 ID" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessKeyId">访问密钥 ID (Access Key ID)</Label>
              <Input id="accessKeyId" name="accessKeyId" value={settings.accessKeyId} onChange={handleChange} placeholder="您的 R2 访问密钥 ID" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretAccessKey">秘密访问密钥 (Secret Access Key)</Label>
              <Input id="secretAccessKey" name="secretAccessKey" type="password" value={settings.secretAccessKey} onChange={handleChange} placeholder="您的 R2 秘密访问密钥" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bucketName">存储桶名称 (Bucket Name)</Label>
              <Input id="bucketName" name="bucketName" value={settings.bucketName} onChange={handleChange} placeholder="您要管理的存储桶名称" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publicDomain">自定义域名 (可选)</Label>
              <Input id="publicDomain" name="publicDomain" value={settings.publicDomain || ''} onChange={handleChange} placeholder="例如: https://files.example.com" />
              <p className="text-sm text-muted-foreground">
                如果已为您的存储桶配置了公开访问的自定义域名，请在此处输入。
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground min-h-[20px]">{statusMessage}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting || isSaving}>
                {isTesting ? '测试中...' : '测试连接'}
              </Button>
              <Button type="submit" disabled={isTesting || isSaving}>
                {isSaving ? '保存中...' : '保存设置'}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
} 