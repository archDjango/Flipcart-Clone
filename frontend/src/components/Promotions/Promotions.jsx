import React from "react";
import "./Promotions.css";

const Promotions = () => {
  const promotions = [
    { img: "/images/electronics.jpg", title: "Electronics" },
    { img: "/images/fashion.jpg", title: "Fashion" },
    { img: "/images/home.jpeg", title: "Home Essentials" },
  ];

  return (
    <section className="promotions">
      {promotions.map((promo, index) => (
        <div key={index} className="promo-card">
          <img src={promo.img} alt={promo.title} loading="lazy" />
          <h3>{promo.title}</h3>
        </div>
      ))}
    </section>
  );
};

export default Promotions;
