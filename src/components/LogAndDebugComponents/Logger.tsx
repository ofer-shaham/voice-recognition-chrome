import React, { useEffect, useState } from "react";
import { LOG_RECORDS_LIMIT } from "../../consts/config";

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
    const [messagesCount, setMessagesCount] = useState(0);

    useEffect(() => {
        const originalConsoleError = console.error;
        const originalConsoleLog = console.log;
        const originalConsoleInfo = console.info;
        const originalConsoleWarn = console.warn;

        console.error = (...args: any[]) => {
            setMessagesCount(prev => prev + 1)
            setMessages((prevMessages) => [
                { id: getRandom(), type: "error", message: args },
                ...prevMessages.slice(0, LOG_RECORDS_LIMIT), // Keep only the last LOG_RECORDS_LIMIT messages
            ]);
            originalConsoleError(...args);
        };

        console.log = (...args: any[]) => {
            setMessagesCount(prev => prev + 1)

            setMessages((prevMessages) => [
                { id: getRandom(), type: "log", message: args },
                ...prevMessages.slice(0, LOG_RECORDS_LIMIT), // Keep only the last LOG_RECORDS_LIMIT messages
            ]);
            originalConsoleLog(...args);
        };

        console.info = (...args: any[]) => {
            setMessagesCount(prev => prev + 1)

            setMessages((prevMessages) => [
                { id: getRandom(), type: "info", message: args },
                ...prevMessages.slice(0, LOG_RECORDS_LIMIT), // Keep only the last LOG_RECORDS_LIMIT messages
            ]);
            originalConsoleInfo(...args);
        };

        console.warn = (...args: any[]) => {
            setMessagesCount(prev => prev + 1)

            setMessages((prevMessages) => [
                { id: getRandom(), type: "warn", message: args },
                ...prevMessages.slice(0, LOG_RECORDS_LIMIT), // Keep only the last LOG_RECORDS_LIMIT messages
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
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                alignItems: "flex-start",
            }}
        >
            <p>log records: {messagesCount}</p>
            {[...messages].map((message, index) => (
                <div key={message.id} style={{ color: getColor(message.type) }}>
                    <p>
                        {messagesCount - index}-{message.type}:{" "}
                        {JSON.stringify(message.message)}
                    </p>
                </div>
            ))}
        </div>
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