import Brand from './Brand.jsx';

export default function MaintenanceScreen() {
  return (
    <div className="maintenance-screen">
      <header className="maintenance-header" aria-label="Shopping AI Assistant">
        <Brand />
      </header>

      <main className="maintenance-content">
        <div className="maintenance-visual" aria-hidden="true">
          <div className="maintenance-orbit maintenance-orbit--outer" />
          <div className="maintenance-orbit maintenance-orbit--inner" />
          <div className="maintenance-tool">
            <svg viewBox="0 0 64 64" fill="none">
              <path d="M38.7 13.6a13 13 0 0 0-14.8 16.7L11.5 42.7a5.5 5.5 0 1 0 7.8 7.8l12.4-12.4a13 13 0 0 0 16.7-14.8l-7.6 7.6-7.7-2-2-7.7 7.6-7.6Z" />
              <circle cx="15.5" cy="46.5" r="2.5" />
            </svg>
          </div>
          <span className="maintenance-spark maintenance-spark--one">✦</span>
          <span className="maintenance-spark maintenance-spark--two">✦</span>
        </div>

        <div className="maintenance-status" role="status">
          <span className="maintenance-status-dot" aria-hidden="true" />
          서비스 점검 중
        </div>

        <h1 className="maintenance-title">
          잠시 쇼핑을 멈추고
          <span>더 나은 서비스를 준비 중이에요</span>
        </h1>

        <p className="maintenance-description">
          현재 안정적인 서비스 제공을 위해 서버를 점검하고 있습니다.
          <br />
          점검을 마치는 대로 다시 찾아뵙겠습니다.
        </p>

        <div className="maintenance-notice">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </svg>
          잠시 후 다시 접속해 주세요
        </div>
      </main>

      <footer className="maintenance-footer">
        <span aria-hidden="true">©</span> Shopping AI Assistant
      </footer>
    </div>
  );
}
