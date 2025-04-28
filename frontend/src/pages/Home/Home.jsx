import React, { useState, useEffect } from 'react';
import axios from 'axios';
import HeroSection from '../../components/HeroSection/HeroSection';
import TopOffers from '../../components/TopOffers/TopOffers';
import ProductShowcase from '../../components/ProductShowcase/ProductShowcase';
import ProductRecommendations from '../../components/ProductRecommendations/ProductRecommendations';
import Footer from '../../components/Footer/Footer';
import './Home.css';

const HomePage = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get('http://localhost:5000/products/recommendations');
        setRecommendations(response.data);
      } catch (err) {
        console.error('Fetch homepage recommendations error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecommendations();
  }, []);

  return (
    <div className="home-container">
      <HeroSection />
      <div className="section">
        <h2 className="section-title">Top Offers</h2>
        <TopOffers />
      </div>
      <div className="section">
        <h2 className="section-title">Recommended For You</h2>
        <ProductRecommendations
          recommendations={recommendations}
          isLoading={isLoading}
          title="Recommended For You"
        />
      </div>
      <div className="section">
        <h2 className="section-title">Popular Products</h2>
        <ProductShowcase />
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;