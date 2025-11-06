import React, { createContext, useContext, useState } from 'react';

const ConfettiContext = createContext();

export const useConfetti = () => {
  const context = useContext(ConfettiContext);
  if (!context) {
    throw new Error('useConfetti must be used within a ConfettiProvider');
  }
  return context;
};

export const ConfettiProvider = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);

  const showConfetti = () => {
    setIsVisible(true);
  };

  const hideConfetti = () => {
    setIsVisible(false);
  };

  const value = {
    isVisible,
    showConfetti,
    hideConfetti,
  };

  return (
    <ConfettiContext.Provider value={value}>
      {children}
    </ConfettiContext.Provider>
  );
};

