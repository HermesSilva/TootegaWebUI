import { useState, useEffect, type JSX } from 'react';

interface MenuIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function MenuIcon({ name, size = 20, className = '' }: MenuIconProps): JSX.Element {
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;

    // Add .svg extension if not present
    const iconName = name.endsWith('.svg') ? name : `${name}.svg`;
    const iconPath = `/icons/${iconName}`;
    
    fetch(iconPath)
      .then((res) => {
        if (!res.ok) throw new Error('Icon not found');
        return res.text();
      })
      .then((svg) => {
        // Parse and modify SVG to apply size, color and stroke-width
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        
        if (svgEl) {
          svgEl.setAttribute('width', String(size));
          svgEl.setAttribute('height', String(size));
          svgEl.setAttribute('stroke', 'hsl(217, 91%, 60%)');
          svgEl.setAttribute('stroke-width', '2.5');
          if (className)
            svgEl.setAttribute('class', className);
          setSvgContent(svgEl.outerHTML);
        }
      })
      .catch(() => {
        setSvgContent(null);
      });
  }, [name, size, className]);

  if (!svgContent)
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="w-2 h-2 rounded-full bg-current opacity-50" />
      </div>
    );

  return <span dangerouslySetInnerHTML={{ __html: svgContent }} />;
}
