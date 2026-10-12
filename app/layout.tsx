import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import CookieConsent from "./components/CookieConsent";
import content from "../content/site.json";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tutor.zp.ua"),
  title: content.seo.title,
  description: content.seo.description,
  alternates: {
    canonical: "/",
    languages: {
      uk: "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "uk_UA",
    url: "/",
    siteName: content.seo.siteName,
    title: content.seo.openGraphTitle,
    description: content.seo.openGraphDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: content.seo.openGraphTitle,
    description: content.seo.openGraphDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <head>
        <Script id="google-consent-mode" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  personalization_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
try {
  var savedConsent = localStorage.getItem('mathlab_cookie_consent_v1');
  if (savedConsent === 'accepted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
} catch (e) {}`}
        </Script>
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-W4JMDFNH');`}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-W4JMDFNH"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
