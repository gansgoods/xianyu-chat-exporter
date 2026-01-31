# 🐟 聊天记录导出插件 (闲鱼 / Fiverr)

🌐 [English](./README.md) | [中文](./README_zh.md)

一键导出闲鱼、Fiverr 聊天记录，支持勾选消息、导出 HTML 和 Markdown 格式。

## ✨ 功能特点

- 🌐 **多平台支持**：支持闲鱼和 Fiverr 两个平台
- 📋 **可视化勾选**：预览所有消息，勾选需要导出的内容
- 🎨 **精美样式**：导出的 HTML 有仿原生的聊天气泡样式
- 📝 **多格式支持**：支持 HTML 和 Markdown 两种导出格式
- 🖼️ **图片视频**：自动提取聊天中的图片和视频
- 💬 **引用消息**：保留消息的引用关系

## 📦 安装方法

### 方式一：开发者模式加载（推荐）

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 右上角打开「**开发者模式**」
4. 点击「**加载已解压的扩展程序**」
5. 选择 `xianyu-chat-exporter` 这个文件夹
6. 安装完成！

### 方式二：打包成 crx 文件

1. 在 `chrome://extensions/` 页面
2. 点击「打包扩展程序」
3. 选择此文件夹路径
4. 生成 `.crx` 文件后双击安装

## 🚀 使用方法

### 闲鱼
1. 打开 [闲鱼网页版](https://www.goofish.com/) 并登录
2. 进入和某人的聊天窗口
3. **重要**：先滚动到聊天记录顶部，确保历史消息都加载出来
4. 点击浏览器右上角的插件图标 💬
5. 在弹出面板中勾选要导出的消息
6. 点击「导出 HTML」或「导出 Markdown」

### Fiverr
1. 打开 [Fiverr](https://www.fiverr.com/) 并登录
2. 进入 Inbox，打开和某人的聊天
3. 滚动加载完整的聊天记录
4. 点击浏览器右上角的插件图标 💬
5. 勾选要导出的消息，点击导出

## 📄 导出效果

### HTML 格式
- 保留头像、气泡样式
- 图片可直接查看
- 视频可播放
- 一个独立 HTML 文件，可直接打开

### Markdown 格式
- 纯文本，方便复制
- 图片以链接形式保留
- 适合整理到笔记软件

## ⚠️ 注意事项

- 支持闲鱼网页版（goofish.com / xianyu.com）和 Fiverr（fiverr.com）
- 需要先滚动加载完整的聊天记录
- 闲鱼图片链接来自阿里云 CDN，有时效性

## 🔧 技术说明

- Manifest V3
- 使用 Chrome Scripting API 提取页面内容
- 纯前端实现，不上传任何数据

---

## ☕ Support / 支持作者

If this tool saves your time, consider buying me a coffee!

如果这个工具帮到了你，可以请我喝杯咖啡~

| 🌐 International | 🇨🇳 国内用户 |
|:---:|:---:|
| [![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/lonnieg) | 微信 / 支付宝 |
| | <img src="./donate-wechat.jpg" width="150" alt="微信打赏"> <img src="./donate-alipay.jpg" width="150" alt="支付宝打赏"> |

---

Made with ❤️ for 效率工作
