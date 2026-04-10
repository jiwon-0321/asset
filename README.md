# Sniper Capital Board

엑셀 기반 투자 현황을 웹 대시보드로 옮긴 1차 구현본입니다.

## 범위

- `Task #1`은 별도 명세가 없어 `총괄현황 대시보드 MVP`로 해석해 구현했습니다.
- 총 자산, 자산 분포, 보유 종목, 실현손익, 최근 거래, 플레이 전략을 한 화면에 표시합니다.

## 실행

```bash
python3 scripts/export_workbook.py
```

이후 `index.html`을 브라우저에서 바로 열면 됩니다.

거래 추가 저장 기능까지 쓰려면 아래 서버로 실행하세요.

```bash
node scripts/dev-server.js
```

그 다음 브라우저에서 `http://127.0.0.1:4173` 로 접속하면 됩니다.
