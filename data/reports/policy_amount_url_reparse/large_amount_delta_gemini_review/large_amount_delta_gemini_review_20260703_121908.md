hold_csv=C:\dongaAI\3차 프로젝트\0.0\data\reports\policy_amount_url_reparse\large_amount_delta_resolution\large_amount_delta_hold_breakdown_20260703_121239.csv
target_rows=52
use_gemini=True
model=gemini-2.5-flash-lite

gemini_decisions={'keep_old': 27, 'hold': 10, 'adopt_new': 15}
final_suggested_actions={'keep_old': 27, 'hold': 10, 'adopt_new': 15}

## samples

### ENERGYAGENCY:24575 | (수정)2026년도 산업진단 개선이행 지원사업 2차 공고
- hold_group: limit_candidate_large_delta
- old -> new: 69000.0 -> 1000.0 (0.0145x)
- gemini: keep_old / high / support_amount / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 금액은 '사업장 당 최대 1,000만원'으로 명시되어 있어, 기존의 '최대 6.9억원'이라는 총 지원금액과 비교했을 때 규모 차이가 크고, '사업장 당'이라는 조건이 붙어 있어 대표 지원금액으로 보기 어렵습니다.

### PBLN_000000000117454 | [강원] 2026년 글로벌 IP 스타기업 육성 해외OA비용 지원사업 공고
- hold_group: limit_candidate_large_delta
- old -> new: 164.0 -> 410.0 (2.5x)
- gemini: hold / low / unknown / review
- final: hold (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 후보 금액이 기존 금액보다 2.5배 크고, 여러 세부 사업별 지원 한도가 제시되어 있어 대표 금액으로 확정하기 어렵습니다.

### PBLN_000000000118395 | [경기] 2026년 기술닥터사업 공고
- hold_group: limit_candidate_large_delta
- old -> new: 500.0 -> 2000.0 (4x)
- gemini: adopt_new / high / support_amount / subtract
- final: adopt_new (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새 파싱 후보 금액 2,000만원은 공정 개선 등 구체적 성과물 도출 시 지원 가능한 최대 금액으로 명확하게 제시되어 기존 최대 지원금액 500만원보다 대표 금액으로 적합합니다.

### PBLN_000000000119836 | [전남광주] 2026년 상반기 구조고도화자금 지원 계획 공고
- hold_group: limit_candidate_large_delta
- old -> new: 3000000.0 -> 1000000.0 (0.333x)
- gemini: keep_old / medium / support_amount / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 후보 금액 100억원은 '하반기 100억원 예정'이라는 문맥과 함께 제시되었으나, 기존값 300억원은 '지원 규모 : 300억원'이라는 명확한 문구와 함께 제시되어 기존값을 유지하는 것이 더 안전하다고 판단됩니다.

### PBLN_000000000120012 | [경기] 2026년 공동활용 연구장비 사용료 지원 기업 모집 공고
- hold_group: limit_candidate_large_delta
- old -> new: 10000.0 -> 500.0 (0.05x)
- gemini: adopt_new / high / support_amount / subtract
- final: adopt_new (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새 파싱 후보 금액은 '기업당 최대 5백만원 지원'이라는 명확한 문구를 근거로 대표 지원금액으로 채택하는 것이 타당합니다.

### PBLN_000000000120600 | [경북] 김천시 2026년 기술주치의119지원사업 공고
- hold_group: extreme_delta
- old -> new: 200000.0 -> 1500.0 (0.0075x)
- gemini: adopt_new / high / support_amount / subtract
- final: adopt_new (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새 파싱 후보 금액인 최대 1,500만원이 공고 내에서 명확하게 지원금액으로 제시되어 있으며, 기존값인 20억원과는 큰 차이가 있지만 문맥상 새로운 지원 한도를 나타내는 것으로 판단됩니다.

### PBLN_000000000120673 | 2026년 다공성 탄소소재 기반 환경소재 및 부품개발 기반구축 사업 수혜기업 지원(시제품 제작 및 기술지도) 사업 공고
- hold_group: limit_candidate_large_delta
- old -> new: 50.0 -> 1000.0 (20x)
- gemini: adopt_new / high / support_amount / subtract
- final: adopt_new (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 금액은 '10백만원 이내'로 명시되어 있으며, 기존 금액인 50만원보다 훨씬 크고 지원 대상 기업 수(8개社)와 함께 구체적으로 제시되어 대표 지원금으로 적합합니다.

### PBLN_000000000120780 | 2026년 통상변화대응지원사업 참여기업 모집 공고
- hold_group: extreme_delta
- old -> new: 1000000.0 -> 2000.0 (0.002x)
- gemini: adopt_new / high / support_amount / subtract
- final: adopt_new (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새 파싱 금액은 '기업당 최대 2천만원까지 지원하며'라는 문구와 일치하며, 지원금액으로 명확하게 판단됩니다.

### PBLN_000000000120845 | 2026년 하반기 중소기업기술혁신개발사업 유망기술개발(구조혁신R&D) 시행계획 공고
- hold_group: limit_candidate_large_delta
- old -> new: 48000.0 -> 200000.0 (4.17x)
- gemini: hold / low / unknown / review
- final: hold (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새 파싱 후보 금액이 여러 항목에 걸쳐 다양하게 제시되어 있어 대표 금액으로 확정하기 어렵습니다.

### PBLN_000000000120865 | 2026년 한ㆍ이스라엘 국제공동기술개발사업 신규 과제 통합 공고
- hold_group: limit_candidate_large_delta
- old -> new: 168000.0 -> 420000.0 (2.5x)
- gemini: adopt_new / high / support_amount / subtract
- final: adopt_new (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새 파싱 금액 42억원은 '라이트하우스 프로그램' 과제당 최대 지원금으로 명확하게 제시되어 대표 지원금으로 채택하는 것이 적절합니다.

### PBLN_000000000120866 | 2026년 부산형 SiC 전력반도체 연구플랫폼 활성화 지원사업 기업지원 모집 공고
- hold_group: manual_review_pattern
- old -> new: 100.0 -> 2200.0 (22x)
- gemini: hold / low / support_amount / subtract
- final: hold (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 후보 금액 2,200만원은 '총 22,000천원(20'이라는 문맥과 함께 제시되어 금액의 정확한 의미와 단위가 불분명하며, 기존 최대 100만원과 비교했을 때 차이가 커서 확정하기 어렵습니다.

### PBLN_000000000121194 | [경남] 고성군 2026년 지역지식재산창출 지원사업 공고
- hold_group: limit_candidate_large_delta
- old -> new: 130.0 -> 90.0 (0.692x)
- gemini: keep_old / high / subsidy / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 후보 금액은 해외권리화 출원 비용 지원에 대한 내용으로 보이며, 기존 최대 지원금액 130만원이 사업 전체의 대표 지원금액으로 판단되어 기존값을 유지하는 것이 더 안전합니다.

### PBLN_000000000121197 | [경남] 창녕군 2026년 지역지식재산 창출지원사업 공고
- hold_group: limit_candidate_large_delta
- old -> new: 130.0 -> 90.0 (0.692x)
- gemini: keep_old / high / subsidy / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 후보 금액은 해외권리화 출원 비용 지원에 대한 내용으로 보이며, 기존 최대 지원금액 130만원이 사업 전체의 대표 지원금액으로 판단되어 기존값을 유지하는 것이 안전합니다.

### PBLN_000000000121785 | [전남광주] 2026년 소규모 밀착 안전망 구축사업 참여기업 모집 공고(지역 중대재해 예방 사각지대 해소사업)
- hold_group: extreme_delta
- old -> new: 10000.0 -> 25.0 (0.0025x)
- gemini: keep_old / high / support_amount / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 금액인 25만원은 '방진마스크최대25만원'과 같이 특정 품목의 최대 지원 한도로 보이며, 기존의 최대 1억원 지원금과는 규모 차이가 매우 커 대표 지원금으로 보기 어렵습니다.

### PBLN_000000000121945 | 2026년 자이언트캐스팅(다이캐스팅) 부품 시험ㆍ평가ㆍ인증 및 기술지도 지원 시행 공고(자이언트캐스팅 공용센터 기반구축 사업)
- hold_group: limit_candidate_large_delta
- old -> new: 1000.0 -> 200.0 (0.2x)
- gemini: keep_old / high / subsidy / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 후보 금액은 '기타 소모성 부품류'에 대한 한도 금액으로 보이며, 기존의 최대 지원금액 1,000만원과 비교했을 때 금액 차이가 크고 성격이 달라 대표 지원금액으로 채택하기 어렵습니다.

### PBLN_000000000122359 | [경북] 2026년 지역특화형(고도화) 스마트공장 구축사업 공고
- hold_group: extreme_delta
- old -> new: 63740000.0 -> 20000.0 (0.000314x)
- gemini: keep_old / high / support_amount / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 후보 금액은 '회당 최대 2억원'으로, 이는 총 지원금액이 아닌 개별 지원 횟수에 대한 한도일 가능성이 높아 기존의 최대 지원금액인 6374억원을 대표 금액으로 유지하는 것이 더 안전합니다.

### PBLN_000000000122384 | 2026년 글로벌산업기술협력센터 사업(M.AX 분야 공동연구) 시행계획 공고
- hold_group: limit_candidate_large_delta
- old -> new: 1000000.0 -> 200000.0 (0.2x)
- gemini: keep_old / high / subsidy / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 파싱 후보 금액은 '연간' 한도 금액으로 보이며, 기존값은 '최대 100억원'으로 총 지원 규모를 나타내는 것으로 판단되어 기존값을 유지하는 것이 더 안전합니다.

### PBLN_000000000122501 | 2026년 디지털기반 중소사업장 산재예방 기술개발 지원사업 시행계획 공고
- hold_group: limit_candidate_large_delta
- old -> new: 50000.0 -> 66000.0 (1.32x)
- gemini: keep_old / medium / subsidy / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 최대 지원금액 6.6억원은 '6.6억원 이내 정부지원연구개발비 지원'으로 제시되었으나, 기존값 5억원은 '과제당 정부지원연구개발비 중 기업지원금액 합계가 5억원이상인 경우'라는 조건과 함께 제시되어 직접적인 비교가 어렵고, '청년인력 의무채용'과 관련된 내용으로 보여 대표 지원금액으로 채택하기에는 불확실성이 있습니다.

### PBLN_000000000122997 | [강원] 횡성군 2026년 2차 지식재산 첫걸음 지원사업 참여기업 모집 공고
- hold_group: limit_candidate_large_delta
- old -> new: 130.0 -> 1000.0 (7.69x)
- gemini: keep_old / medium / subsidy / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 후보 금액은 '특허맵(일반) 10,000 천원 이내'와 같이 개별 항목의 지원 한도로 보이며, 기존 공고의 '디자인) 권리화 지원 1) 지원대상: 횡성군 내 중소기업 2) 지원내용 및 규모 가) 기업당 연간 3건 이내 나) 총액의 90% [기업분담금(현금) : 10%] 구 분특허실용신안상표(브랜드)디자인지원금액(자부담 제외)130만원이내/건'에서 제시된 '130만원이내/건'이 기업 단위의 대표 지원금으로 더 명확해 보입니다.

### PBLN_000000000122998 | [강원] 영월군 2026년 2차 지식재산 첫걸음 지원사업 참여기업 모집 공고
- hold_group: limit_candidate_large_delta
- old -> new: 130.0 -> 1000.0 (7.69x)
- gemini: keep_old / medium / subsidy / subtract
- final: keep_old (Gemini 결과를 sanity check 기준으로 수용)
- reason: 새로운 후보 금액 1,000만원은 '특허맵(일반)' 항목의 지원한도로 보이며, 기존 130만원은 '디자인) 권리화 지원' 항목의 지원금액으로 명시되어 있어 서로 다른 항목을 지칭할 가능성이 높으므로 기존값을 유지하는 것이 안전합니다.