// LanguageSwitcher.tsx
import React, { useState, useEffect } from "react";
import "./LanguageSwitcher.css";

interface LanguageSwitcherProps {
  fromLang: string;
  toLang: string;
  switchLanguages: () => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  fromLang,
  toLang,
  switchLanguages,
}) => {
  const [languages, setLanguagesState] = useState<[string, string]>(["", ""]);
  const [selectedLang, setSelectedLang] = useState<string>(fromLang);

  useEffect(() => {
    const sortedLangs = [fromLang, toLang].sort();
    setLanguagesState(sortedLangs as [string, string]);
    setSelectedLang(fromLang);
  }, [fromLang, toLang]);

  const handleLanguageClick = (lang: string) => {
    if (lang !== selectedLang) {
      switchLanguages();
    }
  };

  return (
    <div className="language-switcher">
      <label className="language-label">
        Choose talker language: {fromLang}
        number of languages: {languages.length}
      </label>
      <div className="button-row">
        {languages.map((lang, index) => (
          <button
            key={index}
            className={`button ${selectedLang === lang ? "selected" : ""}`}
            onClick={() => handleLanguageClick(lang)}
          >
            {lang}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
