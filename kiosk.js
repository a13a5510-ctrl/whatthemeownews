const API_BASE_URL = "https://whatthemeownews-erp-backend-taipei-324921111026.asia-east1.run.app";

let products = [];
let recognition = null;
let currentTotal = 0;
let currentItemsStr = "";
let isListening = false;
let isSpeaking = false;

// 初始化與讀取產品清單
window.onload = async () => {
    initSpeechRecognition();
    await fetchProducts();
};

// 取得產品清單，用於計算總金額
async function fetchProducts() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/products`);
        const result = await res.json();
        if (result.status === 'success') {
            products = result.data;
            console.log("產品清單載入成功:", products);
        }
    } catch (e) {
        console.error("無法取得雲端產品清單:", e);
    }
}

// 初始化語音辨識
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        updateUI("❌ 您的瀏覽器不支援語音辨識", "🙀");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isListening = true;
        updateUI("聆聽中... (請說出你要的口味與數量)", "😼");
        document.getElementById('catAvatar').classList.add('listening');
        hideOrderCard();
    };

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("語音辨識結果:", transcript);
        await parseVoiceOrder(transcript);
    };

    recognition.onerror = (event) => {
        console.error("語音辨識錯誤:", event.error);
        if (event.error === 'no-speech') {
            speakAndReset("喵～我沒有聽到聲音，請點擊螢幕再試一次喔！", "喵～我沒有聽到聲音，請再試一次！", "😿");
        } else {
            speakAndReset("喵～系統發生了點小問題，請再試一次！", "發生了點問題，請重試！", "🙀");
        }
    };

    recognition.onend = () => {
        isListening = false;
        document.getElementById('catAvatar').classList.remove('listening');
    };
}

// 啟動 Kiosk 自助點單
function startKiosk() {
    if (isListening || isSpeaking) return;
    if (!recognition) {
        alert("不支援語音辨識功能！");
        return;
    }
    recognition.start();
}

// 呼叫 AI 解析語音指令
async function parseVoiceOrder(transcript) {
    updateUI("思考中...", "🙀");
    try {
        const res = await fetch(`${API_BASE_URL}/api/ai/parse-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: transcript })
        });
        const result = await res.json();

        if (result.status === 'success' && result.data) {
            const parsedData = result.data;
            
            // 檢查是否是清空指令
            if (parsedData.action === "clear") {
                speakAndReset("好的，已為您清空點餐項目！", "已清空點餐！", "😸");
                return;
            }

            // 計算總金額並組合顯示內容
            let matchedItems = [];
            let total = 0;
            let ttsParts = [];

            for (const [prodName, qty] of Object.entries(parsedData)) {
                // 排除非產品的屬性 (例如 action, note, is_paid)
                if (['action', 'note', 'is_paid'].includes(prodName)) continue;
                
                const prod = products.find(p => p.name === prodName);
                if (prod && qty > 0) {
                    const itemTotal = prod.price * qty;
                    total += itemTotal;
                    matchedItems.push({
                        name: prodName,
                        qty: qty,
                        subtotal: itemTotal
                    });
                    ttsParts.push(`${qty}個${prodName}`);
                }
            }

            if (matchedItems.length === 0) {
                speakAndReset("抱歉，我沒有聽到您想要的口味。請點擊螢幕重新說一次！", "聽不懂您點了什麼，請再說一次！", "😿");
                return;
            }

            currentTotal = total;
            currentItemsStr = matchedItems.map(item => `${item.name}x${item.qty}`).join(', ');

            // 渲染至確認卡片
            renderOrderCard(matchedItems, total);

            // 語音念出確認詞
            const ttsMessage = `好的，為您點了：${ttsParts.join('、')}。總金額共 ${total} 元，請確認。`;
            speakText(ttsMessage, () => {
                updateUI("請確認下方的點餐卡片喵～", "🐱");
            });

        } else {
            speakAndReset("喵～AI 大腦思考失敗，請點擊螢幕重新試一次！", "解析失敗，請再說一次！", "🙀");
        }
    } catch (e) {
        console.error("AI 串接失敗:", e);
        speakAndReset("喵～網路好像有點問題，請重新點擊螢幕再試一次！", "連線失敗，請再試一次！", "🙀");
    }
}

// 渲染訂單卡片
function renderOrderCard(items, total) {
    const container = document.getElementById('orderItemsContainer');
    container.innerHTML = '';
    
    // 生成流水隨機單號
    const orderNo = `K${new Date().getDate()}-${String(Math.floor(Math.random() * 90) + 10)}`;
    document.getElementById('orderNoText').textContent = orderNo;

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'order-item';
        row.innerHTML = `<span>${item.name} x ${item.qty}</span><span>$${item.subtotal}</span>`;
        container.appendChild(row);
    });

    document.getElementById('orderTotalText').textContent = `$${total.toLocaleString()}`;
    document.getElementById('orderCard').style.display = 'flex';
}

// 隱藏訂單卡片
function hideOrderCard() {
    document.getElementById('orderCard').style.display = 'none';
}

// 確認送出點單
async function confirmKioskOrder() {
    if (currentTotal === 0) return;
    
    const orderNo = document.getElementById('orderNoText').textContent;
    const payload = [{ 
        order_no: orderNo, 
        total_amount: currentTotal, 
        received: false, // Kiosk 預設為未收錢
        items: currentItemsStr,
        note: "Kiosk 自助語音點餐"
    }];

    try {
        const res = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            hideOrderCard();
            speakText("好的，已為您成功送單！請到櫃檯告訴人員您的單號，並完成結帳，謝謝您！", () => {
                updateUI("點單成功！歡迎下次光臨喵～", "🐱");
            });
            currentTotal = 0;
            currentItemsStr = "";
        } else {
            speakText("抱歉，送單失敗，請通知店員處理，謝謝！");
        }
    } catch (e) {
        console.error("送單失敗:", e);
        speakText("網路錯誤，無法傳送訂單，請通知店員處理，謝謝！");
    }
}

// 取消 Kiosk 點單
function cancelKioskOrder() {
    hideOrderCard();
    currentTotal = 0;
    currentItemsStr = "";
    speakText("好的，已幫您取消。請隨時點擊螢幕再次開始點餐！", () => {
        updateUI("喵～歡迎光臨！點擊畫面開始對我說話吧！", "🐱");
    });
}

// 文字轉語音 (TTS)
function speakText(text, callback) {
    if (!window.speechSynthesis) {
        if (callback) callback();
        return;
    }
    
    // 停止目前正在播放的語音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 1.0;
    
    utterance.onstart = () => {
        isSpeaking = true;
        updateUI(document.getElementById('chatBubble').textContent, "😸");
    };
    
    utterance.onend = () => {
        isSpeaking = false;
        if (callback) callback();
    };

    utterance.onerror = () => {
        isSpeaking = false;
        if (callback) callback();
    };

    window.speechSynthesis.speak(utterance);
}

// 輔助函式：發聲並重設回初始狀態
function speakAndReset(ttsText, bubbleText, emoji) {
    updateUI(bubbleText, emoji);
    speakText(ttsText, () => {
        updateUI("點擊畫面開始對我說話吧！", "🐱");
    });
}

// 輔助函式：更新介面文字與貓咪表情
function updateUI(bubbleText, emoji) {
    document.getElementById('chatBubble').textContent = bubbleText;
    document.getElementById('catAvatar').textContent = emoji;
}
