const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** FastAPI SSE 스트리밍 채팅 */
export async function streamChat(
  message: string,
  companyContext: Record<string, unknown>,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, company_context: companyContext }),
  });
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split("\n")) {
      if (line.startsWith("data: ")) onChunk(line.slice(6));
    }
  }
}

/** ROI 시뮬레이션 */
export async function simulateRoi(equipment: Record<string, unknown>) {
  const res = await fetch(`${API}/api/roi/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ equipment }),
  });
  return res.json();
}
