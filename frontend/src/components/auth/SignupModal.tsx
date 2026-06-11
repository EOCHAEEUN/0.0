import { useMemo, useState } from "react"
import "./SignupModal.css"

type IndustryOption = {
  name: string
  codes: string[]
}

type SignupModalProps = {
  onClose: () => void
  onLoginClick?: () => void
}

type PasswordLevel = "empty" | "weak" | "normal" | "strong"

const INDUSTRY_OPTIONS: IndustryOption[] = [
  { name: "스마트공장", codes: ["C"] },
  { name: "스마트제조", codes: ["C"] },

  { name: "식품", codes: ["C10"] },
  { name: "섬유", codes: ["C13"] },
  { name: "화학", codes: ["C20"] },
  { name: "바이오", codes: ["C21"] },
  { name: "의약", codes: ["C21"] },
  { name: "고무", codes: ["C22"] },
  { name: "플라스틱", codes: ["C22"] },

  { name: "금속", codes: ["C24", "C25"] },
  { name: "금속가공", codes: ["C25"] },

  { name: "전자", codes: ["C26"] },
  { name: "반도체", codes: ["C26"] },
  { name: "의료기기", codes: ["C27"] },

  { name: "전기", codes: ["C28"] },
  { name: "기계", codes: ["C29"] },
  { name: "장비", codes: ["C29"] },
  { name: "로봇", codes: ["C29"] },

  { name: "자동차", codes: ["C30"] },
  { name: "부품", codes: ["C30"] },

  { name: "소부장", codes: ["C20", "C24", "C25", "C26", "C28", "C29"] },
  { name: "뿌리", codes: ["C24", "C25", "C28", "C29"] },
]

const COMPANY_SIZE_OPTIONS = ["소상공인", "소기업", "중소기업", "중견기업"]

const PURPOSE_OPTIONS = [
  "지원사업 추천",
  "ROI 분석",
  "설비 교체 검토",
  "신청서 초안 작성",
  "안전점검 관리",
]

export default function SignupModal({ onClose, onLoginClick }: SignupModalProps) {
  const [email, setEmail] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  const [password, setPassword] = useState("")
  const [passwordCheck, setPasswordCheck] = useState("")

  const [userName, setUserName] = useState("")
  const [phone, setPhone] = useState("")
  const [businessNumber, setBusinessNumber] = useState("")

  const [companyName, setCompanyName] = useState("")
  const [industryName, setIndustryName] = useState("")
  const [industryCode, setIndustryCode] = useState("")
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryOption | null>(
    null,
  )
  const [isIndustryOpen, setIsIndustryOpen] = useState(false)
  const [isOptionalOpen, setIsOptionalOpen] = useState(false)

  const [region, setRegion] = useState("")
  const [companySize, setCompanySize] = useState("중소기업")
  const [mainPurpose, setMainPurpose] = useState("지원사업 추천")

  const [maxEmployeeCount, setMaxEmployeeCount] = useState("")
  const [minRevenueManwon, setMinRevenueManwon] = useState("")
  const [maxRevenueManwon, setMaxRevenueManwon] = useState("")

  const [agreeService, setAgreeService] = useState(true)
  const [agreePrivacy, setAgreePrivacy] = useState(true)

  const filteredIndustries = useMemo(() => {
    const keyword = `${industryName} ${industryCode}`.trim().toLowerCase()

    if (!keyword) return INDUSTRY_OPTIONS.slice(0, 8)

    return INDUSTRY_OPTIONS.filter((item) => {
      const nameMatched = item.name.toLowerCase().includes(keyword)
      const codeMatched = item.codes.some((code) =>
        code.toLowerCase().includes(keyword),
      )

      return nameMatched || codeMatched
    }).slice(0, 8)
  }, [industryName, industryCode])

  const passwordChecks = useMemo(() => {
    return [
      {
        label: "8자 이상",
        valid: password.length >= 8,
      },
      {
        label: "영문 포함",
        valid: /[A-Za-z]/.test(password),
      },
      {
        label: "숫자 포함",
        valid: /\d/.test(password),
      },
      {
        label: "특수문자 포함",
        valid: /[^A-Za-z0-9]/.test(password),
      },
    ]
  }, [password])

  const passwordScore = passwordChecks.filter((item) => item.valid).length

  const passwordLevel: PasswordLevel =
    password.length === 0
      ? "empty"
      : passwordScore <= 1
        ? "weak"
        : passwordScore <= 3
          ? "normal"
          : "strong"

  const passwordLabel =
    passwordLevel === "empty"
      ? "비밀번호 보안 수준"
      : passwordLevel === "weak"
        ? "약함"
        : passwordLevel === "normal"
          ? "보통"
          : "안전"

  const isPasswordMatched =
    password.length > 0 && passwordCheck.length > 0 && password === passwordCheck

  const isPasswordMismatch =
    password.length > 0 && passwordCheck.length > 0 && password !== passwordCheck

  const handleSendEmailCode = () => {
    if (!email.includes("@")) {
      alert("이메일 형식을 확인해주세요.")
      return
    }

    setIsCodeSent(true)
    setIsEmailVerified(false)
    alert("인증번호를 발송했습니다. 지금은 시연용으로 아무 숫자 4자리 이상 입력하면 됩니다.")
  }

  const handleVerifyEmail = () => {
    if (!isCodeSent) {
      alert("먼저 인증번호를 받아주세요.")
      return
    }

    if (emailCode.trim().length < 4) {
      alert("인증번호를 입력해주세요.")
      return
    }

    setIsEmailVerified(true)
    alert("이메일 인증이 완료되었습니다.")
  }

  const handleSelectIndustry = (industry: IndustryOption) => {
    setSelectedIndustry(industry)
    setIndustryName(industry.name)
    setIndustryCode(industry.codes.join(", "))
    setIsIndustryOpen(false)
  }

  const handleIndustryNameChange = (value: string) => {
    setIndustryName(value)
    setIsIndustryOpen(true)

    const exact = INDUSTRY_OPTIONS.find((item) => item.name === value)

    if (exact) {
      setSelectedIndustry(exact)
      setIndustryCode(exact.codes.join(", "))
    } else {
      setSelectedIndustry(null)
    }
  }

  const handleIndustryCodeChange = (value: string) => {
    const nextValue = value.toUpperCase()
    setIndustryCode(nextValue)
    setIsIndustryOpen(true)

    const normalizedValue = nextValue.replace(/\s/g, "")

    const exact = INDUSTRY_OPTIONS.find((item) =>
      item.codes.some((code) => code === normalizedValue),
    )

    if (exact) {
      setSelectedIndustry(exact)
      setIndustryName(exact.name)
    } else {
      setSelectedIndustry(null)
    }
  }

  const toNullableNumber = (value: string) => {
    if (!value.trim()) return null
    return Number(value)
  }

  const handleSubmit = () => {
    if (!email || !password || !passwordCheck || !userName || !phone) {
      alert("필수 계정 정보와 사용자 정보를 입력해주세요.")
      return
    }

    if (!isEmailVerified) {
      alert("이메일 인증을 완료해주세요.")
      return
    }

    if (passwordLevel !== "strong") {
      alert("비밀번호 보안 수준을 안전 단계로 맞춰주세요.")
      return
    }

    if (password !== passwordCheck) {
      alert("비밀번호가 일치하지 않습니다.")
      return
    }

    if (!companyName || !industryName || !industryCode || !region) {
      alert("기업명, 업종, 지역을 입력해주세요.")
      return
    }

    if (!agreeService || !agreePrivacy) {
      alert("필수 약관에 동의해주세요.")
      return
    }

    const industryCodes =
      selectedIndustry?.codes ??
      industryCode
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean)

    const payload = {
      account: {
        email,
        email_verified: isEmailVerified,
      },
      user: {
        name: userName,
        phone,
        business_number: businessNumber || null,
      },
      company: {
        company_name: companyName,
        industry_name: selectedIndustry?.name ?? industryName,
        industry_code: industryCodes,
        region,
        company_size: companySize,
        main_purpose: mainPurpose,
        max_employee_count: toNullableNumber(maxEmployeeCount),
        min_revenue_manwon: toNullableNumber(minRevenueManwon),
        max_revenue_manwon: toNullableNumber(maxRevenueManwon),
      },
      agreements: {
        service_terms: agreeService,
        privacy_policy: agreePrivacy,
      },
    }

    localStorage.setItem("factofit_signup_profile", JSON.stringify(payload))
    console.log("signup payload", payload)

    alert("회원가입 정보가 저장되었습니다. 이후 DB API와 연결하면 마이페이지에서 불러올 수 있습니다.")
  }

  return (
    <div className="ff-signup-overlay" onClick={onClose}>
      <section
        className="ff-signup-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="ff-signup-close" onClick={onClose}>
          ×
        </button>

        <header className="ff-signup-header">
          <h2>회원가입</h2>
          <p>필수 정보를 입력하면 FactoFit 맞춤형 추천을 시작할 수 있습니다.</p>

          <div className="ff-signup-guide">
            <span>
              <b>*</b> 필수 입력
            </span>
            <span>선택 정보는 지원사업 조건 매칭에 활용됩니다.</span>
          </div>
        </header>

        <div className="ff-signup-section">
          <h3>1. 계정 정보</h3>

          <div className="ff-signup-field">
            <FieldLabel text="이메일" required />
            <div className="ff-signup-inline">
              <input
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setIsEmailVerified(false)
                }}
              />
              <button type="button" onClick={handleSendEmailCode}>
                인증번호 받기
              </button>
            </div>

            {email && !email.includes("@") && (
              <p className="ff-signup-message is-error">
                이메일 형식으로 입력해주세요.
              </p>
            )}
          </div>

          <div className="ff-signup-field">
            <FieldLabel text="이메일 인증번호" required />
            <div className="ff-signup-inline">
              <input
                placeholder="인증번호 입력"
                value={emailCode}
                onChange={(event) => setEmailCode(event.target.value)}
              />
              <button type="button" onClick={handleVerifyEmail}>
                인증 확인
              </button>
            </div>

            {isEmailVerified && (
              <p className="ff-signup-message is-success">
                이메일 인증이 완료되었습니다.
              </p>
            )}
          </div>

          <div className="ff-signup-two-col ff-signup-password-row">
            <div className="ff-signup-field">
              <FieldLabel text="비밀번호" required />
              <input
                type="password"
                placeholder="영문, 숫자, 특수문자 포함 8자 이상"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <div className={`ff-password-meter is-${passwordLevel}`}>
                <div className="ff-password-meter-track">
                  <span />
                  <span />
                  <span />
                </div>
                <p>{passwordLabel}</p>
              </div>

              <ul className="ff-password-check-list">
                {passwordChecks.map((item) => (
                  <li
                    key={item.label}
                    className={item.valid ? "is-valid" : undefined}
                  >
                    {item.valid ? "✓" : "•"} {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="ff-signup-field ff-signup-password-confirm-field">
              <FieldLabel text="비밀번호 확인" required />
              <input
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={passwordCheck}
                onChange={(event) => setPasswordCheck(event.target.value)}
              />

              {passwordCheck.length === 0 && (
                <p className="ff-signup-message is-muted">
                  비밀번호를 한 번 더 입력해주세요.
                </p>
              )}

              {isPasswordMatched && (
                <p className="ff-signup-message is-success">
                  비밀번호가 일치합니다.
                </p>
              )}

              {isPasswordMismatch && (
                <p className="ff-signup-message is-error">
                  비밀번호가 일치하지 않습니다.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="ff-signup-section">
          <h3>2. 사용자 정보</h3>

          <div className="ff-signup-two-col">
            <div className="ff-signup-field">
              <FieldLabel text="이름" required />
              <input
                placeholder="이름"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
              />
            </div>

            <div className="ff-signup-field">
              <FieldLabel text="연락처" required />
              <input
                placeholder="010-0000-0000"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </div>

          <div className="ff-signup-field">
            <FieldLabel text="사업자등록번호" optional />
            <input
              placeholder="예: 123-45-67890"
              value={businessNumber}
              onChange={(event) => setBusinessNumber(event.target.value)}
            />
          </div>
        </div>

        <div className="ff-signup-section">
          <h3>3. 기업 정보</h3>

          <div className="ff-signup-field">
            <FieldLabel text="기업명" required />
            <input
              placeholder="기업명을 입력하세요"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </div>

          <div className="ff-signup-two-col">
            <div className="ff-signup-field ff-signup-combo">
              <FieldLabel text="업종명" required />
              <input
                placeholder="예: 금속가공"
                value={industryName}
                onFocus={() => setIsIndustryOpen(true)}
                onChange={(event) => handleIndustryNameChange(event.target.value)}
              />

              {isIndustryOpen &&
                (industryName || industryCode) &&
                filteredIndustries.length > 0 && (
                  <div className="ff-signup-suggest-box">
                    {filteredIndustries.map((item) => (
                      <button
                        type="button"
                        key={`${item.name}-${item.codes.join("-")}`}
                        onClick={() => handleSelectIndustry(item)}
                      >
                        <span>{item.name}</span>
                        <b>{item.codes.join(", ")}</b>
                      </button>
                    ))}
                  </div>
                )}
            </div>

            <div className="ff-signup-field">
              <FieldLabel text="업종코드" required />
              <input
                placeholder="예: C25"
                value={industryCode}
                onFocus={() => setIsIndustryOpen(true)}
                onChange={(event) => handleIndustryCodeChange(event.target.value)}
              />
            </div>
          </div>

          <div className="ff-signup-field">
            <FieldLabel text="지역" required />
            <input
              placeholder="예: 경기 안산시"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            />
          </div>

          <div className="ff-signup-two-col">
            <div className="ff-signup-field">
              <FieldLabel text="기업 규모" optional />
              <select
                value={companySize}
                onChange={(event) => setCompanySize(event.target.value)}
              >
                {COMPANY_SIZE_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="ff-signup-field">
              <FieldLabel text="주요 목적" optional />
              <select
                value={mainPurpose}
                onChange={(event) => setMainPurpose(event.target.value)}
              >
                {PURPOSE_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <section
          className={
            isOptionalOpen
              ? "ff-signup-optional is-open"
              : "ff-signup-optional"
          }
        >
          <button
            type="button"
            className="ff-signup-optional-summary"
            onClick={() => setIsOptionalOpen((prev) => !prev)}
          >
            <span>4. 선택 정보</span>
            <em>종업원 수·매출액 기준이 있는 지원사업 매칭에 활용됩니다.</em>
            <b>{isOptionalOpen ? "닫기" : "열기"}</b>
          </button>

          {isOptionalOpen && (
            <div className="ff-signup-optional-body">
              <div className="ff-signup-field">
                <FieldLabel text="최대 종업원 수" optional />
                <input
                  type="number"
                  placeholder="예: 50"
                  value={maxEmployeeCount}
                  onChange={(event) => setMaxEmployeeCount(event.target.value)}
                />
              </div>

              <div className="ff-signup-two-col">
                <div className="ff-signup-field">
                  <FieldLabel text="최소 매출액, 만원 단위" optional />
                  <input
                    type="number"
                    placeholder="예: 10000"
                    value={minRevenueManwon}
                    onChange={(event) => setMinRevenueManwon(event.target.value)}
                  />
                </div>

                <div className="ff-signup-field">
                  <FieldLabel text="최대 매출액, 만원 단위" optional />
                  <input
                    type="number"
                    placeholder="예: 500000"
                    value={maxRevenueManwon}
                    onChange={(event) => setMaxRevenueManwon(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="ff-signup-agree-box">
          <label>
            <input
              type="checkbox"
              checked={agreeService}
              onChange={(event) => setAgreeService(event.target.checked)}
            />
            <span>
              서비스 이용약관에 동의합니다. <b>필수</b>
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(event) => setAgreePrivacy(event.target.checked)}
            />
            <span>
              개인정보 수집 및 이용에 동의합니다. <b>필수</b>
            </span>
          </label>
        </div>

        <button type="button" className="ff-signup-submit" onClick={handleSubmit}>
          회원가입 완료
        </button>

        <button
          type="button"
          className="ff-signup-login-link"
          onClick={onLoginClick ?? onClose}
        >
          이미 계정이 있으신가요? 로그인으로 돌아가기
        </button>
      </section>
    </div>
  )
}

function FieldLabel({
  text,
  required,
  optional,
}: {
  text: string
  required?: boolean
  optional?: boolean
}) {
  return (
    <div className="ff-signup-label-row">
      <label>
        {text}
        {required && <b>*</b>}
      </label>

      {optional && <span>선택</span>}
    </div>
  )
}