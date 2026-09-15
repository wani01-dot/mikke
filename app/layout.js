import "./globals.css";

export const metadata = {
  title: "Mikke",
  description: "見逃したくない、あの瞬間を。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
