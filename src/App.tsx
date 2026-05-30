import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import "./styles/App.css";

const Intro = lazy(() => import("./components/Intro"));
const YoutubeLearner = lazy(
  () => import("./components/YoutubeLearner/index")
);
const ProverbList = lazy(() => import("./components/Proverbs/Proverbs"));
const SimultaneousTranslation = lazy(
  () => import("./components/SimultaneousTranslation")
);
const AiConversation = lazy(
  () => import("./components/AiConversation/AiConversation")
);

const Loading = () => <div>Loading...</div>;

const ROUTES_WITHOUT_FOOTER = ["/ai-conversation"];

function AppInner() {
  const location = useLocation();
  const showFooter = !ROUTES_WITHOUT_FOOTER.includes(location.pathname);

  return (
    <>
      <div className={showFooter ? "App-content" : ""}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Intro />} />
            <Route path="/youtube" element={<YoutubeLearner />} />
            <Route path="/proverb" element={<ProverbList />} />
            <Route
              path="/simultanuos_translation"
              element={<SimultaneousTranslation />}
            />
            <Route path="/ai-conversation" element={<AiConversation />} />
          </Routes>
        </Suspense>
      </div>
      {showFooter && <Footer />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}

export default App;
