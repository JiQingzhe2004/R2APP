import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { toast } from 'sonner';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Star, 
  StarOff,
  Check,
  X,
  Settings,
  Eye,
  EyeOff,
  TestTube,
  MessageSquare,
  Wifi,
  AlertCircle,
  CheckCircle,
  XCircle,
  Globe
} from 'lucide-react';
import { AIConfigManager } from '@/services/ai/aiConfigManager';
import { AIConfig, AIProviderType, AIProviderInfo } from '@/services/ai/types';
import { AITestService } from '@/services/ai/aiTestService';
import AIIcon from './AIIcon';

/**
 * AI配置面板组件
 */
export default function AIConfigPanel() {
  const [configManager] = useState(() => new AIConfigManager());
  const [configs, setConfigs] = useState([]);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showApiKey, setShowApiKey] = useState({});
  const [testingConfigs, setTestingConfigs] = useState({});
  const [testResults, setTestResults] = useState({});
  const [showTestMessage, setShowTestMessage] = useState({});
  const [testMessage, setTestMessage] = useState('你好，这是一个测试消息');
  const [showProxyPassword, setShowProxyPassword] = useState({});

  // 加载配置列表
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = () => {
    const allConfigs = configManager.getAllConfigs();
    setConfigs(allConfigs);
  };

  // 开始添加配置
  const handleAddConfig = () => {
    const newConfig = new AIConfig({
      type: AIProviderType.OPENAI
    });
    setEditingConfig(newConfig);
    setIsAdding(true);
  };

  // 开始编辑配置
  const handleEditConfig = (config) => {
    setEditingConfig({ ...config });
    setIsAdding(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingConfig(null);
    setIsAdding(false);
  };

  // 保存配置
  const handleSaveConfig = () => {
    try {
      // 如果提供商使用固定URL，自动设置正确的基础URL
      if (editingConfig.type && AIProviderInfo[editingConfig.type]?.useFixedUrl) {
        editingConfig.baseUrl = AIProviderInfo[editingConfig.type].defaultBaseUrl;
      }

      // 创建AIConfig实例
      const configInstance = new AIConfig(editingConfig);

      if (isAdding) {
        configManager.addConfig(configInstance);
        toast.success('配置添加成功');
      } else {
        configManager.updateConfig(configInstance.id, configInstance);
        toast.success('配置更新成功');
      }
      loadConfigs();
    } catch (error) {
      console.error('保存配置失败:', error);
      toast.error(error.message);
    }
  };

  // 删除配置
  const handleDeleteConfig = (config) => {
    if (confirm(`确定要删除配置 "${config.name}" 吗？`)) {
      try {
        configManager.removeConfig(config.id);
        toast.success('配置删除成功');
        loadConfigs();
      } catch (error) {
        toast.error(error.message);
      }
    }
  };

  // 设置默认配置
  const handleSetDefault = (config) => {
    try {
      configManager.setDefaultConfig(config.id);
      toast.success('默认配置设置成功');
      loadConfigs();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // 复制配置
  const handleCopyConfig = (config) => {
    const copiedConfig = new AIConfig({
      ...config.toObject(),
      name: `${config.name} (副本)`,
      isDefault: false
    });
    copiedConfig.id = copiedConfig.generateId();
    
    try {
      configManager.addConfig(copiedConfig);
      toast.success('配置复制成功');
      loadConfigs();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // 切换配置启用状态
  const handleToggleEnabled = (config) => {
    try {
      configManager.setConfigEnabled(config.id, !config.enabled);
      toast.success(config.enabled ? '配置已禁用' : '配置已启用');
      loadConfigs();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // 切换API密钥显示
  const handleToggleApiKeyVisibility = (configId) => {
    setShowApiKey(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  // 切换代理密码显示
  const handleToggleProxyPasswordVisibility = (configId) => {
    setShowProxyPassword(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  // 测试连接
  const handleTestConnection = async (config) => {
    setTestingConfigs(prev => ({ ...prev, [config.id]: true }));
    setTestResults(prev => ({ ...prev, [config.id]: null }));

    try {
      const result = await AITestService.testConnection(config);

      setTestResults(prev => ({ ...prev, [config.id]: result }));

      if (result.success) {
        toast.success('连接测试成功！');
      } else {
        toast.error(`连接测试失败: ${result.message}`);
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      const errorResult = {
        success: false,
        message: `测试连接失败: ${error.message}`,
        details: error.toString()
      };
      setTestResults(prev => ({ ...prev, [config.id]: errorResult }));
      toast.error(`测试连接失败: ${error.message}`);
    } finally {
      setTestingConfigs(prev => ({ ...prev, [config.id]: false }));
    }
  };

  // 测试消息
  const handleTestMessage = async (config) => {
    setTestingConfigs(prev => ({ ...prev, [config.id]: true }));
    setTestResults(prev => ({ ...prev, [config.id]: null }));

    try {
      const result = await AITestService.sendTestMessage(config, testMessage);
      setTestResults(prev => ({ ...prev, [config.id]: result }));
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        details: error.stack
      };
      setTestResults(prev => ({ ...prev, [config.id]: errorResult }));
      toast.error(`测试失败: ${error.message}`);
    } finally {
      setTestingConfigs(prev => ({ ...prev, [config.id]: false }));
    }
  };

  // 切换测试消息显示
  const handleToggleTestMessage = (configId) => {
    setShowTestMessage(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  // 获取配置状态
  const getConfigStatus = (config) => {
    return AITestService.getConfigStatus(config);
  };

  // 处理表单字段变化
  const handleFieldChange = (field, value) => {
    setEditingConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 渲染配置表单
  const renderConfigForm = () => {
    if (!editingConfig) return null;

    const providerInfo = AIProviderInfo[editingConfig.type];

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {isAdding ? '添加AI配置' : '编辑AI配置'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 提供商类型选择 */}
          <div className="space-y-2">
            <Label htmlFor="provider-type">AI提供商</Label>
            <Select 
              value={editingConfig.type} 
              onValueChange={(value) => handleFieldChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AIProviderInfo).map(([type, info]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <AIIcon type={info.icon} className="h-4 w-4" />
                      <span>{info.displayName}</span>
                      {info.requiresProxy && (
                        <Badge variant="outline" className="text-xs text-orange-600">
                          需代理
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {providerInfo && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{providerInfo.description}</p>
                {providerInfo.requiresProxy && (
                  <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                    <Globe className="h-3 w-3" />
                    <span>此AI服务需要配置代理才能正常访问</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 配置名称 */}
          <div className="space-y-2">
            <Label htmlFor="config-name">配置名称</Label>
            <Input
              id="config-name"
              value={editingConfig.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="输入配置名称"
            />
          </div>

          {/* API密钥 */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API密钥</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type={showApiKey[editingConfig.id] ? 'text' : 'password'}
                value={editingConfig.apiKey}
                onChange={(e) => handleFieldChange('apiKey', e.target.value)}
                placeholder="输入API密钥"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleToggleApiKeyVisibility(editingConfig.id)}
              >
                {showApiKey[editingConfig.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 基础URL */}
          <div className="space-y-2">
            <Label htmlFor="base-url">基础URL</Label>
            {providerInfo?.useFixedUrl ? (
              <div className="flex items-center gap-2">
                <Input
                  id="base-url"
                  value={providerInfo.defaultBaseUrl}
                  disabled
                  className="flex-1 bg-muted"
                />
                <Badge variant="outline" className="text-xs">
                  固定URL
                </Badge>
              </div>
            ) : (
              <Input
                id="base-url"
                value={editingConfig.baseUrl}
                onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
                placeholder="输入API基础URL"
              />
            )}
            {providerInfo?.useFixedUrl && (
              <p className="text-xs text-muted-foreground">
                此提供商使用固定的API端点，无需修改
              </p>
            )}
          </div>

          {/* 模型选择 */}
          <div className="space-y-2">
            <Label htmlFor="model">模型</Label>
            <Select 
              value={editingConfig.model} 
              onValueChange={(value) => handleFieldChange('model', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {providerInfo?.models.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 代理配置 */}
          {providerInfo?.requiresProxy && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">代理配置</span>
                <Badge variant="outline" className="text-xs text-orange-600">
                  需要代理访问
                </Badge>
              </div>
              
              <div className="space-y-3">
                {/* 代理开关 */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-proxy"
                    checked={editingConfig.useProxy}
                    onCheckedChange={(checked) => handleFieldChange('useProxy', checked)}
                  />
                  <Label htmlFor="use-proxy" className="text-sm">启用代理</Label>
                </div>

                {/* 代理配置字段 */}
                {editingConfig.useProxy && (
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    {/* 代理协议 */}
                    <div className="space-y-2">
                      <Label htmlFor="proxy-protocol" className="text-xs">代理协议</Label>
                      <Select 
                        value={editingConfig.proxyProtocol} 
                        onValueChange={(value) => handleFieldChange('proxyProtocol', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="http">HTTP</SelectItem>
                          <SelectItem value="https">HTTPS</SelectItem>
                          <SelectItem value="socks5">SOCKS5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 代理服务器地址和端口 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="proxy-host" className="text-xs">代理服务器地址</Label>
                        <Input
                          id="proxy-host"
                          value={editingConfig.proxyHost}
                          onChange={(e) => handleFieldChange('proxyHost', e.target.value)}
                          placeholder="127.0.0.1"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proxy-port" className="text-xs">端口</Label>
                        <Input
                          id="proxy-port"
                          type="number"
                          min="1"
                          max="65535"
                          value={editingConfig.proxyPort}
                          onChange={(e) => handleFieldChange('proxyPort', e.target.value)}
                          placeholder="7890"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* 代理认证（可选） */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="proxy-username" className="text-xs">用户名（可选）</Label>
                        <Input
                          id="proxy-username"
                          value={editingConfig.proxyUsername}
                          onChange={(e) => handleFieldChange('proxyUsername', e.target.value)}
                          placeholder="代理用户名"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proxy-password" className="text-xs">密码（可选）</Label>
                        <div className="flex gap-2">
                          <Input
                            id="proxy-password"
                            type={showProxyPassword[editingConfig.id] ? 'text' : 'password'}
                            value={editingConfig.proxyPassword}
                            onChange={(e) => handleFieldChange('proxyPassword', e.target.value)}
                            placeholder="代理密码"
                            className="flex-1 h-8 text-sm"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleProxyPasswordVisibility(editingConfig.id)}
                          >
                            {showProxyPassword[editingConfig.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* 代理配置提示 */}
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <p className="font-medium mb-1">代理配置说明：</p>
                      <p>• 常见代理端口：HTTP代理(8080)、Clash(7890)、V2Ray(10808)</p>
                      <p>• 如果代理需要认证，请填写用户名和密码</p>
                      <p>• 确保代理服务器能够访问对应的AI服务</p>
                      <p className="mt-1 text-orange-600">注意：浏览器环境下的代理通常需要系统级配置，请确保系统代理设置正确</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 高级参数 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temperature">温度 (Temperature)</Label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={editingConfig.temperature}
                onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
                placeholder="0.7"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-tokens">最大Token数</Label>
              <Input
                id="max-tokens"
                type="number"
                min="1"
                max="4000"
                value={editingConfig.maxTokens}
                onChange={(e) => handleFieldChange('maxTokens', parseInt(e.target.value))}
                placeholder="1000"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSaveConfig} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              保存配置
            </Button>
            <Button variant="outline" onClick={handleCancelEdit} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
          </div>

          {/* 测试功能 */}
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <TestTube className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">测试配置</span>
            </div>
            
            {/* 配置状态 */}
            <div className="mb-3">
              {(() => {
                const status = getConfigStatus(editingConfig);
                return (
                  <div className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                    status.valid 
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                      : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}>
                    {status.valid ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span>{status.message}</span>
                  </div>
                );
              })()}
            </div>

            {/* 测试按钮 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection(editingConfig)}
                disabled={testingConfigs[editingConfig.id] || !editingConfig.apiKey || !editingConfig.baseUrl}
                className="flex-1"
              >
                <Wifi className="h-4 w-4 mr-2" />
                {testingConfigs[editingConfig.id] ? '测试中...' : '测试连接'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestMessage(editingConfig)}
                disabled={testingConfigs[editingConfig.id] || !editingConfig.apiKey || !editingConfig.baseUrl || !editingConfig.model}
                className="flex-1"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {testingConfigs[editingConfig.id] ? '测试中...' : '测试消息'}
              </Button>
            </div>

            {/* 测试消息输入 */}
            <div className="space-y-2">
              <Label htmlFor="test-message" className="text-xs">测试消息</Label>
              <Input
                id="test-message"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="输入要发送的测试消息"
                className="text-sm"
              />
            </div>

            {/* 测试结果 */}
            {testResults[editingConfig.id] && (
              <div className="mt-3 p-3 rounded-md border bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  {testResults[editingConfig.id].success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">
                    {testResults[editingConfig.id].success ? '测试成功' : '测试失败'}
                  </span>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {testResults[editingConfig.id].message || testResults[editingConfig.id].error}
                </p>

                {testResults[editingConfig.id].data && (
                  <div className="text-xs text-muted-foreground">
                    {testResults[editingConfig.id].data.models && (
                      <div>可用模型: {testResults[editingConfig.id].data.models.join(', ')}</div>
                    )}
                    {testResults[editingConfig.id].data.response && (
                      <div>响应: {testResults[editingConfig.id].data.response}</div>
                    )}
                    {testResults[editingConfig.id].data.usage && (
                      <div>Token使用: {testResults[editingConfig.id].data.usage.total_tokens || 'N/A'}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // 渲染配置列表
  const renderConfigList = () => {
    if (configs.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">尚未配置AI服务</h3>
          <p className="mb-6">请添加一个AI配置以开始使用</p>
          <Button onClick={handleAddConfig}>
            <Plus className="h-4 w-4 mr-2" />
            添加AI配置
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {configs.map(config => {
          const providerInfo = AIProviderInfo[config.type];
          return (
            <Card key={config.id} className={`transition-all ${config.isDefault ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <AIIcon type={providerInfo?.icon} className="h-6 w-6" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{config.name}</h3>
                          {config.isDefault && (
                            <Badge variant="default" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              默认
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {providerInfo?.displayName}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          模型: {config.model} | URL: {providerInfo?.useFixedUrl ? '固定URL' : config.baseUrl}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditConfig(config)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestConnection(config)}
                      disabled={testingConfigs[config.id]}
                    >
                      <Wifi className="h-4 w-4 mr-2" />
                      {testingConfigs[config.id] ? '测试中...' : '测试'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyConfig(config)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      复制
                    </Button>
                    {!config.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefault(config)}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        设为默认
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteConfig(config)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`enabled-${config.id}`}
                      checked={config.enabled}
                      onCheckedChange={() => handleToggleEnabled(config)}
                    />
                    <Label htmlFor={`enabled-${config.id}`}>
                      {config.enabled ? '已启用' : '已禁用'}
                    </Label>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    创建时间: {new Date(config.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* 测试结果 */}
                {testResults[config.id] && (
                  <div className="mt-3 p-2 rounded-md border bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      {testResults[config.id].success ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-600" />
                      )}
                      <span className="text-xs font-medium">
                        {testResults[config.id].success ? '测试成功' : '测试失败'}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {testResults[config.id].message || testResults[config.id].error}
                    </p>

                    {testResults[config.id].data && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {testResults[config.id].data.models && (
                          <div>可用模型: {testResults[config.id].data.models.join(', ')}</div>
                        )}
                        {testResults[config.id].data.response && (
                          <div>响应: {testResults[config.id].data.response}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI配置管理</h2>
          <p className="text-muted-foreground">
            管理您的AI服务配置，支持多种AI提供商
          </p>
        </div>
        <Button onClick={handleAddConfig}>
          <Plus className="h-4 w-4 mr-2" />
          添加AI配置
        </Button>
      </div>

      {/* 配置表单 */}
      {renderConfigForm()}

      {/* 配置列表 */}
      {renderConfigList()}
    </div>
  );
}
