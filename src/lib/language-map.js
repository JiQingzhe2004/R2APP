const languageMap = {
    // JavaScript/TypeScript
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    'd.ts': 'typescript',
  
    // Web
    html: 'html',
    htm: 'html',
    xhtml: 'html',
    css: 'css',
    scss: 'css',
    sass: 'css',
    less: 'css',
    svg: 'svg',
    vue: 'vue',
    svelte: 'svelte',
  
    // Server-side
    py: 'python',
    java: 'java',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    kt: 'kotlin',
    swift: 'swift',
  
    // Systems
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    m: 'objectivec',
  
    // Scripting
    sh: 'bash',
    bash: 'bash',
    ps1: 'powershell',
    bat: 'bat',
  
    // Data
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    toml: 'toml',
  
    // Database
    sql: 'sql',
  
    // Documentation
    md: 'markdown',
    markdown: 'markdown',
  
    // Templates
    ejs: 'ejs',
    hbs: 'handlebars',
    handlebars: 'handlebars',
  
    // Configs
    dockerfile: 'dockerfile',
    gitignore: 'gitignore',
  
    // Other supported
    r: 'r',
    lua: 'lua',
    dart: 'dart',
    groovy: 'groovy',
    pl: 'perl',
    perl: 'perl',
    scala: 'scala',
    graphql: 'graphql',
    gql: 'graphql'
  };
  
  export const getLanguage = (fileName) => {
    if (!fileName) return 'plaintext';
    
    const extension = fileName.split('.').pop().toLowerCase();
    
    // 特殊处理复合扩展名 (如 .d.ts)
    if (fileName.endsWith('.d.ts')) {
      return 'typescript';
    }
    
    return languageMap[extension] || 'plaintext';
  };