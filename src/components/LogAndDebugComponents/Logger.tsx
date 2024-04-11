import React, { useEffect } from "react";

type LoggerProps = {
    messages: any[];
    setMessages: React.Dispatch<React.SetStateAction<any[]>>;
};

export const Logger: React.FC<LoggerProps> = ({ messages, setMessages }) => {
    useEffect(() => {
        const originalConsoleError = console.error;
        const originalConsoleLog = console.log;
        const originalConsoleInfo = console.info;
        const originalConsoleWarn = console.warn;

        console.error = (...args: any[]) => {
            setMessages((prevMessages) => [
                ...prevMessages,
                { type: "error", message: args },
            ]);
            originalConsoleError(...args);
        };

        console.log = (...args: any[]) => {
            setMessages((prevMessages) => [
                ...prevMessages,
                { type: "log", message: args },
            ]);
            originalConsoleLog(...args);
        };

        console.info = (...args: any[]) => {
            setMessages((prevMessages) => [
                ...prevMessages,
                { type: "info", message: args },
            ]);
            originalConsoleInfo(...args);
        };

        console.warn = (...args: any[]) => {
            setMessages((prevMessages) => [
                ...prevMessages,
                { type: "warn", message: args },
            ]);
            originalConsoleWarn(...args);
        };

        return () => {
            console.error = originalConsoleError;
            console.log = originalConsoleLog;
            console.info = originalConsoleInfo;
            console.warn = originalConsoleWarn;
        };
    }, [setMessages]);

    const getColor = (type: string): string => {
        const typeToColor: { [key: string]: string } = {
            error: "red",
            log: "black",
            info: "blue",
            warn: "orange",
        };

        return typeToColor[type] || "inherit";
    };



    return (
        <div>
            {[...messages].reverse().map((message, index) => (
                <div key={index} style={{ color: getColor(message.type) }}>
                    {index}-{message.type}: {JSON.stringify(message.message)}
                </div>
            ))}
        </div>
    );
};