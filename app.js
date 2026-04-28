// ==========================================
// 🚀 喵逮雞 雲端 POS 核心系統 (app.js)
// ==========================================

const API_BASE_URL = "https://whatthemeownews-erp-backend-324921111026.europe-west1.run.app";
let products = [];
let activeInput = null;
let currentNoteRow = null;
let currentRowCount = 10; 
let baseServerReceived = 0; 
let speechRecognition = null; 

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
            updateLiveRevenue(); 
        }
    } catch (e) { console.log("業績同步失敗"); }
}

function updateLiveRevenue() {
    let localReceived = 0;
    for(let i=1; i<=currentRowCount; i++) {
        let rawTotal = parseInt(document.getElementById(`total-${i}`).dataset.rawTotal) || 0;
        let isChecked = document.querySelector(`#row-${i} .received-cb`).checked;
        if(isChecked && rawTotal > 0) {
            localReceived += rawTotal;
        }
    }
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
    // 🌟 配合雙按鈕，稍微加寬最後一格
    html += `<th style="width: 80px; text-align: center;">總額</th><th style="width: 100px; text-align: center;">語音/備註</th>`;
    tr.innerHTML = html;
}

// 長按清空邏輯
let pressTimer;
function startLongPress(rowNum, element) {
    element.classList.add('pressing');
    pressTimer = setTimeout(() => {
        clearSpecificRow(rowNum);
        if (navigator.vibrate) navigator.vibrate(100);
        showToast(`🧹 第 ${rowNum} 行資料已清空`);
    }, 2000);
}

function cancelLongPress(element) {
    clearTimeout(pressTimer);
    element.classList.remove('pressing');
}

function clearSpecificRow(rowNum) {
    const cb = document.querySelector(`#row-${rowNum} .received-cb`);
    if(cb) cb.checked = false;
    document.querySelectorAll(`input[data-row="${rowNum}"]`).forEach(inp => inp.value = '');
    calculateRowTotal(rowNum);
    document.getElementById(`noteVal-${rowNum}`).value = '';
    const noteBtn = document.getElementById(`noteBtn-${rowNum}`);
    noteBtn.classList.remove('has-note');
    noteBtn.textContent = '📝';
}

function generateRowHTML(i) {
    let rowHtml = `
        <tr id="row-${i}">
            <td style="text-align: center;">
                <input type="checkbox" class="received-cb" data-row="${i}" style="width:24px; height:24px; cursor:pointer;" onchange="handleCheckboxChange(event)">
            </td>
            <td class="row-no" style="text-align: center; font-weight:bold; color:#64748b; cursor:pointer; user-select:none;"
                onmousedown="startLongPress(${i}, this)" onmouseup="cancelLongPress(this)" onmouseleave="cancelLongPress(this)"
                ontouchstart="startLongPress(${i}, this)" ontouchend="cancelLongPress(this)" ontouchcancel="cancelLongPress(this)"
                title="長按2秒清空此行">
                ${String(i).padStart(2, '0')}
            </td>
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
    
    // 🌟 這裡加入了專屬的麥克風按鈕
    rowHtml += `
            <td class="row-total" id="total-${i}" onclick="handleTotalClick(${i})" title="點1下收500，點2下收1000">$0</td>
            <td>
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button class="note-btn" style="width: 38px; padding: 6px; background: #e0e7ff; border-color: #c7d2fe; font-size:16px;" id="voiceBtn-${i}" onclick="startVoiceOrder(${i})" title="語音點單">🎤</button>
                    <button class="note-btn" style="width: 38px; padding: 6px; font-size:16px;" id="noteBtn-${i}" onclick="openNoteModal(${i})" title="文字備註">📝</button>
                    <input type="hidden" id="noteVal-${i}" value="">
                </div>
            </td>
        </tr>
    `;
    return rowHtml;
}

function renderTableRows(start, end) {
    const tbody = document.getElementById('dataRowsBody');
    let html = "";
    for (let i = start; i <= end; i++) { html += generateRowHTML(i); }
    if (start === 1) { tbody.innerHTML = html; } else { tbody.insertAdjacentHTML('beforeend', html); }
    closeKeypad();
}

function resetTable() {
    currentRowCount = 10;
    renderTableRows(1, currentRowCount);
    updateLiveRevenue();
}

function handleCheckboxChange(e) {
    updateLiveRevenue(); 
    const rowNum = parseInt(e.target.dataset.row);
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
    updateLiveRevenue(); 
}

let clickTimer = null;
function handleTotalClick(rowNum) {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        calculateChange(rowNum, 1000);
    } else {
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
// 5. 🌟 終極殺器：AI 語音點餐解析引擎
// ==========================================
let rowSpeechRecognition = null;

function startVoiceOrder(rowNum) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("⚠️ 您的瀏覽器不支援語音輸入！請使用 Safari 或 Chrome。");
        return;
    }

    if (rowSpeechRecognition) rowSpeechRecognition.stop();

    rowSpeechRecognition = new SpeechRecognition();
    rowSpeechRecognition.lang = 'zh-TW';
    rowSpeechRecognition.interimResults = false;

    const btn = document.getElementById(`voiceBtn-${rowNum}`);
    
    rowSpeechRecognition.onstart = function() {
        btn.textContent = '🔴';
        btn.style.background = '#fecaca';
        showToast("🎤 請開始點餐 (例如：原味兩個草莓三個)");
    };

    rowSpeechRecognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        showToast(`🗣️ 聽到：${transcript}`);
        parseVoiceOrder(transcript, rowNum);
    };

    rowSpeechRecognition.onerror = function() {
        showToast("⚠️ 聽不清楚，請再試一次");
    };

    rowSpeechRecognition.onend = function() {
        btn.textContent = '🎤';
        btn.style.background = '#e0e7ff';
    };

    rowSpeechRecognition.start();
}

function parseVoiceOrder(transcript, rowNum) {
    // 建立語音數字與阿拉伯數字的對照表
    const numMap = { '一':1, '二':2, '兩':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '十一':11, '十二':12 };
    const numRegexStr = '([0-9]+|十一|十二|一|二|兩|三|四|五|六|七|八|九|十)';
    
    let matchCount = 0;

    products.forEach(p => {
        // 防止產品名稱中有正則特殊符號
        const safeName = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // 模式1: 產品名 + 數字 (例如: 原味兩顆)
        const p1 = new RegExp(`${safeName}[^0-9一二兩三四五六七八九十]*${numRegexStr}`, 'i');
        // 模式2: 數字 + 產品名 (例如: 兩個原味)
        const p2 = new RegExp(`${numRegexStr}[^0-9一二兩三四五六七八九十]*${safeName}`, 'i');
        
        let m = transcript.match(p1) || transcript.match(p2);
        
        if (m) {
            let qtyStr = m[1];
            let qty = parseInt(qtyStr);
            if (isNaN(qty)) qty = numMap[qtyStr] || 1;
            
            const input = document.querySelector(`input[data-row="${rowNum}"][data-prod-id="${p.id}"]`);
            if (input) {
                input.value = qty; // 自動填入
                matchCount++;
            }
        }
    });
    
    if (matchCount > 0) {
        calculateRowTotal(rowNum); // 瞬間重新計算總價
        setTimeout(() => showToast(`✅ 成功辨識 ${matchCount} 種口味！`), 1500);
    } else {
        setTimeout(() => showToast(`❌ 聽不懂口味，請手動輸入`), 1500);
    }
}

// 備註的語音輸入 (保留給📝按鈕裡面的大框框用)
function openNoteModal(rowNum) {
    currentNoteRow = rowNum;
    document.getElementById('noteInput').value = document.getElementById(`noteVal-${rowNum}`).value;
    document.getElementById('noteModal').style.display = 'flex';
}
function closeNoteModal() { 
    document.getElementById('noteModal').style.display = 'none'; 
    currentNoteRow = null; 
    if(speechRecognition) speechRecognition.stop(); 
}

function confirmNote() {
    if (!currentNoteRow) return;
    const noteText = document.getElementById('noteInput').value.trim();
    document.getElementById(`noteVal-${currentNoteRow}`).value = noteText;
    const btn = document.getElementById(`noteBtn-${currentNoteRow}`);
    if (noteText) { btn.classList.add('has-note'); btn.textContent = '📄'; } 
    else { btn.classList.remove('has-note'); btn.textContent = '📝'; }
    closeNoteModal();
}

function toggleSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micBtn = document.getElementById('micBtn');

    if (!SpeechRecognition) { alert("⚠️ 不支援語音輸入！"); return; }
    if (!speechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.lang = 'zh-TW';
        speechRecognition.onresult = function(event) {
            const input = document.getElementById('noteInput');
            input.value = input.value + (input.value ? ' ' : '') + event.results[0][0].transcript;
            micBtn.innerHTML = '<span>🎤 語音輸入</span>'; micBtn.style.background = "";
        };
        speechRecognition.onerror = function() { showToast("⚠️ 失敗，請重試"); micBtn.innerHTML = '<span>🎤 語音輸入</span>'; micBtn.style.background = ""; };
        speechRecognition.onend = function() { micBtn.innerHTML = '<span>🎤 語音輸入</span>'; micBtn.style.background = ""; };
    }
    micBtn.innerHTML = '<span>🎙️ 聆聽中...</span>'; micBtn.style.background = "#fca5a5";
    speechRecognition.start();
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
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeBtn').textContent = isDark ? '[ 深色模式 ]' : '[ 淺色模式 ]';
}
