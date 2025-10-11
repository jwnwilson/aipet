// API Configuration
export const API_CONFIG = {
    // Base URL for the API - change this based on environment
    BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
    
    // Timeout for API requests (in milliseconds)
    TIMEOUT: 30000,
    
    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    
    // Headers that will be included in all requests
    DEFAULT_HEADERS: {
      'Content-Type': 'application/json',
    },
  } as const;
  
  // Environment-specific configurations
  export const getApiConfig = () => {
    const env = import.meta.env.MODE;
    
    switch (env) {
      case 'development':
        return {
          ...API_CONFIG,
          BASE_URL: 'http://localhost:8000/api/v1',
        };
      case 'production':
        return {
          ...API_CONFIG,
          BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://aipet-api.jwnwilson.co.uk/api/v1',
        };
      default:
        return API_CONFIG;
    }
  };
  
  // Export the current configuration
  export const currentApiConfig = getApiConfig(); 