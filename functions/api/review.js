const ALLOWED_SERVICES = new Set([
  'Hair Colour',
  'Hair Treatment',
  'Haircut',
  'Perm',
  'Other',
]);

const ALLOWED_TAGS = new Set([
  'Loved the result',
  'Friendly stylist',
  'Good consultation',
  'Comfortable salon',
  'Good service',
  'Would come again',
  'Long waiting time',
  'Result was not what I expected',
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DEEPSEEK_API_KEY) {
    return json({ error: 'Review generator is not configured.' }, 503);
  }

  const origin = request.headers.get('Origin');
  const allowedOrigins = new Set([
    'https://amuse.com.my',
    'https://www.amuse.com.my',
  ]);

  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: 'Origin not allowed.' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: 'Invalid request.' }, 400);
  }

  const service = typeof body.service === 'string' ? body.service : '';
  const rating = Number(body.rating);
  const language = body.language === 'zh' ? 'zh' : body.language === 'en' ? 'en' : '';
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.filter((tag) => typeof tag === 'string' && ALLOWED_TAGS.has(tag)))].slice(0, 8)
    : [];

  if (!ALLOWED_SERVICES.has(service) || !Number.isInteger(rating) || rating < 1 || rating > 5 || !language) {
    return json({ error: 'Please choose a valid service, rating and language.' }, 400);
  }

  const languageInstruction = language === 'zh'
    ? 'Write in natural Simplified Chinese used by a real customer in Malaysia. Keep it conversational, not formal or promotional.'
    : 'Write in natural conversational English used by a real customer. Keep it concise and not promotional.';

  const systemPrompt = [
    'You help a salon customer turn their own selections into a Google review draft.',
    'Use ONLY the facts supplied in the user message.',
    'The selected star rating represents the customer\'s overall sentiment, so the tone may reflect that rating.',
    'Do not invent staff names, prices, waiting times, hair condition, specific techniques, specific results, or any other details that were not supplied.',
    'Do not claim the salon is the best, award-winning, cheap, or otherwise make marketing claims.',
    'Do not mention that AI wrote the review.',
    'Do not mention the numeric star rating in the review.',
    'If positive and negative tags are both supplied, preserve both fairly.',
    'Write in first person as the customer.',
    'Return only the review text with no heading, quotation marks, bullet points, explanation, or preamble.',
    'Aim for about 45 to 85 words in English, or a similarly concise length in Chinese.',
    languageInstruction,
  ].join(' ');

  const userPrompt = JSON.stringify({
    business: 'Amuse Hair Studio',
    service,
    rating,
    experience_tags: tags,
  });

  let upstream;
  try {
    upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_REVIEW_MODEL || 'deepseek-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        max_tokens: 220,
      }),
    });
  } catch (_) {
    return json({ error: 'Review generation service is temporarily unavailable.' }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('DeepSeek review generation failed', upstream.status, detail.slice(0, 500));
    return json({ error: 'Review generation service is temporarily unavailable.' }, 502);
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch (_) {
    return json({ error: 'Review generation service returned an invalid response.' }, 502);
  }

  const review = payload?.choices?.[0]?.message?.content?.trim?.() || '';

  if (!review) {
    return json({ error: 'No review draft was generated.' }, 502);
  }

  return json({ review });
}
