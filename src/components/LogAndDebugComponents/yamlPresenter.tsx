import React, { useState, useEffect } from 'react';
import * as yaml from 'js-yaml'; // Import js-yaml for parsing
// import 'js-yaml/dist/cjs'; // Import type definitions for js-yaml (optional)

interface YamlProps {
    url: string; // URL of the YAML file
}

export const Yaml: React.FC<YamlProps> = ({ url }) => {
    const [yamlData, setYamlData] = useState<any>({}); // State to hold parsed YAML data
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`Failed to fetch YAML: ${response.statusText}`);
                }

                const text = await response.text();
                // const parsedData = yaml.safeLoad(text); // Parse YAML using js-yaml
                const parsedData = yaml.load(text)

                setYamlData(parsedData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [url]);

    if (isLoading) {
        return <div>Loading YAML data...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    // Render the parsed YAML data based on its structure (adjust as needed)
    return (
        <div>
            <h2>Keys</h2>
            <ul>
                {Object.keys(yamlData).map((key) => (
                    <li key={key}>{key}</li>
                ))}
            </ul>
            <h2>Values</h2>
            <pre>{JSON.stringify(yamlData, null, 2)}</pre> </div>
    );
};

export default Yaml;
