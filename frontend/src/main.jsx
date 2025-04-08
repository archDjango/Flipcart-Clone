import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CartProvider } from "./context/CartContext";
import { SearchProvider } from "./context/SearchContext.jsx";
import { ThemeProvider } from './context/ThemeContext'; // New import
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <CartProvider>
        <SearchProvider>
          <App />
        </SearchProvider>
      </CartProvider>
    </ThemeProvider>
  </React.StrictMode>
);





  
    
