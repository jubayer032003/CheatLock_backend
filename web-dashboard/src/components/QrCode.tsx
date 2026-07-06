export function QrCode({ value }: { value: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`;

  return (
    <div className="keep-light inline-flex rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10">
      <img className="h-36 w-36" src={src} alt="Exam QR code" />
    </div>
  );
}
