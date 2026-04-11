# Sniper Capital Board Notes

## Current Structure

- `index.html` / `app.js` / `styles.css`
  브라우저 UI와 상호작용을 담당합니다.
- `api/*.js`
  Vercel과 로컬 dev server에서 쓰는 API 엔드포인트입니다.
- `lib/*.js`
  인증, 저장, 시세/차트 조회, 포트폴리오 서비스 공통 로직입니다.
- `scripts/dev-server.js`
  로컬 개발 서버입니다.
- `scripts/portfolio-store.js`
  포트폴리오 저장과 재계산 로직입니다.
- `scripts/export_workbook.py`
  루트의 최신 엑셀 파일을 읽어 `data/portfolio.json`을 생성합니다.
- `data/portfolio.json`
  엑셀 export 기준의 기본 포트폴리오 데이터입니다.

## Current Data Flow

1. 엑셀 파일을 갱신합니다.
2. `npm run export` 또는 `python3 scripts/export_workbook.py [파일명]`으로 `data/portfolio.json`을 다시 생성합니다.
3. 로컬에서는 `npm run dev`로 실행합니다.
4. 웹에서는 `/api/portfolio`와 저장 서버 데이터를 우선 사용합니다.

## Cleanup Policy

- 브라우저에서 직접 읽지 않는 중복 산출물은 만들지 않습니다.
- 현재 서비스와 연결되지 않은 보조 스크립트는 레포에 남기지 않습니다.
- 운영 흐름과 맞지 않는 문서는 길게 남기지 않고 현재 구조 기준으로 짧게 유지합니다.
