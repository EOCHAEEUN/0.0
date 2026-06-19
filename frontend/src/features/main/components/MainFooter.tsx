import { footerInfos, footerLinks, publicDataChips } from "../main.parts"

export function MainFooter() {
  return (
    <footer className="ff-main-footer">
      <div className="ff-footer-public-data">
        <p>POWERED BY PUBLIC DATA</p>
        <h2>공공데이터 활용기관 및 기본 정보</h2>

        <div className="ff-footer-chip-grid">
          {publicDataChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </div>

      <div className="ff-footer-company">
        <div>
          <h3>FactoFit</h3>
          <p>Manufacturing AI Advisor · 제조기업 의사결정 지원 플랫폼</p>
        </div>

        <div className="ff-footer-link-grid">
          {footerLinks.map((link) => (
            <button type="button" key={link}>
              {link}
            </button>
          ))}
        </div>

        <div className="ff-footer-info">
          {footerInfos.map((info) => (
            <span key={info}>{info}</span>
          ))}
        </div>

        <small>
          본 서비스 화면은 제조업 설비투자 의사결정 및 공공데이터 기반
          지원사업 매칭을 설명하기 위한 데모입니다.
        </small>
      </div>
    </footer>
  )
}
