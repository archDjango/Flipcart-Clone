import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./HeroSection.css";

const HeroSection = () => {
  const banners = [
    { img: "/images/banner1.jpg", text: "Biggest Sale - Up to 50% Off!" },
    { img: "/images/banner2.jpg", text: "New Arrivals Just for You" },
    { img: "/images/banner3.jpg", text: "Grab the Best Electronics Deals" },
  ];

  return (
    <section className="hero-section">
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        navigation
        pagination={{ clickable: true }}
        autoplay={{ delay: 3000, disableOnInteraction: false }}
        loop={true} // Ensures infinite scrolling
        className="hero-slider"
      >
        {banners.map((banner, index) => (
          <SwiperSlide key={index} className="slide">
            <img src={banner.img} alt={`Banner ${index + 1}`} loading="lazy" />
            <div className="banner-text">
              <h2>{banner.text}</h2>
              <button className="shop-now-btn">Shop Now</button>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
};

export default HeroSection;
