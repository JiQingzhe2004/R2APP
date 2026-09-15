# 配置存储位置说明

本文档说明应用的所有配置和缓存文件保存的位置。

## 主要配置存储

应用使用 `electron-store` 来存储配置，所有配置都保存在一个 JSON 文件中。

### Windows
```
%APPDATA%\CS-Explorer\config.json
```
完整路径示例：`C:\Users\你的用户名\AppData\Roaming\CS-Explorer\config.json`

### macOS
```
~/Library/Application Support/CS-Explorer/config.json
```

### Linux
```
~/.config/CS-Explorer/config.json
```

## 配置文件中存储的内容

`config.json` 文件包含以下配置：

- **存储配置（profiles）**：所有云存储服务的配置信息
  - 存储类型（R2、OSS、COS 等）
  - Access Key、Secret Key 等凭证
  - 存储桶名称、区域等
- **当前激活的配置ID（activeProfileId）**
- **应用设置（app-settings）**：
  - 主题设置（theme）
  - 关闭行为（close-action）
  - 下载路径等
- **下载任务（download-tasks）**：下载任务的状态和进度
- **上传状态（uploads-state）**：上传任务的状态
- **最近活动（recent-activities）**：最近的文件操作记录
- **机器码（machineId）**：用于统计和更新的唯一标识
- **安装报告（installReported）**：是否已报告安装

## 节日启动图缓存

节日启动图和配置缓存保存在以下位置：

### Windows
```
%APPDATA%\CS-Explorer\festival-splash\
├── festival-config.json          # 节日配置缓存
└── images\                       # 节日图片缓存
    ├── christmas-2025.png
    ├── new-year-2025.png
    └── ...
```

完整路径示例：`C:\Users\你的用户名\AppData\Roaming\CS-Explorer\festival-splash\`

### macOS
```
~/Library/Application Support/CS-Explorer/festival-splash/
├── festival-config.json
└── images/
```

### Linux
```
~/.config/CS-Explorer/festival-splash/
├── festival-config.json
└── images/
```

## 如何访问配置文件

### Windows
1. 按 `Win + R` 打开运行对话框
2. 输入 `%APPDATA%\CS-Explorer` 并回车
3. 即可看到 `config.json` 文件

### macOS
1. 打开 Finder
2. 按 `Cmd + Shift + G` 打开"前往文件夹"
3. 输入 `~/Library/Application Support/CS-Explorer`
4. 即可看到 `config.json` 文件

### Linux
1. 打开文件管理器
2. 按 `Ctrl + L` 显示地址栏
3. 输入 `~/.config/CS-Explorer`
4. 即可看到 `config.json` 文件

## 配置文件格式

`config.json` 是一个 JSON 文件，格式如下：

```json
{
  "profiles": [
    {
      "id": "profile-1",
      "name": "我的R2存储",
      "type": "r2",
      "accountId": "...",
      "accessKeyId": "...",
      "secretAccessKey": "...",
      "bucketName": "..."
    }
  ],
  "activeProfileId": "profile-1",
  "app-settings": {
    "theme": "dark",
    "close-action": "minimize-to-tray"
  },
  "download-tasks": {},
  "uploads-state": [],
  "recent-activities": [],
  "machineId": "...",
  "installReported": null
}
```

## 注意事项

⚠️ **重要提示**：

1. **备份配置**：修改或删除配置文件前，建议先备份
2. **敏感信息**：配置文件中包含 Access Key、Secret Key 等敏感信息，请妥善保管
3. **不要手动编辑**：除非你知道自己在做什么，否则不要手动编辑配置文件
4. **删除配置**：删除配置文件会导致所有设置丢失，需要重新配置

## 清理缓存

如果需要清理缓存：

1. **清理节日启动图缓存**：删除 `festival-splash` 目录
2. **重置所有配置**：删除 `config.json` 文件（应用会重新创建）
3. **清理下载任务**：在应用设置中清除下载历史

## 代码中的存储实现

### 主配置存储
```javascript
// electron/main/index.js
import Store from 'electron-store'
const store = new Store();

// 保存配置
store.set('profiles', profiles);
store.set('activeProfileId', activeProfileId);

// 读取配置
const profiles = store.get('profiles', []);
```

### 节日启动图缓存
```javascript
// electron/main/festival-splash.js
const CACHE_DIR = app.getPath('userData');
const FESTIVAL_CACHE_DIR = join(CACHE_DIR, 'festival-splash');
```

## 相关文件

- 主配置存储：`electron/main/index.js`（第 324 行）
- 节日缓存：`electron/main/festival-splash.js`（第 12-15 行）
