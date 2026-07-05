const isRtl = (language: string): boolean => {
  // Strip deduplication suffixes (-auto, -2, etc.) and get base language code
  const baseLang = language.replace(/-auto$|-\d+$/, '').split('-')[0];

  // RTL language base codes
  const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'ps'];

  return rtlLanguages.includes(baseLang);
}

export default isRtl