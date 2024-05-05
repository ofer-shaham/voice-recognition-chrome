import { useState } from 'react';

const useLocalStorageScore = (): [number, () => void] => {
    const [score, setScore] = useState<number>(0);



    const updateScore = () => {
        console.log('updateScore', score)
        //TODO: riddle1: this will not have an effect on score's value
        // const newScore = score + 1;
        setScore( score+1);
    };

    return [score, updateScore];
};

export default useLocalStorageScore;

