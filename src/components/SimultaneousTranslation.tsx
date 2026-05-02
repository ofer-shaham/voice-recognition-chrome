import React, { useEffect, useState } from "react";
import ComponentSwitcher from "./General/ComponentSwitcher";
import { errorCode } from "../consts/config";

const SimultaneousTranslation: React.FC = () => {
  const [microphoneAccess, setMicrophoneAccess] = useState(false);

  const checkMicrophoneAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneAccess(true);
    } catch (error: Error | any) {
      console.error("Microphone access denied:", error);
      if (error.toString().includes("device not found")) {
        alert(
          `${errorCode.microphone_not_found}:\n${errorCode.microphone_not_found_details}`
        );
      } else if (error.toString().includes("Permission denied")) {
        alert(
          `${errorCode.microphone_no_permission}:\n${errorCode.microphone_no_permission_details}`
        );
      }
    }
  };

  useEffect(() => {
    checkMicrophoneAccess();
  }, []);

  if (!microphoneAccess) {
    return (
      <button onClick={checkMicrophoneAccess}>Grant microphone access</button>
    );
  }

  return <ComponentSwitcher />;
};

export default React.memo(SimultaneousTranslation);
