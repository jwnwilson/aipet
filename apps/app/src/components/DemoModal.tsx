import React from 'react';

interface ThankYouModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DemoModal: React.FC<ThankYouModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '1rem'
      }}>
        <h2 style={{
          margin: '0 0 1rem 0',
          color: '#333',
          fontSize: '1.5rem'
        }}>
          Thank you for trying this demo!
        </h2>
        <p style={{
          margin: '0 0 1.5rem 0',
          color: '#666',
          lineHeight: '1.5'
        }}>
          We hope you enjoyed exploring our AI Pet, the Pet has gone to sleep now.
        </p>
        <button
          onClick={onClose}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#0056b3';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#007bff';
          }}
        >
          Continue Exploring
        </button>
      </div>
    </div>
  );
};

export default DemoModal; 