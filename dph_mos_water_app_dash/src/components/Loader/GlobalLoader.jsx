import React from 'react';

const GlobalLoader = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999,
      backdropFilter: 'blur(10px)',
      backgroundColor: 'rgba(255, 255, 255, 0.89)',
      flexDirection: 'column'
    }}>
      <img
        src="/Loader.png"
        alt="Loading..."
        style={{
          width: '110px',
          height: '110px',
          animation: 'spin 2s linear infinite'
        }}
      />
      <p style={{
        marginTop: '16px',
        color: '#555',
        fontFamily: 'Roboto, sans-serif',
        fontSize: '16px'
      }}>
        Loading, please wait...
      </p>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default GlobalLoader;
