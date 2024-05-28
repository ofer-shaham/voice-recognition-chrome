import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { translate } from "../../utils/translate";
import { bookExample } from "../../consts/config";
import isRtl from "../../utils/isRtl";
import '../../styles/YoutubeTranscriptParser.css'
import NarrateSentence from "./NarrateSentence";
import YouTubePlayer from "./YoutubePlayer";
import Accordion from "../LogAndDebugComponents/Accordion";

interface FinalTranscriptHistory {
  finalTranscriptProxy: string;
  uuid: number;
  translation: string;
  fromLang: string;
  toLang: string;
  audioData: string | null;
  translated: boolean;
  timestamp: string;
}

function YoutubeTranscriptParser() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlParam = searchParams.get("url");
  const pageParam = searchParams.get("page");
  const linesParam = searchParams.get("lines");
  const fromLangParam = searchParams.get("fromLang");
  const toLangParam = searchParams.get("toLang");

  const [url, setUrl] = useState(urlParam || bookExample.url);
  const [fromLang, setFromLang] = useState(fromLangParam || bookExample.fromLang);
  const [toLang, setToLang] = useState(toLangParam || bookExample.toLang);
  const [currentPage, setCurrentPage] = useState(parseInt(pageParam || "1"));
  const [linesPerPage, setLinesPerPage] = useState(parseInt(linesParam || "4"));

  const [transcriptHistory, setTranscriptHistory] = useState<FinalTranscriptHistory[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setTotalPages(Math.ceil(transcriptHistory.length / linesPerPage));
  }, [transcriptHistory, linesPerPage]);

  useEffect(() => {
    // Update the search params whenever the state changes
    setSearchParams({
      url,
      page: currentPage.toString(),
      lines: linesPerPage.toString(),
      fromLang,
      toLang,
    });
  }, [url, currentPage, linesPerPage, fromLang, toLang, setSearchParams]);


  const parseSubtitles = (subtitles: string): {
    timestamps: string[];
    texts: string[];
  } => {
    const lines = subtitles.split("\n");
    const timestamps = [];
    const texts = [];

    for (let i = 0; i < lines.length; i++) {
      if (i % 2 === 0) {
        // Even line (timestamp)
        const timestamp = lines[i].trim();
        timestamps.push(timestamp);
      } else {
        // Odd line (text)
        const text = lines[i].trim();
        texts.push(text);
      }
    }

    return { timestamps, texts };
  }

  const handleLoadText = () => {
    fetch(url)
      .then((resp) => {
        const contentType = resp.headers.get("Content-Type");
        if (contentType && contentType.includes("text/html")) {
          throw new Error("Invalid content type: text/html");
        }
        return resp.text();
      })
      .then((text) => {

        const { timestamps, texts } = parseSubtitles(text);

        const initialTranscriptHistory: FinalTranscriptHistory[] = texts.map((line, index) => ({
          finalTranscriptProxy: line,
          uuid: generateUuid(),
          translation: "",
          fromLang: fromLang,
          toLang: toLang,
          audioData: null,
          translated: false, // Initialize the translated flag as false
          timestamp: timestamps[index]
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
      <div className="inputs">
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
        <input
          type="number"
          value={currentPage}
          onChange={(e) => setCurrentPage(Number(e.target.value))}
          placeholder="Page"
        />
      </div>
      <button onClick={handleLoadText}>Load</button>

      {transcriptHistory.length ? (
        <table id="transcript-table">
          <thead>
            <tr>
              <th>id</th>
              <th>{fromLang}</th>
              <th>{toLang}</th>
              <th>video frame</th>
            </tr>
          </thead>
          <tbody>
            {transcriptHistory
              .slice((currentPage - 1) * linesPerPage, currentPage * linesPerPage)
              .map((line, index) => (
                <tr key={index + 1 + (currentPage - 1) * linesPerPage}>
                  <td>{index + 1 + (currentPage - 1) * linesPerPage}</td>
                  <td className={`transcript ${fromLangClassName}`}>
                    <NarrateSentence rate={1} markTextAsSpoken={true} markColor='blue' mySentence={line.finalTranscriptProxy} lang={fromLang} />
                  </td>
                  <td className={`translation ${toLangClassName}`}>
                    <NarrateSentence rate={1} markTextAsSpoken={true} markColor='blue' mySentence={line.translation} lang={toLang} />
                  </td>
                  <td>
                    <Accordion title={line.timestamp + '-' + transcriptHistory[index + 1 + (currentPage - 1) * linesPerPage].timestamp} >
                      <YouTubePlayer videoUrl={bookExample.videoUrl} videoId={bookExample.videoId} startTime={line.timestamp} stopTime={index + (currentPage - 1) * linesPerPage === transcriptHistory.length - 1 ? '00:00' : transcriptHistory[index + 1 + (currentPage - 1) * linesPerPage].timestamp} />
                    </Accordion>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : null
      }

      {totalPages ?
        <> <div className="nav">
          <button onClick={goToPreviousPage} disabled={currentPage === 1}>
            Previous Page
          </button>
          <span>
            {totalPages ? <>Page {currentPage} of {totalPages}</> : null}
          </span>
          <button onClick={goToNextPage} disabled={currentPage === totalPages}>
            Next Page
          </button>
        </div></> : null
      }
    </div >
  );
}

export default YoutubeTranscriptParser;