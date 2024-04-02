import { useEffect } from "react";

type LoggerProps = {
    errors: any[];
    setErrors: React.Dispatch<React.SetStateAction<any[]>>;
};

export const Logger: React.FC<LoggerProps> = ({ errors, setErrors }) => {
    useEffect(() => {
        const originalConsoleError = console.error;

        console.error = (...args: any[]) => {
            // Store the error arguments in the component's state
            setErrors(prevErrors => [...prevErrors, args]);
            // Call the original console.error to keep the default behavior
            originalConsoleError(...args);
        };

        return () => {
            // Reset console.error to its original implementation when the component unmounts
            console.error = originalConsoleError;
        };
    }, [setErrors]);

    return (
        <div>
            {/* Render the errors in the component */}
            {[...errors].reverse().map((error, index) => (
                <div key={index}>{JSON.stringify(error)}</div>
            ))}
        </div>
    );
};