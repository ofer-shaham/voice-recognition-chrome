import { useState, useEffect } from 'react';

function getStorageValue(key:string, defaultValue:any) {
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

const useLocalStorageScore = ({ key, defaultValue }: props): [any, () => void] => {
    const [value, setValue] = useState<any>(() => {
        return getStorageValue(key, defaultValue);
    });


    useEffect(() => {
        // storing input name
        localStorage.setItem(key, JSON.stringify(value));
      }, [key, value]);

    const updateValue = () => {
        setValue((prev:any) => prev + 1);
    };

    return [value, updateValue];
};

export default useLocalStorageScore;