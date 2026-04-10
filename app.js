// 🗑️ 已經移除了所有 Google API 的複雜設定，系統瘦身成功！

const TOTAL_DATA_ROWS = 30;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']; 

// 🎯 您的專屬雲端伺服器網址
const API_URL = 'https://whatthemeownews-erp-backend-324921111026.europe-west1.run.app/api/orders';

const DOM = {
    dataRowsBody: document.getElementById('dataRowsBody'),
    pageInfo: document.getElementById('pageInfo'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    dateDisplay: document.getElementById('dateDisplay'),
    headerRow: document.getElementById('headerRow'),
    saveToDriveBtn: document.getElementById('saveToDriveBtn'),
    authStatus: document.getElementById('authStatus'),
    saveButtonText: document.getElementById('saveButtonText'),
    keypad: document.getElementById('virtualKeypad'),
    tableContainer: document.querySelector('.table-container'),
    calculatorContainer: document.getElementById('calculatorContainer'),
    calcDisplay: document.getElementById('calcDisplay'),
    dashCount: document.getElementById('dashCount'),
    dashTotal: document.getElementById('dashTotal'),
    noteModal: document.getElementById('noteModal'),
    noteInput: document.getElementById('noteInput'),
    micBtn: document.getElementById('micBtn'),
    fullScreenBtn: document.getElementById('fullScreenBtn'),
    alarmModal: document.getElementById('alarmModal'),
    alarmDetails: document.getElementById('alarmDetails'),
    themeBtn: document.getElementById('themeBtn'),
    themeMeta: document.getElementById('theme-color-meta')
};
    
let allOrderData = []; 
let currentPageIndex = 0; 
let unitPrices = []; 
let currentTargetCell = null; 
let longPressTimer = null; 
let recognition = null;
let isListening = false;
let currentEditingRowIndex = null; 

// --- LocalStorage 斷電保護機制 ---
function saveToLocal() { localStorage.setItem('posData', JSON.stringify(allOrderData)); }
function loadFromLocal() {
    const savedData = localStorage.getItem('posData');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allOrderData = parsed;
                return true;
            }
        } catch (e) { console.error("讀取存檔失敗", e); }
    }
    return false;
}
function clearLocal() { localStorage.removeItem('posData'); }
function updateRowTimestamp(rowIndex) {
    if (!allOrderData[currentPageIndex][rowIndex].timestamp) {
        allOrderData[currentPageIndex][rowIndex].timestamp = new Date().toISOString();
        saveToLocal();
    }
}

// --- 介面與主題 ---
window.toggleTheme = function() {
    const currentTheme = document.body.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.body.removeAttribute('data-theme');
        DOM.themeBtn.textContent = '[ 深色模式 ]';
        if(DOM.themeMeta) DOM.themeMeta.setAttribute("content", "#3f51b5");
    } else {
        document.body.setAttribute('data-theme', 'dark');
        DOM.themeBtn.textContent = '[ 淺色模式 ]';
        if(DOM.themeMeta) DOM.themeMeta.setAttribute("content", "#121212");
    }
};

window.toggleFullScreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => console.warn(e));
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
};

document.addEventListener('fullscreenchange', () => {
    const btn = DOM.fullScreenBtn;
    if (document.fullscreenElement) {
        btn.textContent = '[ 結束全螢幕 ]';
        btn.classList.add('active');
    } else {
        btn.textContent = '[ 全螢幕 ]';
        btn.classList.remove('active');
    }
});

// --- 計算機 ---
window.toggleCalculator = function() {
    DOM.calculatorContainer.style.display = (DOM.calculatorContainer.style.display === 'block') ? 'none' : 'block';
};
window.calcAction = function(val) {
    const display = DOM.calcDisplay;
    if (val === 'C') display.value = ''; 
    else if (val === '=') {
        try {
            let expr = display.value.replace(/×/g, '*').replace(/÷/g, '/');
            if (expr) display.value = eval(expr); 
        } catch (e) { display.value = 'Error'; }
    } else {
        const lastChar = display.value.slice(-1);
        const ops = ['+', '-', '*', '/'];
        if (ops.includes(val) && ops.includes(lastChar)) display.value = display.value.slice(0, -1) + val;
        else display.value += val;
    }
};

// --- 語音備註 ---
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-TW'; 
        recognition.continuous = false; 
        recognition.interimResults = false;
        recognition.onresult = (event) => {
            DOM.noteInput.value += (DOM.noteInput.value ? ' ' : '') + event.results[0][0].transcript;
            stopSpeech(); 
        };
        recognition.onerror = () => stopSpeech();
        recognition.onend = () => stopSpeech();
    } else DOM.micBtn.style.display = 'none'; 
}

window.toggleSpeech = function() {
    if (!recognition) return alert("不支援語音");
    if (isListening) stopSpeech(); else startSpeech();
};
function startSpeech() {
    recognition.start();
    isListening = true;
    DOM.micBtn.classList.add('listening');
    DOM.micBtn.innerHTML = '<span>🔴 正在聆聽...</span>';
}
function stopSpeech() {
    if(recognition) recognition.stop();
    isListening = false;
    DOM.micBtn.classList.remove('listening');
    DOM.micBtn.innerHTML = '<span>🎤 語音輸入</span>';
}
function openNoteModal(rowIndex) {
    currentEditingRowIndex = rowIndex;
    DOM.noteInput.value = allOrderData[currentPageIndex][rowIndex].note || "";
    DOM.noteModal.style.display = 'flex';
    setTimeout(() => DOM.noteInput.focus(), 100);
}
window.closeNoteModal = function() {
    stopSpeech();
    DOM.noteModal.style.display = 'none';
    currentEditingRowIndex = null;
};
window.confirmNote = function() {
    if (currentEditingRowIndex !== null) {
        allOrderData[currentPageIndex][currentEditingRowIndex].note = DOM.noteInput.value.trim();
        allOrderData[currentPageIndex][currentEditingRowIndex].alerted = false;
        updateRowTimestamp(currentEditingRowIndex); 
        saveToLocal(); 
        renderPage(allOrderData[currentPageIndex]); 
    }
    closeNoteModal();
};

// --- 鬧鐘系統 ---
let audioCtx;
let alarmInterval = null;
function unlockAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.addEventListener('click', unlockAudio);

function startAlarmSound() {
    if (!audioCtx) unlockAudio();
    if (alarmInterval) return;
    playBeepPattern();
    alarmInterval = setInterval(playBeepPattern, 1500);
}
function playBeepPattern() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(880, now); 
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    gain.gain.setValueAtTime(0.1, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    gain.gain.setValueAtTime(0.1, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.6);
}
window.stopAlarm = function() {
    if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
    DOM.alarmModal.style.display = 'none';
};
function initReminderSystem() { setInterval(checkReminders, 30000); }
function checkReminders() {
    if (!allOrderData[currentPageIndex] || DOM.alarmModal.style.display === 'flex') return;
    const now = new Date();
    for (let i = 0; i < allOrderData[currentPageIndex].length; i++) {
        const rowData = allOrderData[currentPageIndex][i];
        if (!rowData.note || rowData.alerted) continue; 
        const timeMatch = rowData.note.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
        if (timeMatch) {
            const targetTime = new Date();
            targetTime.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
            const diff = targetTime - now;
            if (diff > 0 && diff <= 600000) { // 10 mins
                DOM.alarmDetails.textContent = `編號 ${i + 1}：${rowData.note}`;
                DOM.alarmModal.style.display = 'flex';
                startAlarmSound();
                rowData.alerted = true;
                break; 
            }
        }
    }
}

// ==========================================
// 🚀 核心升級：將資料傳送至您的雲端 ERP 伺服器
// ==========================================
async function saveToCloudERP() {
    DOM.saveButtonText.textContent = '⚙️ 正在傳送至雲端...';
    DOM.saveToDriveBtn.disabled = true;
    DOM.saveToDriveBtn.style.opacity = '0.7'; 
    
    try {
        // 1. 將本地資料打包成乾淨的 JSON 陣列
        const payload = []; 
        
        allOrderData.forEach((pageData, pageIndex) => {
            pageData.forEach((rowData, rowIndex) => {
                const hasQuantity = rowData.quantities.some(q => q > 0);
                if (rowData.received || hasQuantity) {
                    payload.push({
                        order_no: (rowIndex + 1).toString(),
                        total_amount: rowData.totalPrice,
                        received: rowData.received,
                        note: rowData.note || ""
                    });
                }
            });
        });
        
        if (payload.length === 0) {
            alert("沒有發現任何有效資料！");
            return;
        }

        // 2. 發送請求到 Google Cloud Run (FastAPI)
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // 3. 成功後的清理動作
        if (response.ok && result.status === 'success') {
            allOrderData[currentPageIndex].forEach((row, index) => {
                if (row.received || row.quantities.some(q => q > 0)) {
                    if (row.received) clearRow(index, false); 
                }
            });
            renderPage(allOrderData[currentPageIndex]); 
            clearLocal();
            
            alert(`✅ 雲端同步完成！\n${result.message}`);
            DOM.authStatus.textContent = `✅ ${result.message}`;
            renderRealTimeDashboard();
        } else {
            throw new Error(result.message || "伺服器未回傳成功狀態");
        }

    } catch (error) {
        console.error("API 連線錯誤:", error);
        alert(`無法連線至雲端伺服器 😢\n請確認您的網路，或檢查 Cloud Run 是否正常運作。\n錯誤訊息: ${error.message}`);
        DOM.authStatus.textContent = `❌ 連線失敗`;
    } finally {
        DOM.saveButtonText.textContent = '💾 儲存至雲端 ERP';
        DOM.saveToDriveBtn.disabled = false;
        DOM.saveToDriveBtn.style.opacity = '1';
    }
}

// --- 渲染邏輯 ---
function initializeDate() { 
    const today = new Date(); 
    const monthYear = `${today.getFullYear()}年${today.getMonth() + 1}月`;
    DOM.dateDisplay.innerHTML = `<div class="calendar-header">${monthYear} (${WEEKDAYS[today.getDay()]})</div><div class="calendar-day"><span class="calendar-day-number">${today.getDate()}</span>日</div>`;
}

function fetchUnitPrices() { 
    const thElements = DOM.headerRow.getElementsByTagName('th');
    for (let i = 2; i < thElements.length - 2; i++) {
        const match = thElements[i].textContent.match(/\((\d+)\)/);
        unitPrices.push(match && match[1] ? parseInt(match[1]) : 0);
    }
}

function createEmptyPage() {
    const newPage = [];
    for (let i = 0; i < TOTAL_DATA_ROWS; i++) {
        newPage.push({ received: false, quantities: Array(11).fill(0), totalPrice: 0, note: "", alerted: false, timestamp: null });
    }
    return newPage;
}

function calculateRowTotal(rowIndex) {
    const row = DOM.dataRowsBody.rows[rowIndex];
    if (!row) return;
    let total = 0;
    const quantities = [];
    for (let i = 2; i <= 12; i++) {
        const qtyCell = row.cells[i].querySelector('.quantity-cell');
        const qty = parseInt(qtyCell.getAttribute('data-value') || 0); 
        total += qty * unitPrices[i - 2];
        quantities.push(qty);
    }
    allOrderData[currentPageIndex][rowIndex].quantities = quantities;
    allOrderData[currentPageIndex][rowIndex].totalPrice = total;
    row.cells[13].textContent = `$${total}`;
    
    if (quantities.some(q => q > 0)) row.classList.add('active-row');
    else row.classList.remove('active-row');
    
    updateRowTimestamp(rowIndex); 
    saveToLocal(); 
    renderRealTimeDashboard();
}

function renderRealTimeDashboard() {
    let localCount = 0, localTotal = 0;
    if (allOrderData[currentPageIndex]) {
        allOrderData[currentPageIndex].forEach(row => {
            if (row.received && row.totalPrice > 0) {
                localCount++; localTotal += row.totalPrice;
            }
        });
    }
    DOM.dashCount.textContent = localCount;
    DOM.dashTotal.textContent = `$${localTotal.toLocaleString()}`;
}

function renderPage(data) {
    DOM.dataRowsBody.innerHTML = ''; 
    data.forEach((rowData, i) => {
        let row = DOM.dataRowsBody.insertRow();
        if (rowData.quantities.some(q => q > 0)) row.classList.add('active-row');

        let receivedCell = row.insertCell();
        receivedCell.className = 'received-cell';
        const receivedCheckDiv = document.createElement('div');
        receivedCheckDiv.className = 'custom-check';
        if (rowData.received) { receivedCheckDiv.classList.add('checked'); receivedCheckDiv.textContent = '\u2713'; }
        receivedCell.appendChild(receivedCheckDiv); 
        
        let idCell = row.insertCell();
        idCell.textContent = i + 1; 
        idCell.className = 'id-cell';
        idCell.addEventListener('touchstart', () => startLongPress(i));
        idCell.addEventListener('touchend', cancelLongPress);
        idCell.addEventListener('mousedown', () => startLongPress(i));
        idCell.addEventListener('mouseup', cancelLongPress);
        idCell.addEventListener('mouseleave', cancelLongPress);

        rowData.quantities.forEach((quantity, j) => { 
            let cell = row.insertCell();
            const quantityDiv = document.createElement('div');
            quantityDiv.className = 'quantity-cell';
            quantityDiv.setAttribute('data-row-index', i);
            if (quantity > 0) {
                quantityDiv.setAttribute('data-value', quantity);
                quantityDiv.textContent = quantity;
                quantityDiv.classList.add('active'); 
            }
            quantityDiv.addEventListener('click', function() {
                if (this.querySelector('.flavor-hint')) return;
                const headerTh = DOM.headerRow.cells[cell.cellIndex];
                if (headerTh) {
                    const flavorName = headerTh.textContent.replace(/\n/g, '').replace(/\s+/g, '').split('(')[0].trim();
                    const hint = document.createElement('div');
                    hint.className = 'flavor-hint';
                    hint.textContent = flavorName;
                    this.appendChild(hint);
                    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 2000);
                }
            });
            cell.appendChild(quantityDiv);
        });
        
        let priceCell = row.insertCell();
        priceCell.textContent = `$${rowData.totalPrice}`;
        priceCell.className = 'price-cell';
        priceCell.onclick = (e) => {
            e.stopPropagation(); 
            const orig = rowData.totalPrice;
            if (orig === 0) return; 
            const now = Date.now();
            if (priceCell.lastClickTime && (now - priceCell.lastClickTime < 300)) {
                priceCell.textContent = `找$${1000 - orig}`;
                priceCell.className = 'price-cell change-1000'; 
                priceCell.lastClickTime = 0; 
            } else {
                priceCell.textContent = `找$${500 - orig}`;
                priceCell.className = 'price-cell change-500'; 
                priceCell.lastClickTime = now;
            }
            if (priceCell.revertTimer) clearTimeout(priceCell.revertTimer);
            priceCell.revertTimer = setTimeout(() => {
                priceCell.textContent = `$${orig}`;
                priceCell.className = 'price-cell'; 
            }, 5000);
        };

        let noteCell = row.insertCell();
        noteCell.className = 'note-cell';
        if (rowData.note) noteCell.classList.add('has-note');
        noteCell.innerHTML = '<span class="note-icon">📝</span>';
        noteCell.onclick = () => openNoteModal(i);
    });
    updatePaginationUI();
    renderRealTimeDashboard();
}

function startLongPress(rowIndex) {
    longPressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50); 
        if (confirm(`確定要清空編號「${rowIndex + 1}」的所有資料嗎？`)) clearRow(rowIndex);
    }, 800); 
}
function cancelLongPress() { clearTimeout(longPressTimer); }

function clearRow(rowIndex, redraw = true) {
    const rowData = allOrderData[currentPageIndex][rowIndex];
    rowData.quantities.fill(0); rowData.totalPrice = 0;
    rowData.received = false; rowData.note = "";
    rowData.alerted = false; rowData.timestamp = null; 
    saveToLocal(); 
    if(redraw) renderPage(allOrderData[currentPageIndex]);
}

function updatePaginationUI() {
    const totalPages = allOrderData.length;
    DOM.pageInfo.textContent = `${currentPageIndex + 1} / ${totalPages}`;
    DOM.prevPageBtn.disabled = currentPageIndex === 0;
    const hasData = allOrderData[currentPageIndex].some(r => r.received || r.quantities.some(q => q > 0));
    DOM.nextPageBtn.disabled = (currentPageIndex + 1 === totalPages && !hasData);
}

function handleKeypadInput(button) {
    if (!currentTargetCell) return;
    const value = button.getAttribute('data-value');
    const action = button.getAttribute('data-action');
    const rowIndex = parseInt(currentTargetCell.getAttribute('data-row-index'));
    
    if (value) {
        let currentText = currentTargetCell.getAttribute('data-value') || '';
        if (button.classList.contains('keypad-btn-quick')) currentText = value; 
        else currentText = (currentText === '0') ? value : currentText + value;
        currentTargetCell.setAttribute('data-value', currentText);
        currentTargetCell.textContent = currentText;
    } else if (action === 'clear') {
        currentTargetCell.setAttribute('data-value', ''); currentTargetCell.textContent = ''; 
    } else if (action === 'back') {
        let currentText = currentTargetCell.getAttribute('data-value') || '';
        currentText = currentText.slice(0, -1);
        currentTargetCell.setAttribute('data-value', currentText);
        currentTargetCell.textContent = currentText;
    }

    const currentVal = currentTargetCell.getAttribute('data-value');
    if (currentVal && parseInt(currentVal) > 0) currentTargetCell.classList.add('active');
    else currentTargetCell.classList.remove('active');
    calculateRowTotal(rowIndex);
}

function handleReceivedClick(event) {
    if (!event.target.classList.contains('custom-check')) return;
    const checkDiv = event.target;
    const rowIndex = Array.from(DOM.dataRowsBody.rows).indexOf(checkDiv.closest('tr'));
    
    const newState = !checkDiv.classList.contains('checked');
    allOrderData[currentPageIndex][rowIndex].received = newState;
    checkDiv.classList.toggle('checked');
    checkDiv.textContent = newState ? '\u2713' : ''; 
    
    updateRowTimestamp(rowIndex); 
    saveToLocal();
    updatePaginationUI(); 
    renderRealTimeDashboard();
}

function handleNextPageClick() {
    if (currentPageIndex < allOrderData.length - 1) currentPageIndex++;
    else if (allOrderData[currentPageIndex].some(r => r.quantities.some(q=>q>0))) {
        allOrderData.push(createEmptyPage()); currentPageIndex++;
    } else return;
    renderPage(allOrderData[currentPageIndex]);
}
function handlePrevPageClick() {
    if (currentPageIndex > 0) { currentPageIndex--; renderPage(allOrderData[currentPageIndex]); }
}

function bindEventListeners() {
    DOM.prevPageBtn.addEventListener('click', handlePrevPageClick);
    DOM.nextPageBtn.addEventListener('click', handleNextPageClick);
    // 🔗 按鈕直接綁定發送至雲端的功能！
    DOM.saveToDriveBtn.addEventListener('click', saveToCloudERP);
    DOM.dataRowsBody.addEventListener('click', handleReceivedClick);
    
    DOM.dataRowsBody.addEventListener('click', function(event) {
        if (event.target.classList.contains('quantity-cell')) {
            if (currentTargetCell) currentTargetCell.classList.remove('active');
            currentTargetCell = event.target;
            currentTargetCell.classList.add('active'); 
            
            const rect = currentTargetCell.getBoundingClientRect();
            const containerRect = DOM.tableContainer.getBoundingClientRect();
            let topPos = rect.top - containerRect.top + currentTargetCell.offsetHeight + 5; 
            let leftPos = rect.left - containerRect.left;
            
            if (leftPos + 240 > DOM.tableContainer.clientWidth) leftPos = DOM.tableContainer.clientWidth - 245;
            if (leftPos < 0) leftPos = 5;
            
            DOM.keypad.style.top = `${topPos}px`;
            DOM.keypad.style.left = `${leftPos}px`;
            DOM.keypad.style.display = 'block'; 
        }
    });
    
    DOM.keypad.addEventListener('click', function(event) {
        const button = event.target.closest('.keypad-button');
        if (button) handleKeypadInput(button);
    });
    
    document.addEventListener('click', function(event) {
        if (!DOM.keypad.contains(event.target) && !event.target.classList.contains('quantity-cell')) {
            DOM.keypad.style.display = 'none';
            if (currentTargetCell) { currentTargetCell.classList.remove('active'); currentTargetCell = null; }
        }
    });
}

function initializeApp() {
    fetchUnitPrices();
    initializeDate(); 
    if (!loadFromLocal()) allOrderData.push(createEmptyPage());
    renderPage(allOrderData[currentPageIndex]);
    bindEventListeners();
    initSpeechRecognition(); 
    initReminderSystem(); 
    
    // 初始化時不再需要等待 Google API，直接啟用按鈕
    DOM.saveToDriveBtn.disabled = false;
    DOM.saveButtonText.textContent = '💾 儲存至雲端 ERP';
    DOM.authStatus.textContent = '✅ 已連接至雲端伺服器';
}

initializeApp();
