import { useEffect, useState } from "react";
import { translate } from "../../utils/translate";
import { bookExample } from "../../consts/config";
import isRtl from "../../utils/isRtl";
import '../../styles/TextLoader.css'
import NarrateSentence from "./NarrateSentence";
import { splitTextByEndlAndPunctuation } from "../../utils/splitTextByPunctuation";


interface FinalTranscriptHistory {
  finalTranscriptProxy: string;
  uuid: number;
  translation: string;
  fromLang: string;
  toLang: string;
  audioData: string | null;
  translated: boolean;
}

function TextLoader() {
  const [url, setUrl] = useState(bookExample.url);
  const [fromLang, setFromLang] = useState(bookExample.fromLang);
  const [toLang, setToLang] = useState(bookExample.toLang);
  const [linesPerPage, setLinesPerPage] = useState(4);
  const [transcriptHistory, setTranscriptHistory] = useState<FinalTranscriptHistory[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setTotalPages(Math.ceil(transcriptHistory.length / linesPerPage));
  }, [transcriptHistory, linesPerPage]);

  const handleLoadText = () => {
    fetch(url)
      .then((response) => response.text())
      .then((text) => {
        const splitted = splitTextByEndlAndPunctuation(text);
        const initialTranscriptHistory: FinalTranscriptHistory[] = splitted.map((line) => ({
          finalTranscriptProxy: line,
          uuid: generateUuid(),
          translation: "",
          fromLang: fromLang,
          toLang: toLang,
          audioData: null,
          translated: false, // Initialize the translated flag as false
        }));
        setTranscriptHistory(initialTranscriptHistory);
        setCurrentPage(1);
      })
      .catch((error) => {
        console.error("Error loading text:", error);
      });
  };


  const generateUuid = (): number => {
    return Math.floor(Math.random() * 100000);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  useEffect(() => {
    if (!transcriptHistory.length) {
      console.log("empty transcript history");
      return;
    }

    const handleTranslateText = async () => {
      // Perform translation logic here and update the translation property of each visible line
      const translatedLines = await Promise.all(
        transcriptHistory
          .slice((currentPage - 1) * linesPerPage, currentPage * linesPerPage)
          .map(async (line: FinalTranscriptHistory) => {
            if (!line.translated) { // Check if the line has been translated
              const translatedLine = await translate({
                finalTranscriptProxy: line.finalTranscriptProxy,
                fromLang: line.fromLang,
                toLang: line.toLang,
              });
              return {
                ...line,
                translation: translatedLine,
                translated: true, // Set the translated flag as true
              };
            } else {
              return line;
            }
          })
      );

      setTranscriptHistory((prevState) => {
        const updatedTranscriptHistory = [...prevState];
        updatedTranscriptHistory.splice(
          (currentPage - 1) * linesPerPage,
          linesPerPage,
          ...translatedLines
        );
        return updatedTranscriptHistory;
      });
    };

    // Save next batch translation based on visible lines
    handleTranslateText();
  }, [currentPage, linesPerPage, toLang, transcriptHistory]);
  const fromLangClassName = isRtl(fromLang) ? 'is-rtl' : '';
  const toLangClassName = isRtl(toLang) ? 'is-rtl' : '';

  return (
    <div>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter URL"
      />
      <input
        type="text"
        value={fromLang}
        onChange={(e) => setFromLang(e.target.value)}
        placeholder="From Language"
      />
      <input
        type="text"
        value={toLang}
        onChange={(e) => setToLang(e.target.value)}
        placeholder="To Language"
      />
      <input
        type="number"
        value={linesPerPage}
        onChange={(e) => setLinesPerPage(Number(e.target.value))}
        placeholder="Lines Per Page"
      />
      <button onClick={handleLoadText}>Load</button>

      {transcriptHistory.length ? (
        <table id="transcript-table">
          <thead>
            <tr>
              <th>Line Number</th>
              <th>{fromLang}</th>
              <th>{toLang}</th>
            </tr>
          </thead>
          <tbody>
            {transcriptHistory
              .slice((currentPage - 1) * linesPerPage, currentPage * linesPerPage)
              .map((line, index) => (
                <tr key={line.uuid}>
                  <td>{index + 1}</td>
                  <td className={`transcript ${fromLangClassName}`}>
                    <NarrateSentence rate={1} markTextAsSpoken={true} markColor='blue' mySentence={line.finalTranscriptProxy} lang={fromLang} />
                  </td>
                  <td className={`translation ${toLangClassName}`}>
                    <NarrateSentence rate={1} markTextAsSpoken={true} markColor='blue' mySentence={line.translation} lang={toLang} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : null
      }

      <div>
        <button onClick={goToPreviousPage} disabled={currentPage === 1}>
          Previous Page
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button onClick={goToNextPage} disabled={currentPage === totalPages}>
          Next Page
        </button>
      </div>
    </div >
  );
}

export default TextLoader;