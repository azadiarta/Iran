'use client';

// Sitewide watermark: the Iranian Political Association (Birmingham) emblem,
// fixed behind all content at low opacity. `backgroundSize: contain` keeps the
// image's original proportions intact (no stretching/cropping) while letting
// it scale to fit any viewport.
export default function SiteBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none"
      style={{
        zIndex: -1,
        backgroundImage: "url('/branding/ipa-birmingham.jpg')",
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: 0.07,
      }}
    />
  );
}
