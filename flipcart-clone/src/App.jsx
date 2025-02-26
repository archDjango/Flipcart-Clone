import React from 'react';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        {/* Your main content goes here */}
        <h1>Welcome to Flipkart Clone</h1>
        <p>This is the main content area.</p>
      </main>
      <Footer />
    </div>
  );
}

export default App;
