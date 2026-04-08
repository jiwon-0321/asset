# Sniper Capital Board

엑셀 기반 투자 현황을 웹 대시보드로 옮긴 1차 구현본입니다.

## 범위

- `Task #1`은 별도 명세가 없어 `총괄현황 대시보드 MVP`로 해석해 구현했습니다.
- 총 자산, 자산 분포, 보유 종목, 실현손익, 최근 거래, 페이즈 1 전략을 한 화면에 표시합니다.

## 실행

```bash
python3 scripts/export_workbook.py
```

이후 `index.html`을 브라우저에서 바로 열면 됩니다.

선택적으로 로컬 서버에서 보고 싶다면 아래처럼 실행해도 됩니다.

```bash
python3 -m http.server 4173
```
