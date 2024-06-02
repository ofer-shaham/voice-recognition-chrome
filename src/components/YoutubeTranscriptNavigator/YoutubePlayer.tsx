import React, { useEffect, useState } from 'react';
import { convertTimeToSeconds } from '../../utils/YoutubeUtils';

interface YouTubePlayerProps {
    videoId: string;
    videoUrl: string;
    startTime: string;
    stopTime: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, videoUrl, startTime, stopTime }) => {
    const [playerWidth, setPlayerWidth] = useState<number>(0);
    const [playerHeight, setPlayerHeight] = useState<number>(0);



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
                src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${startTimeInSeconds}&end=${stopTimeInSeconds}&autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen

            />
        </>
    );
};

export default YouTubePlayer;