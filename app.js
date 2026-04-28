// ==========================================
// 6. 🚀 結帳邏輯 (新增打包品項功能)
// ==========================================
async function submitOrders() {
    const payload = [];
    for (let i = 1; i <= currentRowCount; i++) {
        const rawTotal = parseInt(document.getElementById(`total-${i}`).dataset.rawTotal) || 0;
        if (rawTotal > 0) {
            const isReceived = document.querySelector(`#row-${i} .received-cb`).checked;
            const note = document.getElementById(`noteVal-${i}`).value;
            const orderNo = `D${new Date().getDate()}-${String(i).padStart(2,'0')}`;
            
            // 🌟 核心：收集這筆訂單賣了哪些品項
            let itemsArr = [];
            const inputs = document.querySelectorAll(`input.qty-input[data-row="${i}"]`);
            inputs.forEach(input => {
                const qty = parseInt(input.value);
                if (qty > 0) {
                    const prodId = parseInt(input.dataset.prodId);
                    const prod = products.find(p => p.id === prodId);
                    if (prod) itemsArr.push(`${prod.name}x${qty}`);
                }
            });
            const itemsStr = itemsArr.join(', '); // 變成 "原味x2, 卡士達x1"

            payload.push({ 
                order_no: orderNo, 
                total_amount: rawTotal, 
                received: isReceived, 
                items: itemsStr, // 🌟 夾帶送出
                note: note 
            });
        }
    }

    if (payload.length === 0) { alert("⚠️ 表格中沒有任何金額大於 0 的訂單喔！"); return; }

    const btn = document.getElementById('checkoutBtn');
    const originalText = document.getElementById('checkoutButtonText').textContent;
    btn.disabled = true;
    document.getElementById('checkoutButtonText').textContent = "📡 傳送至總部中...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert(`🎉 結帳成功！共送出 ${payload.length} 筆訂單！`);
            resetTable();    
            fetchTodayStats();    
        } else { alert("❌ 結帳失敗：" + result.message); }
    } catch (e) { alert("❌ 網路連線錯誤，請檢查您的網路或重新整理！"); } 
    finally { btn.disabled = false; document.getElementById('checkoutButtonText').textContent = originalText; }
}
