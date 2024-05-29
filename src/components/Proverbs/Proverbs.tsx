import React, { useState, useEffect } from "react";
import { useSwipeable } from "react-swipeable";

interface Proverb {
    id: number;
    proverb: string;
    meaning: string;
    explanation: string;
}

const ProverbList: React.FC = () => {
    const [proverbs, setProverbs] = useState<Proverb[]>([]);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/fixtures/proverbs/english.json");
                const data = await response.json();
                setProverbs(data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, []);

    const handleSwipe = (delta: number) => {
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex >= proverbs.length) {
            return;
        }
        setIndex(newIndex);
    };

    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => handleSwipe(1),
        onSwipedRight: () => handleSwipe(-1),
    });

    if (proverbs.length === 0) {
        return <div>Loading...</div>;
    }

    const currentProverb = proverbs[index];

    return (
        <div {...swipeHandlers}>
            <h2>{currentProverb.proverb}</h2>
            <p>{currentProverb.meaning}</p>
            <p>{currentProverb.explanation}</p>
        </div>
    );
};

export default ProverbList;