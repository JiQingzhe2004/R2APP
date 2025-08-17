import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PlatformData {
  platform: string;
  count: number;
}

interface PlatformChartProps {
  data: PlatformData[];
}

const PlatformChart: React.FC<PlatformChartProps> = ({ data }) => {
  // 平台颜色配置
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  // 自定义工具提示
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const currentData = payload[0].payload;
      const total = data.reduce((sum: number, item: PlatformData) => sum + item.count, 0);
      const percentage = ((currentData.count / total) * 100).toFixed(1);
      
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`平台: ${currentData.platform}`}</p>
          <p className="text-blue-600">{`数量: ${currentData.count}`}</p>
          <p className="text-gray-600">{`占比: ${percentage}%`}</p>
        </div>
      );
    }
    return null;
  };

  // 自定义图例
  const CustomLegend = ({ payload }: any) => {
    // 安全检查payload
    if (!payload || !Array.isArray(payload)) {
      return (
        <div className="flex flex-wrap justify-center gap-4 mt-4 text-gray-500">
          暂无图例数据
        </div>
      );
    }

    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center">
            <div 
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-600">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        暂无数据
      </div>
    );
  }

  // 确保数据格式正确
  const chartData = data.map(item => ({
    platform: item.platform || '',
    count: item.count || 0
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ platform, percent }) => `${platform} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="count"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <Legend content={<CustomLegend />} />
    </div>
  );
};

export default PlatformChart;
