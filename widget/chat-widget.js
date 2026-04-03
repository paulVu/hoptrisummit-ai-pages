/**
 * HoptriSummit AI Chat Widget — Embeddable vanilla JS
 *
 * Usage:
 *   <script src="https://your-server/widget/chat-widget.js"
 *           data-server="https://your-server"></script>
 *
 * Options (data- attributes on the script tag):
 *   data-server    — Backend URL (default: same origin)
 *   data-position  — "right" (default) or "left"
 *   data-primary   — Primary color hex (default: #2e7d32)
 *   data-welcome   — Custom welcome message
 */

(function () {
  'use strict';

  // ── Config from script tag ──────────────────────────────────────────
  const scriptTag = document.currentScript || document.querySelector('script[src*="chat-widget"]');
  const SERVER_ATTR = (scriptTag?.getAttribute('data-server') || window.__HTS_SERVER__ || '').trim();
  const HAS_CUSTOM_SERVER = SERVER_ATTR.length > 0;
  const SERVER = SERVER_ATTR.replace(/\/$/, '') || window.location.origin;
  const POSITION = scriptTag?.getAttribute('data-position') || 'right';
  const PRIMARY = scriptTag?.getAttribute('data-primary') || '#2e7d32';
  const CUSTOM_WELCOME = scriptTag?.getAttribute('data-welcome') || '';
  const SCRIPT_SRC = scriptTag?.src || '';
  const WIDGET_BASE = SCRIPT_SRC ? SCRIPT_SRC.split('/').slice(0, -1).join('/') : (SERVER + '/widget');
  const IS_STATIC_HOST = /github\.io$/i.test(window.location.hostname) || /netlify\.app$/i.test(window.location.hostname);

  // ── Load CSS ────────────────────────────────────────────────────────
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = WIDGET_BASE + '/chat-widget.css';
  document.head.appendChild(cssLink);

  // ── Build DOM ───────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'hts-widget-container';
  container.innerHTML = `
    <button id="hts-launcher" aria-label="Mở chat">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
    </button>
    <div id="hts-chat">
      <div id="hts-header">
        <div id="hts-avatar">🌱</div>
        <div id="hts-header-info">
          <h3>Trí — Hợp Trí Summit</h3>
          <p>Trợ lý AI Nông nghiệp</p>
        </div>
        <button id="hts-close" aria-label="Đóng">✕</button>
      </div>
      <div id="hts-messages"></div>
      <div id="hts-quick-actions">
        <button class="hts-quick-btn" data-template="product">🔎 Tìm kiếm sản phẩm</button>
        <button class="hts-quick-btn" data-template="technical">🌾 Tư vấn kỹ thuật</button>
        <button class="hts-quick-btn" data-template="dealer">📍 Tìm đại lý</button>
        <button class="hts-quick-btn" data-template="sales">🤝 Kết nối sales</button>
      </div>
      <div id="hts-input-area">
        <textarea id="hts-input" rows="1" placeholder="Nhập tin nhắn..." autocomplete="off"></textarea>
        <button id="hts-send" aria-label="Gửi">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div id="hts-powered">Powered by Hợp Trí Summit AI</div>
    </div>
  `;
  document.body.appendChild(container);

  // ── Apply custom position ───────────────────────────────────────────
  if (POSITION === 'left') {
    document.getElementById('hts-launcher').style.cssText += 'right:auto;left:24px;';
    document.getElementById('hts-chat').style.cssText += 'right:auto;left:24px;';
  }

  // ── Apply custom primary color ──────────────────────────────────────
  if (PRIMARY !== '#2e7d32') {
    container.style.setProperty('--hts-primary', PRIMARY);
    container.style.setProperty('--hts-user-bubble', PRIMARY);
  }

  // ── Elements ────────────────────────────────────────────────────────
  const launcher = document.getElementById('hts-launcher');
  const chat = document.getElementById('hts-chat');
  const closeBtn = document.getElementById('hts-close');
  const messages = document.getElementById('hts-messages');
  const input = document.getElementById('hts-input');
  const sendBtn = document.getElementById('hts-send');
  const quickButtons = Array.from(document.querySelectorAll('.hts-quick-btn'));

  const QUICK_TEMPLATES = {
    product: 'Em muốn tìm sản phẩm phù hợp cho cây trồng [ghi rõ cây trồng] tại khu vực [tỉnh/thành].',
    technical: 'Anh/chị tư vấn giúp em vấn đề kỹ thuật: cây [ghi rõ cây] đang gặp tình trạng [mô tả triệu chứng].',
    dealer: 'Em muốn tìm đại lý Hợp Trí gần [ghi rõ tỉnh/thành], vui lòng gửi địa chỉ và số điện thoại.',
    sales: 'Em muốn được bộ phận kinh doanh liên hệ tư vấn. Số điện thoại của em là [điền số].',
  };

  let ws = null;
  let isOpen = false;
  let isConnected = false;
  const conversationHistory = []; // REST mode conversation memory

  // Detect mode: REST (Netlify/static with /api/chat) or WebSocket (self-hosted)
  const USE_REST = !HAS_CUSTOM_SERVER; // same-origin = Netlify function at /api/chat
  const API_URL = SERVER + '/api/chat';

  // ── Toggle Chat ─────────────────────────────────────────────────────
  launcher.addEventListener('click', () => {
    isOpen = !isOpen;
    chat.classList.toggle('hts-open', isOpen);
    launcher.style.display = isOpen ? 'none' : 'flex';
    if (isOpen) {
      if (USE_REST) {
        if (!isConnected) {
          isConnected = true;
          addBotMessage(CUSTOM_WELCOME || 'Xin chào! Em là Trí, trợ lý AI của Hợp Trí Summit. Em có thể giúp gì cho anh/chị hôm nay ạ? 🌱');
        }
      } else if (!ws) {
        connect();
      }
      input.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    isOpen = false;
    chat.classList.remove('hts-open');
    launcher.style.display = 'flex';
  });

  // ── WebSocket Connection (self-hosted mode) ─────────────────────────
  function connect() {
    const wsUrl = SERVER.replace(/^http/, 'ws') + '/ws/chat';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isConnected = true;
      console.log('[hts-widget] Connected via WebSocket');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.onclose = () => {
      isConnected = false;
      ws = null;
      console.log('[hts-widget] Disconnected');
      if (isOpen) setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('[hts-widget] WebSocket error:', err);
    };
  }

  // ── Handle Incoming Messages (WebSocket mode) ───────────────────────
  function handleMessage(data) {
    switch (data.type) {
      case 'connected':
        addBotMessage(CUSTOM_WELCOME || data.message);
        break;
      case 'bot_message':
        removeTyping();
        addBotMessage(data.content, data.citations);
        break;
      case 'typing':
        if (data.status) showTyping();
        else removeTyping();
        break;
      case 'error':
        removeTyping();
        addBotMessage('⚠️ ' + (data.message || 'Có lỗi xảy ra'));
        break;
    }
  }

  // ── Add Messages to UI ──────────────────────────────────────────────
  function addBotMessage(text, citations) {
    const el = document.createElement('div');
    el.className = 'hts-msg hts-msg-bot';
    el.innerHTML = renderMarkdown(text);

    if (citations && citations.length > 0) {
      const citDiv = document.createElement('div');
      citDiv.className = 'hts-citations';
      citDiv.innerHTML = '📎 ' + citations
        .map((c, i) => `<a href="${escHtml(c)}" target="_blank" rel="noopener">Nguồn ${i + 1}</a>`)
        .join(' · ');
      el.appendChild(citDiv);
    }

    messages.appendChild(el);
    scrollBottom();
  }

  function addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'hts-msg hts-msg-user';
    el.textContent = text;
    messages.appendChild(el);
    scrollBottom();
  }

  function showTyping() {
    if (document.getElementById('hts-typing')) return;
    const el = document.createElement('div');
    el.id = 'hts-typing';
    el.className = 'hts-typing';
    el.innerHTML = '<div class="hts-typing-dot"></div><div class="hts-typing-dot"></div><div class="hts-typing-dot"></div>';
    messages.appendChild(el);
    scrollBottom();
  }

  function removeTyping() {
    const el = document.getElementById('hts-typing');
    if (el) el.remove();
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  // ── Send Message ────────────────────────────────────────────────────
  function sendMessage() {
    const text = input.value.trim();
    if (!text || !isConnected) return;

    addUserMessage(text);
    input.value = '';
    autoResize();
    input.focus();

    if (USE_REST) {
      sendREST(text);
    } else {
      ws.send(JSON.stringify({ type: 'message', content: text }));
    }
  }

  // ── REST mode send (Netlify Functions) ──────────────────────────────
  async function sendREST(text) {
    showTyping();
    conversationHistory.push({ role: 'user', content: text });

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: conversationHistory.slice(-8),
        }),
      });

      const data = await res.json();
      removeTyping();

      const reply = data.reply || 'Xin lỗi, em gặp sự cố. Vui lòng thử lại.';
      conversationHistory.push({ role: 'assistant', content: reply });
      addBotMessage(reply, data.citations);
    } catch (err) {
      console.error('[hts-widget] REST error:', err);
      removeTyping();
      addBotMessage('⚠️ Không thể kết nối. Vui lòng thử lại sau.');
    }
  }

  sendBtn.addEventListener('click', sendMessage);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  quickButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-template');
      const template = QUICK_TEMPLATES[key];
      if (!template) return;

      const current = input.value.trim();
      input.value = current ? `${current}\n${template}` : template;
      autoResize();
      input.focus();
    });
  });

  // Auto-resize textarea
  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  }
  input.addEventListener('input', autoResize);

  // ── Helpers ─────────────────────────────────────────────────────────
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Lightweight markdown → HTML renderer (no dependencies).
   * Supports: bold, italic, inline code, code blocks, links, lists, headings, line breaks, citation refs.
   */
  function renderMarkdown(text) {
    if (!text) return '';
    let html = escHtml(text);

    // Code blocks: ```...```
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    // Inline code: `...`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold + italic: ***text***
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Headings: ### h4, ## h3, # h2
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Unordered lists: - item
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function(m) { return '<ul>' + m + '</ul>'; });
    // Horizontal rule: ---
    html = html.replace(/^---$/gm, '<hr>');
    // Citation refs like [1][2] → superscript
    html = html.replace(/\[(\d+)\]/g, '<sup class="hts-cite-ref">[$1]</sup>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    // Clean up extra <br> around block elements
    html = html.replace(/<br>\s*(<\/?(?:ul|ol|li|h[2-4]|pre|hr))/g, '$1');
    html = html.replace(/(<\/(?:ul|ol|li|h[2-4]|pre|hr)>)\s*<br>/g, '$1');

    return html;
  }
})();
