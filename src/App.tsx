import React, { lazy, Suspense } from "react";
import "./styles/App.css";

const YoutubeLearner = lazy(() => import("./components/YoutubeLearner/index"));

const Loading = () => <div>Loading...</div>;

function App() {
  const path = typeof window !== "undefined" && window.location
    ? window.location.pathname
    : "/";

  return (
    <div className="App-content">
      <Suspense fallback={<Loading />}>
        {path === "/youtube" ? <YoutubeLearner /> : <div>App shell unavailable in this test mode.</div>}
      </Suspense>
    </div>
  );
}

export default App;
