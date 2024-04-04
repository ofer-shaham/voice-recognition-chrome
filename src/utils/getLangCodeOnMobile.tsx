export const getLangCodeOnMobile = (lang: string, isMobile: boolean) => {
    if (isMobile)
        return lang.replace('-', '_');
    return lang;
};
