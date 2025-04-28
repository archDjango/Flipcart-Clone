import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import ProductRecommendations from '../../components/ProductRecommendations/ProductRecommendations';
import './Recommendations.css';

const Recommendations = () => {
  const { user } = useContext(AuthContext);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserRecommendations = async () => {
      if (!user) {
        setError('Please log in to see your recommendations.');
        return;
      }
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/recommendations/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRecommendations(response.data);
      } catch (err) {
        console.error('Fetch user recommendations error:', err);
        setError('Failed to load recommendations. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserRecommendations();
  }, [user]);

  return (
    <div className="recommendations-page">
      <h1>Your Personalized Recommendations</h1>
      {error && <p className="error">{error}</p>}
      <ProductRecommendations
        recommendations={recommendations}
        isLoading={isLoading}
        title="Based on Your Activity"
      />
    </div>
  );
};

export default Recommendations;