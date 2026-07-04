type MobileScreenFeedbackProps = {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function MobileScreenFeedback({ loading, error, onRetry }: MobileScreenFeedbackProps) {
  if (loading) {
    return (
      <article className="ff-mobile-card">
        <p>데이터를 불러오는 중...</p>
      </article>
    )
  }

  if (error) {
    return (
      <article className="ff-mobile-card">
        <h2>데이터를 불러오지 못했습니다</h2>
        <p>{error}</p>
        {onRetry ? (
          <button type="button" className="ff-mobile-secondary-btn" onClick={() => void onRetry()}>
            다시 시도
          </button>
        ) : null}
      </article>
    )
  }

  return null
}
