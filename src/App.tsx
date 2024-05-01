import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Intro from './components/Intro';
import MobileVer from './components/MobileVer';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Intro />} />
                <Route path="/mobile" element={<MobileVer />} />
            </Routes>
        </Router>
    );
}


export default App;