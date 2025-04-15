import React, { createContext, useState, useEffect } from 'react';

// Create the ThemeContext
export const ThemeContext = createContext();

// ThemeProvider component to wrap the app and provide theme state
export const ThemeProvider = ({ children }) => {
  // Initialize darkMode state from localStorage, defaulting to false if not set
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // Effect to toggle the dark-mode class on the body and persist the state
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Provide the darkMode state and setter to the context
  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};