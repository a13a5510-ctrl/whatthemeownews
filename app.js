// ==========================================
// 🐱 喵逮雞 POS 系統 - 核心神經網路 (經典原味版)
// ==========================================

// ⚠️ 徒兒請注意：請務必將下方網址換成您自己真實的 Cloud Run 端點！
const API_URL = "https://whatthemeownews-erp-backend-324921111026.europe-west1.run.app"; 

const menuItems = [
    { name: "菜脯米", price: 30 },
    { name: "金沙", price: 35 },
    { name: "泰奶", price: 35 },
    { name: "起司", price: 35 },
    { name: "鮪玉", price: 30 },
    { name: "草莓", price: 30 },
    { name: "抹茶", price: 30 },
    { name: "巧克力", price: 30 },
    { name: "卡士達", price: 25 },
    { name: "原味", price: 20 }
];

// 全域變數
let currentNoteRowId = null;
let calcCurrent = '0';
let calcOp = null;
let calcPrev = null;

// ================= 初始化頁面 =================
document.addEventListener("DOMContentLoaded", () => {
    updateClock();
    setInterval(updateClock, 1000);
    renderTable();
    setupThemeToggle();
    setupModals();
});

function updateClock() {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString('zh-TW', { hour12: false });
    document.getElementById('date').innerText = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

// ================= 生成經典原味表格 =================
function renderTable() {
    const headerRow = document.getElementById('menu-headers');
    const tbody = document.getElementById('order-body');
    
    // 1. 還原您原本的表頭結構 (使用原本的 CSS class)
    let headersHtml = `<th>收💸</th><th>No</th>`;
    headersHtml += menuItems.map(item => `
        <th>
            <div class="menu-name">${item.name}</div>
            <div class="menu-price">(${item.price})</div>
        </th>
    `).join('');
    headersHtml += `<th>總額</th><th>語音/備註</th>`;
    headerRow.innerHTML = headersHtml;

    // 2. 生成 10 列訂單 (還原您原本的 input 與按鈕風格)
    let rowsHtml = '';
    for (let i = 1; i <= 10; i++) {
        let rowId = i.toString().padStart(2, '0');
        
        let inputsHtml = menuItems.map(item => `
            <td>
                <div class="input-wrapper">
                    <input type="number" min="0" class="qty-input" id="qty-${rowId}-${item.name}" data-price="${item.price}" data-row="${rowId}" onchange="calculateTotal('${rowId}')" onfocus="this.select()">
                </div>
            </td>
        `).join('');

        rowsHtml += `
            <tr id="row-${rowId}">
                <td><input type="checkbox" id="paid-${rowId}" class="paid-checkbox"></td>
                <td class="row-num">${rowId}</td>
                ${inputsHtml}
                <td class="total-price" id="total-${rowId}">$0</td>
                
                <!-- 還原原本的語音與備註(彈出式)按鈕 -->
                <td class="action-cell">
                    <div class="action-buttons-cell">
                        <button class="btn btn-icon btn-voice" onclick="startVoiceOrder('${rowId}')">🎤</button>
                        <button class="btn btn-icon btn-note" onclick="openNoteModal('${rowId}')">📝</button>
                    </div>
                    <!-- 隱藏的 span 用來儲存該列的備註內容 -->
                    <span id="note-display-${rowId}" class="note-display" style="display: block; font-size: 12px; color: #ff9800; margin-top: 2px;"></span>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = rowsHtml;
}

// ================= 核心邏輯 =================
function calculateTotal(rowId) {
    let total = 0;
    menuItems.forEach(item => {
        let qty = document.getElementById(`qty-${rowId}-${item.name}`).value;
        if (qty > 0) {
            total += qty * item.price;
        }
    });
    document.getElementById(`total-${rowId}`).innerText = `$${total}`;
    updateDailyTotal();
}

function updateDailyTotal() {
    let dailyTotal = 0;
    for (let i = 1; i <= 10; i++) {
        let rowId = i.toString().padStart(2, '0');
        let rowTotalText = document.getElementById(`total-${rowId}`).innerText.replace('$', '');
        dailyTotal += parseInt(rowTotalText) || 0;
    }
    document.getElementById('daily-total-amount').innerText = `$${dailyTotal}`;
}

function clearRow(rowId) {
    menuItems.forEach(item => {
        document.getElementById(`qty-${rowId}-${item.name}`).value = '';
    });
    document.getElementById(`paid-${rowId}`).checked = false;
    document.getElementById(`note-display-${rowId}`).innerText = '';
    document.getElementById(`row-${rowId}`).style.backgroundColor = ''; 
    calculateTotal(rowId);
}

// ================= 彈出視窗功能 (備註 & 計算機) =================
function setupModals() {
    // 備註彈窗
    const noteModal = document.getElementById('note-modal');
    document.getElementById('cancel-note').onclick = () => { noteModal.style.display = 'none'; };
    document.getElementById('save-note').onclick = () => {
        const noteText = document.getElementById('note-input').value;
        document.getElementById(`note-display-${currentNoteRowId}`).innerText = noteText;
        noteModal.style.display = 'none';
    };

    // 計算機彈窗
    const calcModal = document.getElementById('calc-modal');
    document.getElementById('calc-btn').onclick = () => { 
        calcModal.style.display = 'flex'; 
        updateCalcDisplay();
    };
    document.getElementById('close-calc').onclick = () => { calcModal.style.display = 'none'; };
}

function openNoteModal(rowId) {
    currentNoteRowId = rowId;
    document.getElementById('note-input').value = document.getElementById(`note-display-${rowId}`).innerText;
    document.getElementById('note-modal').style.display = 'flex';
}

// ================= 計算機邏輯 =================
function updateCalcDisplay() { document.getElementById('calc-display').innerText = calcCurrent; }
function appendCalc(num) {
    if (calcCurrent === '0') calcCurrent = num;
    else calcCurrent += num;
    updateCalcDisplay();
}
function setOp(op) {
    if (calcOp !== null) calculateResult();
    calcPrev = calcCurrent;
    calcOp = op;
    calcCurrent = '0';
}
function calculateResult() {
    if (calcOp === null || calcPrev === null) return;
    let result = 0;
    const prev = parseFloat(calcPrev);
    const current = parseFloat(calcCurrent);
    switch(calcOp) {
        case '+': result = prev + current; break;
        case '-': result = prev - current; break;
        case '*': result = prev * current; break;
        case '/': result = current !== 0 ? prev / current : 'Error'; break;
    }
    calcCurrent = String(result);
    calcOp = null;
    calcPrev = null;
    updateCalcDisplay();
}
function clearCalc() {
    calcCurrent = '0'; calcOp = null; calcPrev = null;
    updateCalcDisplay();
}

// ================= 語音與 AI 黑科技串接 =================
function startVoiceOrder(rowId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("大師提醒：您的瀏覽器不支援語音辨識，請在 iPhone 上使用 Safari 瀏覽器開啟喔！");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;

    const voiceBtn = document.querySelector(`#row-${rowId} .btn-voice`);
    const originalHtml = voiceBtn.innerHTML;
    voiceBtn.innerHTML = '⏳';
    voiceBtn.style.backgroundColor = '#e74c3c';

    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log(`客席 ${rowId} 收到語音指令:`, transcript);
        sendToGemini(rowId, transcript, voiceBtn, originalHtml);
    };

    recognition.onerror = (event) => {
        console.error("語音辨識錯誤:", event.error);
        alert("聽不清楚，請再試一次！");
        resetVoiceBtn(voiceBtn, originalHtml);
    };
    
    recognition.onend = () => {
        if(voiceBtn.innerHTML === '⏳') {
           resetVoiceBtn(voiceBtn, originalHtml);
        }
    }
}

function sendToGemini(rowId, transcript, voiceBtn, originalHtml) {
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcript })
    })
    .then(response => response.json())
    .then(data => {
        const parsedData = data.parsed_json || data; 
        console.log("大師解析結果:", parsedData);

        // 🛑 黑科技：清空指令攔截
        if (parsedData.action === "clear") {
            clearRow(rowId);
            resetVoiceBtn(voiceBtn, originalHtml);
            return; 
        }

        // ✍️ 黑科技：自動填寫備註 (填入隱藏的 span 裡顯示)
        if (parsedData.note) {
            document.getElementById(`note-display-${rowId}`).innerText = parsedData.note;
        }

        // ✅ 黑科技：已收款自動打勾並改變背景色
        if (parsedData.is_paid === true) {
            document.getElementById(`paid-${rowId}`).checked = true;
            document.getElementById(`row-${rowId}`).style.backgroundColor = 'rgba(46, 204, 113, 0.15)';
        }

        // 填寫數量
        menuItems.forEach(item => {
            if (parsedData[item.name]) {
                document.getElementById(`qty-${rowId}-${item.name}`).value = parsedData[item.name];
            }
        });

        calculateTotal(rowId);
        resetVoiceBtn(voiceBtn, originalHtml);
    })
    .catch(error => {
        console.error("API 呼叫失敗:", error);
        alert("大師神經網路斷線啦！請檢查伺服器或再試一次。");
        resetVoiceBtn(voiceBtn, originalHtml);
    });
}

function resetVoiceBtn(btn, originalHtml) {
    btn.innerHTML = originalHtml;
    btn.style.backgroundColor = '';
}

// ================= 淺色/深色模式切換 =================
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        if (document.body.classList.contains('dark-theme')) {
            toggleBtn.innerText = '[ 淺色模式 ]';
        } else {
            toggleBtn.innerText = '[ 深色模式 ]';
        }
    });
}
