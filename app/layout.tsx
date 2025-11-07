export const metadata = {
  title: 'OBS Earthquake Overlay',
  description: 'Earthquake alert overlay for OBS',
};

// Inline script to apply saved theme before paint
const themeScript = `
try {
  var raw = localStorage.getItem('emscDockConfigV2');
  if (raw) {
    var s = JSON.parse(raw);
    if (s && s.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }
} catch {};`;

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-transparent">{children}</body>
    </html>
  );
}

