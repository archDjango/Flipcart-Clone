import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ThankYouPage.css';

const ThankYouPage = () => {
  const navigate = useNavigate();

  return (
    <div className="thank-you-page">
      <h2>🎉 Order Confirmed!</h2>
      <p>Thank you for your purchase! Your order is being processed.</p>
      <button className="back-home-btn" onClick={() => navigate('/')}>
        🏠 Return to Home
      </button>
    </div>
  );
};

export default ThankYouPage;