import React, { createContext, useState, useEffect } from 'react';

export const CompareContext = createContext();

export const CompareProvider = ({ children }) => {
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [recentComparisons, setRecentComparisons] = useState([]);
  const [error, setError] = useState('');

  // Load initial state from localStorage
  useEffect(() => {
    try {
      const storedIds = JSON.parse(localStorage.getItem('selectedProductIds') || '[]');
      const storedComparisons = JSON.parse(localStorage.getItem('recentComparisons') || '[]');
      if (Array.isArray(storedIds)) {
        setSelectedProductIds(storedIds);
        console.log('Loaded selectedProductIds from localStorage:', storedIds);
      }
      if (Array.isArray(storedComparisons)) {
        setRecentComparisons(storedComparisons);
        console.log('Loaded recentComparisons from localStorage:', storedComparisons);
      }
    } catch (err) {
      console.error('Failed to parse localStorage:', err);
    }
  }, []);

  // Toggle product for comparison (2–4 product limit)
  const toggleProduct = (productId, callback) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) {
        const updated = prev.filter((id) => id !== productId);
        localStorage.setItem('selectedProductIds', JSON.stringify(updated));
        setError('');
        console.log('Removed product, new selectedProductIds:', updated);
        return updated;
      } else if (prev.length >= 4) {
        const errorMsg = 'You can compare up to 4 products';
        setError(errorMsg);
        if (callback) callback(errorMsg);
        console.log('Max 4 products reached:', prev);
        return prev;
      } else {
        const updated = [...prev, productId];
        localStorage.setItem('selectedProductIds', JSON.stringify(updated));
        setError('');
        console.log('Added product, new selectedProductIds:', updated);
        return updated;
      }
    });
  };

  // Save current comparison to recent comparisons
  const saveComparison = () => {
    if (selectedProductIds.length < 2 || selectedProductIds.length > 4) return;
    const newComparison = {
      id: Date.now(),
      productIds: [...selectedProductIds],
      created_at: new Date().toISOString(),
    };
    const updated = [newComparison, ...recentComparisons].slice(0, 5); // Keep last 5 comparisons
    setRecentComparisons(updated);
    localStorage.setItem('recentComparisons', JSON.stringify(updated));
    console.log('Saved comparison:', newComparison);
  };

  // Auto-save valid comparisons
  useEffect(() => {
    saveComparison();
  }, [selectedProductIds]);

  // Load a recent comparison
  const loadComparison = (comparison) => {
    setSelectedProductIds(comparison.productIds);
    localStorage.setItem('selectedProductIds', JSON.stringify(comparison.productIds));
    setError('');
    console.log('Loaded comparison:', comparison.productIds);
  };

  // Clear selected products
  const clearSelectedProducts = () => {
    setSelectedProductIds([]);
    localStorage.setItem('selectedProductIds', JSON.stringify([]));
    setError('');
    console.log('Cleared selectedProductIds');
  };

  // Clear error message
  const clearError = () => {
    setError('');
  };

  // Auto-clear errors after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <CompareContext.Provider
      value={{
        selectedProductIds,
        toggleProduct,
        recentComparisons,
        saveComparison,
        loadComparison,
        clearSelectedProducts,
        error,
        clearError,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
};