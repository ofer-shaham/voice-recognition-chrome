import React, { useEffect, useState } from 'react';

interface YouTubePlayerProps {
    videoId: string;
    videoUrl: string;
    startTime: string;
    stopTime: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, videoUrl, startTime, stopTime }) => {
    const [playerWidth, setPlayerWidth] = useState<number>(200);
    const [playerHeight, setPlayerHeight] = useState<number>(200);

    const convertTimeToSeconds = (time: string): number => {
        const [seconds, minutes, hours] = time.split(':').reverse();
        return parseInt(hours || '0', 10) * 3600 + parseInt(minutes || '0', 10) * 60 + parseInt(seconds, 10);
    };

    const startTimeInSeconds = convertTimeToSeconds(startTime);
    const stopTimeInSeconds = convertTimeToSeconds(stopTime);

    if (isNaN(startTimeInSeconds)) throw new Error('error calculating startTime');
    if (isNaN(stopTimeInSeconds)) throw new Error('error calculating startTime');


    useEffect(() => {
        const calculatePlayerSize = () => {
            const tableCell = document.getElementById('table-cell');
            if (tableCell) {
                const { width, height } = tableCell.getBoundingClientRect();
                setPlayerWidth(width);
                setPlayerHeight(height);
            }
        };

        calculatePlayerSize();
        window.addEventListener('resize', calculatePlayerSize);

        return () => {
            window.removeEventListener('resize', calculatePlayerSize);
        };
    }, []);

    return (
        <>
            <iframe
                title="YouTube Player"
                width={playerWidth}
                height={playerHeight}
                src={`https://www.youtube.com/embed/${videoId}?start=${startTimeInSeconds}&end=${stopTimeInSeconds}&autoplay=1`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </>
    );
};

export default YouTubePlayer;