import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/footer.css';

function Footer() {
    return (
        <footer>
            <nav>
                <ul className="footer-list">
                    <li>
                        <Link to="/">listen,translate,speak</Link>
                    </li>
                    <li>
                        <Link to="/youtube">Youtube Transcript Parser</Link>
                    </li>
                    <li>
                        <Link to="/proverb">Proverbs</Link>
                    </li>
                    <li>
                        <Link to="/simultanuos_translation/?showMobile=true&from-lang=he-IL&to-lang=ru-RU">
                            Simultaneous Translation
                        </Link>
                    </li>
                    <li>
                        <Link to="/ai-conversation">AI Conversation</Link>
                    </li>
                </ul>
            </nav>
        </footer>
    );
}

export default Footer;
