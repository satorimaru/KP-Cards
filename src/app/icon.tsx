import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a1210",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 268,
            height: 364,
            background: "#f8f4ea",
            borderRadius: 22,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-8deg)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              color: "#dc2626",
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            2
          </div>
          <div style={{ color: "#dc2626", fontSize: 110, lineHeight: 1 }}>
            ♥
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
