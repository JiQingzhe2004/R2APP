import React, { useState, useEffect } from 'react';
import { Activity, Download, Users, TrendingUp, Monitor, Globe, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import StatCard from './StatCard';
import UsageChart from './UsageChart';
import PlatformChart from './PlatformChart';
import VersionChart from './VersionChart';
import SafeChart from './SafeChart';

interface DashboardData {
  overview: {
    totalInstalls: number;
    todayInstalls: number;
    totalUsage: number;
    todayUsage: number;
  };
  weeklyData: Array<{
    date: string;
    unique_users: number;
    total_usage: number;
  }>;
  platformDistribution: Array<{
    platform: string;
    count: number;
  }>;
  versionDistribution: Array<{
    version: string;
    count: number;
  }>;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(getApiUrl('/api/analytics/dashboard'));
      setData(response.data.data);
      setError(null);
    } catch (err) {
      console.error('获取仪表盘数据失败:', err);
      setError('获取数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">❌</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // 确保数据属性存在，提供默认值
  const safeData = {
    overview: data.overview || {
      totalInstalls: 0,
      todayInstalls: 0,
      totalUsage: 0,
      todayUsage: 0
    },
    weeklyData: data.weeklyData || [],
    platformDistribution: data.platformDistribution || [],
    versionDistribution: data.versionDistribution || []
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">R2APP 统计仪表盘</h1>
              <p className="mt-1 text-sm text-gray-500">
                实时监控应用安装和使用情况
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Activity className="h-4 w-4" />
                <span>刷新数据</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="总安装数"
            value={safeData.overview.totalInstalls}
            icon={Download}
            color="blue"
            change={safeData.overview.todayInstalls}
            changeLabel="今日新增"
          />
          <StatCard
            title="总使用次数"
            value={safeData.overview.totalUsage}
            icon={Activity}
            color="green"
            change={safeData.overview.todayUsage}
            changeLabel="今日使用"
          />
          <StatCard
            title="活跃用户"
            value={safeData.weeklyData[0]?.unique_users || 0}
            icon={Users}
            color="purple"
            change={safeData.weeklyData[1]?.unique_users || 0}
            changeLabel="昨日对比"
          />
          <StatCard
            title="平台分布"
            value={safeData.platformDistribution.length}
            icon={Monitor}
            color="orange"
            change={null}
            changeLabel="支持平台"
          />
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 使用趋势图 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              使用趋势 (最近7天)
            </h3>
            <SafeChart data={safeData.weeklyData}>
              <UsageChart data={safeData.weeklyData} />
            </SafeChart>
          </div>

          {/* 平台分布图 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Globe className="h-5 w-5 mr-2 text-green-600" />
              平台分布
            </h3>
            <SafeChart data={safeData.platformDistribution}>
              <PlatformChart data={safeData.platformDistribution} />
            </SafeChart>
          </div>
        </div>

        {/* 版本分布图 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
            版本分布 (Top 10)
          </h3>
          <SafeChart data={safeData.versionDistribution}>
            <VersionChart data={safeData.versionDistribution} />
          </SafeChart>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
