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

      <Card className={cn('overflow-hidden rounded-3xl', variant === 'embedded' && 'border-dashed')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5 text-primary" />
            查看版本更新记录
          </CardTitle>
          <CardDescription>
            通过下方的筛选器快速定位特定类型的更新，或直接浏览完整的版本历史。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center flex-1">
              <Button
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('all')}
                className="rounded-full transition-all px-4"
              >
                全部版本
              </Button>
              {Object.entries(changelogData.categories).map(([type, label]) => (
                <Button
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className="flex items-center gap-2 rounded-full transition-all px-3"
                >
                  {getTypeIcon(type)}
                  {label}
                </Button>
              ))}
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
               <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full whitespace-nowrap">
                <span className="font-medium text-foreground">{filteredVersions.length}</span> 个版本
              </div>
              {selectedType !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilter}
                  className="flex items-center gap-2 text-muted-foreground rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors h-8 px-3"
                >
                  <X className="h-4 w-4" />
                  清除筛选
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredVersions.map((version) => (
          <Card key={version.version} className="overflow-hidden rounded-3xl border transition-all duration-200 hover:shadow-lg hover:border-primary/20 group">
            <CardHeader
              className="cursor-pointer hover:bg-muted/30 transition-colors py-4"
              onClick={() => toggleVersion(version.version)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/10",
                    expandedVersions.has(version.version) && "bg-primary/10 text-primary"
                  )}>
                     {getTypeIcon(version.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold">v{version.version}</h3>
                      <Badge variant={getTypeBadgeVariant(version.type)} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-normal">
                        {getTypeLabel(version.type)}
                      </Badge>
                      {version.breaking && (
                        <Badge variant="destructive" className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-normal">
                          <AlertTriangle className="h-3 w-3" />
                          破坏性更新
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{version.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                    <Calendar className="h-3.5 w-3.5" />
                    {version.date}
                  </div>
                  <div className={cn(
                    "rounded-full p-1 transition-transform duration-200",
                    expandedVersions.has(version.version) ? "rotate-180 bg-muted" : ""
                  )}>
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardHeader>

            {expandedVersions.has(version.version) && (
              <CardContent className="pt-0 pb-6 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="px-14">
                  <div className="h-px w-full bg-border/50 mb-4" />
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      <ScrollText className="h-4 w-4 text-primary" />
                      更新详情
                    </div>
                    <ul className="space-y-2.5">
                      {version.changes.map((change, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground group/item hover:text-foreground transition-colors">
                          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 flex-shrink-0 group-hover/item:bg-primary transition-colors"></div>
                          <span className="leading-relaxed">{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
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

