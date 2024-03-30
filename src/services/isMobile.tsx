//load available voices
export const isMobile = /Mobi|Android/i.test(navigator.userAgent);
if (isMobile) {
    console.log('Browser is running on a mobile phone');
} else {
    console.log('Browser is running on a PC');
}
