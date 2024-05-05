import React, { useState, useEffect } from 'react';
import { marked } from 'marked'; // Import marked for markdown processing
import '../../styles/markdown-wrap.css'

interface MarkdownProps {
    url: string; // URL of the markdown file
}

const Markdown: React.FC<MarkdownProps> = ({ url }) => {
    const [markdownContent, setMarkdownContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`Failed to fetch markdown: ${response.statusText}`);
                }

                const text = await response.text();
                const res = await marked(text);
                setMarkdownContent(res);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [url]);

    if (isLoading) {
        return <div>Loading markdown...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }


    return (
        <div className='markdown-wrap' style={{ backgroundColor: 'black', overflowWrap: 'break-word', textWrap: 'initial' }} dangerouslySetInnerHTML={{ __html: markdownContent }} />
    );
};

export default Markdown;
