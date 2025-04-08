import React from "react";
import HeroSection from "../../components/HeroSection/HeroSection";
import TopOffers from "../../components/TopOffers/TopOffers";
import ProductShowcase from "../../components/ProductShowcase/ProductShowcase";
import Footer from "../../components/Footer/Footer";
import "./Home.css";

const HomePage = () => {
  return (
    <div className="home-container">
      <HeroSection />
      <div className="section">
        <h2 className="section-title">Top Offers</h2>
        <TopOffers />
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

