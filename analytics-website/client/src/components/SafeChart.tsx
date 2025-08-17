import React, { ReactElement } from 'react';

interface SafeChartProps {
  children: React.ReactNode;
  data: any[];
  fallback?: React.ReactNode;
}

const SafeChart = ({ children, data, fallback }: SafeChartProps): ReactElement => {
  // 检查数据是否有效
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      fallback || (
        <div className="flex items-center justify-center h-64 text-gray-500">
          暂无数据
        </div>
      )
    ) as ReactElement;
  }

  // 检查数据格式是否正确
  const isValidData = data.every(item => item && typeof item === 'object');
  if (!isValidData) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        数据格式错误
      </div>
    );
  }

  return <>{children}</>;
};

export default SafeChart;
