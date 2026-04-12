interface StartupSplashProps {
  isExiting: boolean;
}

export function StartupSplash({ isExiting }: StartupSplashProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden"
      style={{
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(0.76)' : 'scale(1)',
        transition: 'opacity 600ms ease, transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="absolute inset-0 bg-neutral-900" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),transparent_58%)]" />
      <div className="relative flex flex-col items-center gap-6">
        <img
          src="./app-icon.png"
          alt="PDFoff Viewer"
          className="h-52 w-52 drop-shadow-[0_24px_80px_rgba(59,130,246,0.22)]"
        />
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-[0.18em] text-white uppercase">
            PDFoff Viewer
          </h1>
          <p className="mt-3 text-sm uppercase tracking-[0.42em] text-white/45">
            Native PDF Reading
          </p>
        </div>
      </div>
    </div>
  );
}
