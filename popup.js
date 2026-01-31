// 存储解析后的消息
let messages = [];
let chatTitle = '聊天记录';
let currentPlatform = 'unknown'; // 'xianyu' | 'fiverr' | 'unknown'

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 检测平台
    if (tab.url.includes('xianyu.com') || tab.url.includes('goofish.com')) {
      currentPlatform = 'xianyu';
    } else if (tab.url.includes('fiverr.com')) {
      currentPlatform = 'fiverr';
    } else {
      showEmpty();
      return;
    }

    // 根据平台注入不同的提取脚本
    const extractFunc = currentPlatform === 'fiverr' ? extractFiverrMessages : extractXianyuMessages;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractFunc
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

// ==================== 闲鱼消息提取 ====================
function extractXianyuMessages() {
  const messages = [];
  
  // 获取聊天对象名称
  const chatTitle = document.querySelector('[class*="nickname"]')?.textContent?.trim()
    || document.querySelector('[class*="user-name"]')?.textContent?.trim()
    || '聊天记录';

  // 获取所有消息元素（排除商品卡片等非聊天消息）
  const allElements = document.querySelectorAll('[class*="ant-list-item"]');
  const messageElements = Array.from(allElements).filter(el => {
    // 排除商品卡片（通常包含价格信息）
    if (el.querySelector('[class*="price"]')) return false;
    // 排除没有消息文本和媒体的元素
    const hasText = el.querySelector('[class*="message-text"]');
    const hasImage = el.querySelector('[class*="image-container"]');
    const hasVideo = el.querySelector('video');
    return hasText || hasImage || hasVideo;
  });
  
  // 判断是否是有效头像（排除占位图）
  function isValidAvatar(url) {
    if (!url) return false;
    // 排除 2x2 像素的占位图
    if (url.includes('tps-2-2') || url.includes('tps-1-1')) return false;
    // 排除明显的占位图模式
    if (url.includes('placeholder') || url.includes('default')) return false;
    return true;
  }
  
  // 第一遍：先扫描所有消息，找到有效的头像
  let validMyAvatar = '';
  let validOtherAvatar = '';
  
  messageElements.forEach((el) => {
    const style = el.getAttribute('style') || '';
    const isMe = style.includes('direction: rtl') || style.includes('text-align: right');
    const avatarEl = el.querySelector('[class*="avatar"]');
    let avatarSrc = avatarEl?.getAttribute('src') || '';
    if (avatarSrc.startsWith('//')) avatarSrc = 'https:' + avatarSrc;
    
    if (isValidAvatar(avatarSrc)) {
      if (isMe && !validMyAvatar) {
        validMyAvatar = avatarSrc;
      } else if (!isMe && !validOtherAvatar) {
        validOtherAvatar = avatarSrc;
      }
    }
  });
  
  // 第二遍：提取消息，使用有效头像填充
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
    let quoteImage = '';
    let quoteIsVideo = false;
    let quoteVideoUrl = '';
    if (quoteEl) {
      const quoteName = quoteEl.querySelector('[class*="user-nickname"]')?.textContent?.trim() || '';
      
      // 检查引用是否包含视频
      const quoteVideoEl = quoteEl.querySelector('video');
      if (quoteVideoEl) {
        quoteIsVideo = true;
        quoteVideoUrl = quoteVideoEl.getAttribute('src') || '';
        if (quoteVideoUrl.startsWith('//')) quoteVideoUrl = 'https:' + quoteVideoUrl;
      }
      
      // 检查引用是否包含图片
      const quoteImgEl = quoteEl.querySelector('[class*="reply-image"] img:first-child');
      if (quoteImgEl) {
        let imgSrc = quoteImgEl.getAttribute('src') || '';
        if (imgSrc.startsWith('//')) imgSrc = 'https:' + imgSrc;
        // 检查是否是有效图片（排除占位图）
        if (isValidAvatar(imgSrc)) {
          quoteImage = imgSrc;
        } else {
          // 尝试获取高清图（ant-image-img）
          const hdImg = quoteEl.querySelector('.ant-image-img');
          if (hdImg) {
            let hdSrc = hdImg.getAttribute('src') || '';
            if (hdSrc.startsWith('//')) hdSrc = 'https:' + hdSrc;
            if (isValidAvatar(hdSrc)) {
              quoteImage = hdSrc;
            }
          }
        }
      }
      
      // 获取引用文本
      let quoteText = '';
      
      // 方法1: 查找带 opacity 样式的 span（文字引用的常见格式）
      const opacitySpan = quoteEl.querySelector('span[style*="opacity"]');
      if (opacitySpan) {
        quoteText = opacitySpan.textContent?.trim() || '';
      }
      
      // 方法2: 查找 reply-content 或 reply-text 类
      if (!quoteText) {
        const replyContent = quoteEl.querySelector('[class*="reply-content"], [class*="reply-text"]');
        if (replyContent) {
          quoteText = replyContent.textContent?.trim() || '';
        }
      }
      
      // 方法3: 如果是视频引用但没有文本，显示 [视频]
      if (!quoteText && quoteIsVideo) {
        quoteText = '[视频]';
      }
      
      // 方法4: 如果有图片但没有文本，显示 [图片]
      if (!quoteText && quoteImage) {
        quoteText = '[图片]';
      }
      
      if (quoteName || quoteText) {
        quote = `${quoteName}: ${quoteText}`;
      }
    }
    
    // 如果引用包含视频，且当前消息的视频URL和引用视频URL相同，说明视频是引用的，不是消息本身的
    // 保留 quoteVideoUrl 用于在引用框内显示视频
    if (quoteIsVideo && quoteVideoUrl && videoUrl === quoteVideoUrl) {
      videoUrl = '';
    }
    
    // 如果引用包含图片，且当前消息的图片URL和引用图片URL相同（或类似），说明图片是引用的
    if (quoteImage && imageUrl) {
      // 提取图片ID进行比较（因为引用图片和原图可能URL略有不同）
      const getImageId = (url) => {
        const match = url.match(/O1CN[A-Za-z0-9]+/);
        return match ? match[0] : url;
      };
      if (getImageId(imageUrl) === getImageId(quoteImage)) {
        imageUrl = '';
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
    
    // 获取头像（智能处理占位图）
    const avatarEl = el.querySelector('[class*="avatar"]');
    let avatarSrc = avatarEl?.getAttribute('src') || '';
    if (avatarSrc.startsWith('//')) avatarSrc = 'https:' + avatarSrc;
    
    // 如果当前头像无效，使用预先找到的有效头像
    let avatar = isValidAvatar(avatarSrc) ? avatarSrc : (isMe ? validMyAvatar : validOtherAvatar);
    
    if (text || imageUrl || videoUrl) {
      messages.push({
        id: index,
        isMe,
        text,
        imageUrl,
        videoUrl,
        quote,
        quoteImage,
        quoteIsVideo,
        quoteVideoUrl,
        timestamp,
        avatar,
        selected: true
      });
    }
  });

  return { messages, chatTitle };
}

// ==================== Fiverr 消息提取 ====================
function extractFiverrMessages() {
  const messages = [];

  // 获取聊天对象名称（从页面标题或头部信息获取）
  let chatTitle = 'Fiverr Chat';

  // 尝试从消息中提取对方的用户名
  const allMessages = document.querySelectorAll('.message');
  for (const msg of allMessages) {
    const nameEl = msg.querySelector('p');
    const name = nameEl?.textContent?.trim();
    if (name && name !== 'Me') {
      chatTitle = name;
      break;
    }
  }

  // 从 URL 中提取用户名作为备选
  const urlMatch = location.pathname.match(/\/inbox\/([^\/]+)/);
  if (urlMatch && chatTitle === 'Fiverr Chat') {
    chatTitle = urlMatch[1];
  }

  // 获取所有消息
  allMessages.forEach((el, index) => {
    // 获取完整的 textContent 来解析
    const fullText = el.textContent || '';

    // 解析用户名（第一个非空文本通常是头像字母+用户名）
    // 格式: "HMike N.21 Dec 2025, 11:29消息内容" 或 "DMe21 Dec 2025, 13:33消息内容"
    let sender = '';
    let timestamp = '';
    let text = '';

    // 尝试从 figure title 获取用户名
    const figureEl = el.querySelector('figure[title]');
    const figureTitle = figureEl?.getAttribute('title') || '';

    // 尝试从 p 元素获取显示名称
    const nameEl = el.querySelector('p');
    const displayName = nameEl?.textContent?.trim() || '';

    // 判断是否是自己的消息
    const isMe = displayName === 'Me';

    // 提取时间戳 (格式: "21 Dec 2025, 11:29")
    const timeMatch = fullText.match(/(\d{1,2}\s+\w+\s+\d{4},\s+\d{1,2}:\d{2})/);
    if (timeMatch) {
      timestamp = timeMatch[1];
    }

    // 提取消息文本
    // 消息文本通常在时间戳之后
    if (timeMatch) {
      const timeIndex = fullText.indexOf(timeMatch[0]);
      const afterTime = fullText.substring(timeIndex + timeMatch[0].length).trim();
      text = afterTime;
    } else {
      // 如果没有找到时间戳，尝试获取最后的文本部分
      const textParts = fullText.split(/\d{1,2}:\d{2}/);
      if (textParts.length > 1) {
        text = textParts[textParts.length - 1].trim();
      }
    }

    // 清理文本（移除前导的用户名部分）
    if (text.startsWith(displayName)) {
      text = text.substring(displayName.length).trim();
    }

    // 获取头像
    const avatarEl = el.querySelector('figure img');
    let avatar = avatarEl?.getAttribute('src') || '';

    // 检查是否有图片附件
    let imageUrl = '';
    const attachmentImg = el.querySelector('.message-content img:not(figure img)');
    if (attachmentImg) {
      imageUrl = attachmentImg.getAttribute('src') || '';
      if (!text) text = '[图片]';
    }

    // 检查是否有文件附件
    const fileAttachment = el.querySelector('[class*="attachment"], [class*="file"]');
    if (fileAttachment && !text) {
      text = '[文件]';
    }

    if (text) {
      messages.push({
        id: index,
        isMe,
        text,
        imageUrl,
        videoUrl: '',
        quote: '',
        quoteImage: '',
        quoteIsVideo: false,
        quoteVideoUrl: '',
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
          <span class="message-sender ${msg.isMe ? 'me' : ''}">${msg.isMe ? (currentPlatform === 'fiverr' ? 'Me' : '我') : chatTitle}</span>
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

// 绑定事件（在 DOMContentLoaded 后自动执行，因为 script 在 body 底部）
function bindEvents() {
  // 全选切换
  document.getElementById('selectAll')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    messages.forEach(m => m.selected = checked);
    document.querySelectorAll('.message-item input[type="checkbox"]').forEach(cb => {
      cb.checked = checked;
    });
    updateStatus();
  });

  // 导出 HTML
  document.getElementById('exportHtml')?.addEventListener('click', () => {
  try {
    const selected = messages.filter(m => m.selected);
    if (selected.length === 0) {
      alert('请至少选择一条消息');
      return;
    }
    
    console.log('开始导出 HTML，选中消息数:', selected.length);
    const html = generateHtml(selected);
    console.log('HTML 生成成功，长度:', html.length);
    downloadFile(html, `聊天记录_${chatTitle}_${getDateStr()}.html`, 'text/html');
    
    // 调试模式：同时导出 JSON 原始数据
    if (document.getElementById('debugMode').checked) {
      const debugData = {
        exportTime: new Date().toISOString(),
        chatTitle: chatTitle,
        totalMessages: messages.length,
        selectedMessages: selected.length,
        messages: selected
      };
      const json = JSON.stringify(debugData, null, 2);
      downloadFile(json, `调试数据_${chatTitle}_${getDateStr()}.json`, 'application/json');
    }
  } catch (error) {
    console.error('导出 HTML 失败:', error);
    alert('导出失败: ' + error.message);
  }
  });

  // 导出 Markdown
  document.getElementById('exportMd')?.addEventListener('click', () => {
    try {
      const selected = messages.filter(m => m.selected);
      if (selected.length === 0) {
        alert('请至少选择一条消息');
        return;
      }
      
      console.log('开始导出 Markdown，选中消息数:', selected.length);
      const md = generateMarkdown(selected);
      downloadFile(md, `聊天记录_${chatTitle}_${getDateStr()}.md`, 'text/markdown');
      
      // 调试模式：同时导出 JSON 原始数据
      if (document.getElementById('debugMode').checked) {
        const debugData = {
          exportTime: new Date().toISOString(),
          chatTitle: chatTitle,
          totalMessages: messages.length,
          selectedMessages: selected.length,
          messages: selected
        };
        const json = JSON.stringify(debugData, null, 2);
        downloadFile(json, `调试数据_${chatTitle}_${getDateStr()}.json`, 'application/json');
      }
    } catch (error) {
      console.error('导出 Markdown 失败:', error);
      alert('导出失败: ' + error.message);
    }
  });
  
  console.log('事件绑定完成');
}

// 立即绑定事件
bindEvents();

// 生成引用 HTML
function generateQuoteHtml(msg) {
  if (!msg.quote) return '';
  
  let quoteContent = '';
  if (msg.quoteImage) {
    // 引用包含图片
    quoteContent = `
      <div class="quote">
        <div class="quote-text">${escapeHtml(msg.quote)}</div>
        <img class="quote-img" src="${msg.quoteImage}" alt="引用图片">
      </div>`;
  } else if (msg.quoteIsVideo && msg.quoteVideoUrl) {
    // 引用包含视频 - 显示小视频播放器
    quoteContent = `
      <div class="quote">
        <div class="quote-text">${escapeHtml(msg.quote)}</div>
        <video class="quote-video" src="${msg.quoteVideoUrl}" controls preload="metadata"></video>
      </div>`;
  } else if (msg.quoteIsVideo) {
    // 引用包含视频但没有URL（显示视频图标）
    quoteContent = `
      <div class="quote">
        <div class="quote-text">${escapeHtml(msg.quote)}</div>
        <div class="quote-video-icon">🎬</div>
      </div>`;
  } else {
    // 纯文本引用
    quoteContent = `<div class="quote">${escapeHtml(msg.quote)}</div>`;
  }
  return quoteContent;
}

// 生成 HTML
function generateHtml(msgs) {
  const messagesHtml = msgs.map(msg => `
    <div class="msg ${msg.isMe ? 'me' : 'other'}">
      <img class="avatar" src="${msg.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle fill=%22%23ddd%22 cx=%2220%22 cy=%2220%22 r=%2220%22/></svg>'}" alt="">
      <div class="bubble">
        ${generateQuoteHtml(msg)}
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
      max-width: 900px; 
      width: 80%;
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
      padding: 8px 10px;
      background: rgba(0,0,0,0.05);
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 3px solid #ddd;
    }
    .quote-text {
      margin-bottom: 6px;
    }
    .quote-img {
      max-width: 80px;
      max-height: 120px;
      border-radius: 6px;
      display: block;
      cursor: pointer;
    }
    .quote-video {
      max-width: 120px;
      max-height: 160px;
      border-radius: 6px;
      display: block;
      margin-top: 6px;
    }
    .quote-video-icon {
      font-size: 24px;
      opacity: 0.7;
      margin-top: 4px;
    }
    .text { font-size: 14px; word-break: break-word; }
    .chat-img { 
      max-width: 200px; 
      max-height: 300px;
      border-radius: 8px; 
      display: block;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .chat-img:hover { opacity: 0.85; }
    .chat-video { 
      max-width: 200px; 
      border-radius: 8px;
      cursor: pointer;
    }
    .time { 
      font-size: 11px; 
      color: #999; 
      margin-top: 6px;
      text-align: right;
    }
    .msg.me .time { color: rgba(0,0,0,0.5); }
    
    /* Lightbox 遮罩层样式 */
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 9999;
      justify-content: center;
      align-items: center;
      cursor: zoom-out;
    }
    .lightbox.active { display: flex; }
    .lightbox-content {
      max-width: 90vw;
      max-height: 90vh;
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    .lightbox-close {
      position: absolute;
      top: 20px;
      right: 30px;
      font-size: 40px;
      color: #fff;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s;
      z-index: 10000;
    }
    .lightbox-close:hover { opacity: 1; }
    .lightbox-controls {
      position: absolute;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 12px;
      z-index: 10000;
    }
    .lightbox-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      backdrop-filter: blur(4px);
    }
    .lightbox-btn:hover { background: rgba(255, 255, 255, 0.3); }
    .lightbox-btn:active { transform: scale(0.95); }
    .zoom-info {
      color: #fff;
      font-size: 14px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 22px;
      backdrop-filter: blur(4px);
    }
    .lightbox video {
      max-width: 90vw;
      max-height: 90vh;
      width: auto;
      height: auto;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">💬 聊天记录：${escapeHtml(chatTitle)}</div>
    <div class="meta">📅 导出时间：${new Date().toLocaleString('zh-CN')} | 📱 来源：${currentPlatform === 'fiverr' ? 'Fiverr' : '闲鱼'}</div>
    <div class="chat">
      ${messagesHtml}
    </div>
  </div>
  
  <!-- Lightbox 遮罩层 -->
  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
    <div id="lightbox-body"></div>
    <div class="lightbox-controls" onclick="event.stopPropagation()">
      <button class="lightbox-btn" onclick="zoomOut()" title="缩小">−</button>
      <span class="zoom-info" id="zoom-info">100%</span>
      <button class="lightbox-btn" onclick="zoomIn()" title="放大">+</button>
      <button class="lightbox-btn" onclick="zoomReset()" title="重置">↺</button>
    </div>
  </div>
  
  <script>
    let currentZoom = 100;
    const ZOOM_STEP = 25;
    const ZOOM_MIN = 25;
    const ZOOM_MAX = 300;
    
    // 更新缩放显示
    function updateZoom() {
      const content = document.querySelector('#lightbox-body .lightbox-content');
      if (content) {
        content.style.transform = 'scale(' + (currentZoom / 100) + ')';
      }
      document.getElementById('zoom-info').textContent = currentZoom + '%';
    }
    
    // 放大
    function zoomIn() {
      if (currentZoom < ZOOM_MAX) {
        currentZoom += ZOOM_STEP;
        updateZoom();
      }
    }
    
    // 缩小
    function zoomOut() {
      if (currentZoom > ZOOM_MIN) {
        currentZoom -= ZOOM_STEP;
        updateZoom();
      }
    }
    
    // 重置
    function zoomReset() {
      currentZoom = 100;
      updateZoom();
    }
    
    // 点击图片打开 Lightbox
    document.querySelectorAll('.chat-img').forEach(img => {
      img.addEventListener('click', function(e) {
        e.stopPropagation();
        currentZoom = 100;
        const lightbox = document.getElementById('lightbox');
        const body = document.getElementById('lightbox-body');
        body.innerHTML = '<img class="lightbox-content" src="' + this.src + '" alt="大图" onclick="event.stopPropagation()">';
        document.getElementById('zoom-info').textContent = '100%';
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });
    
    // 点击视频打开 Lightbox
    document.querySelectorAll('.chat-video').forEach(video => {
      video.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        this.pause();
        currentZoom = 100;
        const lightbox = document.getElementById('lightbox');
        const body = document.getElementById('lightbox-body');
        body.innerHTML = '<video class="lightbox-content" src="' + this.src + '" controls autoplay onclick="event.stopPropagation()"></video>';
        document.getElementById('zoom-info').textContent = '100%';
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });
    
    // 关闭 Lightbox
    function closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      const body = document.getElementById('lightbox-body');
      // 停止视频播放
      const video = body.querySelector('video');
      if (video) video.pause();
      body.innerHTML = '';
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      currentZoom = 100;
    }
    
    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
      if (!document.getElementById('lightbox').classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === '0') zoomReset();
    });
    
    // 鼠标滚轮缩放
    document.getElementById('lightbox').addEventListener('wheel', function(e) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }, { passive: false });
  </script>
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
    
    const sender = msg.isMe ? (currentPlatform === 'fiverr' ? '**Me**' : '**我**') : `**${chatTitle}**`;
    
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
  // 根据平台更新标题
  const titleEl = document.getElementById('headerTitle');
  if (titleEl) {
    titleEl.textContent = currentPlatform === 'fiverr' ? 'Fiverr Chat Export' : '闲鱼聊天记录导出';
  }
}
