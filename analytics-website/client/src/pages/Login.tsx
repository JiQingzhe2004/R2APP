import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { useAuth } from '../App';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const [form, setForm] = useState<LoginForm>({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // 清除错误信息
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.username || !form.password) {
      setError('请填写用户名和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${getApiUrl('/auth/login')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (data.success) {
        // 使用认证上下文登录
        login(data.data.token, data.data.user);
        
        // 跳转到仪表盘
        navigate('/dashboard');
      } else {
        setError(data.error || '登录失败');
      }
    } catch (error) {
      console.error('登录错误:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <LogIn className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            登录到管理后台
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            R2APP 统计分析系统
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">用户登录</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-50 dark:text-red-200 dark:bg-red-900/50 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">用户名或邮箱</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={form.username}
                  onChange={handleInputChange}
                  placeholder="请输入用户名或邮箱"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={handleInputChange}
                    placeholder="请输入密码"
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </form>

            {/* <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                还没有账户？{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() => navigate('/register')}
                >
                  立即注册
                </button>
              </p>
            </div> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
