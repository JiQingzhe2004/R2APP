import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Calendar,
  Tag,
  AlertTriangle,
  CheckCircle,
  Zap,
  ArrowUp,
  X,
  ChevronDown,
  ChevronUp,
  ScrollText
} from 'lucide-react';
import changelogData from '@/data/changelog.json';
import { cn } from '@/lib/utils';

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

const getTypeLabel = (type) => {
  return changelogData.categories[type] || type;
};

export function ReleaseNotesContent({ variant = 'standalone' }) {
  const showStandaloneIntro = variant === 'standalone';
  const containerClass = cn('space-y-6', variant === 'embedded' && 'space-y-4');

  const releasedVersions = useMemo(() => (
    changelogData.versions.filter((version) => version.version !== 'unreleased')
  ), []);

  const defaultExpandedVersion = releasedVersions[0]?.version;

  const [selectedType, setSelectedType] = useState('all');
  const [expandedVersions, setExpandedVersions] = useState(() => {
    const initial = new Set();
    if (defaultExpandedVersion) {
      initial.add(defaultExpandedVersion);
    }
    return initial;
  });

  const filteredVersions = useMemo(() => {
    if (selectedType === 'all') {
      return releasedVersions;
    }
    return releasedVersions.filter((version) => version.type === selectedType);
  }, [releasedVersions, selectedType]);

  useEffect(() => {
    if (filteredVersions.length === 0) {
      return;
    }

    setExpandedVersions((prev) => {
      const hasVisibleExpanded = filteredVersions.some((version) => prev.has(version.version));
      if (hasVisibleExpanded) {
        return prev;
      }

      const next = new Set(prev);
      next.add(filteredVersions[0].version);
      return next;
    });
  }, [filteredVersions]);

  const toggleVersion = (version) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };

  const clearFilter = () => {
    setSelectedType('all');
  };

  return (
    <div className={containerClass}>
      {showStandaloneIntro && (
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">更新日志</h1>
          <p className="text-muted-foreground">查看 CS-Explorer 的所有版本更新内容</p>
        </div>
      )}

      <Card className={cn('overflow-hidden', variant === 'embedded' && 'border-dashed')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5 text-primary" />
            查看版本更新记录
          </CardTitle>
          <CardDescription>
            随时了解每次发布的功能更新、体验优化以及修复说明。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <p>
              更新日志会按照版本时间线展示全部变更内容，并提供快捷定位到最新版本的功能，方便您回顾历史更新。
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('all')}
              >
                全部版本
              </Button>
              {Object.entries(changelogData.categories).map(([type, label]) => (
                <Button
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType(type)}
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
                  onClick={clearFilter}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                  清除筛选
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              当前筛选：<span className="font-medium">{selectedType === 'all' ? '全部版本' : changelogData.categories[selectedType]}</span>
              {selectedType !== 'all' && (
                <span className="ml-2">(共 {filteredVersions.length} 个版本)</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredVersions.map((version) => (
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
                  <div className="text-sm text-muted-foreground">更新内容：</div>
                  <ul className="space-y-2">
                    {version.changes.map((change, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
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

      <div className="text-center text-sm text-muted-foreground py-4">
        <p>感谢您使用 CS-Explorer！我们会持续改进，为您提供更好的体验。</p>
        <p className="mt-1">如有问题或建议，欢迎反馈。</p>
      </div>
    </div>
  );
}

