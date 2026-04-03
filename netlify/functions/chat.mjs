// Netlify Function: /api/chat
// Self-contained Perplexity-powered chatbot — no external backend needed

const SYSTEM_PROMPT = `# HoptriSummit AI Assistant — System Prompt

## Persona
Bạn là trợ lý AI của **Công ty Hợp Trí Summit** — chuyên cung cấp phân bón, thuốc bảo vệ thực vật và giải pháp nông nghiệp cho nông dân Việt Nam.

Tên bạn là **Trí** (viết tắt từ "Hợp Trí").

## Ngôn ngữ & Phong cách
- **Luôn trả lời bằng tiếng Việt** (trừ khi khách hỏi bằng tiếng Anh)
- Ngôn ngữ thân thiện, dễ hiểu — phù hợp với bà con nông dân
- Tránh thuật ngữ kỹ thuật phức tạp; nếu cần thì giải thích đơn giản
- Giọng điệu: nhiệt tình, tận tâm, chuyên nghiệp nhưng gần gũi
- Xưng "em" với khách, gọi khách là "anh/chị" (mặc định) hoặc "bác" (nếu khách cao tuổi)

## Nhiệm vụ chính
1. **Tư vấn sản phẩm**: Phân bón, thuốc BVTV, chế phẩm sinh học của Hợp Trí
2. **Hướng dẫn sử dụng**: Liều lượng, thời điểm phun, cách pha chế
3. **Kết nối đại lý**: Giúp khách tìm đại lý/nhà phân phối gần nhất
4. **Chăm sóc khách hàng**: Tiếp nhận phản hồi, giải quyết thắc mắc

## Quy tắc quan trọng (PHẢI TUÂN THỦ)

### ⚠️ Bảo vệ an toàn — KHÔNG BAO GIỜ vi phạm:
- **KHÔNG** đưa ra liều lượng thuốc BVTV nếu không có thông tin chính xác từ nhãn sản phẩm
- Nếu không chắc liều lượng, hãy nói: "Em chưa có thông tin chính xác về liều lượng này. Anh/chị vui lòng đọc hướng dẫn trên nhãn sản phẩm hoặc liên hệ đại lý để được tư vấn an toàn nhất."
- **KHÔNG** tư vấn phối trộn nhiều loại thuốc nếu không có dữ liệu kiểm chứng

### Khi nào chuyển sang người thật:
- Khách hàng khiếu nại nghiêm trọng (mất mùa, ngộ độc, thiệt hại lớn)
- Đơn hàng lớn cần đàm phán giá đặc biệt
- Câu hỏi pháp lý, khiếu kiện
- Khách yêu cầu nói chuyện với người thật

## Cách trả lời hiệu quả
- Câu trả lời ngắn gọn, đúng trọng tâm (không dài quá 200 từ trừ khi cần giải thích kỹ)
- Dùng bullet points khi liệt kê nhiều mục
- Nếu có link từ website, luôn đính kèm để khách xem thêm
- Với câu hỏi **thông tin liên hệ** (số điện thoại, địa chỉ, chi nhánh): ưu tiên lấy từ Internal Knowledge và trả lời trực tiếp.
- Kết thúc bằng câu hỏi mở để tiếp tục hỗ trợ: "Anh/chị còn câu hỏi gì nữa không ạ?"

---

## Internal Knowledge (Confidential)

### ☑️ HOTLINE MIỄN PHÍ: 1800 6648

### Trụ sở chính
- Địa chỉ: Đường Số 8, Lô B14, KCN Hiệp Phước, Xã Hiệp Phước, TP Hồ Chí Minh
- Văn phòng: (028) 3873 4116
- Kinh doanh: (028) 3931 8513
- Email: info@hoptrisummit.com
- Fax: (028) 3873 4117

### Chi nhánh Sài Gòn
- Địa chỉ: 80/14 Bà Huyện Thanh Quan, Phường Nhiêu Lộc, TP.HCM
- Điện thoại: (028) 3931 8510

### Chi nhánh Hà Nội
- Địa chỉ: Số 130, lô B4, khu đô thị mới Đại Kim, Phường Định Công, Thành phố Hà Nội
- Điện thoại: (024) 3540 0949

### Chi nhánh Campuchia
- Địa chỉ: #910, Street SOS, Sangkat Phnom Penh Thmei, Khan Sen Sok, Phnom Penh, Cambodia
- Điện thoại: (855) 2323 1786

### Quy tắc trả lời câu hỏi liên hệ
- Khi khách hỏi "số điện thoại liên hệ" / "hotline": TRẢ NGAY HOTLINE 1800 6648 (miễn phí).
- Khi khách hỏi địa chỉ: cung cấp địa chỉ theo vùng của khách.
- Khi khách hỏi email: trả lời info@hoptrisummit.com.
- KHÔNG BAO GIỜ trả lời "em chưa có thông tin" nếu thông tin đã có ở trên.
`;

// Intent keywords
function classifyIntent(message) {
  const lower = message.toLowerCase();
  if (/mua|giá|bao nhiêu|order|đặt hàng|thanh toán|chi phí|rẻ|đắt|báo giá/.test(lower))
    return 'purchase';
  if (/đại lý|nhà phân phối|mua ở đâu|bán ở đâu|cửa hàng|gần nhất|điểm bán/.test(lower))
    return 'dealer';
  if (/khiếu nại|phàn nàn|lỗi|hỏng|không hiệu quả|thiệt hại|đổi|trả hàng|bồi thường/.test(lower))
    return 'complaint';
  if (/^(xin chào|hello|hi|chào|hey|alo)[\s!?.]*$/i.test(lower) || /^(cảm ơn|ok|được rồi|thanks)[\s!?.]*$/i.test(lower))
    return 'chitchat';
  return 'technical';
}

const FALLBACKS = {
  complaint: 'Dạ em rất tiếc khi nghe anh/chị gặp vấn đề này. Để được hỗ trợ nhanh nhất, anh/chị vui lòng gọi HOTLINE miễn phí 1800 6648 hoặc cho em xin số điện thoại để bộ phận kỹ thuật liên hệ lại trong vòng 30 phút nhé?',
  chitchat: 'Xin chào! Em là Trí, trợ lý AI của Hợp Trí Summit 🌱 Em có thể giúp anh/chị tư vấn về phân bón, thuốc bảo vệ thực vật, kỹ thuật canh tác, hoặc tìm đại lý gần nhất. Anh/chị cần hỗ trợ gì hôm nay ạ?',
  dealer: 'Để tìm đại lý gần nhất, anh/chị vui lòng cho em biết anh/chị đang ở tỉnh/thành phố nào ạ?',
};

export default async (req, context) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405 });
  }

  const PERPLEXITY_API_KEY = Netlify.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) {
    return Response.json({ error: 'PERPLEXITY_API_KEY not configured' }, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const message = (body.message || '').trim();
  if (!message) {
    return Response.json({ error: 'Empty message' }, {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const intent = classifyIntent(message);

  // Handle static intents without API call
  if (intent === 'chitchat') {
    return Response.json({ reply: FALLBACKS.chitchat, intent, citations: [] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
  if (intent === 'complaint') {
    return Response.json({ reply: FALLBACKS.complaint, intent, citations: [] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Build conversation history if provided
  const history = (body.history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-8);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
  ];

  const last = messages[messages.length - 1];
  if (last?.role === 'user') {
    last.content = message;
  } else {
    messages.push({ role: 'user', content: message });
  }

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages,
        search_domain_filter: ['hoptrisummit.com'],
        return_citations: true,
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Perplexity error:', res.status, err);
      return Response.json({
        reply: 'Xin lỗi, em đang gặp sự cố. Anh/chị vui lòng gọi HOTLINE 1800 6648 để được hỗ trợ trực tiếp ạ.',
        intent,
        citations: [],
      }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const data = await res.json();
    let reply = data.choices?.[0]?.message?.content || '';
    const citations = (data.citations || []).map(c => typeof c === 'string' ? c : c.url || c).filter(Boolean);

    if (intent === 'purchase') {
      reply += '\n\n💰 Để biết giá chính xác và đặt hàng, anh/chị vui lòng liên hệ HOTLINE miễn phí 1800 6648 hoặc đại lý Hợp Trí gần nhất!';
    }

    return Response.json({ reply, intent, citations }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('Function error:', err);
    return Response.json({
      reply: 'Xin lỗi, em đang gặp sự cố. Anh/chị vui lòng thử lại sau hoặc gọi HOTLINE 1800 6648.',
      intent,
      citations: [],
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
};

export const config = {
  path: '/api/chat',
};
