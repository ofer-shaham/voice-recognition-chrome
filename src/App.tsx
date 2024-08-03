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
          </Routes>
        </Suspense>
      </div>
      <Footer />
    </Router>
  );
}

export default App;
