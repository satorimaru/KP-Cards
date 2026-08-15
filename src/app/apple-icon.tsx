import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
            width: 96,
            height: 130,
            background: "#f8f4ea",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-8deg)",
          }}
        >
          <div
            style={{
              color: "#dc2626",
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            2
          </div>
          <div style={{ color: "#dc2626", fontSize: 40, lineHeight: 1 }}>♥</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
