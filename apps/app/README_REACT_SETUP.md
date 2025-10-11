# React Setup for Babylon.js App

This project has been updated to wrap the existing Babylon.js logic in a React application while keeping the original Babylon.js code unchanged.

## Changes Made

### 1. Dependencies Added
- `react` and `react-dom` for React framework
- `@types/react` and `@types/react-dom` for TypeScript support
- `@vitejs/plugin-react` for Vite React integration

### 2. New Files Created
- `src/App.tsx` - Main React application component
- `src/main.tsx` - React entry point
- `src/components/BabylonScene.tsx` - React component that hosts the Babylon.js scene

### 3. Modified Files
- `index.html` - Added root div and changed script source to main.tsx
- `vite/plugin.ts` - Added React plugin to Vite configuration
- `src/css/main.css` - Added styles for React app container
- `package.json` - Added React dependencies

### 4. Original Files Preserved
- `src/app.ts` - Original Babylon.js logic (unchanged)
- `src/playground/main-scene.ts` - Original scene logic (unchanged)
- All other Babylon.js related files remain untouched

## How It Works

1. **React Entry Point**: `main.tsx` renders the React app
2. **App Component**: `App.tsx` provides the main application structure
3. **BabylonScene Component**: `BabylonScene.tsx` manages the Babylon.js canvas lifecycle within React
4. **Original Logic**: The original Babylon.js App class logic has been extracted and adapted to work within the React component's useEffect hook

## Benefits

- **Separation of Concerns**: React handles the UI structure while Babylon.js handles 3D rendering
- **Component Reusability**: The BabylonScene component can be easily reused or extended
- **React Ecosystem**: Full access to React hooks, state management, and component libraries
- **Preserved Functionality**: All original Babylon.js features remain intact

## Running the App

```bash
npm install
npm run dev
```

The app will run on `http://localhost:8088` with the same Babylon.js functionality wrapped in a React application. 