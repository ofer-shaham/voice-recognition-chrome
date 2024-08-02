import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Intro from './components/Intro';
import YoutubeTranscriptParser from './components/YoutubeTranscriptNavigator/YoutubeTranscriptParser';
import ProverbList from './components/Proverbs/Proverbs';
import Footer from './components/Footer';
import './styles/App.css'

function App() {
  return (
    <Router>
      <div className="App-content">
        <Routes>

          <Route path="/" element={<Intro />} />
          <Route path="/youtube" element={<YoutubeTranscriptParser />} />
          <Route path="/proverb" element={<ProverbList />} />

        </Routes>
      </div>
      <Footer />
    </Router>


  );
}

export default App;