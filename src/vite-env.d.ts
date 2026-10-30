/// <reference types="vite/client" />

// SVG imports
declare module '*.svg' {
  const content: string;
  export default content;
}

// Absolute path SVG imports
declare module '/icons/*.svg' {
  const content: string;
  export default content;
}

// CSS imports
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
