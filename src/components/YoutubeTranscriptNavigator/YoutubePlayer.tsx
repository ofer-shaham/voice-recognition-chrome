import React, { useRef, useEffect, useState } from 'react';
import { convertTimeToSeconds } from '../../utils/YoutubeUtils';

interface YouTubePlayerProps {
  videoId: string;
  startTime: string;
  stopTime: string;
  autoplay?: boolean;
  thumbnail?: boolean;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  startTime,
  stopTime,
  autoplay = true,
  thumbnail = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 180 });

  const startSec = convertTimeToSeconds(startTime);
  const stopSec = convertTimeToSeconds(stopTime);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(160, entry.contentRect.width);
        setSize({ width: w, height: Math.round(w * 9 / 16) });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (isNaN(startSec) || isNaN(stopSec)) return null;

  if (thumbnail) {
    return (
      <div ref={containerRef} className="yt-player-thumb">
        <img
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt={`${startTime}`}
          className="yt-thumb-img"
        />
        <span className="yt-thumb-ts">{startTime}</span>
      </div>
    );
  }

  const src = [
    `https://www.youtube-nocookie.com/embed/${videoId}`,
    `?start=${Math.floor(startSec)}`,
    `&end=${Math.ceil(stopSec)}`,
    autoplay ? '&autoplay=1' : '',
    '&rel=0&modestbranding=1',
  ].join('');

  return (
    <div ref={containerRef} className="yt-player-wrap">
      <iframe
        title={`yt-${videoId}-${startSec}`}
        width={size.width}
        height={size.height}
        src={src}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default YouTubePlayer;
