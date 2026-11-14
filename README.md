# 智学测评小程序端

用微信开发者工具导入本目录（不是仓库根目录）：

```text
D:\xiangmuuuu-miniprogram\miniprogram
```

## 本地联调

1. 启动 8081 后端（仓库根目录）：

   ```powershell
   cd D:\xiangmuuuu-miniprogram
   .\start-miniprogram-server.ps1
   ```

2. 在开发者工具「详情 → 本地设置」勾选「不校验合法域名……」。
3. 保持 `config.js` 中：

   ```js
   baseUrl: 'http://127.0.0.1:8081'
   ```

4. 编译后用测试账号登录：

   - 学生：`20260001 / 123456`
   - 教师：`zhaolin / 123456`
   - 课程负责人：`admin / 123456`

## 正式发布

把 `config.js` 的 `baseUrl` 改成已备案的 HTTPS 域名，并在微信公众平台配置 `request` 合法域名。正式环境不能使用 `localhost`、IP 或 HTTP。

完整说明、接口改造、已验证内容和限制见上级目录的 [MINIPROGRAM.md](../MINIPROGRAM.md)。
