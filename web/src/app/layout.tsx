import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data in the AI Revolution — Interactive Guide",
  description: "An interactive exploration of data concepts in AI: tokenization, embeddings, attention, transformers, RAG, fine-tuning, quantization, and more.",
  openGraph: {
    title: "Data in the AI Revolution — Interactive Guide",
    description: "9 interactive explorations covering predictive ML, tokenization, embeddings, attention, transformers, computer vision, RAG, fine-tuning, and quantization.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Data in the AI Revolution",
    description: "Hands-on interactive guide to core AI and data science concepts.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
