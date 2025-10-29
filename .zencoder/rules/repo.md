---
description: Repository Information Overview
alwaysApply: true
---

# Lorcana Proxy Printer - Repository Information

## Summary
A React-based web application for managing and printing Lorcana trading card proxies. The application provides a user interface for creating, customizing, and exporting proxy cards as PDF documents. Built with modern frontend technologies including React 19, Vite, and Bootstrap for responsive UI design.

## Structure
```
lorcana-proxy/
├── src/                          # Source code directory
│   ├── main.jsx                  # React application entry point
│   ├── App.jsx                   # Root React component
│   ├── App.css                   # Application styling
│   ├── index.css                 # Global styles
│   ├── components/
│   │   └── LorcanaProxyPrinter.jsx  # Main proxy printer component
│   └── assets/                   # Static assets (images, icons)
├── public/                       # Static public assets (served as-is)
├── dist/                         # Production build output (generated)
├── package.json                  # Project dependencies and scripts
├── vite.config.js                # Vite build configuration
├── eslint.config.js              # ESLint configuration
└── index.html                    # HTML entry point
```

## Language & Runtime
**Language**: JavaScript (JSX)
**Runtime**: Node.js (via npm)
**JavaScript Version**: ES Module (type: "module")
**Framework**: React 19.1.0
**Build Tool**: Vite 6.3.5

## Dependencies
**Main Dependencies**:
- `react@^19.1.0` - UI framework
- `react-dom@^19.1.0` - React DOM rendering
- `bootstrap@^5.3.6` - CSS framework for responsive design
- `jspdf@^3.0.1` - PDF generation library
- `react-toastify@^11.0.5` - Toast notification system

**Development Dependencies**:
- `vite@^6.3.5` - Build tool and dev server
- `@vitejs/plugin-react@^4.4.1` - Vite React plugin with Fast Refresh
- `eslint@^9.25.0` - Code linting
- `@eslint/js@^9.25.0` - ESLint JavaScript config
- `eslint-plugin-react-hooks@^5.2.0` - React hooks linting rules
- `eslint-plugin-react-refresh@^0.4.19` - React Fast Refresh validation
- `@types/react@^19.1.2` - React type definitions
- `@types/react-dom@^19.1.2` - React DOM type definitions
- `globals@^16.0.0` - Global type definitions

## Build & Installation
**Installation**:
```bash
npm install
```

**Development Server** (with HMR):
```bash
npm run dev
```

**Production Build**:
```bash
npm run build
```

**Preview Built Application**:
```bash
npm run preview
```

**Linting**:
```bash
npm run lint
```

## Build Configuration
The Vite build configuration (`vite.config.js`) implements code splitting for optimized bundle sizes:
- Separate chunks for: html2canvas, jsPDF, react-toastify, bootstrap, and react vendor libraries
- Main application code bundled separately for better caching
- Rollup-based output optimization for production builds

## Main Entry Points
- **HTML Entry**: `index.html` - Root HTML file mounted in browser
- **JS Entry**: `src/main.jsx` - React application initialization
- **Root Component**: `src/App.jsx` - Main App component wrapper
- **Main Logic**: `src/components/LorcanaProxyPrinter.jsx` - Core proxy printer functionality

## Application Features
The LorcanaProxyPrinter component provides:
- Proxy card creation and management interface
- PDF export functionality (via jsPDF)
- Screen capture capabilities (via html2canvas)
- User notifications and feedback (via react-toastify)
- Responsive Bootstrap-based UI

## Package Manager
**Package Manager**: npm
**Lock File**: package-lock.json
**Node Modules**: Installed in node_modules/ (not committed to repository)

## Test Framework
**targetFramework**: Playwright
