"use client";

/** آخرین لایهٔ خطا — وقتی خود چیدمان اصلی هم بالا نمی‌آید؛ مستقل از استایل‌های سامانه */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Tahoma, system-ui, sans-serif", background: "#f6f8f6", color: "#10231b", padding: "24px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div
            style={{
              fontSize: 96, fontWeight: 900, lineHeight: 1,
              background: "linear-gradient(92deg,#00825E,#E5548B)", WebkitBackgroundClip: "text",
              backgroundClip: "text", color: "transparent",
            }}
          >
            ۵۰۰
          </div>
          <h1 style={{ fontSize: 22, margin: "16px 0 8px" }}>مشکلی پیش آمد</h1>
          <p style={{ fontSize: 14, color: "#5b6b62", lineHeight: 2, margin: "0 0 24px" }}>
            سامانه موقتاً نتوانست پاسخ دهد. لطفاً دوباره تلاش کنید.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#00825E", color: "#fff", border: 0, borderRadius: 999,
              padding: "10px 26px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
