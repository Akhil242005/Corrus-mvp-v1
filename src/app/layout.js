import "./globals.css";

export const metadata = {
  title: "CORRUS - Skill Verification & Hiring Platform",
  description: "Link competence with real-world engineering challenges.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
