// 存储解析后的消息
let messages = [];
let chatTitle = '聊天记录';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 检查是否在闲鱼页面
    if (!tab.url.includes('xianyu.com') && !tab.url.includes('goofish.com')) {
      showEmpty();
      return;
    }

    // 注入脚本提取消息
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractMessages
    });

    const data = results[0]?.result;
    if (!data || data.messages.length === 0) {
      showEmpty();
      return;
    }

    messages = data.messages;
    chatTitle = data.chatTitle || '聊天记录';
    renderMessages();
    showContent();
    updateStatus();

  } catch (error) {
    console.error('Error:', error);
    showEmpty();
  }
});

// 在页面中执行的提取函数
function extractMessages() {
  const messages = [];
  
  // 获取聊天对象名称
  const chatTitle = document.querySelector('[class*="nickname"]')?.textContent?.trim()
    || document.querySelector('[class*="user-name"]')?.textContent?.trim()
    || '聊天记录';

  // 获取所有消息元素
  const messageElements = document.querySelectorAll('[class*="ant-list-item"]');
  
  messageElements.forEach((el, index) => {
    // 判断是自己还是对方的消息
    const style = el.getAttribute('style') || '';
    const isMe = style.includes('direction: rtl') || style.includes('text-align: right');
    
    // 获取文本内容
    const textEl = el.querySelector('[class*="message-text"] > span');
    let text = textEl?.textContent?.trim() || '';
    
    // 检查是否是图片
    const imgEl = el.querySelector('[class*="image-container"] img');
    let imageUrl = '';
    if (imgEl) {
      imageUrl = imgEl.getAttribute('src') || '';
      if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
      // 尝试获取高清图
      const hdImg = el.querySelector('.ant-image-img');
      if (hdImg) {
        const hdSrc = hdImg.getAttribute('src');
        if (hdSrc && !hdSrc.includes('display: none')) {
          imageUrl = hdSrc.startsWith('//') ? 'https:' + hdSrc : hdSrc;
        }
      }
      if (!text) text = '[图片]';
    }
    
    // 检查是否是视频
    const videoEl = el.querySelector('video');
    let videoUrl = '';
    if (videoEl) {
      videoUrl = videoEl.getAttribute('src') || '';
      if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
      if (!text) text = '[视频]';
    }
    
    // 检查是否有引用
    const quoteEl = el.querySelector('[class*="reply-container"]');
    let quote = '';
    if (quoteEl) {
      const quoteName = quoteEl.querySelector('[class*="user-nickname"]')?.textContent?.trim() || '';
      const quoteText = quoteEl.querySelector('span:not([class])')?.textContent?.trim() || '';
      if (quoteName || quoteText) {
        quote = `${quoteName}: ${quoteText}`.substring(0, 50);
      }
    }
    
    // 获取时间戳（从前面的时间分隔符获取）
    let timestamp = '';
    let prevEl = el.closest('[style*="position: relative"]')?.previousElementSibling;
    while (prevEl) {
      const timeText = prevEl.querySelector('[style*="text-align: center"]')?.textContent?.trim();
      if (timeText && /\d{1,2}-\d{1,2}/.test(timeText)) {
        timestamp = timeText;
        break;
      }
      prevEl = prevEl.previousElementSibling;
    }
    
    // 获取头像
    const avatarEl = el.querySelector('[class*="avatar"]');
    let avatar = avatarEl?.getAttribute('src') || '';
    if (avatar.startsWith('//')) avatar = 'https:' + avatar;
    
    if (text || imageUrl || videoUrl) {
      messages.push({
        id: index,
        isMe,
        text,
        imageUrl,
        videoUrl,
        quote,
        timestamp,
        avatar,
        selected: true
      });
    }
  });

  return { messages, chatTitle };
}

// 渲染消息列表
function renderMessages() {
  const list = document.getElementById('messageList');
  list.innerHTML = messages.map((msg, i) => `
    <div class="message-item" data-index="${i}">
      <input type="checkbox" ${msg.selected ? 'checked' : ''} data-index="${i}">
      <div class="message-content">
        <div class="message-meta">
          <span class="message-sender ${msg.isMe ? 'me' : ''}">${msg.isMe ? '我' : chatTitle}</span>
          ${msg.timestamp ? `<span class="message-time">${msg.timestamp}</span>` : ''}
        </div>
        <div class="message-text ${msg.imageUrl ? 'image' : ''} ${msg.videoUrl ? 'video' : ''}">
          ${msg.quote ? `<div style="color:#999;font-size:11px;margin-bottom:2px;">↩️ ${escapeHtml(msg.quote.substring(0, 30))}...</div>` : ''}
          ${escapeHtml(msg.text.substring(0, 100))}${msg.text.length > 100 ? '...' : ''}
        </div>
      </div>
    </div>
  `).join('');

  // 绑定勾选事件
  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      messages[index].selected = e.target.checked;
      updateStatus();
      updateSelectAll();
    });
  });
}

// 更新状态
function updateStatus() {
  const selected = messages.filter(m => m.selected).length;
  document.getElementById('status').textContent = `已选择 ${selected} 条`;
}

// 更新全选状态
function updateSelectAll() {
  const allSelected = messages.every(m => m.selected);
  document.getElementById('selectAll').checked = allSelected;
}

// 全选切换
document.getElementById('selectAll').addEventListener('change', (e) => {
  const checked = e.target.checked;
  messages.forEach(m => m.selected = checked);
  document.querySelectorAll('.message-item input[type="checkbox"]').forEach(cb => {
    cb.checked = checked;
  });
  updateStatus();
});

// 导出 HTML
document.getElementById('exportHtml').addEventListener('click', () => {
  const selected = messages.filter(m => m.selected);
  if (selected.length === 0) {
    alert('请至少选择一条消息');
    return;
  }
  
  const html = generateHtml(selected);
  downloadFile(html, `聊天记录_${chatTitle}_${getDateStr()}.html`, 'text/html');
});

// 导出 Markdown
document.getElementById('exportMd').addEventListener('click', () => {
  const selected = messages.filter(m => m.selected);
  if (selected.length === 0) {
    alert('请至少选择一条消息');
    return;
  }
  
  const md = generateMarkdown(selected);
  downloadFile(md, `聊天记录_${chatTitle}_${getDateStr()}.md`, 'text/markdown');
});

// 生成 HTML
function generateHtml(msgs) {
  const messagesHtml = msgs.map(msg => `
    <div class="msg ${msg.isMe ? 'me' : 'other'}">
      <img class="avatar" src="${msg.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle fill=%22%23ddd%22 cx=%2220%22 cy=%2220%22 r=%2220%22/></svg>'}" alt="">
      <div class="bubble">
        ${msg.quote ? `<div class="quote">↩️ ${escapeHtml(msg.quote)}</div>` : ''}
        ${msg.imageUrl ? `<img class="chat-img" src="${msg.imageUrl}" alt="图片">` : ''}
        ${msg.videoUrl ? `<video class="chat-video" src="${msg.videoUrl}" controls></video>` : ''}
        ${!msg.imageUrl && !msg.videoUrl ? `<div class="text">${escapeHtml(msg.text)}</div>` : ''}
        ${msg.timestamp ? `<div class="time">${msg.timestamp}</div>` : ''}
      </div>
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>聊天记录 - ${escapeHtml(chatTitle)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f5f5f5; 
      padding: 20px;
      line-height: 1.5;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #FFE14D, #FFC107);
      color: #333;
      padding: 16px 20px;
      font-weight: 600;
      font-size: 16px;
    }
    .meta {
      padding: 10px 20px;
      background: #fafafa;
      border-bottom: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
    .chat { padding: 16px; background: #f7f7f7; }
    .msg { 
      display: flex; 
      margin-bottom: 16px; 
      align-items: flex-start;
    }
    .msg.me { flex-direction: row-reverse; }
    .avatar { 
      width: 40px; 
      height: 40px; 
      border-radius: 50%; 
      flex-shrink: 0;
      object-fit: cover;
    }
    .msg.other .avatar { margin-right: 10px; }
    .msg.me .avatar { margin-left: 10px; }
    .bubble { 
      max-width: 70%; 
      padding: 10px 14px; 
      border-radius: 12px;
      position: relative;
    }
    .msg.other .bubble { 
      background: #fff; 
      border: 1px solid #e8e8e8;
    }
    .msg.me .bubble { 
      background: #FFE14D; 
      color: #333;
    }
    .quote {
      font-size: 12px;
      color: #999;
      padding: 6px 8px;
      background: rgba(0,0,0,0.05);
      border-radius: 4px;
      margin-bottom: 8px;
      border-left: 3px solid #ddd;
    }
    .text { font-size: 14px; word-break: break-word; }
    .chat-img { 
      max-width: 200px; 
      max-height: 300px;
      border-radius: 8px; 
      display: block;
    }
    .chat-video { 
      max-width: 200px; 
      border-radius: 8px; 
    }
    .time { 
      font-size: 11px; 
      color: #999; 
      margin-top: 6px;
      text-align: right;
    }
    .msg.me .time { color: rgba(0,0,0,0.5); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">💬 聊天记录：${escapeHtml(chatTitle)}</div>
    <div class="meta">📅 导出时间：${new Date().toLocaleString('zh-CN')} | 📱 来源：闲鱼</div>
    <div class="chat">
      ${messagesHtml}
    </div>
  </div>
</body>
</html>`;
}

// 生成 Markdown
function generateMarkdown(msgs) {
  let md = `# 聊天记录：${chatTitle}\n\n`;
  md += `> 导出时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
  
  let lastTime = '';
  msgs.forEach(msg => {
    if (msg.timestamp && msg.timestamp !== lastTime) {
      md += `### ${msg.timestamp}\n\n`;
      lastTime = msg.timestamp;
    }
    
    const sender = msg.isMe ? '**我**' : `**${chatTitle}**`;
    
    if (msg.quote) {
      md += `> ${msg.quote}\n\n`;
    }
    
    if (msg.imageUrl) {
      md += `${sender}：![图片](${msg.imageUrl})\n\n`;
    } else if (msg.videoUrl) {
      md += `${sender}：[视频](${msg.videoUrl})\n\n`;
    } else {
      md += `${sender}：${msg.text}\n\n`;
    }
  });
  
  return md;
}

// 工具函数
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

function showEmpty() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('empty').style.display = 'block';
}

function showContent() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
}
