#!/usr/bin/env python3
"""
엑셀 데이터를 Firestore로 업로드하는 스크립트
"""
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Firebase Admin SDK 초기화
cred = credentials.Certificate('../config/serviceAccountKey.json')
firebase_admin.initialize_app(cred)

# Firestore 클라이언트
db = firestore.client()

def upload_portfolio_data():
    """portfolio.json 데이터를 Firestore로 업로드"""

    print("📁 portfolio.json 읽는 중...")
    with open('../data/portfolio.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("🔥 Firestore 업로드 시작...\n")

    # 1. Summary 데이터 업로드
    print("1️⃣ Summary 데이터 업로드 중...")
    summary_ref = db.collection('summary').document('current')
    summary_ref.set({
        **data['summary'],
        'updatedAt': firestore.SERVER_TIMESTAMP,
        'metadata': data.get('metadata', {})
    })
    print("   ✅ Summary 완료\n")

    # 2. Asset Status 업로드
    print("2️⃣ Asset Status 데이터 업로드 중...")
    for idx, asset in enumerate(data['assetStatus']):
        asset_ref = db.collection('assetStatus').document(f"asset_{idx}")
        asset_ref.set(asset)
    print(f"   ✅ {len(data['assetStatus'])}개 자산 완료\n")

    # 3. Holdings 업로드
    print("3️⃣ Holdings 데이터 업로드 중...")
    for idx, holding in enumerate(data['holdings']):
        # asset 필드를 document ID로 사용
        doc_id = f"{holding.get('platform', 'unknown')}_{holding.get('asset', f'asset_{idx}')}"
        holding_ref = db.collection('holdings').document(doc_id)
        holding_ref.set(holding)
    print(f"   ✅ {len(data['holdings'])}개 보유 종목 완료\n")

    # 4. 거래 내역 (Trades) 업로드
    print("4️⃣ 거래 내역 업로드 중...")

    # 국내주식 거래
    stock_trades = data['trades']['stocks']
    for trade in stock_trades:
        trade_ref = db.collection('trades').add({
            **trade,
            'type': 'stock',
            'createdAt': firestore.SERVER_TIMESTAMP
        })
    print(f"   ✅ {len(stock_trades)}개 국내주식 거래 완료")

    # 암호화폐 거래
    crypto_trades = data['trades']['crypto']
    for trade in crypto_trades:
        trade_ref = db.collection('trades').add({
            **trade,
            'type': 'crypto',
            'createdAt': firestore.SERVER_TIMESTAMP
        })
    print(f"   ✅ {len(crypto_trades)}개 암호화폐 거래 완료\n")

    # 5. 실현손익 업로드
    print("5️⃣ 실현손익 데이터 업로드 중...")
    for realized in data['realized']:
        realized_ref = db.collection('realized').add({
            **realized,
            'createdAt': firestore.SERVER_TIMESTAMP
        })
    print(f"   ✅ {len(data['realized'])}개 실현손익 완료\n")

    # 6. 차트 데이터 업로드
    print("6️⃣ 차트 데이터 업로드 중...")
    charts_ref = db.collection('charts').document('current')
    charts_ref.set(data['charts'])
    print("   ✅ 차트 데이터 완료\n")

    # 7. 전략 데이터 업로드
    print("7️⃣ 전략 데이터 업로드 중...")
    strategy_ref = db.collection('strategy').document('phase1')
    strategy_ref.set(data['strategy'])
    print("   ✅ 전략 데이터 완료\n")

    # 8. Analytics (XRP Defense 등) 업로드
    print("8️⃣ Analytics 데이터 업로드 중...")
    analytics_ref = db.collection('analytics').document('current')
    analytics_ref.set(data['analytics'])
    print("   ✅ Analytics 완료\n")

    print("=" * 50)
    print("🎉 모든 데이터 업로드 완료!")
    print("=" * 50)

if __name__ == '__main__':
    try:
        upload_portfolio_data()
    except Exception as e:
        print(f"❌ 에러 발생: {e}")
        import traceback
        traceback.print_exc()
