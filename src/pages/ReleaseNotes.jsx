import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { 
  Calendar, 
  Tag, 
  AlertTriangle, 
  CheckCircle, 
  Zap, 
  ArrowUp, 
  Filter,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider';
import changelogData from '@/data/changelog.json';

export default function ReleaseNotesPage() {
  const { theme } = useTheme();
  const [selectedType, setSelectedType] = useState('all');
  const [expandedVersions, setExpandedVersions] = useState(new Set(['5.0.3'])); // 默认展开最新版本

  // 获取版本类型标签的样式
  const getTypeBadgeVariant = (type) => {
    switch (type) {
      case '重大更新':
        return 'destructive';
      case '功能更新':
        return 'default';
      case '问题修复':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // 获取版本类型图标
  const getTypeIcon = (type) => {
    switch (type) {
      case '重大更新':
        return <ArrowUp className="h-4 w-4" />;
      case '功能更新':
        return <Zap className="h-4 w-4" />;
      case '问题修复':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Tag className="h-4 w-4" />;
    }
  };

  // 获取版本类型标签文本
  const getTypeLabel = (type) => {
    return changelogData.categories[type] || type;
  };

  // 过滤版本
  const filteredVersions = useMemo(() => {
    console.log('Filtering versions:', { selectedType, totalVersions: changelogData.versions.length });
    
    // 首先过滤掉 unreleased 版本
    const releasedVersions = changelogData.versions.filter(version => version.version !== 'unreleased');
    console.log('Released versions:', releasedVersions.length);
    
    if (selectedType === 'all') {
      return releasedVersions;
    }
    
    const filtered = releasedVersions.filter(version => {
      const matches = version.type === selectedType;
      console.log(`Version ${version.version}: type=${version.type}, selectedType=${selectedType}, matches=${matches}`);
      return matches;
    });
    
    console.log('Filtered results:', { selectedType, filteredCount: filtered.length, filtered });
    return filtered;
  }, [selectedType]);

  // 切换版本展开状态
  const toggleVersion = (version) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  // 清除筛选
  const clearFilter = () => {
    console.log('clearFilter called, setting selectedType to "all"');
    setSelectedType('all');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 页面标题 */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">更新日志</h1>
        <p className="text-muted-foreground">查看 CS-Explorer 的所有版本更新内容</p>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            版本筛选
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 当前过滤状态显示 */}
            <div className="text-sm text-muted-foreground">
              当前筛选：<span className="font-medium">{selectedType === 'all' ? '全部版本' : changelogData.categories[selectedType]}</span>
              {selectedType !== 'all' && (
                <span className="ml-2">
                  (共 {filteredVersions.length} 个版本)
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  console.log('Clicking "全部版本" button');
                  setSelectedType('all');
                }}
              >
                全部版本
              </Button>
              {Object.entries(changelogData.categories).map(([type, label]) => (
                <Button
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    console.log('Clicking filter button:', { type, label });
                    setSelectedType(type);
                  }}
                  className="flex items-center gap-2"
                >
                  {getTypeIcon(type)}
                  {label}
                </Button>
              ))}
              {selectedType !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    console.log('Clearing filter');
                    clearFilter();
                  }}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                  清除筛选
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 版本列表 */}
      <div className="space-y-4">
        {filteredVersions.map((version, index) => (
          <Card key={version.version} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleVersion(version.version)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getTypeBadgeVariant(version.type)} className="flex items-center gap-1">
                      {getTypeIcon(version.type)}
                      {getTypeLabel(version.type)}
                    </Badge>
                    {version.breaking && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        破坏性更新
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">v{version.version}</h3>
                    <p className="text-sm text-muted-foreground">{version.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {version.date}
                  </div>
                  {expandedVersions.has(version.version) ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
            
            {expandedVersions.has(version.version) && (
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    更新内容：
                  </div>
                  <ul className="space-y-2">
                    {version.changes.map((change, changeIndex) => (
                      <li key={changeIndex} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* 底部信息 */}
      <div className="text-center text-sm text-muted-foreground py-4">
        <p>感谢您使用 CS-Explorer！我们会持续改进，为您提供更好的体验。</p>
        <p className="mt-1">如有问题或建议，欢迎反馈。</p>
      </div>
    </div>
  )
} 