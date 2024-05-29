import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Intro from './components/Intro';
import YoutubeTranscriptParser from './components/YoutubeTranscriptNavigator/YoutubeTranscriptParser';
import ProverbList from './components/Proverbs/Proverbs';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Intro />} />
                <Route path="/youtube" element={<YoutubeTranscriptParser />} />
                <Route path="/proverbs" element={<ProverbList />} />

            </Routes>
        </Router>
    );
}


export default App;