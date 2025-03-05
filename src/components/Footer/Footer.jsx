import React from "react";
import { FaFacebook, FaTwitter, FaInstagram, FaCcVisa, FaCcMastercard, FaCcPaypal } from "react-icons/fa";
import "./Footer.css"; // Import CSS file

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* About Us */}
        <div className="footer-section">
          <h3>About Us</h3>
          <p>Flipkart Clone is a demo project for learning e-commerce development.</p>
        </div>

        {/* Customer Care */}
        <div className="footer-section">
          <h3>Customer Care</h3>
          <ul>
            <li>Help Center</li>
            <li>Track Order</li>
            <li>Returns & Refunds</li>
            <li>Contact Us</li>
          </ul>
        </div>

        {/* Policies */}
        <div className="footer-section">
          <h3>Policies</h3>
          <ul>
            <li>Privacy Policy</li>
            <li>Terms & Conditions</li>
            <li>Return Policy</li>
            <li>Shipping Policy</li>
          </ul>
        </div>

        {/* Social Media & Payments */}
        <div className="footer-section social-payments">
          <div>
            <h3>Follow Us</h3>
            <div className="social-icons">
              <FaFacebook className="icon" />
              <FaTwitter className="icon" />
              <FaInstagram className="icon" />
            </div>
          </div>
          <div>
            <h3>Payment Methods</h3>
            <div className="payment-icons">
              <FaCcVisa className="icon" />
              <FaCcMastercard className="icon" />
              <FaCcPaypal className="icon" />
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="footer-bottom">
        © 2025 Flipkart Clone. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
