export const convertTimeToSeconds = (time: string): number => {
    const [seconds, minutes, hours] = time.split(':').reverse();
    return parseInt(hours || '0', 10) * 3600 + parseInt(minutes || '0', 10) * 60 + parseInt(seconds, 10);
};