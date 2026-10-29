/** اسکلت بارگذاری سراسری — هم‌زبان با LoadingBlock صفحات (شیمر، بدون اسپینر تنها) */
export default function Loading() {
  return (
    <div dir="rtl" className="min-h-[60vh] max-w-6xl mx-auto w-full px-4 py-10 flex flex-col gap-4" role="status" aria-label="در حال بارگذاری…">
      <div className="flex flex-col gap-2">
        <span className="h-8 w-56 rounded-2xl b-shimmer" />
        <span className="h-4 w-80 max-w-full rounded-lg b-shimmer" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="b-card-sm p-5 flex items-center gap-4">
            <span className="w-11 h-11 rounded-full b-shimmer shrink-0" />
            <span className="flex flex-col gap-2 flex-1">
              <span className="h-4 w-2/3 rounded-md b-shimmer" />
              <span className="h-3 w-1/2 rounded-md b-shimmer" />
            </span>
          </div>
        ))}
      </div>
      <div className="b-card-sm p-6 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-4 rounded-md b-shimmer" style={{ width: `${90 - i * 11}%` }} />
        ))}
      </div>
    </div>
  );
}
