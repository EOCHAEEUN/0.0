type AgreementBoxProps = {
  agreeService: boolean
  agreePrivacy: boolean
  onAgreeServiceChange: (checked: boolean) => void
  onAgreePrivacyChange: (checked: boolean) => void
}

export default function AgreementBox({
  agreeService,
  agreePrivacy,
  onAgreeServiceChange,
  onAgreePrivacyChange,
}: AgreementBoxProps) {
  return (
    <div className="ff-signup-agree-box">
      <label>
        <input
          type="checkbox"
          checked={agreeService}
          onChange={(event) => onAgreeServiceChange(event.target.checked)}
        />
        <span>
          서비스 이용약관에 동의합니다. <b>필수</b>
        </span>
      </label>

      <label>
        <input
          type="checkbox"
          checked={agreePrivacy}
          onChange={(event) => onAgreePrivacyChange(event.target.checked)}
        />
        <span>
          개인정보 수집 및 이용에 동의합니다. <b>필수</b>
        </span>
      </label>
    </div>
  )
}