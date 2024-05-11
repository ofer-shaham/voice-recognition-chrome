import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Intro from './components/Intro';
import TextLoader from './components/Book/TextLoader';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Intro />} />
                <Route path="/book" element={<TextLoader />} />
            </Routes>
        </Router>
    );
}


export default App;