export function EmptyPolicyState({
  onBackToRoi,
  equipmentName,
}: {
  onBackToRoi: () => void
  equipmentName: string
}) {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #FDBA74",
        background: "#FFF7ED",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge orange">추천 결과 없음</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#061B34",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        현재 조건에 맞는 지원사업이 없습니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#667085",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
          maxWidth: "760px",
        }}
      >
        {equipmentName} 기준 정책 추천 결과가 비어 있습니다. ROI 분석 결과,
        설비명, 업종, 투자 목적, 예상 지원금 정보를 보완하면 추천 정확도를
        높일 수 있습니다.
      </p>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button className="btn blue" type="button" onClick={onBackToRoi}>
          ROI 입력값 보완하기
        </button>

        <button
          className="btn dark"
          type="button"
          onClick={() =>
            window.alert("지원사업 결과가 없어도 화면이 정상 표시됩니다.")
          }
        >
          빈 상태 테스트 확인
        </button>
      </div>
    </div>
  )
}

export function LoadingPolicyState() {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #BFDBFE",
        background: "#EFF6FF",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge blue">LOADING</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#061B34",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        지원사업 추천 결과를 불러오는 중입니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#667085",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
        }}
      >
        ROI 분석 결과와 설비 정보를 기준으로 신청 가능성이 높은 지원사업을
        정리하고 있습니다.
      </p>
    </div>
  )
}

export function ErrorPolicyState({ onBackToRoi }: { onBackToRoi: () => void }) {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #FCA5A5",
        background: "#FEF2F2",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge red">ERROR</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#991B1B",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        지원사업 추천 결과를 불러오지 못했습니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#7F1D1D",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
          maxWidth: "760px",
        }}
      >
        정책 추천 API 오류가 발생해도 화면은 깨지지 않습니다. 잠시 후 다시
        시도하거나 ROI 입력값을 확인해주세요.
      </p>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button className="btn blue" type="button" onClick={onBackToRoi}>
          ROI 분석으로 돌아가기
        </button>
      </div>
    </div>
  )
}
