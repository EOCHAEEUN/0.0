export async function simulateRoi(input: any) {
  console.log("ROI API 요청 input:", input)

  const response = await fetch("http://127.0.0.1:8000/api/roi/simulate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("ROI API 오류 응답:", errorText)
    throw new Error(`ROI API 호출 실패: ${response.status}`)
  }

  const json = await response.json()
  console.log("ROI API 응답:", json)

  return json.data
}