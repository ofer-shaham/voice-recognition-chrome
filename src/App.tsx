import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Footer from "./components/Footer";
import "./styles/App.css";

// Lazy load components
const Intro = lazy(() => import("./components/Intro"));
const YoutubeTranscriptParser = lazy(
  () =>
    import("./components/YoutubeTranscriptNavigator/YoutubeTranscriptParser")
);
const ProverbList = lazy(() => import("./components/Proverbs/Proverbs"));
const SimultaneousTranslation = lazy(
  () => import("./components/SimultaneousTranslation")
);
const AiConversation = lazy(
  () => import("./components/AiConversation/AiConversation")
);

// Loading component
const Loading = () => <div>Loading...</div>;

function App() {
  return (
    <Router>
      <div className="App-content">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Intro />} />
            <Route path="/youtube" element={<YoutubeTranscriptParser />} />
            <Route path="/proverb" element={<ProverbList />} />
            <Route
              path="/simultanuos_translation"
              element={<SimultaneousTranslation />}
            />
            <Route path="/ai-conversation" element={<AiConversation />} />
          </Routes>
        </Suspense>
      </div>
      <Footer />
    </Router>
  );
}

export default App;
