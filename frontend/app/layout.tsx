import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "팩토핏 (FactoFit)",
  description: "중소 제조기업 설비투자 AI 의사결정 에이전트",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
