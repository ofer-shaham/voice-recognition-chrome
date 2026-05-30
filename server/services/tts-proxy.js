async function fetchTtsAudio(text, lang) {
  const shortLang = String(lang).split("-")[0];
  const encoded   = encodeURIComponent(String(text).slice(0, 200));
  const url       = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${shortLang}&client=tw-ob&q=${encoded}`;
  const upstream  = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!upstream.ok) {
    const err = new Error(`TTS upstream returned ${upstream.status}`);
    err.status = upstream.status;
    throw err;
  }
  return Buffer.from(await upstream.arrayBuffer());
}

module.exports = { fetchTtsAudio };
