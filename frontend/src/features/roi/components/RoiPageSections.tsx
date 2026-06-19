import { useState, type ReactNode, type RefObject } from "react"

import type { ApiStatus, RoiFormState, ScenarioCard, ScoreSummary } from "../roi.contract"
import {
  EQUIPMENT_TYPE_OPTIONS,
  colors,
  inputStyle,
  secondaryButtonStyle,
  selectStyle,
} from "../roi.constants"
import {
  formatAnnualMoneyFromManwon,
  formatCommaNumber,
  formatMoneyFromManwon,
  formatNumber,
  formatPaybackYears,
} from "../roi.utils"

export function PageHero() {
  return (
    <div
      style={{
        marginBottom: "28px",
      }}
    >
      <div
        style={{
          width: "60px",
          height: "4px",
          borderRadius: "999px",
          background:
            "linear-gradient(90deg, #4B5CB0 0%, #C8A15B 55%, rgba(200,161,91,0) 100%)",
          marginBottom: "14px",
        }}
      />

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: "40px",
          padding: "0 22px",
          borderRadius: "999px",
          background: colors.blue,
          color: "#FFFFFF",
          fontSize: "14px",
          fontWeight: 900,
          letterSpacing: "0.04em",
          marginBottom: "18px",
        }}
      >
        FACTOFIT SIMULATION
      </div>

      <div
        style={{
          color: colors.blue,
          fontSize: "15px",
          fontWeight: 900,
          letterSpacing: "0.22em",
          marginBottom: "18px",
        }}
      >
        ANALYSIS
      </div>

      <h1
        style={{
          color: colors.navy,
          fontSize: "clamp(40px, 4.8vw, 70px)",
          lineHeight: 1.08,
          letterSpacing: "-0.045em",
          fontWeight: 900,
          margin: 0,
          marginBottom: "18px",
        }}
      >
        설비투자 전, 회수기간과 실부담금보다 먼저{" "}
        <span style={{ color: colors.blue2 }}>ROI</span>를 계산합니다.
      </h1>

      <p
        style={{
          color: colors.muted,
          fontSize: "16px",
          lineHeight: 1.8,
          fontWeight: 800,
          margin: 0,
          maxWidth: "1080px",
        }}
      >
        필수 정보는 지원사업 매칭 기준으로 사용되고, 선택 정보는 계산 정확도를 높이는 데
        활용됩니다. 입력값이 비어 있으면 일부 항목은 fallback 평균값으로 계산됩니다.
      </p>
    </div>
  )
}

export function InputPanel({
  inputSectionRef,
  form,
  apiStatus,
  errorMessage,
  onChange,
  onCalculate,
}: {
  inputSectionRef: RefObject<HTMLDivElement | null>
  form: RoiFormState
  apiStatus: ApiStatus
  errorMessage: string
  onChange: (key: keyof RoiFormState, value: string) => void
  onCalculate: () => void
}) {
  return (
    <div
      ref={inputSectionRef}
      style={{
        background: colors.card,
        border: `1px solid ${colors.line}`,
        borderRadius: "30px",
        overflow: "visible",
        boxShadow: "0 18px 40px rgba(15,23,42,.04)",
        marginBottom: "34px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 1fr)",
        }}
      >
        <aside
          style={{
            padding: "32px 24px 28px",
            background: colors.soft,
            borderRight: `1px solid ${colors.lineSoft}`,
          }}
        >
          <div
            style={{
              color: colors.blue2,
              fontSize: "14px",
              letterSpacing: "0.18em",
              fontWeight: 900,
              marginBottom: "18px",
            }}
          >
            STEP 01
          </div>

          <h2
            style={{
              color: colors.navy,
              fontSize: "28px",
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
              fontWeight: 900,
              margin: 0,
              marginBottom: "14px",
            }}
          >
            입력 정보
          </h2>

          <p
            style={{
              color: colors.muted,
              fontSize: "15px",
              lineHeight: 1.7,
              fontWeight: 800,
              margin: 0,
              marginBottom: "28px",
            }}
          >
            필수값은 지원사업 매칭 기준으로 사용되고, 선택값은 계산 정확도를 높이는 데
            활용됩니다.
          </p>
        </aside>

        <div
          style={{
            padding: "32px 28px 28px",
          }}
        >
          <SectionTitle
            required
            tooltip="ROI 시뮬레이션을 실행하기 위해 반드시 필요한 입력값입니다. 마이페이지에 저장된 값이 있으면 자동으로 채워지고, 이 화면에서 수정한 값은 ROI 계산에만 사용됩니다."
          >
            공통 필수 정보
          </SectionTitle>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "18px 20px",
              marginBottom: "30px",
            }}
          >
            <FieldBox label="설비 종류" labelRight={<EquipmentTypeHelpTooltip />}>
              <select
                value={form.equipmentType}
                onChange={(event) => onChange("equipmentType", event.target.value)}
                style={selectStyle}
              >
                {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </select>
            </FieldBox>

            <FieldBox label="설비명">
              <input
                value={form.equipmentName}
                onChange={(event) => onChange("equipmentName", event.target.value)}
                placeholder="예: 1600톤 프레스 #1"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="업종명">
              <input
                value={form.industryName}
                onChange={(event) => onChange("industryName", event.target.value)}
                placeholder="예: 금속가공"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="업종코드">
              <input
                value={form.industryCode}
                onChange={(event) => onChange("industryCode", event.target.value)}
                placeholder="예: C25"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="설비 사용연수">
              <input
                value={form.equipmentAge}
                onChange={(event) => onChange("equipmentAge", event.target.value)}
                placeholder="예: 15"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="연간 에너지 비용">
              <input
                value={form.annualEnergyCostManwon}
                onChange={(event) =>
                  onChange("annualEnergyCostManwon", formatCommaNumber(event.target.value))
                }
                placeholder="예: 4,500"
                style={inputStyle}
              />
              <HelperText>단위: 만원/년</HelperText>
            </FieldBox>

            <FieldBox label="연 매출액">
              <input
                value={form.annualRevenueManwon}
                onChange={(event) =>
                  onChange("annualRevenueManwon", formatCommaNumber(event.target.value))
                }
                placeholder="예: 320,000"
                style={inputStyle}
              />
              <HelperText>단위: 만원/년</HelperText>
            </FieldBox>

            <FieldBox label="지역">
              <input
                value={form.region}
                onChange={(event) => onChange("region", event.target.value)}
                placeholder="예: 경기도 안산시"
                style={inputStyle}
              />
            </FieldBox>
          </div>

          <SectionTitle
            optional
            tooltip="선택 정보를 입력하면 투자비, 절감액, 회수기간을 더 현실적인 기준으로 계산할 수 있습니다."
          >
            선택 정보
          </SectionTitle>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "28px 26px",
              alignItems: "start",
            }}
          >
            <FieldBox label="직원수">
              <input
                value={form.employees}
                onChange={(event) => onChange("employees", formatCommaNumber(event.target.value))}
                placeholder="예: 45"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="공정">
              <input
                value={form.process}
                onChange={(event) => onChange("process", event.target.value)}
                placeholder="예: 프레스 공정"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="설비용량 규격값">
              <input
                value={form.currentCapacityValue}
                onChange={(event) => onChange("currentCapacityValue", event.target.value)}
                placeholder="예: 1600"
                style={inputStyle}
              />
              <HelperText>보조 단위: 프레스/사출기 톤, CNC kW</HelperText>
            </FieldBox>

            <FieldBox label="불량률">
              <input
                value={form.defectRate}
                onChange={(event) => onChange("defectRate", event.target.value)}
                placeholder="예: 5.8"
                style={inputStyle}
              />
              <HelperText>% 단위</HelperText>
            </FieldBox>

            <FieldBox label="연간 생산량">
              <input
                value={form.productionQty}
                onChange={(event) => onChange("productionQty", formatCommaNumber(event.target.value))}
                placeholder="예: 50,000"
                style={inputStyle}
              />
            </FieldBox>

            <FieldBox label="제품 개당 예상이익">
              <input
                value={form.contributionMarginWon}
                onChange={(event) =>
                  onChange("contributionMarginWon", formatCommaNumber(event.target.value))
                }
                placeholder="예: 12,000"
                style={inputStyle}
              />
              <HelperText>원 단위</HelperText>
            </FieldBox>

            <FieldBox label="전체교체 예상 투자금">
              <input
                value={form.scenarioAInvestmentManwon}
                onChange={(event) =>
                  onChange(
                    "scenarioAInvestmentManwon",
                    formatCommaNumber(event.target.value),
                  )
                }
                placeholder="예: 22,000"
                style={inputStyle}
              />
              <HelperText>단위: 만원 · scenario_a_investment_manwon</HelperText>
            </FieldBox>

            <FieldBox label="부분교체 예상 투자금">
              <input
                value={form.scenarioBInvestmentManwon}
                onChange={(event) =>
                  onChange(
                    "scenarioBInvestmentManwon",
                    formatCommaNumber(event.target.value),
                  )
                }
                placeholder="예: 4,994"
                style={inputStyle}
              />
              <HelperText>단위: 만원 · scenario_b_investment_manwon</HelperText>
            </FieldBox>

            <FieldBox label="연간 유지보수 비용">
              <input
                value={form.annualMaintenanceCostManwon}
                onChange={(event) =>
                  onChange(
                    "annualMaintenanceCostManwon",
                    formatCommaNumber(event.target.value),
                  )
                }
                placeholder="예: 1,200"
                style={inputStyle}
              />
              <HelperText>단위: 만원/년</HelperText>
            </FieldBox>
          </div>

          <div
            style={{
              marginTop: "26px",
              background: "#F8FAFD",
              border: `1px solid ${colors.lineSoft}`,
              borderRadius: "24px",
              padding: "24px",
            }}
          >
            <div
              style={{
                color: colors.navy,
                fontSize: "18px",
                lineHeight: 1.35,
                fontWeight: 900,
                marginBottom: "10px",
              }}
            >
              입력값 기준으로 시뮬레이션을 실행합니다.
            </div>

            <p
              style={{
                color: colors.muted,
                fontSize: "14px",
                lineHeight: 1.7,
                fontWeight: 800,
                margin: 0,
                marginBottom: "18px",
              }}
            >
              실행 시 백엔드 <b>/api/roi/simulate</b> API를 호출하고, 응답이 있으면
              추천 결과와 시나리오 카드에 반영합니다.
            </p>

            <button
              type="button"
              onClick={onCalculate}
              disabled={apiStatus === "loading"}
              style={{
                height: "52px",
                padding: "0 28px",
                borderRadius: "16px",
                border: "0",
                background: colors.blue2,
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: 900,
                cursor: apiStatus === "loading" ? "not-allowed" : "pointer",
                opacity: apiStatus === "loading" ? 0.7 : 1,
              }}
            >
              {apiStatus === "loading" ? "시뮬레이션 분석 중..." : "시뮬레이션 분석하기"}
            </button>
          </div>

          {apiStatus !== "idle" && (
            <StatusMessage apiStatus={apiStatus} errorMessage={errorMessage} />
          )}
        </div>
      </div>
    </div>
  )
}

export function ResultAndAiSection({
  form,
  selectedScenario,
  recommendedScenario,
  recommendedScenarioId,
  selectedScenarioId,
  selectedScores,
  selectedStatusLabel,
  selectedDescription,
  summaryAccent,
  summarySoft,
  onReset,
  onNavigateSupport,
}: {
  form: RoiFormState
  selectedScenario: ScenarioCard
  recommendedScenario: ScenarioCard
  recommendedScenarioId: "A" | "B"
  selectedScenarioId: "A" | "B"
  selectedScores: ScoreSummary
  selectedStatusLabel: string
  selectedDescription: string
  summaryAccent: string
  summarySoft: string
  onReset: () => void
  onNavigateSupport: () => void
}) {
  const resultMetrics = [
    {
      label: "총 투자금",
      value: formatMoneyFromManwon(selectedScenario.investmentManwon),
    },
    {
      label: "예상 지원금",
      value: formatMoneyFromManwon(selectedScenario.subsidyManwon),
    },
    {
      label: "실부담금",
      value: formatMoneyFromManwon(selectedScenario.netInvestmentManwon),
    },
    {
      label: "회수기간",
      value: formatPaybackYears(selectedScenario.paybackYears),
    },
  ]

  return (
    <div
      style={{
        borderRadius: "34px",
        border: `1px solid ${colors.lineSoft}`,
        background: colors.card,
        boxShadow: "0 22px 48px rgba(15,23,42,.06)",
        overflow: "hidden",
        marginBottom: "34px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 410px",
          alignItems: "stretch",
        }}
      >
        <section
          style={{
            padding: "42px 42px 36px",
            minHeight: "430px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 58%, #F8FAFD 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                width: "fit-content",
                height: "42px",
                padding: "0 18px",
                borderRadius: "999px",
                background: summarySoft,
                color: summaryAccent,
                fontSize: "14px",
                fontWeight: 900,
              }}
            >
              {selectedStatusLabel}
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "42px",
                padding: "0 16px",
                borderRadius: "999px",
                background: "#F7F8FC",
                color: colors.muted,
                fontSize: "13px",
                fontWeight: 900,
                border: `1px solid ${colors.lineSoft}`,
              }}
            >
              현재 선택 시나리오 {selectedScenario.id}
            </span>
          </div>

          <h2
            style={{
              color: colors.navy,
              fontSize: "clamp(38px, 4.2vw, 64px)",
              lineHeight: 1.08,
              letterSpacing: "-0.055em",
              fontWeight: 900,
              margin: 0,
              marginBottom: "22px",
              maxWidth: "820px",
            }}
          >
            {form.equipmentName} 투자 시 추천{" "}
            <span style={{ color: colors.blue2 }}>ROI</span>는{" "}
            <span style={{ color: summaryAccent }}>{selectedScenario.roiPct}%</span>,{" "}
            <span style={{ color: summaryAccent }}>{selectedScenario.id} 시나리오</span>
            입니다.
          </h2>

          <p
            style={{
              color: colors.muted,
              fontSize: "16px",
              lineHeight: 1.75,
              fontWeight: 800,
              margin: 0,
              marginBottom: "30px",
              maxWidth: "900px",
            }}
          >
            {selectedDescription}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              borderTop: `1px solid ${colors.lineSoft}`,
              borderBottom: `1px solid ${colors.lineSoft}`,
              background: "#FBFCFF",
            }}
          >
            {resultMetrics.map((metric) => (
              <SummaryNumberCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
              />
            ))}
          </div>
        </section>

        <aside
          style={{
            background: colors.navy,
            borderLeft: "1px solid rgba(255,255,255,.08)",
            borderTop: `4px solid ${colors.gold}`,
            padding: "36px 32px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                color: "#FFFFFF",
                fontSize: "30px",
                lineHeight: 1.15,
                letterSpacing: "-0.035em",
                fontWeight: 900,
              }}
            >
              AI 판단 근거
            </div>

            <div
              style={{
                width: "58px",
                height: "58px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.18)",
                color: "#FFFFFF",
                fontSize: "20px",
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {selectedScores.total}
            </div>
          </div>

          <p
            style={{
              color: "#DDE7F7",
              fontSize: "14px",
              lineHeight: 1.75,
              fontWeight: 800,
              margin: 0,
              marginBottom: "26px",
            }}
          >
            AI는 현재 <b>{recommendedScenarioId} 시나리오</b>를 추천합니다. 추천 기준은
            지원금 적합도, 비용 절감 효과, 설비 노후도, 안전 리스크를 종합한 점수입니다.
            {selectedScenarioId !== recommendedScenarioId
              ? ` 현재 화면에서는 ${selectedScenarioId} 시나리오를 확인 중입니다.`
              : ""}
          </p>

          <ReasonRow label="지원금 적합도" value={selectedScores.supportFit} />
          <ReasonRow label="비용 절감 효과" value={selectedScores.savingEffect} />
          <ReasonRow label="설비 노후도" value={selectedScores.aging} />
          <ReasonRow label="안전 리스크" value={selectedScores.safetyRisk} />
        </aside>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: "22px",
          alignItems: "center",
          padding: "26px 32px",
          borderTop: `1px solid ${colors.lineSoft}`,
          background: "#F8FAFD",
        }}
      >
        <div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "34px",
              padding: "0 14px",
              borderRadius: "999px",
              background: "#EEF0FF",
              color: colors.blue2,
              fontSize: "12px",
              letterSpacing: "0.04em",
              fontWeight: 900,
              marginBottom: "12px",
            }}
          >
            NEXT ACTION
          </span>

          <div
            style={{
              color: colors.navy,
              fontSize: "24px",
              lineHeight: 1.25,
              fontWeight: 900,
              letterSpacing: "-0.035em",
              marginBottom: "8px",
            }}
          >
            다음 추천 액션
          </div>

          <p
            style={{
              color: colors.muted,
              fontSize: "15px",
              lineHeight: 1.7,
              fontWeight: 800,
              margin: 0,
            }}
          >
            추천된 {recommendedScenario.id} 시나리오 기준으로 지원사업 상세 검토를 이어서
            진행하세요.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onNavigateSupport}
            style={{
              ...secondaryButtonStyle,
              background: "#FFFFFF",
              color: colors.blue2,
              border: `1px solid ${colors.lineSoft}`,
            }}
          >
            지원사업 상세보기
          </button>

          <button type="button" onClick={onReset} style={secondaryButtonStyle}>
            다시 계산하기
          </button>
        </div>
      </div>
    </div>
  )
}

export function ScenarioCompareSection({
  scenarios,
  recommendedScenarioId,
  selectedScenarioId,
  onSelect,
}: {
  scenarios: ScenarioCard[]
  recommendedScenarioId: "A" | "B"
  selectedScenarioId: "A" | "B"
  onSelect: (id: "A" | "B") => void
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "22px",
        marginBottom: "34px",
      }}
    >
      {scenarios.map((scenario) => {
        const isSelected = selectedScenarioId === scenario.id
        const isRecommended = recommendedScenarioId === scenario.id
        const isA = scenario.id === "A"
        const accent = isA ? colors.green : colors.blue2

        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() => onSelect(scenario.id)}
            style={{
              textAlign: "left",
              borderRadius: "28px",
              border: isSelected ? `2px solid ${accent}` : `1px solid ${colors.lineSoft}`,
              background: colors.card,
              padding: "26px",
              cursor: "pointer",
              boxShadow: isSelected ? "0 16px 34px rgba(15,23,42,.08)" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "18px",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: "40px",
                    padding: "0 16px",
                    borderRadius: "999px",
                    background: isRecommended ? colors.greenSoft : "#EEF0FF",
                    color: isRecommended ? colors.green : colors.blue2,
                    fontSize: "14px",
                    fontWeight: 900,
                    marginBottom: "18px",
                  }}
                >
                  {isRecommended ? `${scenario.badge} 추천` : scenario.badge}
                </span>

                <div
                  style={{
                    color: colors.navy,
                    fontSize: "24px",
                    lineHeight: 1.25,
                    letterSpacing: "-0.03em",
                    fontWeight: 900,
                    marginBottom: "10px",
                  }}
                >
                  {scenario.title}
                </div>

                <p
                  style={{
                    color: colors.muted,
                    fontSize: "14px",
                    lineHeight: 1.65,
                    fontWeight: 800,
                    margin: 0,
                  }}
                >
                  {scenario.subtitle}
                </p>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: accent,
                  color: "#FFFFFF",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "28px",
                  fontWeight: 900,
                }}
              >
                {scenario.id}
              </div>
            </div>

            <MetricGrid>
              <MetricCell label="투자금액" value={formatMoneyFromManwon(scenario.investmentManwon)} />
              <MetricCell label="보조금" value={formatMoneyFromManwon(scenario.subsidyManwon)} />
              <MetricCell
                label="실투자금액"
                value={formatMoneyFromManwon(scenario.netInvestmentManwon)}
                valueColor={accent}
              />
            </MetricGrid>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "14px",
                margin: "16px 0",
              }}
            >
              <SmallSavingCard
                icon="⚡"
                label="에너지 절감액"
                value={formatAnnualMoneyFromManwon(scenario.energySavingManwon)}
              />
              <SmallSavingCard
                icon="🔧"
                label="유지보수 절감액"
                value={formatAnnualMoneyFromManwon(scenario.maintenanceSavingManwon)}
              />
              <SmallSavingCard
                icon="◎"
                label="불량비용 절감액"
                value={formatAnnualMoneyFromManwon(scenario.defectSavingManwon)}
              />
            </div>

            <MetricGrid>
              <MetricCell
                label="연간 순편익"
                value={formatAnnualMoneyFromManwon(scenario.annualNetBenefitManwon)}
                valueColor={accent}
              />
              <MetricCell label="회수기간" value={formatPaybackYears(scenario.paybackYears)} />
              <MetricCell label="ROI" value={`${scenario.roiPct}%`} valueColor={accent} />
            </MetricGrid>
          </button>
        )
      })}
    </div>
  )
}

export function InvestmentEstimateSection({
  scenarios,
  selectedScenarioId,
}: {
  scenarios: ScenarioCard[]
  selectedScenarioId: "A" | "B"
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "22px",
        marginBottom: "34px",
      }}
    >
      {scenarios.map((scenario) => {
        const isA = scenario.id === "A"
        const isSelected = selectedScenarioId === scenario.id
        const accent = isA ? colors.green : colors.blue2
        const softBackground = isA ? colors.greenSoft : "#EEF0FF"

        return (
          <div
            key={`estimate-${scenario.id}`}
            style={{
              borderRadius: "26px",
              border: isSelected
                ? `2px solid ${accent}`
                : `1px solid ${colors.lineSoft}`,
              background: isSelected
                ? "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 62%, #F8FAFD 100%)"
                : colors.card,
              padding: isSelected ? "23px" : "24px",
              boxShadow: isSelected
                ? "0 18px 38px rgba(15,23,42,.07)"
                : "none",
              transition: "border .18s ease, box-shadow .18s ease, background .18s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  color: colors.navy,
                  fontSize: "24px",
                  lineHeight: 1.2,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                }}
              >
                투자금 추정 정보
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: "34px",
                  padding: "0 14px",
                  borderRadius: "999px",
                  background: isSelected ? softBackground : "transparent",
                  color: accent,
                  fontSize: "13px",
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {scenario.id === "A" ? "시나리오 A - 전체 교체" : "시나리오 B - 부분 교체"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "14px",
              }}
            >
              <EstimateCard label="투자 범위" value={scenario.estimateRangeText} />
              <EstimateCard
                label="권장 투자액"
                value={formatMoneyFromManwon(scenario.investmentManwon)}
                valueColor={accent}
              />
              <EstimateCard label="산정 기준" value={scenario.estimateBasisText} />
            </div>

            <p
              style={{
                color: colors.muted,
                fontSize: "13px",
                lineHeight: 1.7,
                fontWeight: 800,
                margin: 0,
                marginTop: "16px",
              }}
            >
              실제 서비스에서는 설비 카테고리, 업종 코드, 지역, 설비 용량을 기준으로 DB
              평균 단가를 조회해 이 값을 대체하는 구조가 적합합니다.
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function EvidenceSection({
  costOpen,
  benchmarkOpen,
  onToggleCost,
  onToggleBenchmark,
  currentEnergyCost,
  currentMaintenanceCost,
  currentDefectLoss,
  selectedEnergyAfter,
  selectedMaintenanceAfter,
  selectedDefectAfter,
  costMax,
  toBarWidth,
  benchmarkIndustryName,
  form,
  selectedScores,
}: {
  costOpen: boolean
  benchmarkOpen: boolean
  onToggleCost: () => void
  onToggleBenchmark: () => void
  currentEnergyCost: number
  currentMaintenanceCost: number
  currentDefectLoss: number
  selectedEnergyAfter: number
  selectedMaintenanceAfter: number
  selectedDefectAfter: number
  costMax: number
  toBarWidth: (value: number) => string
  benchmarkIndustryName: string
  form: RoiFormState
  selectedScores: ScoreSummary
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "22px",
      }}
    >
      <AccordionCard
        title="비용 비교"
        subtitle="기본 닫힘 · 클릭 시 상세 표시"
        open={costOpen}
        onToggle={onToggleCost}
      >
        <div
          style={{
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <LegendChip color={colors.blue} label="기존 설비 유지" />
          <LegendChip color={colors.blue2} label="선택 시나리오 기준" />
        </div>

        <CostCompareRow
          label="연간 전기요금"
          oldValue={currentEnergyCost}
          newValue={selectedEnergyAfter}
          oldBarWidth={toBarWidth(currentEnergyCost)}
          newBarWidth={toBarWidth(selectedEnergyAfter)}
        />

        <CostCompareRow
          label="불량 손실"
          oldValue={currentDefectLoss}
          newValue={selectedDefectAfter}
          oldBarWidth={toBarWidth(currentDefectLoss)}
          newBarWidth={toBarWidth(selectedDefectAfter)}
        />

        <CostCompareRow
          label="유지보수비"
          oldValue={currentMaintenanceCost}
          newValue={selectedMaintenanceAfter}
          oldBarWidth={toBarWidth(currentMaintenanceCost)}
          newBarWidth={toBarWidth(selectedMaintenanceAfter)}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#98A2B3",
            fontSize: "12px",
            fontWeight: 900,
            marginTop: "12px",
            paddingLeft: "150px",
          }}
        >
          <span>0</span>
          <span>{formatNumber(Math.round(costMax * 0.33))}</span>
          <span>{formatNumber(Math.round(costMax * 0.66))}</span>
          <span>{formatNumber(costMax)}</span>
        </div>
      </AccordionCard>

      <AccordionCard
        title="벤치마크 근거"
        subtitle="AI 분석 요약 · 기본 닫힘"
        open={benchmarkOpen}
        onToggle={onToggleBenchmark}
      >
        <div
          style={{
            border: `1px solid ${colors.lineSoft}`,
            borderRadius: "22px",
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          <BenchmarkRow label="업종" value={benchmarkIndustryName} />
          <BenchmarkRow label="설비 유형" value={form.equipmentType} bordered />
          <BenchmarkRow
            label="노후도"
            value={`${form.equipmentAge || "-"}년`}
            chip={{ label: "주의", color: "#A35B16", background: "#FFF5E8" }}
            bordered
          />
          <BenchmarkRow
            label="불량률"
            value={`${form.defectRate || "-"}%`}
            chip={{
              label: "개선 필요",
              color: "#B84646",
              background: "#FFF1F1",
            }}
            bordered
          />
          <BenchmarkRow
            label="지원사업 적합도"
            value={`${selectedScores.supportFit}%`}
            chip={{
              label: "높음",
              color: colors.green,
              background: colors.greenSoft,
            }}
            bordered
          />
        </div>

        <p
          style={{
            color: colors.muted,
            fontSize: "14px",
            lineHeight: 1.75,
            fontWeight: 800,
            margin: 0,
          }}
        >
          현재 설비는 에너지 비용, 유지보수비, 불량 손실, 노후도 측면에서 교체 또는
          부분 개선 검토 우선순위가 높습니다.
        </p>
      </AccordionCard>
    </div>
  )
}

function RequiredMark() {
  return (
    <span
      style={{
        color: "#D94E41",
        marginLeft: "2px",
      }}
    >
      *
    </span>
  )
}

function SelectChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "26px",
        padding: "0 10px",
        borderRadius: "999px",
        background: "#F4F6FA",
        color: "#98A2B3",
        fontSize: "11px",
        fontWeight: 900,
        lineHeight: 1,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      선택
    </span>
  )
}

export function FloatingModalNotice({
  open,
  title,
  description,
  description2,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  description2: string
  onClose: () => void
}) {
  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 120,
          background: "rgba(15, 23, 42, 0.62)",
          backdropFilter: "blur(8px)",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 121,
          width: "min(860px, calc(100vw - 40px))",
          borderRadius: "32px",
          padding: "54px 56px",
          background:
            "linear-gradient(135deg, rgba(10,18,38,.98) 0%, rgba(18,27,50,.98) 58%, rgba(32,37,49,.98) 100%)",
          border: "1px solid rgba(201, 190, 120, 0.28)",
          boxShadow: "0 38px 110px rgba(6, 27, 52, 0.38)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: "absolute",
            right: "42px",
            top: "42px",
            width: "62px",
            height: "62px",
            borderRadius: "999px",
            border: "1px solid rgba(201, 190, 120, 0.26)",
            background: "rgba(255,255,255,.06)",
            color: "#FFFFFF",
            fontSize: "42px",
            lineHeight: 1,
            fontWeight: 400,
            cursor: "pointer",
          }}
        >
          ×
        </button>

        <div
          style={{
            width: "170px",
            height: "4px",
            borderRadius: "999px",
            background:
              "linear-gradient(90deg, #7D74D9 0%, #D8D48B 56%, rgba(216,212,139,0) 100%)",
            marginBottom: "36px",
          }}
        />

        <strong
          style={{
            display: "block",
            color: "#DCD58A",
            fontSize: "42px",
            lineHeight: 1.18,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            marginBottom: "30px",
          }}
        >
          {title}
        </strong>

        <p
          style={{
            margin: 0,
            color: "#FFFFFF",
            fontSize: "23px",
            lineHeight: 1.85,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            maxWidth: "720px",
          }}
        >
          {description}
        </p>

        <p
          style={{
            margin: "24px 0 0",
            color: "#DCD58A",
            fontSize: "23px",
            lineHeight: 1.8,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            maxWidth: "760px",
          }}
        >
          {description2}
        </p>
      </div>
    </>
  )
}

function SectionTitle({
  children,
  tooltip,
  required = false,
  optional = false,
}: {
  children: ReactNode
  tooltip?: string
  required?: boolean
  optional?: boolean
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false)

  return (
    <div
      style={{
        color: colors.navy,
        fontSize: "26px",
        lineHeight: 1.2,
        letterSpacing: "-0.03em",
        fontWeight: 900,
        marginBottom: "18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        position: "relative",
        width: "fit-content",
      }}
    >
      <span>
        {children}
        {required && <RequiredMark />}
      </span>

      {optional && <SelectChip />}

      {tooltip && (
        <span
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "#EEF2F7",
            color: colors.muted,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 950,
            cursor: "help",
            flexShrink: 0,
          }}
        >
          i
        </span>
      )}

      {tooltip && tooltipOpen && (
        <div
          style={{
            position: "absolute",
            left: "calc(100% + 10px)",
            top: "-4px",
            width: "360px",
            padding: "14px 16px",
            borderRadius: "16px",
            border: `1px solid ${colors.lineSoft}`,
            background: "#FFFFFF",
            boxShadow: "0 18px 42px rgba(15,23,42,.12)",
            color: colors.muted,
            fontSize: "13px",
            lineHeight: 1.65,
            fontWeight: 850,
            letterSpacing: "-0.01em",
            zIndex: 20,
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}

function EquipmentTypeHelpTooltip() {
  const [open, setOpen] = useState(false)

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        minWidth: "18px",
        height: "18px",
        minHeight: "18px",
        borderRadius: "999px",
        background: "#F1F5F9",
        color: "#64748B",
        fontSize: "11px",
        fontWeight: 800,
        lineHeight: 1,
        cursor: "help",
        flex: "0 0 18px",
      }}
    >
      i

      {open && (
        <span
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(100% + 14px)",
            transform: "translateX(-34%)",
            zIndex: 9999,
            width: "360px",
            maxWidth: "calc(100vw - 44px)",
            padding: "16px 17px",
            borderRadius: "18px",
            background: colors.navy,
            color: "#FFFFFF",
            border: "1px solid rgba(255,255,255,.12)",
            boxShadow: "0 18px 42px rgba(6,27,52,.22)",
            whiteSpace: "normal",
            textAlign: "left",
            pointerEvents: "none",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#E7DC91",
              fontSize: "13px",
              lineHeight: 1.35,
              fontWeight: 900,
              marginBottom: "8px",
              letterSpacing: "-0.01em",
            }}
          >
            ROI 분석 지원 설비 안내
          </strong>

          <span
            style={{
              display: "block",
              color: "rgba(255,255,255,.88)",
              fontSize: "12px",
              lineHeight: 1.7,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              marginBottom: "8px",
            }}
          >
            현재 ROI 분석은 press, cnc, injection 설비에 최적화되어 있습니다.
          </span>

          <span
            style={{
              display: "block",
              color: "rgba(255,255,255,.88)",
              fontSize: "12px",
              lineHeight: 1.7,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            welding, compressor 등 기타 설비도 저장은 가능하지만, 분석 결과가 일부 제한될 수 있어요.
          </span>

          <span
            style={{
              position: "absolute",
              left: "34%",
              top: "100%",
              width: "12px",
              height: "12px",
              transform: "translate(-50%, -6px) rotate(45deg)",
              background: colors.navy,
              borderRight: "1px solid rgba(255,255,255,.12)",
              borderBottom: "1px solid rgba(255,255,255,.12)",
            }}
          />
        </span>
      )}
    </span>
  )
}

function FieldBox({
  label,
  children,
  labelRight,
}: {
  label: string
  children: ReactNode
  labelRight?: ReactNode
}) {
  const isRequired = label.trim().endsWith("*")
  const displayLabel = isRequired ? label.replace(/\s*\*$/, "") : label

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        <label
          style={{
            display: "block",
            color: colors.muted,
            fontSize: "14px",
            lineHeight: 1.2,
            fontWeight: 900,
          }}
        >
          {displayLabel}
          {isRequired && (
            <span
              style={{
                color: "#D94E41",
                marginLeft: "4px",
              }}
            >
              *
            </span>
          )}
        </label>

        {labelRight}
      </div>

      {children}
    </div>
  )
}

function HelperText({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        color: "#94A3B8",
        fontSize: "13px",
        lineHeight: 1.55,
        fontWeight: 900,
        margin: 0,
        marginTop: "10px",
      }}
    >
      {children}
    </p>
  )
}

function StatusMessage({
  apiStatus,
  errorMessage,
}: {
  apiStatus: ApiStatus
  errorMessage: string
}) {
  const styleMap: Record<ApiStatus, { border: string; background: string; color: string; text: string }> = {
    idle: {
      border: `1px solid ${colors.line}`,
      background: colors.card,
      color: colors.muted,
      text: "",
    },
    loading: {
      border: "1px solid #C2D7FF",
      background: "#F3F7FF",
      color: "#2E4AA7",
      text: "API 응답을 기다리는 중입니다.",
    },
    success: {
      border: "1px solid #C2D7FF",
      background: "#F3F7FF",
      color: "#2E4AA7",
      text: "백엔드 응답을 화면에 반영했습니다. 추천 결과와 시나리오 카드를 확인하세요.",
    },
    empty: {
      border: "1px solid #F3C58C",
      background: "#FFF9F0",
      color: "#A35B16",
      text: "API 응답은 왔지만 결과 데이터가 비어 있어 프론트 기본 계산값으로 표시합니다.",
    },
    error: {
      border: "1px solid #F5B1B1",
      background: "#FFF6F6",
      color: "#A03434",
      text: `API 호출에 실패했습니다. ${errorMessage} 프론트 기본 계산값으로 계속 표시합니다.`,
    },
  }

  const current = styleMap[apiStatus]

  return (
    <div
      style={{
        marginTop: "14px",
        padding: "14px 16px",
        borderRadius: "16px",
        border: current.border,
        background: current.background,
        color: current.color,
        fontSize: "13px",
        lineHeight: 1.7,
        fontWeight: 900,
      }}
    >
      {current.text}
    </div>
  )
}

function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        border: `1px solid ${colors.lineSoft}`,
        borderRadius: "22px",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  )
}

function MetricCell({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        padding: "18px",
        borderRight: `1px solid ${colors.lineSoft}`,
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: "13px",
          lineHeight: 1.2,
          fontWeight: 900,
          marginBottom: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: valueColor || colors.navy,
          fontSize: "22px",
          lineHeight: 1.2,
          letterSpacing: "-0.03em",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SmallSavingCard({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <div
      style={{
        border: `1px solid ${colors.lineSoft}`,
        background: colors.card,
        borderRadius: "20px",
        padding: "18px 14px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "22px",
          lineHeight: 1,
          marginBottom: "12px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: colors.muted,
          fontSize: "13px",
          lineHeight: 1.35,
          fontWeight: 900,
          marginBottom: "10px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: colors.navy,
          fontSize: "17px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SummaryNumberCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        padding: "20px 22px",
        background: "transparent",
        boxShadow: `inset -1px 0 0 ${colors.lineSoft}`,
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: "13px",
          lineHeight: 1.2,
          fontWeight: 900,
          marginBottom: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: colors.navy,
          fontSize: "24px",
          lineHeight: 1.15,
          letterSpacing: "-0.035em",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function EstimateCard({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        border: `1px solid ${colors.lineSoft}`,
        borderRadius: "20px",
        padding: "18px 16px",
        background: "#FDFEFF",
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: "13px",
          lineHeight: 1.2,
          fontWeight: 900,
          marginBottom: "12px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: valueColor || colors.navy,
          fontSize: "20px",
          lineHeight: 1.3,
          fontWeight: 900,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function ReasonRow({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 34px",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          color: "#FFFFFF",
          fontSize: "15px",
          lineHeight: 1.2,
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      <div
        style={{
          width: "100%",
          height: "15px",
          borderRadius: "999px",
          background: "rgba(255,255,255,.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            maxWidth: "100%",
            height: "100%",
            borderRadius: "999px",
            background: "#B7D8B9",
          }}
        />
      </div>

      <div
        style={{
          color: "#FFFFFF",
          fontSize: "15px",
          lineHeight: 1,
          fontWeight: 900,
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function AccordionCard({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string
  subtitle: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div
      style={{
        borderRadius: "28px",
        border: `1px solid ${colors.lineSoft}`,
        background: colors.card,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          border: "0",
          background: "transparent",
          padding: "22px 24px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: colors.navy,
              fontSize: "24px",
              lineHeight: 1.2,
              fontWeight: 900,
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </span>

          <span
            style={{
              color: colors.muted,
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            {subtitle}
          </span>
        </div>

        <span
          style={{
            color: colors.blue2,
            fontSize: "42px",
            lineHeight: 1,
            fontWeight: 300,
          }}
        >
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "0 24px 24px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function LegendChip({
  color,
  label,
}: {
  color: string
  label: string
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        color: colors.muted,
        fontSize: "14px",
        fontWeight: 900,
      }}
    >
      <i
        style={{
          width: "22px",
          height: "10px",
          borderRadius: "999px",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  )
}

function CostCompareRow({
  label,
  oldValue,
  newValue,
  oldBarWidth,
  newBarWidth,
}: {
  label: string
  oldValue: number
  newValue: number
  oldBarWidth: string
  newBarWidth: string
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: "16px",
        alignItems: "center",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          color: colors.navy,
          fontSize: "16px",
          lineHeight: 1.3,
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div>
        <div
          style={{
            width: "100%",
            height: "24px",
            borderRadius: "999px",
            background: "#E9EDF5",
            overflow: "hidden",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: oldBarWidth,
              height: "100%",
              background: colors.blue,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: "10px",
              fontSize: "13px",
              fontWeight: 900,
              borderRadius: "999px",
            }}
          >
            {formatNumber(oldValue)}
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: "24px",
            borderRadius: "999px",
            background: "#E9EDF5",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: newBarWidth,
              height: "100%",
              background: colors.blue2,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: "10px",
              fontSize: "13px",
              fontWeight: 900,
              borderRadius: "999px",
            }}
          >
            {formatNumber(newValue)}
          </div>
        </div>
      </div>
    </div>
  )
}

function BenchmarkRow({
  label,
  value,
  chip,
  bordered,
}: {
  label: string
  value: string
  chip?: {
    label: string
    color: string
    background: string
  }
  bordered?: boolean
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: "18px",
        alignItems: "center",
        padding: "16px 18px",
        borderTop: bordered ? `1px solid ${colors.lineSoft}` : "0",
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: "14px",
          lineHeight: 1.2,
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          color: colors.navy,
          fontSize: "16px",
          lineHeight: 1.4,
          fontWeight: 900,
        }}
      >
        <span>{value}</span>

        {chip && (
          <span
            style={{
              height: "28px",
              padding: "0 12px",
              borderRadius: "999px",
              background: chip.background,
              color: chip.color,
              fontSize: "12px",
              fontWeight: 900,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {chip.label}
          </span>
        )}
      </div>
    </div>
  )
}

