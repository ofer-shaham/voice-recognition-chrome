import React, { useEffect } from "react";

type MessageType = "error" | "log" | "info" | "warn";

type Message = {
    id: number;
    type: MessageType;
    message: any[];
};

type LoggerProps = {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
};

export const Logger: React.FC<LoggerProps> = ({ messages, setMessages }) => {
    useEffect(() => {
        const originalConsoleError = console.error;
        const originalConsoleLog = console.log;
        const originalConsoleInfo = console.info;
        const originalConsoleWarn = console.warn;

        console.error = (...args: any[]) => {
            setMessages((prevMessages) => [
                { id: getRandom(), type: "error", message: args },
                ...prevMessages,
            ]);
            originalConsoleError(...args);
        };

        console.log = (...args: any[]) => {
            setMessages((prevMessages) => [
                { id: getRandom(), type: "log", message: args },
                ...prevMessages,
            ]);
            originalConsoleLog(...args);
        };

        console.info = (...args: any[]) => {
            setMessages((prevMessages) => [
                { id: getRandom(), type: "info", message: args },
                ...prevMessages,
            ]);
            originalConsoleInfo(...args);
        };

        console.warn = (...args: any[]) => {
            setMessages((prevMessages) => [
                { id: getRandom(), type: "warn", message: args },
                ...prevMessages,
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



    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            alignItems: 'flex-start'
        }}>
            {
                [...messages].map((message, index) => (
                    <div key={message.id} style={{ color: getColor(message.type) }}>
                        <p>{messages.length - index}-{message.type}: {JSON.stringify(message.message)}</p>
                    </div>
                ))
            }
        </div >
    );
};

const getRandom = () => {
    return Date.now() * Math.floor(Math.random() * 100000);
};
const getColor = (type: MessageType): string => {
    const typeToColor: { [key in MessageType]: string } = {
        error: "red",
        log: "black",
        info: "blue",
        warn: "orange",
    };

    return typeToColor[type] || "inherit";
};