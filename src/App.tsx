import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import DebugPanel from "./components/DebugPanel/DebugPanel";
import "./styles/App.css";

const AppHub = lazy(() => import("./components/AppHub"));
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

const normalizeRoutePath = (path: string) => {
  const normalized = path.replace(/\/+/g, "/");
  return normalized === "" ? "/" : normalized;
};

function AppRoutes() {
  const location = useLocation();
  const path = normalizeRoutePath(location.pathname);

  if (path !== location.pathname) {
    return <Navigate to={`${path}${location.search}`} replace />;
  }

  if (path === "/") return <AppHub />;
  if (path === "/listen") return <Intro />;

  if (path === "/youtube2") return <Navigate to={`/youtube2/setup${location.search}`} replace />;
  if (path.startsWith("/youtube2/")) return <YoutubeLearner routeBase="/youtube2" />;

  if (path === "/youtube") return <Navigate to={`/youtube/setup${location.search}`} replace />;
  if (["/youtube/setup", "/youtube/home", "/youtube/history", "/youtube/settings", "/youtube/settings/translation", "/youtube/settings/openrouter"].includes(path)) return <YoutubeLearner />;
  if (path.startsWith("/youtube/view/") || path.startsWith("/youtube/project/")) return <YoutubeLearner />;

  if (path === "/proverb") return <ProverbList />;
  if (path === "/simultanuos_translation") return <SimultaneousTranslation />;
  if (path === "/ai-conversation") return <AiConversation />;
  return <AppHub />;
}

function AppInner() {
  const location = useLocation();
  const showFooter = !ROUTES_WITHOUT_FOOTER.includes(location.pathname);

  return (
    <>
      <div className={showFooter ? "App-content" : ""}>
        <Suspense fallback={<Loading />}>
          <AppRoutes />
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
      <DebugPanel />
    </Router>
  );
}

export default App;
