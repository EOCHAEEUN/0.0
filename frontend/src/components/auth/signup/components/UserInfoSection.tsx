import FieldLabel from "./FieldLabel"

type UserInfoSectionProps = {
  userName: string
  phone: string
  onUserNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
}

export default function UserInfoSection({
  userName,
  phone,
  onUserNameChange,
  onPhoneChange,
}: UserInfoSectionProps) {
  return (
    <div className="ff-signup-section">
      <h3>2. 사용자 정보</h3>

      <div className="ff-signup-two-col">
        <div className="ff-signup-field">
          <FieldLabel text="이름" required />
          <input
            placeholder="이름"
            value={userName}
            onChange={(event) => onUserNameChange(event.target.value)}
          />
        </div>

        <div className="ff-signup-field">
          <FieldLabel text="연락처" required />
          <input
            placeholder="010-0000-0000"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  )
}