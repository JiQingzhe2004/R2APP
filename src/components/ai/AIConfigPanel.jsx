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
  const [editingConfigId, setEditingConfigId] = useState(null);
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
    setIsAdding(true);
    setEditingConfigId(null);
  };

  // 开始编辑配置
  const handleEditConfig = (config) => {
    setEditingConfigId(config.id);
    setIsAdding(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingConfigId(null);
    setIsAdding(false);
  };

  // 保存配置
  const handleSaveConfig = (configData) => {
    try {
      // 如果提供商使用固定URL，自动设置正确的基础URL
      if (configData.type && AIProviderInfo[configData.type]?.useFixedUrl) {
        configData.baseUrl = AIProviderInfo[configData.type].defaultBaseUrl;
      }

      // 处理自定义模型
      if (configData.model === 'custom') {
        if (!configData.customModel?.trim()) {
          toast.error('请输入自定义模型名称');
          return;
        }
        configData.model = configData.customModel.trim();
        delete configData.customModel;
      }

      if (isAdding) {
        configManager.addConfig(configData);
        toast.success('配置添加成功！');
      } else {
        configManager.updateConfig(configData.id, configData);
        toast.success('配置更新成功！');
      }

      loadConfigs();
      handleCancelEdit();
    } catch (error) {
      console.error('保存配置失败:', error);
      toast.error(`保存失败: ${error.message}`);
    }
  };

  // 删除配置
  const handleDeleteConfig = (config) => {
    if (config.isDefault) {
      toast.error('不能删除默认配置');
      return;
    }

    if (confirm(`确定要删除配置 "${config.name}" 吗？`)) {
      try {
        configManager.removeConfig(config.id);
        loadConfigs();
        toast.success('配置删除成功！');
      } catch (error) {
        console.error('删除配置失败:', error);
        toast.error(`删除失败: ${error.message}`);
      }
    }
  };

  // 复制配置
  const handleCopyConfig = (config) => {
    try {
      const newConfig = new AIConfig({
        ...config,
        id: undefined,
        name: `${config.name} (副本)`,
        isDefault: false,
        createdAt: new Date().toISOString()
      });
      
      configManager.addConfig(newConfig);
      loadConfigs();
      toast.success('配置复制成功！');
    } catch (error) {
      console.error('复制配置失败:', error);
      toast.error(`复制失败: ${error.message}`);
    }
  };

  // 设置默认配置
  const handleSetDefault = (config) => {
    try {
      configManager.setDefaultConfig(config.id);
      loadConfigs();
      toast.success(`已将 "${config.name}" 设为默认配置`);
    } catch (error) {
      console.error('设置默认配置失败:', error);
      toast.error(`设置失败: ${error.message}`);
    }
  };

  // 切换启用状态
  const handleToggleEnabled = (config) => {
    try {
      const updatedConfig = { ...config, enabled: !config.enabled };
      configManager.updateConfig(config.id, updatedConfig);
      loadConfigs();
      toast.success(`配置已${updatedConfig.enabled ? '启用' : '禁用'}`);
    } catch (error) {
      console.error('切换启用状态失败:', error);
      toast.error(`操作失败: ${error.message}`);
    }
  };

  // 测试连接
  const handleTestConnection = async (config) => {
    setTestingConfigs(prev => ({ ...prev, [config.id]: true }));
    setTestResults(prev => ({ ...prev, [config.id]: null }));

    try {
      const result = await AITestService.testConnection(config);

      setTestResults(prev => ({ ...prev, [config.id]: result }));

      if (result.success) {
        // 使用主进程IPC发送系统通知
        if (window.api && window.api.showNotification) {
          window.api.showNotification({
            title: 'AI配置测试成功',
            body: '连接测试成功！',
            icon: '/src/assets/icon.ico',
            tag: 'ai-test-success',
            silent: false
          });
        }
      } else {
        if (window.api && window.api.showNotification) {
          window.api.showNotification({
            title: 'AI配置测试失败',
            body: `连接测试失败: ${result.message}`,
            icon: '/src/assets/icon.ico',
            tag: 'ai-test-failure',
            silent: false
          });
        }
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      const errorResult = {
        success: false,
        message: `测试连接失败: ${error.message}`,
        details: error.toString()
      };
      setTestResults(prev => ({ ...prev, [config.id]: errorResult }));
      if (window.api && window.api.showNotification) {
        window.api.showNotification({
          title: 'AI配置测试失败',
          body: `测试连接失败: ${error.message}`,
          icon: '/src/assets/icon.ico',
          tag: 'ai-test-error',
          silent: false
        });
      }
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
        if (window.api && window.api.showNotification) {
          window.api.showNotification({
            title: 'AI配置测试成功',
            body: `测试消息成功: ${result.message}`,
            icon: '/src/assets/icon.ico',
            tag: 'ai-test-success',
            silent: false
          });
        }
      } else {
        if (window.api && window.api.showNotification) {
          window.api.showNotification({
            title: 'AI配置测试失败',
            body: `测试消息失败: ${result.error}`,
            icon: '/src/assets/icon.ico',
            tag: 'ai-test-failure',
            silent: false
          });
        }
      }
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        details: error.stack
      };
      setTestResults(prev => ({ ...prev, [config.id]: errorResult }));
      if (window.api && window.api.showNotification) {
        window.api.showNotification({
          title: 'AI配置测试失败',
          body: `测试失败: ${error.message}`,
          icon: '/src/assets/icon.ico',
          tag: 'ai-test-error',
          silent: false
        });
      }
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
    const providerInfo = AIProviderInfo[config.type];
    const requiredFields = ['name', 'apiKey', 'model'];
    
    // 如果提供商不使用固定URL，则baseUrl也是必需字段
    if (!providerInfo?.useFixedUrl) {
      requiredFields.push('baseUrl');
    }
    
    const missingFields = requiredFields.filter(field => !config[field] || !config[field].trim());
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        status: 'incomplete',
        message: `缺少必要字段: ${missingFields.join(', ')}`,
        missingFields
      };
    }

    if (!config.enabled) {
      return {
        valid: false,
        status: 'disabled',
        message: '配置已禁用',
        missingFields: []
      };
    }

    return {
      valid: true,
      status: 'ready',
      message: '配置就绪',
      missingFields: []
    };
  };

  // 渲染配置表单
  const renderConfigForm = (config = null, isEdit = false) => {
    const editingConfig = config || new AIConfig({ type: AIProviderType.ZHIPU });
    const providerInfo = AIProviderInfo[editingConfig.type];

    return (
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {isEdit ? `编辑配置: ${editingConfig.name}` : '添加新配置'}
            </CardTitle>
            {(isEdit || isAdding) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 基础配置 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">配置名称</Label>
              <Input
                id="name"
                value={editingConfig.name || ''}
                onChange={(e) => {
                  editingConfig.name = e.target.value;
                  if (isEdit) {
                    const updatedConfigs = configs.map(c => 
                      c.id === editingConfig.id ? { ...c, name: e.target.value } : c
                    );
                    setConfigs(updatedConfigs);
                  }
                }}
                placeholder="我的AI配置"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">AI提供商</Label>
              <Select 
                value={editingConfig.type} 
                onValueChange={(value) => {
                  editingConfig.type = value;
                  editingConfig.model = AIProviderInfo[value]?.defaultModel || '';
                  if (isEdit) {
                    const updatedConfigs = configs.map(c => 
                      c.id === editingConfig.id ? { ...c, type: value, model: AIProviderInfo[value]?.defaultModel || '' } : c
                    );
                    setConfigs(updatedConfigs);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AIProviderInfo).map(([type, info]) => (
                    <SelectItem key={type} value={type}>
                      {info.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* API配置 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API密钥</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type={showApiKey[editingConfig.id] ? 'text' : 'password'}
                  value={editingConfig.apiKey || ''}
                  onChange={(e) => {
                    editingConfig.apiKey = e.target.value;
                    if (isEdit) {
                      const updatedConfigs = configs.map(c => 
                        c.id === editingConfig.id ? { ...c, apiKey: e.target.value } : c
                      );
                      setConfigs(updatedConfigs);
                    }
                  }}
                  placeholder="输入您的API密钥"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setShowApiKey(prev => ({
                      ...prev,
                      [editingConfig.id]: !prev[editingConfig.id]
                    }));
                  }}
                >
                  {showApiKey[editingConfig.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* 基础URL（仅当提供商不使用固定URL时显示） */}
            {!providerInfo?.useFixedUrl && (
              <div className="space-y-2">
                <Label htmlFor="base-url">基础URL</Label>
                <Input
                  id="base-url"
                  value={editingConfig.baseUrl || ''}
                  onChange={(e) => {
                    editingConfig.baseUrl = e.target.value;
                    if (isEdit) {
                      const updatedConfigs = configs.map(c => 
                        c.id === editingConfig.id ? { ...c, baseUrl: e.target.value } : c
                      );
                      setConfigs(updatedConfigs);
                    }
                  }}
                  placeholder="https://api.example.com"
                />
              </div>
            )}

            {/* 模型选择 */}
            <div className="space-y-2">
              <Label htmlFor="model">模型</Label>
              <Select 
                value={editingConfig.model} 
                onValueChange={(value) => {
                  editingConfig.model = value;
                  if (isEdit) {
                    const updatedConfigs = configs.map(c => 
                      c.id === editingConfig.id ? { ...c, model: value } : c
                    );
                    setConfigs(updatedConfigs);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerInfo?.models.map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">自定义模型</SelectItem>
                </SelectContent>
              </Select>
              
              {/* 自定义模型输入框 */}
              {editingConfig.model === 'custom' && (
                <Input
                  value={editingConfig.customModel || ''}
                  onChange={(e) => {
                    editingConfig.customModel = e.target.value;
                    if (isEdit) {
                      const updatedConfigs = configs.map(c => 
                        c.id === editingConfig.id ? { ...c, customModel: e.target.value } : c
                      );
                      setConfigs(updatedConfigs);
                    }
                  }}
                  placeholder="输入自定义模型名称"
                  className="mt-2"
                />
              )}
            </div>
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
                    onCheckedChange={(checked) => {
                      editingConfig.useProxy = checked;
                      if (isEdit) {
                        const updatedConfigs = configs.map(c => 
                          c.id === editingConfig.id ? { ...c, useProxy: checked } : c
                        );
                        setConfigs(updatedConfigs);
                      }
                    }}
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
                        onValueChange={(value) => {
                          editingConfig.proxyProtocol = value;
                          if (isEdit) {
                            const updatedConfigs = configs.map(c => 
                              c.id === editingConfig.id ? { ...c, proxyProtocol: value } : c
                            );
                            setConfigs(updatedConfigs);
                          }
                        }}
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
                          onChange={(e) => {
                            editingConfig.proxyHost = e.target.value;
                            if (isEdit) {
                              const updatedConfigs = configs.map(c => 
                                c.id === editingConfig.id ? { ...c, proxyHost: e.target.value } : c
                              );
                              setConfigs(updatedConfigs);
                            }
                          }}
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
                          onChange={(e) => {
                            editingConfig.proxyPort = e.target.value;
                            if (isEdit) {
                              const updatedConfigs = configs.map(c => 
                                c.id === editingConfig.id ? { ...c, proxyPort: e.target.value } : c
                              );
                              setConfigs(updatedConfigs);
                            }
                          }}
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
                          onChange={(e) => {
                            editingConfig.proxyUsername = e.target.value;
                            if (isEdit) {
                              const updatedConfigs = configs.map(c => 
                                c.id === editingConfig.id ? { ...c, proxyUsername: e.target.value } : c
                              );
                              setConfigs(updatedConfigs);
                            }
                          }}
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
                            onChange={(e) => {
                              editingConfig.proxyPassword = e.target.value;
                              if (isEdit) {
                                const updatedConfigs = configs.map(c => 
                                  c.id === editingConfig.id ? { ...c, proxyPassword: e.target.value } : c
                                );
                                setConfigs(updatedConfigs);
                              }
                            }}
                            placeholder="代理密码"
                            className="flex-1 h-8 text-sm"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setShowProxyPassword(prev => ({
                                ...prev,
                                [editingConfig.id]: !prev[editingConfig.id]
                              }));
                            }}
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
                onChange={(e) => {
                  editingConfig.temperature = parseFloat(e.target.value);
                  if (isEdit) {
                    const updatedConfigs = configs.map(c => 
                      c.id === editingConfig.id ? { ...c, temperature: parseFloat(e.target.value) } : c
                    );
                    setConfigs(updatedConfigs);
                  }
                }}
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
                onChange={(e) => {
                  editingConfig.maxTokens = parseInt(e.target.value);
                  if (isEdit) {
                    const updatedConfigs = configs.map(c => 
                      c.id === editingConfig.id ? { ...c, maxTokens: parseInt(e.target.value) } : c
                    );
                    setConfigs(updatedConfigs);
                  }
                }}
                placeholder="1000"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-4">
            <Button onClick={() => handleSaveConfig(editingConfig)} className="flex-1">
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
                      : 'bg-yellow-50 text-yellow-700 dark:bg-green-900/20 dark:text-yellow-400'
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
              <div className="mt-3 p-2 rounded-md border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  {testResults[editingConfig.id].success ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-600" />
                  )}
                  <span className="text-xs font-medium">
                    {testResults[editingConfig.id].success ? '测试成功' : '测试失败'}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground">
                      {testResults[editingConfig.id].message || testResults[editingConfig.id].error}
                </p>

                {testResults[editingConfig.id].data && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {testResults[editingConfig.id].data.models && (
                      <div>可用模型: {testResults[editingConfig.id].data.models.join(', ')}</div>
                    )}
                    {testResults[editingConfig.id].data.response && (
                      <div>响应: {testResults[editingConfig.id].data.response}</div>
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
          <p className="text-lg font-medium">暂无AI配置</p>
          <p className="text-sm">点击上方"添加AI配置"按钮开始配置</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {configs.map(config => {
          const providerInfo = AIProviderInfo[config.type];
          const isEditing = editingConfigId === config.id;
          
          return (
            <div key={config.id}>
              <Card className={`transition-all ${config.isDefault ? 'ring-2 ring-primary' : ''}`}>
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
                      {editingConfigId === config.id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelEdit()}
                        >
                          <X className="h-4 w-4 mr-2" />
                          收起
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditConfig(config)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          编辑
                        </Button>
                      )}
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
              
              {/* 编辑表单显示在对应配置下方 */}
              {isEditing && (
                <div className="mt-4">
                  {renderConfigForm(config, true)}
                </div>
              )}
            </div>
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

      {/* 添加配置表单（仅在添加时显示在顶部） */}
      {isAdding && (
        <div>
          {renderConfigForm()}
        </div>
      )}

      {/* 配置列表 */}
      {renderConfigList()}
    </div>
  );
}
