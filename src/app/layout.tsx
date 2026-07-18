import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

/**
 * iOS reads splash screens from link tags keyed by exact device metrics.
 * Portrait only — the app is a portrait experience on iPhone.
 */
const SPLASH = [
  { w: 440, h: 956, r: 3 }, // iPhone 16/17 Pro Max
  { w: 420, h: 912, r: 3 }, // iPhone Air
  { w: 402, h: 874, r: 3 }, // iPhone 16/17 Pro
  { w: 430, h: 932, r: 3 }, // 14/15 Pro Max, 15/16 Plus
  { w: 393, h: 852, r: 3 }, // 14 Pro, 15, 16
  { w: 390, h: 844, r: 3 }, // 12, 13, 14
  { w: 375, h: 812, r: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, r: 3 }, // XS Max, 11 Pro Max
  { w: 414, h: 896, r: 2 }, // XR, 11
  { w: 375, h: 667, r: 2 }, // SE 2/3
  { w: 744, h: 1133, r: 2 }, // iPad mini 6
  { w: 820, h: 1180, r: 2 }, // iPad Air, iPad 10th gen
  { w: 834, h: 1194, r: 2 }, // iPad Pro 11"
  { w: 1024, h: 1366, r: 2 }, // iPad Pro 12.9"
];

export const metadata: Metadata = {
  title: "Surplus",
  description: "Hit the surplus. Beat last session.",
  appleWebApp: {
    capable: true,
    title: "Surplus",
    statusBarStyle: "black-translucent",
    startupImage: SPLASH.map(({ w, h, r }) => ({
      url: `/splash/splash-${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0B",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
