# 面试复盘助手

把一场面试整理成可以留下的复盘。填写公司、轮次和岗位，上传或粘贴面试记录，生成 AI 复盘初稿，再改成自己的终稿。

原始记录、AI 初稿和最终复盘分开保存。重新生成只会更新初稿，不会覆盖原始记录，也不会覆盖已经保存的终稿。首页按行业查看已投递的公司和各轮面试结果。记录保存在本机。

## 开发

```powershell
pnpm install
pnpm dev
```

浏览器打开 http://localhost:3000。

同时打开桌面窗口：

```powershell
pnpm dev:app
```

## 打包

```powershell
pnpm build
cd electron
npm install
npm run pack
```

Windows 便携版输出到 `electron/release/面试复盘助手.exe`。

## 网页

推送到 `main` 后会自动构建并发布：

https://abooy11.github.io/Interview-Review-Assistant/
