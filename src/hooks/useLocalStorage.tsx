import { useState, useEffect } from 'react';

function getStorageValue(key: string, defaultValue: any) {
    // getting stored value
    if (typeof window !== "undefined") {
        const saved = localStorage.getItem(key);
        const initial = saved !== null ? JSON.parse(saved) : defaultValue;
        return initial;
    }
}
interface props {
    key: string;
    defaultValue: any;
}

const useLocalStorageScore = ({ key, defaultValue }: props): [any, () => void, () => void] => {
    const [value, setValue] = useState<any>(() => {
        return getStorageValue(key, defaultValue);
    });


    useEffect(() => {
        // storing input name
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    const increaseValue = (num?: number) => {

        setValue((prev: any) => prev + 1);
    };
    const reset = () => {

        setValue(0);
    };

    return [value, increaseValue, reset];
};

export default useLocalStorageScore;