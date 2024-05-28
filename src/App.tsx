import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Intro from './components/Intro';
import YoutubeTranscriptParser from './components/YoutubeTranscriptNavigator/YoutubeTranscriptParser';
 
function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Intro />} />
                <Route path="/youtube" element={<YoutubeTranscriptParser />} />
            </Routes>
        </Router>
    );
}


export default App;