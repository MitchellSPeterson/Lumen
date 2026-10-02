import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { applyAppearance, readAppearance } from './appearance';

applyAppearance(readAppearance());

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
