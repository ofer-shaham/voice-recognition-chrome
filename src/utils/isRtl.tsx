const isRtl = (language: string): boolean => {
    const rtlLanguages = ['ar-', 'he-', 'fa-IR', 'ur-', 'ps-']; // RTL language codes

     return rtlLanguages.some(code => language.startsWith(code));
}

export default isRtl