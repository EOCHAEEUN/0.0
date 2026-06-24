import { useState, type CSSProperties } from "react"
import factoFitAiCharacter from "../assets/factofit-ai-character.png"
import type {
  AnalysisData,
  EquipmentContext,
  PolicyCounters,
  ReadinessItem,
  SupportProject,
} from "../supportProjects.contract"
import { HoverInfo } from "./SupportProjectDialogs"
import {
  buildReadinessItems,
  getBestScore,
  getDotFillRatio,
  getFitLabel,
  getMaxSupportAmount,
  getPriorityCount,
  getProjectScoreColor,
  getReadinessComment,
  getReadinessScore,
  getRequiredDocuments,
  getToneColor,
} from "../supportProjects.utils"

const redDot = "#A51E18"
const emptyDot = "#E8EEF5"

function HighlightedText({ text }: { text: string }) {
  return <>{text}</>
}


function FactoFitAiCharacterMark() {
  return (
    <div
      aria-label="FactoFit AI 캐릭터"
      role="img"
      style={{
        position: "relative",
        width: "178px",
        height: "126px",
        display: "grid",
        placeItems: "center",
        marginBottom: "12px",
        overflow: "visible",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "160px",
          height: "84px",
          transform: "translate(-50%, -50%)",
          borderRadius: "999px",
          background:
            "radial-gradient(circle, rgba(246,232,168,.22) 0%, rgba(246,232,168,.10) 44%, transparent 76%)",
          filter: "blur(18px)",
          opacity: 0.78,
        }}
      />
      <span
        style={{
          position: "relative",
          width: "170px",
          height: "118px",
          display: "grid",
          placeItems: "center",
          overflow: "visible",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0%, #000 86%, rgba(0,0,0,.72) 94%, transparent 100%)",
          maskImage:
            "linear-gradient(180deg, #000 0%, #000 86%, rgba(0,0,0,.72) 94%, transparent 100%)",
        }}
      >
        <img
          src={factoFitAiCharacter}
          alt="FactoFit AI"
          draggable={false}
          style={{
            width: "160px",
            height: "auto",
            objectFit: "contain",
            display: "block",
            filter:
              "drop-shadow(0 12px 18px rgba(0,0,0,.24)) drop-shadow(0 0 14px rgba(246,232,168,.15))",
            userSelect: "none",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "0",
            height: "24px",
            background:
              "linear-gradient(180deg, rgba(6,14,30,0), rgba(6,14,30,.88) 72%, rgba(6,14,30,.96))",
            pointerEvents: "none",
          }}
        />
      </span>
    </div>
  )
}

export function SupportWorkflowHero({
  policyCounters,
  equipmentName,
}: {
  policyCounters: PolicyCounters
  equipmentName: string
}) {
  const metrics = [
    {
      label: "전체 정책 DB",
      value: `${policyCounters.totalPolicyCount}건`,
      hoverTitle: "전체 정책 DB",
      hoverBody: "공공데이터와 정책 DB를 기준으로 수집한 전체 지원사업 모집단입니다.",
    },
    {
      label: "업종 매칭 후보",
      value: `${policyCounters.industryMatchedCount}건`,
      hoverTitle: "업종 매칭 후보",
      hoverBody: "우리 기업의 업종코드를 기준으로 1차 필터링한 후보 지원사업입니다.",
    },
    {
      label: "AI 최종 추천",
      value: `${policyCounters.aiRecommendedCount}건`,
      hoverTitle: "AI 최종 추천",
      hoverBody: "정책 유사도와 AI 판단 근거를 함께 반영해 선별한 최종 추천 사업입니다.",
    },
    {
      label: "우선 검토 사업",
      value: `${policyCounters.priorityCount}건`,
      hoverTitle: "우선 검토 사업",
      hoverBody: "가장 먼저 확인할 1순위 지원사업입니다.",
    },
  ]

  return (
    <div
      style={{
        marginTop: "30px",
        marginBottom: "26px",
        borderRadius: "34px",
        background:
          "radial-gradient(circle at 80% 8%, rgba(246,232,168,.18), transparent 32%), linear-gradient(135deg, #081224 0%, #111C32 56%, #18233A 100%)",
        color: "#FFFFFF",
        padding: "40px 44px",
        boxShadow: "0 28px 70px rgba(6,27,52,.22)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.88fr 1.12fr",
          gap: "30px",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              width: "120px",
              height: "3px",
              borderRadius: "999px",
              background: "linear-gradient(90deg, #7C6BE8, #F6E8A8, transparent)",
              marginBottom: "28px",
            }}
          />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "34px",
              padding: "0 18px",
              borderRadius: "999px",
              border: "1px solid rgba(246,232,168,.42)",
              color: "#F6E8A8",
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "-.2px",
              marginBottom: "20px",
            }}
          >
            FactoFit AI Agent
          </span>
          <h3
            style={{
              color: "#FFFFFF",
              fontSize: "44px",
              lineHeight: 1.18,
              fontWeight: 950,
              letterSpacing: "-1.4px",
              margin: 0,
            }}
          >
            입력한 정보가
            <br />
            <span style={{ color: "#F6E8A8" }}>지원사업 추천 흐름</span>으로
            <br />
            이어집니다.
          </h3>
          <p
            style={{
              marginTop: "20px",
              color: "rgba(255,255,255,.74)",
              fontSize: "15px",
              lineHeight: 1.8,
              fontWeight: 800,
            }}
          >
            {equipmentName} 기준으로 전체 정책 DB를 필터링하고, 유사도와 AI 판단 근거를 함께 반영해 우선 검토할 사업을 정리합니다.
          </p>
        </div>

        <div
          style={{
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,.16)",
            background: "rgba(255,255,255,.07)",
            padding: "24px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            {[
              ["01", "조건 입력"],
              ["02", "후보 추림"],
              ["03", "순위 산정"],
              ["04", "실행 준비"],
            ].map(([step, label]) => (
              <div
                key={step}
                style={{
                  minHeight: "74px",
                  borderRadius: "20px",
                  border: "1px solid rgba(255,255,255,.14)",
                  background: "rgba(255,255,255,.06)",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                }}
              >
                <span style={{ color: "#F6E8A8", fontSize: "13px", fontWeight: 900 }}>{step}</span>
                <b style={{ marginTop: "4px", color: "#FFFFFF", fontSize: "15px", fontWeight: 900 }}>{label}</b>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.95fr 1.05fr",
              gap: "18px",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                borderRadius: "24px",
                border: "1px solid rgba(246,232,168,.18)",
                background:
                  "radial-gradient(circle at 70% 18%, rgba(246,232,168,.20), transparent 34%), rgba(6, 14, 30, .48)",
                padding: "20px",
                display: "grid",
                justifyItems: "center",
                alignContent: "center",
                minHeight: "210px",
              }}
            >
              <FactoFitAiCharacterMark />
              <div style={{ marginTop: "0", textAlign: "center" }}>
                <b style={{ display: "block", color: "#FFFFFF", fontSize: "20px", fontWeight: 950 }}>
                  FactoFit AI
                </b>
                <span style={{ display: "block", marginTop: "6px", color: "rgba(255,255,255,.68)", fontSize: "13px", fontWeight: 800 }}>
                  정책 후보를 읽고 우선순위를 정리합니다.
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              {metrics.map((metric) => (
                <HoverInfo
                  key={metric.label}
                  width={320}
                  fullWidth
                  content={
                    <div>
                      <b style={{ display: "block", color: "#F6E8A8", fontSize: "14px", marginBottom: "8px" }}>
                        {metric.hoverTitle}
                      </b>
                      <span style={{ color: "#FFFFFF" }}>{metric.hoverBody}</span>
                    </div>
                  }
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: "116px",
                      borderRadius: "20px",
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.075)",
                      padding: "18px",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        color: "rgba(255,255,255,.66)",
                        fontSize: "13px",
                        fontWeight: 950,
                        marginBottom: "12px",
                        lineHeight: 1.35,
                        wordBreak: "keep-all",
                      }}
                    >
                      {metric.label}
                    </span>
                    <b
                      style={{
                        color: "#F6E8A8",
                        fontSize: "36px",
                        lineHeight: 1,
                        fontWeight: 950,
                        letterSpacing: "-0.8px",
                        textShadow: "0 10px 30px rgba(246,232,168,.18)",
                      }}
                    >
                      {metric.value}
                    </b>
                  </div>
                </HoverInfo>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


function SummaryCard({ label, value, desc }: { label: string; value: string | number; desc: string }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <b>{value}</b>
      <small
        style={{
          display: "block",
          color: "#94A3B8",
          fontSize: "11px",
          fontWeight: 900,
          marginTop: "8px",
          lineHeight: 1.35,
        }}
      >
        {desc}
      </small>
    </div>
  )
}

export function PolicySummaryCards({
  policyCounters,
}: {
  policyCounters: PolicyCounters
}) {
  return (
    <div className="policy-summary">
      <SummaryCard
        label="전체 정책 DB"
        value={`${policyCounters.totalPolicyCount}건`}
        desc="공공데이터·정책 DB 기준"
      />
      <SummaryCard
        label="업종 매칭 후보"
        value={`${policyCounters.industryMatchedCount}건`}
        desc="업종코드 기준 1차 필터링"
      />
      <SummaryCard
        label="AI 최종 추천"
        value={`${policyCounters.aiRecommendedCount}건`}
        desc="유사도 + AI 판단 선별"
      />
      <SummaryCard
        label="우선 검토 사업"
        value={`${policyCounters.priorityCount}건`}
        desc="가장 먼저 확인할 1순위"
      />
    </div>
  )
}

function AiRankingBasisCard() {
  return (
    <div className="ai-ground-card" style={{ marginTop: 0 }}>
      <h4>AI 추천 순위 기준</h4>
      <ul>
        <li>전체 정책 DB에서 우리 기업 조건에 맞는 후보를 먼저 추립니다.</li>
        <li>업종·지역·설비 정보와 정책 조건의 유사도를 함께 반영합니다.</li>
        <li>ROI 분석 결과와 투자 목적이 맞는 사업을 우선 추천합니다.</li>
        <li>최종 추천 5개 중 가장 적합한 사업을 1순위로 보여줍니다.</li>
      </ul>
    </div>
  )
}

function ProjectScoreDots({ score }: { score: number }) {
  const filledStepCount = Math.round((Math.min(100, Math.max(0, score)) / 100) * 15)

  return (
    <HoverInfo
      width={340}
      content={
        <div>
          <b style={{ display: "block", marginBottom: "8px", color: "#F6E8A8" }}>
            적합도 단계 기준
          </b>
          <div>점 5개를 15단계로 나눠 1/3 단위까지 표시합니다.</div>
          <div style={{ marginTop: "8px" }}>● ● ● ● ● 매우 적합: 85점 이상</div>
          <div>● ● ● ● ○ 적합: 75점 이상</div>
          <div>● ● ● ○ ○ 검토 가능: 65점 이상</div>
          <div>● ● ○ ○ ○ 보완 필요: 55점 이상</div>
          <div>● ○ ○ ○ ○ 낮은 적합도: 55점 미만</div>
        </div>
      }
    >
      <span
        aria-label={`추천 적합도 ${score}%, 15단계 중 ${filledStepCount}단계`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          whiteSpace: "nowrap",
        }}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const fillRatio = getDotFillRatio(score, index)
          const fillPercent = Math.round(fillRatio * 100)
          const dotBackground =
            fillRatio <= 0
              ? emptyDot
              : fillRatio >= 1
                ? redDot
                : `linear-gradient(90deg, ${redDot} 0% ${fillPercent}%, ${emptyDot} ${fillPercent}% 100%)`

          return (
            <i
              key={index}
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: dotBackground,
                display: "block",
              }}
            />
          )
        })}
      </span>
    </HoverInfo>
  )
}

function ProjectPercent({ score }: { score: number }) {
  return (
    <HoverInfo
      width={330}
      content={
        <div>
          <b style={{ display: "block", marginBottom: "8px", color: "#F6E8A8" }}>
            추천 적합도 안내
          </b>
          이 퍼센트는 지원사업 심사 통과 확률이 아니라, 우리 기업의 업종·지역·설비 조건,
          ROI 분석 결과, 정책 유사도, AI 판단 근거를 종합한 추천 우선순위 점수입니다.
        </div>
      }
    >
      <b
        style={{
          color: getProjectScoreColor(score),
          fontFamily: "DM Mono, monospace",
          fontSize: "22px",
          fontWeight: 500,
          textAlign: "right",
          minWidth: "54px",
        }}
      >
        {score}%
      </b>
    </HoverInfo>
  )
}

function RecommendedProjectRow({
  project,
  selected,
  onSelect,
  onOpenDetail,
}: {
  project: SupportProject
  selected: boolean
  onSelect: () => void
  onOpenDetail: () => void
}) {
  return (
    <article
      onClick={() => {
        onSelect()
        onOpenDetail()
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr) 152px 62px",
        gap: "14px",
        alignItems: "center",
        padding: "17px 18px",
        borderRadius: "24px",
        border: selected ? "2px solid #344BA0" : "1px solid #E2E8F0",
        background: selected ? "#F5F7FF" : "#FFFFFF",
        boxShadow: selected ? "0 14px 26px rgba(52,75,160,.12)" : "0 8px 18px rgba(0,0,0,0.035)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "14px",
          background: project.scenario === "A" ? "#EEF6FF" : "#F0FDF4",
          border: "1px solid #E2E8F0",
          display: "grid",
          placeItems: "center",
          color: project.scenario === "A" ? "#344BA0" : "#0B7A53",
          fontFamily: "DM Mono, monospace",
          fontSize: "19px",
          fontWeight: 700,
        }}
      >
        {project.scenario}
      </div>

      <div style={{ minWidth: 0 }}>
        <strong
          style={{
            display: "block",
            color: "#061B34",
            fontSize: "16px",
            fontWeight: 900,
            letterSpacing: "-0.3px",
            marginBottom: "7px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          <HighlightedText text={project.title} />
        </strong>

        <p
          style={{
            color: "#667085",
            fontSize: "12px",
            fontWeight: 900,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <HighlightedText text={project.scenarioLabel} /> · {project.amount} · <HighlightedText text={project.agency} />
        </p>
      </div>

      <ProjectScoreDots score={project.fitScore} />
      <ProjectPercent score={project.fitScore} />
    </article>
  )
}

export function RecommendationListCard({
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenDetail,
}: {
  projects: SupportProject[]
  selectedProjectId: number | null
  onSelectProject: (id: number) => void
  onOpenDetail: (project: SupportProject) => void
}) {
  const [showMore, setShowMore] = useState(false)
  const firstFive = projects.slice(0, 5)
  const nextFive = projects.slice(5, 10)
  const visibleProjects = showMore ? [...firstFive, ...nextFive] : firstFive
  const hiddenCount = Math.min(5, Math.max(projects.length - 5, 0))

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "28px",
        padding: "28px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "center",
          marginBottom: "18px",
        }}
      >
        <div>
          <h4
            style={{
              color: "#061B34",
              fontSize: "22px",
              fontWeight: 900,
              letterSpacing: "-0.4px",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            추천 지원사업 한눈에 보기
            <HoverInfo
              width={410}
              content={
                <div>
                  <b style={{ display: "block", color: "#F6E8A8", fontSize: "14px", marginBottom: "8px" }}>
                    추천 적합도 안내
                  </b>
                  <span>
                    카드를 클릭하면 지원사업 상세 정보를 확인할 수 있습니다. 점수{" "}
                    <b style={{ color: "#F6E8A8" }}>●</b>는 적합도 단계, 우측 퍼센트는
                    기업 조건·ROI·정책 유사도·AI 판단을 종합한 추천 적합도 점수입니다.
                  </span>
                </div>
              }
            >
              <span
                aria-label="추천 지원사업 안내"
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  display: "inline-grid",
                  placeItems: "center",
                  background: "#EEF2FF",
                  color: "#344BA0",
                  border: "1px solid #D7DEF8",
                  fontSize: "13px",
                  fontWeight: 950,
                }}
              >
                i
              </span>
            </HoverInfo>
          </h4>

          <p
            style={{
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
              fontWeight: 800,
            }}
          >
            우선 추천 5개를 먼저 보여주고, 더보기로 5개를 추가 확인합니다.
          </p>
        </div>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowMore((prev) => !prev)}
            style={{
              height: "42px",
              padding: "0 16px",
              borderRadius: "999px",
              border: "1px solid #E2E8F0",
              background: showMore ? "#EEF2FF" : "#F8FAFC",
              color: "#061B34",
              fontSize: "13px",
              fontWeight: 900,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {showMore ? "접기" : `+ ${hiddenCount}개 더보기`}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {visibleProjects.map((project, index) => (
          <RecommendedProjectRow
            key={`${project.rawId || project.id}-${project.title}-${index}`}
            project={project}
            selected={selectedProjectId === project.id}
            onSelect={() => onSelectProject(project.id)}
            onOpenDetail={() => onOpenDetail(project)}
          />
        ))}
      </div>

      <p
        style={{
          marginTop: "14px",
          color: "#667085",
          fontSize: "12px",
          lineHeight: 1.7,
          fontWeight: 850,
          background: "#F8FAFC",
          border: "1px solid #EEF2F6",
          borderRadius: "14px",
          padding: "11px 13px",
        }}
      >
        ⓘ 카드 선택 시 상세 정보를 확인할 수 있고, 붉은 점과 퍼센트는 추천 적합도를 보조적으로 보여줍니다.
      </p>
    </div>
  )
}

export function RecommendationFitCard({
  project,
  equipmentName,
}: {
  project: SupportProject
  equipmentName: string
}) {
  const reasonText =
    project.reasonText ||
    project.reasons[0] ||
    `${equipmentName} 기준 업종·지역·설비 정보와 정책 조건을 바탕으로 추천되었습니다.`

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "28px",
        padding: "28px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h4
            style={{
              color: "#061B34",
              fontSize: "22px",
              fontWeight: 900,
              letterSpacing: "-0.4px",
              marginBottom: "8px",
            }}
          >
            추천 적합도
          </h4>

          <p
            style={{
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
              fontWeight: 800,
            }}
          >
            선택된 사업이 현재 설비투자 조건과 얼마나 맞는지 종합 점수로 보여줍니다.
          </p>
        </div>

        <span className="badge green">{getFitLabel(project.fitScore)}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "210px 1fr",
          gap: "28px",
          alignItems: "center",
          marginTop: "28px",
        }}
      >
        <div
          style={{
            width: "190px",
            height: "190px",
            borderRadius: "50%",
            background: `conic-gradient(#344BA0 0deg ${project.fitScore * 3.6}deg, #E8EEF5 ${project.fitScore * 3.6}deg 360deg)`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 18px 38px rgba(52,75,160,.12)",
          }}
        >
          <div
            style={{
              width: "142px",
              height: "142px",
              borderRadius: "50%",
              background: "#FFFFFF",
              display: "grid",
              placeItems: "center",
              border: "1px solid #E2E8F0",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <b
                style={{
                  display: "block",
                  color: "#344BA0",
                  fontFamily: "DM Mono, monospace",
                  fontSize: "56px",
                  lineHeight: 1,
                  fontWeight: 500,
                  letterSpacing: "-3px",
                }}
              >
                {project.fitScore}
              </b>

              <span
                style={{
                  display: "block",
                  color: "#667085",
                  fontSize: "18px",
                  fontWeight: 900,
                  marginTop: "4px",
                }}
              >
                /100
              </span>
            </div>
          </div>
        </div>

        <div>
          <h4
            style={{
              color: "#061B34",
              fontSize: "22px",
              lineHeight: 1.35,
              fontWeight: 900,
              letterSpacing: "-0.4px",
              marginBottom: "14px",
            }}
          >
            {project.title}
          </h4>

          <div
            style={{
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              borderRadius: "20px",
              padding: "18px 20px",
              color: "#475467",
              fontSize: "14px",
              lineHeight: 1.75,
              fontWeight: 800,
            }}
          >
            <strong
              style={{
                display: "block",
                color: "#061B34",
                fontSize: "15px",
                fontWeight: 950,
                marginBottom: "8px",
              }}
            >
              AI 추천 근거
            </strong>
            <p style={{ margin: 0, wordBreak: "keep-all" }}>{reasonText}</p>
          </div>

          <p
            style={{
              marginTop: "14px",
              color: "#667085",
              fontSize: "12px",
              lineHeight: 1.7,
              fontWeight: 850,
            }}
          >
            원형 그래프는 추천 우선순위 점수이며, 추천 근거는 DB matched_policy.reason을 기준으로 표시합니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export function SuccessHeroSection({
  topProject,
  selectedProject,
  equipmentContext,
  finalRecommendedProjects,
  selectedProjectId,
  onSelectProject,
  onOpenDetail,
  onGoDraft,
}: {
  topProject: SupportProject
  selectedProject: SupportProject
  equipmentContext: EquipmentContext
  finalRecommendedProjects: SupportProject[]
  selectedProjectId: number | null
  onSelectProject: (id: number) => void
  onOpenDetail: (project: SupportProject) => void
  onGoDraft: () => void
}) {
  return (
    <div
      className="summary-hero-card"
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        borderLeftColor: "#0B7A53",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: "28px",
          alignItems: "center",
        }}
      >
        <div>
          <span className="badge green">추천 완료</span>

          <h3 style={{ marginTop: "18px" }}>
            1순위 추천은 <br />
            {topProject.title}입니다.
          </h3>

          <p>
            {equipmentContext.equipmentName} 설비 투자 조건과 ROI 분석 결과를 기준으로
            우선 검토할 수 있는 지원사업입니다. 신청서 작성 시 투자금, 기대효과,
            회수기간을 함께 제시하면 근거를 더 명확히 구성할 수 있습니다.
          </p>

          <div
            className="hero-actions"
            style={{ justifyContent: "flex-start", marginTop: "28px" }}
          >
            <button className="btn dark" type="button" onClick={onGoDraft}>
              신청서 초안 만들기
            </button>
          </div>
        </div>

        <AiRankingBasisCard />
      </div>

      <div
        style={{
          marginTop: "34px",
          paddingTop: "28px",
          borderTop: "1px solid #E2E8F0",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.95fr 1.05fr",
            gap: "24px",
            alignItems: "stretch",
          }}
        >
          <RecommendationFitCard
            project={selectedProject}
            equipmentName={equipmentContext.equipmentName}
          />
          <RecommendationListCard
            projects={finalRecommendedProjects}
            selectedProjectId={selectedProjectId}
            onSelectProject={onSelectProject}
            onOpenDetail={onOpenDetail}
          />
        </div>
      </div>
    </div>
  )
}

export function OtherMatchedPoliciesPanel({
  projects,
  onOpenDetail,
}: {
  projects: SupportProject[]
  onOpenDetail: (project: SupportProject) => void
}) {
  if (projects.length === 0) return null

  return (
    <div
      className="details-wrap"
      style={{
        borderRadius: "26px",
        border: "1px solid #E2E8F0",
        overflow: "hidden",
        background: "#FFFFFF",
        boxShadow: "0 12px 28px rgba(6,27,52,.04)",
      }}
    >
      <style>
        {`
          .factofit-other-policy-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .factofit-other-policy-scroll::-webkit-scrollbar {
            width: 0;
            height: 0;
            display: none;
          }

          .ff-other-policy-row {
            transition: background .16s ease, transform .16s ease;
          }

          .ff-other-policy-row:hover {
            background: linear-gradient(90deg, rgba(246,232,168,.18), rgba(52,75,160,.035), rgba(255,255,255,.98)) !important;
            transform: translateX(2px);
          }
        `}
      </style>

      <div
        style={{
          minHeight: "76px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "0 24px",
          borderBottom: "1px solid #E2E8F0",
          color: "#222222",
        }}
      >
        <span style={{ fontSize: "24px" }}>☷</span>
        <div>
          <h4
            style={{
              color: "#061B34",
              fontSize: "22px",
              fontWeight: 900,
              letterSpacing: "-0.3px",
              margin: 0,
            }}
          >
            그 외 매칭된 정책 {projects.length}건
          </h4>
          <p
            style={{
              marginTop: "5px",
              color: "#667085",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            목록 안에서 스크롤해 나머지 정책을 확인할 수 있습니다.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "24px",
          alignItems: "center",
          minHeight: "44px",
          padding: "0 28px",
          borderBottom: "1px solid #EEF2F6",
          background: "#F8FAFC",
          color: "#667085",
          fontSize: "12px",
          fontWeight: 900,
        }}
      >
        <span>정책명</span>
        <span>주관사</span>
      </div>

      <div
        className="factofit-other-policy-scroll"
        style={{
          maxHeight: "340px",
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {projects.map((project, index) => (
          <div
            key={`${project.rawId || project.id}-${project.title}-${index}`}
            className="ff-other-policy-row"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 320px",
              gap: "24px",
              alignItems: "center",
              minHeight: "68px",
              padding: "0 28px",
              borderBottom: "1px solid #EEF2F6",
            }}
          >
            <button
              type="button"
              onClick={() => onOpenDetail(project)}
              style={{
                border: 0,
                background: "transparent",
                padding: 0,
                textAlign: "left",
                color: "#222222",
                fontSize: "16px",
                fontWeight: 850,
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {index + 1}. <HighlightedText text={project.title} />
            </button>
            <span
              style={{
                color: "#222222",
                fontSize: "16px",
                fontWeight: 800,
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <HighlightedText text={project.agency} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ApplicationReadinessSection({
  analysisData,
  policyCards,
}: {
  analysisData: AnalysisData
  policyCards: SupportProject[]
}) {
  const readinessScore = getReadinessScore(analysisData, policyCards)
  const readinessItems = buildReadinessItems(analysisData, policyCards)
  const readinessComment = getReadinessComment(analysisData, policyCards)

  return (
    <details open>
      <summary>지원사업 신청 준비도</summary>

      <div className="detail-body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.8fr 1.2fr",
            gap: "24px",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "28px",
              padding: "30px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
            }}
          >
            <span className="badge green">
              {readinessScore >= 60 ? "신청 가능" : "보완 필요"}
            </span>

            <h3
              style={{
                marginTop: "18px",
                color: "#061B34",
                fontSize: "26px",
                lineHeight: 1.35,
                fontWeight: 900,
                letterSpacing: "-0.5px",
              }}
            >
              현재 신청 준비도는 <br />
              {readinessScore}%입니다.
            </h3>

            <p
              style={{
                marginTop: "14px",
                color: "#667085",
                fontSize: "14px",
                lineHeight: 1.8,
                fontWeight: 800,
              }}
            >
              {readinessComment}
            </p>

            <div
              style={{
                marginTop: "28px",
                height: "14px",
                background: "#E8EEF5",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <i
                style={{
                  display: "block",
                  width: `${readinessScore}%`,
                  height: "100%",
                  background: "#0B7A53",
                  borderRadius: "999px",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "10px",
                color: "#667085",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {readinessItems.map((item) => (
              <ReadinessRow key={item.label} item={item} />
            ))}
          </div>
        </div>
      </div>
    </details>
  )
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  return (
    <div
      title={item.description}
      style={{
        display: "grid",
        gridTemplateColumns: "170px 1fr 70px",
        gap: "16px",
        alignItems: "center",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "22px",
        padding: "18px",
        borderLeft: `6px solid ${getToneColor(item.tone)}`,
      }}
    >
      <div>
        <strong
          style={{
            display: "block",
            color: "#061B34",
            fontSize: "15px",
            fontWeight: 900,
            marginBottom: "6px",
          }}
        >
          {item.label}
        </strong>

        <span
          style={{
            color: getToneColor(item.tone),
            fontSize: "12px",
            fontWeight: 900,
          }}
        >
          {item.status}
        </span>
      </div>

      <div
        style={{
          height: "12px",
          background: "#E8EEF5",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <i
          style={{
            display: "block",
            height: "100%",
            width: `${item.score}%`,
            background: getToneColor(item.tone),
            borderRadius: "999px",
          }}
        />
      </div>

      <b
        style={{
          color: getToneColor(item.tone),
          fontFamily: "DM Mono, monospace",
          fontSize: "22px",
          fontWeight: 500,
          textAlign: "right",
        }}
      >
        {item.score}%
      </b>
    </div>
  )
}

export function RequiredDocumentsSection({
  analysisData,
}: {
  analysisData: AnalysisData
}) {
  const requiredDocuments = getRequiredDocuments(analysisData)

  return (
    <details>
      <summary>신청 전 확인할 공통 서류</summary>

      <div className="detail-body">
        <div className="check-grid">
          {requiredDocuments.map((documentName, index) => {
            const toneClass = index === 0 ? "" : index === 1 ? "orange" : "red"

            return (
              <div className={`check-card ${toneClass}`} key={`${documentName}-${index}`}>
                <h4>{documentName}</h4>
                <p>
                  제출 전 최신 상태로 준비하고, 신청사업 요구 양식에 맞는지 확인해주세요.
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </details>
  )
}

export const backButtonStyle: CSSProperties = {
  marginBottom: "28px",
  height: "44px",
  padding: "0 18px",
  borderRadius: "999px",
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  color: "#061B34",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(6,27,52,.06)",
}

export function getHeaderMetrics(projects: SupportProject[]) {
  return {
    bestScore: getBestScore(projects),
    maxSupportAmount: getMaxSupportAmount(projects),
    priorityCount: getPriorityCount(projects),
  }
}
