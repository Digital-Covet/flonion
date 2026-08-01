import "dotenv/config";
// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Flonion - Grow Your Business with Better Reviews</title>
          <meta name="description" content="Flonion helps local businesses in India collect more customer reviews, manage online reputation, and prepare for AI-powered marketing from one simple platform. Start growing your business today." />
          <meta name="keywords" content="customer reviews, online reputation management, local business SEO, AI marketing, review management India, Google reviews, business growth, Flonion" />
          <meta property="og:title" content="Flonion - Grow Your Business with Better Reviews" />
          <meta property="og:description" content="Flonion helps local businesses in India collect more customer reviews, manage online reputation, and prepare for AI-powered marketing from one simple platform. Start growing your business today." />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Flonion" />
          <meta property="og:image" content="https://via.placeholder.com/1200x630?text=Flonion" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Flonion - Grow Your Business with Better Reviews" />
          <meta name="twitter:description" content="Flonion helps local businesses in India collect more customer reviews, manage online reputation, and prepare for AI-powered marketing from one simple platform. Start growing your business today." />
          <meta name="twitter:image" content="https://via.placeholder.com/1200x630?text=Flonion" />
          <link rel="icon" href="/favicon.ico" />
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Flonion",
              "description": "Flonion helps local businesses in India collect more customer reviews, manage online reputation, and prepare for AI-powered marketing from one simple platform.",
              "url": "https://flonion.com",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "INR"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "150"
              }
            })}
          </script>
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
