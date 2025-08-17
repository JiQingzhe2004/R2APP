import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UsageData {
  date: string;
  unique_users: number;
  total_usage: number;
}

interface UsageChartProps {
  data: UsageData[];
}

const UsageChart: React.FC<UsageChartProps> = ({ data }) => {
  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 自定义工具提示
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`日期: ${label}`}</p>
          <p className="text-blue-600">{`活跃用户: ${payload[0]?.value || 0}`}</p>
          <p className="text-green-600">{`使用次数: ${payload[1]?.value || 0}`}</p>
        </div>
      );
    }
    return null;
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
    date: item.date || '',
    unique_users: item.unique_users || 0,
    total_usage: item.total_usage || 0
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          stroke="#9ca3af"
          fontSize={12}
        />
        <YAxis 
          stroke="#9ca3af"
          fontSize={12}
          tickFormatter={(value) => value.toLocaleString()}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line 
          type="monotone" 
          dataKey="unique_users" 
          stroke="#3b82f6" 
          strokeWidth={3}
          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
          name="活跃用户"
        />
        <Line 
          type="monotone" 
          dataKey="total_usage" 
          stroke="#10b981" 
          strokeWidth={3}
          dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
          name="使用次数"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default UsageChart;
