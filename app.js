// ==========================================
// 🚀 喵逮雞 雲端 POS 核心系統 (app.js)
// ==========================================

const API_BASE_URL = "https://whatthemeownews-erp-backend-324921111026.europe-west1.run.app";
let products = [];
let activeInput = null;
let currentNoteRow = null;
let currentRowCount = 10; // 🌟 預設 10 行，未來會自動增加
let baseServerReceived = 0; // 紀錄從伺服器抓來的已結帳金額

// ==========================================
// 1. 系統初始化
// ==========================================
window.onload = async () => {
    updateDateDisplay();
    setInterval(updateDateDisplay, 60000);
    
    await fetchProductsFromCloud();
    await fetchTodayStats();
    initVirtualKeypad();
};

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

// 🌟 顯示找零的 Toast 動畫
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2800);
}

// ==========================================
// 2. 雲端資料同步區
// ==========================================
async function fetchProductsFromCloud() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/products`);
        const result = await res.json();
        if (result.status === 'success') {
            products = result.data;
            renderTableHeader();
            renderTableRows(1, 10);
        }
    } catch (e) {
        document.getElementById('headerRow').innerHTML = "<th style='color:red;'>無法連線到雲端伺服器！</th>";
    }
}

async function fetchTodayStats() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/stats/today`);
        const result = await res.json();
        if (result.status === 'success') {
            document.getElementById('dashCount').textContent = result.data.total_orders_count;
            baseServerReceived = result.data.revenue_received;
            updateLiveRevenue(); // 🌟 重新計算本地+雲端的總額
        }
    } catch (e) { console.log("業績同步失敗"); }
}

// 🌟 即時更新畫面上的營業額 (伺服器已收 + 畫面上剛勾的)
function updateLiveRevenue() {
    let localReceived = 0;
    for(let i=1; i<=currentRowCount; i++) {
        let rawTotal = parseInt(document.getElementById(`total-${i}`).dataset.rawTotal) || 0;
        let isChecked = document.querySelector(`#row-${i} .received-cb`).checked;
        if(isChecked && rawTotal > 0) {
            localReceived += rawTotal;
        }
    }
    // 顯示最新的動態數字
    document.getElementById('dashTotal').textContent = `$${(baseServerReceived + localReceived).toLocaleString()}`;
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
    html += `<th style="width: 100px; text-align: center;">總額(點算找零)</th><th style="width: 80px; text-align: center;">備註</th>`;
    tr.innerHTML = html;
}

// 生成單行 HTML 的函數
function generateRowHTML(i) {
    let rowHtml = `
        <tr id="row-${i}">
            <td style="text-align: center;">
                <input type="checkbox" class="received-cb" data-row="${i}" style="width:24px; height:24px; cursor:pointer;" onchange="handleCheckboxChange(event)">
            </td>
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
            <td class="row-total" id="total-${i}" onclick="handleTotalClick(${i})" title="點1下收500，點2下收1000">$0</td>
            <td>
                <button class="note-btn" id="noteBtn-${i}" onclick="openNoteModal(${i})">📝</button>
                <input type="hidden" id="noteVal-${i}" value="">
            </td>
        </tr>
    `;
    return rowHtml;
}

// 渲染指定範圍的行數
function renderTableRows(start, end) {
    const tbody = document.getElementById('dataRowsBody');
    let html = "";
    for (let i = start; i <= end; i++) {
        html += generateRowHTML(i);
    }
    if (start === 1) {
        tbody.innerHTML = html; // 覆蓋
    } else {
        tbody.insertAdjacentHTML('beforeend', html); // 附加在後面
    }
    closeKeypad();
}

function resetTable() {
    currentRowCount = 10;
    renderTableRows(1, currentRowCount);
    updateLiveRevenue();
}

// 🌟 處理勾選事件 (觸發自動新增行數 & 更新營收)
function handleCheckboxChange(e) {
    updateLiveRevenue(); // 更新上方營收
    
    const rowNum = parseInt(e.target.dataset.row);
    // 如果勾選的是「目前表格的最後一行」，自動多生 5 行出來！
    if (rowNum === currentRowCount && e.target.checked) {
        let newStart = currentRowCount + 1;
        currentRowCount += 5;
        renderTableRows(newStart, currentRowCount);
    }
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
    updateLiveRevenue(); // 輸入數字時也即時更新營收
}

// 🌟 處理總額點擊 (單擊 500，雙擊 1000)
let clickTimer = null;
function handleTotalClick(rowNum) {
    if (clickTimer) {
        // 觸發雙擊 (Double Click) -> 1000 元
        clearTimeout(clickTimer);
        clickTimer = null;
        calculateChange(rowNum, 1000);
    } else {
        // 觸發單擊 (Single Click) -> 等待一下確認不是雙擊，然後算 500 元
        clickTimer = setTimeout(() => {
            clickTimer = null;
            calculateChange(rowNum, 500);
        }, 250); 
    }
}

function calculateChange(rowNum, payAmount) {
    let rawTotal = parseInt(document.getElementById(`total-${rowNum}`).dataset.rawTotal) || 0;
    if(rawTotal === 0) return;
    
    let change = payAmount - rawTotal;
    if (change < 0) {
        showToast(`⚠️ 客人付的 $${payAmount} 不夠哦！(總額 $${rawTotal})`);
    } else {
        showToast(`💵 收 $${payAmount}，應找零：$${change}`);
        // 貼心設計：順便幫店員把左邊的收錢框打勾
        const cb = document.querySelector(`#row-${rowNum} .received-cb`);
        if(!cb.checked) {
            cb.checked = true;
            handleCheckboxChange({target: cb});
        }
    }
}

// ==========================================
// 4. 虛擬鍵盤邏輯
// ==========================================
function setActiveInput(inputElement) {
    document.querySelectorAll('.qty-input').forEach(el => el.style.borderColor = '#ccc');
    activeInput = inputElement;
    activeInput.style.borderColor = '#4f46e5';
    
    const keypad = document.getElementById('virtualKeypad');
    keypad.style.display = 'block';
    setTimeout(() => { keypad.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
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
            
            if (action === 'done') { closeKeypad(); return; }
            if (!activeInput) return;
            
            let currentVal = activeInput.value;
            if (action === 'clear') { activeInput.value = ''; } 
            else if (action === 'back') { activeInput.value = currentVal.slice(0, -1); } 
            else if (value) {
                if (e.target.classList.contains('keypad-btn-quick')) {
                    activeInput.value = value.replace('+', ''); 
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
    document.getElementById('noteInput').value = document.getElementById(`noteVal-${rowNum}`).value;
    document.getElementById('noteModal').style.display = 'flex';
}
function closeNoteModal() { document.getElementById('noteModal').style.display = 'none'; currentNoteRow = null; }
function confirmNote() {
    if (!currentNoteRow) return;
    const noteText = document.getElementById('noteInput').value.trim();
    document.getElementById(`noteVal-${currentNoteRow}`).value = noteText;
    const btn = document.getElementById(`noteBtn-${currentNoteRow}`);
    if (noteText) { btn.classList.add('has-note'); btn.textContent = '📄'; } 
    else { btn.classList.remove('has-note'); btn.textContent = '📝'; }
    closeNoteModal();
}

// ==========================================
// 6. 🚀 結帳邏輯
// ==========================================
async function submitOrders() {
    const payload = [];
    for (let i = 1; i <= currentRowCount; i++) {
        const rawTotal = parseInt(document.getElementById(`total-${i}`).dataset.rawTotal) || 0;
        if (rawTotal > 0) {
            const isReceived = document.querySelector(`#row-${i} .received-cb`).checked;
            const note = document.getElementById(`noteVal-${i}`).value;
            const orderNo = `D${new Date().getDate()}-${String(i).padStart(2,'0')}`;
            payload.push({ order_no: orderNo, total_amount: rawTotal, received: isReceived, note: note });
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

// ==========================================
// 7. 計算機與深色模式功能
// ==========================================
function toggleCalculator() {
    const calc = document.getElementById('calculatorContainer');
    calc.style.display = calc.style.display === 'none' ? 'block' : 'none';
}

function calcAction(val) {
    const display = document.getElementById('calcDisplay');
    if (val === 'C') { display.value = ''; } 
    else if (val === '=') { try { display.value = eval(display.value); } catch(e) { display.value = 'Error'; } } 
    else { display.value += val; }
}

function toggleTheme() {
    // 🌟 強制切換 data-theme
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeBtn').textContent = isDark ? '[ 深色模式 ]' : '[ 淺色模式 ]';
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
}
