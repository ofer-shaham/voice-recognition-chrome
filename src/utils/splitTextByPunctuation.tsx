
export const splitTextByEndlAndPunctuation = (text: string): string[] => {
    const pattern = /[\r?\n!.,;?]/;
    const splitText = text.split(pattern);
    const filteredText = splitText.filter((word) => word.trim() !== "");
    return filteredText;
};
