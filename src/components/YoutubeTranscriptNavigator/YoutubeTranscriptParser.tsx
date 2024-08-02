import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { translate } from "../../utils/translate";
import { bookExample } from "../../consts/config";
import isRtl from "../../utils/isRtl";
import '../../styles/YoutubeTranscriptParser.css'
import NarrateSentence from "./NarrateSentence";
import YouTubePlayer from "./YoutubePlayer";
import Accordion from "../LogAndDebugComponents/Accordion";
import { convertTimeToSeconds } from "../../utils/YoutubeUtils";
import { freeSpeak } from "../../utils/freeSpeak";
import { populateAvailableVoices } from "../../utils/getVoice";
import { useAvailableVoices } from "../../hooks/useAvailableVoices";
// import Todo from '../LogAndDebugComponents/mdPresenter';


const MAX_LINES = 20
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
  const pageParam = (searchParams.get("page"));
  const linesParam = searchParams.get("lines");
  const fromLangParam = searchParams.get("fromLang");
  const toLangParam = searchParams.get("toLang");

  const [url, setUrl] = useState(urlParam || bookExample.url);
  const [fromLang, setFromLang] = useState(fromLangParam || bookExample.fromLang);
  const [toLang, setToLang] = useState(toLangParam || bookExample.toLang);
  const [currentPage, setCurrentPage] = useState(parseInt(pageParam || "1") || 1);
  const [linesPerPage, setLinesPerPage] = useState(parseInt(linesParam || "4") || 4);
  const [transcriptHistory, setTranscriptHistory] = useState<FinalTranscriptHistory[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentWords, setCurrentWords] = useState('');
  const [currentWordsTranslated, setCurrentWordsTranslated] = useState('');
  const availableVoices = useAvailableVoices();


  //translate and speak the marked text
  useEffect(() => {
    if (!currentWords) return;
    async function translateIt() {

      const res = await translate({ finalTranscriptProxy: currentWords, fromLang, toLang })
      setCurrentWordsTranslated(res)
      freeSpeak(currentWords, fromLang)

    }
    translateIt()

  }, [currentWords, currentWordsTranslated, fromLang, toLang])


  function getStopTime(index: number, currentPage: number, linesPerPage: number, transcriptHistoryLength: number): string {
    const nextIndex = index + 1 + (currentPage - 1) * linesPerPage;

    if (nextIndex === transcriptHistoryLength - 1) {
      return '00:00';
    } else {
      return transcriptHistory[nextIndex].timestamp;
    }
  }

  useEffect(() => {
    setTotalPages(Math.ceil(transcriptHistory.length / linesPerPage));

  }, [transcriptHistory, linesPerPage]);

  useEffect(() => {
    // Update the search params whenever the state changes
    setSearchParams({
      url,
      page: (currentPage || 1).toString(),
      lines: (linesPerPage || 1).toString(),
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
      if (lines[i].trim().length) {
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
  /*
    * update devices' available voices
    */
  useEffect(() => {
    if (!availableVoices.length) { console.warn('no voices') }
    else {
      populateAvailableVoices(availableVoices)
      console.info('some voices', { availableVoices })
    }
  }, [availableVoices])
  useEffect(() => {
    if (!transcriptHistory.length) {
      console.log("empty transcript history");
      return;
    }

    const handleTranslateText = async () => {
      // Check if any lines need translation
      const linesToTranslate = transcriptHistory.slice(
        (currentPage - 1) * linesPerPage,
        currentPage * linesPerPage
      ).filter(line => !line.translated);

      if (linesToTranslate.length === 0) {
        return; // No lines to translate, exit the function
      }
      console.log({ linesToTranslate })
      // Perform translation logic here and update the translation property of each visible line
      const translatedLines = await Promise.all(
        linesToTranslate.map(async (line) => {

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

  function getDurationInSeconds(stopTimeInSeconds: string, startTimeInSeconds: string): number {
    return convertTimeToSeconds(stopTimeInSeconds) - convertTimeToSeconds(startTimeInSeconds);
  }

  return (
    <div className='content'>
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
          min={1}
          max={MAX_LINES}
          type="number"
          value={Math.min(Math.max(linesPerPage, 1), MAX_LINES)}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            const clampedValue = Math.min(Math.max(newValue, 1), MAX_LINES);
            setLinesPerPage(clampedValue);
          }}
          title="Lines Per Page"
        />
        <input
          min={1}
          max={totalPages}
          type="number"
          value={currentPage.toString()}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            const clampedValue = Math.min(Math.max(newValue, 1), totalPages);
            setCurrentPage(clampedValue);
          }}
          placeholder="Page"
          title="Current Page"
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
                  <td className={`transcript ${fromLangClassName}`}
                    title={currentWordsTranslated}
                    onClick={(ev) => {
                      const selection = window.getSelection() || '';
                      const selectedText = selection.toString().trim();
                      setCurrentWords(selectedText);
                    }}

                  >
                    <NarrateSentence rate={1} markTextAsSpoken={true} markColor='blue' mySentence={line.finalTranscriptProxy} lang={fromLang} />
                  </td>
                  <td className={`translation ${toLangClassName}`}>
                    <NarrateSentence rate={1} markTextAsSpoken={true} markColor='blue' mySentence={line.translation} lang={toLang} />
                  </td>
                  <td>
                    {line.timestamp && transcriptHistory[index + 1 + (currentPage - 1) * linesPerPage]?.timestamp ? (
                      <Accordion
                        title={line.timestamp + '-' + transcriptHistory[index + 1 + (currentPage - 1) * linesPerPage].timestamp}
                        timeout={getDurationInSeconds(getStopTime(index, currentPage, linesPerPage, transcriptHistory.length), line.timestamp)}
                      >
                        <YouTubePlayer
                          videoUrl={bookExample.videoUrl}
                          videoId={bookExample.videoId}
                          startTime={line.timestamp}
                          stopTime={getStopTime(index, currentPage, linesPerPage, transcriptHistory.length)}

                        />
                      </Accordion>
                    ) : null}
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

      {/* <Accordion title='readme'>
        <Todo url="https://raw.githubusercontent.com/ofer-shaham/voice-recognition-chrome/main/src/components/YoutubeTranscriptNavigator/README.md" />

      </Accordion> */}

    </div >
  );
}

export default YoutubeTranscriptParser;