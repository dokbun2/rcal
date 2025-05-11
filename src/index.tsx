import React from 'react';
import ReactDOM from 'react-dom/client';
import RentalCalculator from './rental-calculator';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <RentalCalculator />
  </React.StrictMode>
); 