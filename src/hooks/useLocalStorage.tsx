import { useState, useEffect } from 'react';

const useLocalStorageScore = (): [number, () => void] => {
    const [score, setScore] = useState<number>(0);

    useEffect(() => {
        const storedScore = localStorage.getItem('score');
        if (storedScore) {
            setScore(parseInt(storedScore));
        }
    }, []);

    const updateScore = () => {
        const newScore = score + 1;
        setScore(newScore);
        localStorage.setItem('score', newScore.toString());
    };

    return [score, updateScore];
};

export default useLocalStorageScore;