// ==========================================
// 🚀 喵逮雞 雲端 POS 核心系統 (app.js)
// ==========================================

const API_BASE_URL = "https://whatthemeownews-erp-backend-324921111026.europe-west1.run.app";
let products = [];
let activeInput = null;
let currentNoteRow = null;

// ==========================================
// 1. 系統初始化與大腦連線
// ==========================================
window.onload = async () => {
    updateDateDisplay();
    setInterval(updateDateDisplay, 60000); // 每分鐘更新時間
    
    await fetchProductsFromCloud(); // 抓取菜單
    await fetchTodayStats();        // 抓取今日業績
    initVirtualKeypad();            // 啟動虛擬鍵盤
};

// 🌟 大師美化：高質感的日期與時間顯示
function updateDateDisplay() {
    const now = new Date();
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
    const dayStr = `星期${days[now.getDay()]}`;
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    document.getElementById('dateDisplay').innerHTML = `
        🕒 ${dateStr} ${dayStr} <span style="color:#38bdf8; margin-left:8px; font-size:18px;">${timeStr}</span>
    `;
}

// ==========================================
// 2. 雲端資料同步區
// ==========================================
async function fetchProductsFromCloud() {
    try {
        document.getElementById('headerRow').innerHTML = "<th>連線至總部菜單中...</th>";
        const res = await fetch(`${API_BASE_URL}/api/admin/products`);
        const result = await res.json();
        
        if (result.status === 'success') {
            products = result.data;
            renderTableHeader();
            renderTableRows();
        } else {
            alert("載入菜單失敗，請檢查網路連線。");
        }
    } catch (e) {
        console.error(e);
        document.getElementById('headerRow').innerHTML = "<th style='color:red;'>無法連線到雲端伺服器！</th>";
    }
}

async function fetchTodayStats() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/stats/today`);
        const result = await res.json();
        if (result.status === 'success') {
            document.getElementById('dashCount').textContent = result.data.total_orders_count;
            document.getElementById('dashTotal').textContent = `$${result.data.revenue_received.toLocaleString()}`;
        }
    } catch (e) {
        console.log("業績同步失敗");
    }
}

// ==========================================
// 3. 動態表格渲染與計算
// ==========================================
function renderTableHeader() {
    const tr = document.getElementById('headerRow');
    let html = `
        <th style="width: 50px; text-align: center;">收💸</th>
        <th style="width: 50px; text-align: center;">No</th>
    `;
    
    products.forEach(p => {
        html += `<th style="text-align: center;">${p.name}<span class="th-price">(${p.price})</span></th>`;
    });
    
    html += `
        <th style="width: 80px; text-align: center;">總額</th>
        <th style="width: 80px; text-align: center;">備註</th>
    `;
    tr.innerHTML = html;
}

function renderTableRows() {
    const tbody = document.getElementById('dataRowsBody');
    let html = "";
    
    for (let i = 1; i <= 10; i++) {
        let rowHtml = `
            <tr id="row-${i}">
                <td style="text-align: center;"><input type="checkbox" class="received-cb" style="width:24px; height:24px; cursor:pointer;"></td>
                <td style="text-align: center; font-weight:bold; color:#64748b;">${String(i).padStart(2, '0')}</td>
        `;
        
        products.forEach(p => {
            rowHtml += `
                <td>
                    <input type="text" class="qty-input" inputmode="none" readonly
                           data-row="${i}" data-price="${p.price}" data-prod-id="${p.id}" 
                           onclick="setActiveInput(this)">
                </td>
            `;
        });
        
        rowHtml += `
                <td class="row-total" id="total-${i}">$0</td>
                <td>
                    <button class="note-btn" id="noteBtn-${i}" onclick="openNoteModal(${i})">📝</button>
                    <input type="hidden" id="noteVal-${i}" value="">
                </td>
            </tr>
        `;
        html += rowHtml;
    }
    tbody.innerHTML = html;
    closeKeypad(); // 重置表格時關閉鍵盤
}

function calculateRowTotal(rowNum) {
    const inputs = document.querySelectorAll(`input[data-row="${rowNum}"]`);
    let total = 0;
    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        const price = parseInt(input.dataset.price) || 0;
        total += (qty * price);
    });
    document.getElementById(`total-${rowNum}`).textContent = `$${total}`;
    document.getElementById(`total-${rowNum}`).dataset.rawTotal = total;
}

// ==========================================
// 4. 🌟 虛擬鍵盤邏輯 (修復顯示與隱藏)
// ==========================================
function setActiveInput(inputElement) {
    // 移除其他人的選取框
    document.querySelectorAll('.qty-input').forEach(el => el.style.borderColor = '#ccc');
    
    activeInput = inputElement;
    activeInput.style.borderColor = '#4f46e5';
    
    // 🌟 喚醒虛擬鍵盤
    const keypad = document.getElementById('virtualKeypad');
    keypad.style.display = 'block';
    
    // 讓畫面稍微往下捲動，確保鍵盤不會被擋住
    setTimeout(() => {
        keypad.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function closeKeypad() {
    document.getElementById('virtualKeypad').style.display = 'none';
    if(activeInput) {
        activeInput.style.borderColor = '#ccc';
        activeInput = null;
    }
}

function initVirtualKeypad() {
    document.querySelectorAll('.keypad-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const value = e.target.dataset.value;
            
            // 如果按了完成，就收起鍵盤
            if (action === 'done') {
                closeKeypad();
                return;
            }

            if (!activeInput) return; // 沒有選取輸入框就不動作
            let currentVal = activeInput.value;

            if (action === 'clear') {
                activeInput.value = '';
            } else if (action === 'back') {
                activeInput.value = currentVal.slice(0, -1);
            } else if (value) {
                // 快速鍵直接取代，不然就接在後面
                if (e.target.classList.contains('keypad-btn-quick')) {
                    activeInput.value = value.replace('+', ''); // 把 +10 變成 10
                } else {
                    activeInput.value = currentVal + value;
                }
            }
            
            calculateRowTotal(activeInput.dataset.row);
        });
    });
}

// ==========================================
// 5. 備註功能 (Modal)
// ==========================================
function openNoteModal(rowNum) {
    currentNoteRow = rowNum;
    const currentNote = document.getElementById(`noteVal-${rowNum}`).value;
    document.getElementById('noteInput').value = currentNote;
    document.getElementById('noteModal').style.display = 'flex';
}

function closeNoteModal() {
    document.getElementById('noteModal').style.display = 'none';
    currentNoteRow = null;
}

function confirmNote() {
    if (!currentNoteRow) return;
    const noteText = document.getElementById('noteInput').value.trim();
    document.getElementById(`noteVal-${currentNoteRow}`).value = noteText;
    
    const btn = document.getElementById(`noteBtn-${currentNoteRow}`);
    if (noteText) {
        btn.classList.add('has-note');
        btn.textContent = '📄';
    } else {
        btn.classList.remove('has-note');
        btn.textContent = '📝';
    }
    closeNoteModal();
}

// ==========================================
// 6. 🚀 結帳邏輯
// ==========================================
async function submitOrders() {
    const payload = [];
    
    for (let i = 1; i <= 10; i++) {
        const totalElem = document.getElementById(`total-${i}`);
        const rawTotal = parseInt(totalElem.dataset.rawTotal) || 0;
        
        if (rawTotal > 0) {
            const isReceived = document.querySelector(`#row-${i} .received-cb`).checked;
            const note = document.getElementById(`noteVal-${i}`).value;
            const orderNo = `D${new Date().getDate()}-${String(i).padStart(2,'0')}`;
            
            payload.push({
                order_no: orderNo,
                total_amount: rawTotal,
                received: isReceived,
                note: note
            });
        }
    }

    if (payload.length === 0) {
        alert("⚠️ 表格中沒有任何金額大於 0 的訂單喔！");
        return;
    }

    const btn = document.getElementById('checkoutBtn');
    const originalText = document.getElementById('checkoutButtonText').textContent;
    btn.disabled = true;
    document.getElementById('checkoutButtonText').textContent = "📡 傳送至總部中...";

    try {
        const res = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.status === 'success') {
            alert(`🎉 結帳成功！共送出 ${payload.length} 筆訂單！`);
            renderTableRows();    
            fetchTodayStats();    
        } else {
            alert("❌ 結帳失敗：" + result.message);
        }
    } catch (e) {
        alert("❌ 網路連線錯誤，請檢查您的網路或重新整理！");
    } finally {
        btn.disabled = false;
        document.getElementById('checkoutButtonText').textContent = originalText;
    }
}

// ==========================================
// 7. 計算機與深色模式功能
// ==========================================
function toggleCalculator() {
    const calc = document.getElementById('calculatorContainer');
    calc.style.display = calc.style.display === 'none' ? 'block' : 'none';
}

function calcAction(val) {
    const display = document.getElementById('calcDisplay');
    if (val === 'C') {
        display.value = '';
    } else if (val === '=') {
        try { display.value = eval(display.value); } catch(e) { display.value = 'Error'; }
    } else {
        display.value += val;
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    document.getElementById('themeBtn').textContent = isDark ? '[ 淺色模式 ]' : '[ 深色模式 ]';
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
        document.getElementById('fullScreenBtn').textContent = '[ 退出全螢幕 ]';
    } else {
        document.exitFullscreen();
        document.getElementById('fullScreenBtn').textContent = '[ 全螢幕 ]';
    }
}
