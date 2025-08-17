@echo off
echo 启动 R2APP 统计网站开发环境...
echo.

echo 1. 启动后端服务器...
start "Backend Server" cmd /k "npm run server"

echo 2. 等待后端启动...
timeout /t 3 /nobreak > nul

echo 3. 启动前端开发服务器...
start "Frontend Client" cmd /k "npm run client"

echo.
echo 开发环境启动完成！
echo 后端: http://localhost:3006
echo 前端: http://localhost:3000
echo.
echo 按任意键退出...
pause > nul
