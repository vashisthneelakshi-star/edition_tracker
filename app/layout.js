import './globals.css';

export const metadata = {
  title: 'Edition Tracker',
  description: 'Rajasthan Patrika - Edition Delay/Early Tracking System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
