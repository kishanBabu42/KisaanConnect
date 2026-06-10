import re

with open('customer-dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find where the PAYMENTS SECTION starts and where the next PROFILE SECTION starts
pay_start = content.find('        <!-- PAYMENTS SECTION -->')
prof_start = content.find('        <!-- PROFILE SECTION -->')

if pay_start < 0 or prof_start < 0:
    print(f"ERROR: pay_start={pay_start} prof_start={prof_start}")
else:
    old_section = content[pay_start:prof_start]
    print("Old section found, length:", len(old_section))
    
    new_section = '''        <!-- PAYMENTS SECTION -->
        <div id="payments-section" class="section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h2 style="margin:0;">\U0001f4b3 Payments &amp; Wallet</h2>
                <button onclick="loadCustomerPayments()" style="border-radius:12px; border:1px solid var(--border); padding:10px 18px; background:var(--card-bg); color:var(--text); cursor:pointer;"><i class="fas fa-sync-alt"></i> Refresh</button>
            </div>

            <!-- Wallet Card -->
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border-radius: 24px; padding: 35px; box-shadow: 0 15px 35px rgba(99,102,241,0.3); position: relative; overflow: hidden; margin-bottom: 25px;">
                <h3 style="margin-top: 0; font-size: 16px; font-weight: 600; opacity: 0.9;">Wallet Balance</h3>
                <div style="font-size: 48px; font-weight: 900; margin-bottom: 5px; letter-spacing: -2px;">\u20b9<span id="customer-wallet-disp">0.00</span></div>
                <div style="font-size: 13px; opacity: 0.8; margin-bottom: 25px;">Available to spend</div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button onclick="showCustPaymentModal(\'credit\')" style="background: white; color: #6366f1; padding: 12px 22px; border-radius: 12px; font-weight: 800; border: none; cursor:pointer;"><i class="fas fa-plus"></i> Add Money</button>
                    <button onclick="showCustPaymentModal(\'debit\')" style="background: rgba(255,255,255,0.2); color: white; padding: 12px 22px; border-radius: 12px; font-weight: 700; border: 1px solid rgba(255,255,255,0.4); cursor:pointer;"><i class="fas fa-shopping-cart"></i> Pay for Order</button>
                </div>
                <i class="fas fa-wallet" style="position: absolute; right: -20px; bottom: -20px; font-size: 140px; opacity: 0.08; transform: rotate(-15deg);"></i>
            </div>

            <!-- Payment Methods -->
            <h3 style="margin-bottom: 15px;"><i class="fas fa-credit-card"></i> Choose Payment Method</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div onclick="showCustPaymentModal(\'debit\',\'upi\')" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color:white; border-radius:20px; padding:20px; cursor:pointer; text-align:center; transition:0.3s;" onmouseover="this.style.transform=\'translateY(-4px)\'" onmouseout="this.style.transform=\'\'">
                    <i class="fas fa-mobile-alt" style="font-size:26px; margin-bottom:8px;"></i>
                    <div style="font-weight:800; font-size:14px;">UPI</div>
                    <div style="font-size:11px; opacity:0.9;">GPay \u00b7 PhonePe \u00b7 BHIM</div>
                </div>
                <div onclick="showCustPaymentModal(\'debit\',\'card\')" style="background: linear-gradient(135deg, #0369a1, #0ea5e9); color:white; border-radius:20px; padding:20px; cursor:pointer; text-align:center; transition:0.3s;" onmouseover="this.style.transform=\'translateY(-4px)\'" onmouseout="this.style.transform=\'\'">
                    <i class="fas fa-credit-card" style="font-size:26px; margin-bottom:8px;"></i>
                    <div style="font-weight:800; font-size:14px;">Debit/Credit Card</div>
                    <div style="font-size:11px; opacity:0.9;">Visa \u00b7 Mastercard \u00b7 RuPay</div>
                </div>
                <div onclick="showCustPaymentModal(\'debit\',\'netbanking\')" style="background: linear-gradient(135deg, #b45309, #f59e0b); color:white; border-radius:20px; padding:20px; cursor:pointer; text-align:center; transition:0.3s;" onmouseover="this.style.transform=\'translateY(-4px)\'" onmouseout="this.style.transform=\'\'">
                    <i class="fas fa-university" style="font-size:26px; margin-bottom:8px;"></i>
                    <div style="font-weight:800; font-size:14px;">Net Banking</div>
                    <div style="font-size:11px; opacity:0.9;">SBI \u00b7 HDFC \u00b7 ICICI \u00b7 All</div>
                </div>
                <div onclick="showCustPaymentModal(\'credit\',\'wallet\')" style="background: linear-gradient(135deg, #059669, #10b981); color:white; border-radius:20px; padding:20px; cursor:pointer; text-align:center; transition:0.3s;" onmouseover="this.style.transform=\'translateY(-4px)\'" onmouseout="this.style.transform=\'\'">
                    <i class="fas fa-wallet" style="font-size:26px; margin-bottom:8px;"></i>
                    <div style="font-weight:800; font-size:14px;">Add to Wallet</div>
                    <div style="font-size:11px; opacity:0.9;">Paytm \u00b7 Amazon Pay</div>
                </div>
                <div onclick="showCustPaymentModal(\'debit\',\'cash\')" style="background: linear-gradient(135deg, #64748b, #94a3b8); color:white; border-radius:20px; padding:20px; cursor:pointer; text-align:center; transition:0.3s;" onmouseover="this.style.transform=\'translateY(-4px)\'" onmouseout="this.style.transform=\'\'">
                    <i class="fas fa-money-bill-wave" style="font-size:26px; margin-bottom:8px;"></i>
                    <div style="font-weight:800; font-size:14px;">Cash on Delivery</div>
                    <div style="font-size:11px; opacity:0.9;">Pay when received</div>
                </div>
            </div>

            <!-- Transaction History -->
            <h3 style="margin-bottom: 15px;"><i class="fas fa-history"></i> Transaction History</h3>
            <div id="customer-payments-list"><div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fas fa-spinner fa-spin" style="font-size:24px;"></i><p>Loading transactions...</p></div></div>
        </div>

        <!-- Customer Payment Modal -->
        <div id="cust-payment-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center;">
            <div style="max-width:420px; background:var(--card-bg); border-radius:24px; padding:30px; width:90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <h3 id="cust-pm-title" style="margin-top:0;">Make Payment</h3>
                <label style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Payment Method</label>
                <select id="cust-pm-method" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); margin:8px 0 15px; background:var(--card-bg); color:var(--text);">
                    <option value="upi">\U0001f4f1 UPI (GPay / PhonePe / BHIM)</option>
                    <option value="card">\U0001f4b3 Debit / Credit Card</option>
                    <option value="netbanking">\U0001f3e6 Net Banking</option>
                    <option value="wallet">\U0001f45b Digital Wallet (Paytm)</option>
                    <option value="cash">\U0001f4b5 Cash on Delivery</option>
                    <option value="bank_transfer">\U0001f501 Bank Transfer (NEFT/RTGS)</option>
                </select>
                <label style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Amount (\u20b9)</label>
                <input type="number" id="cust-pm-amount" placeholder="Enter amount" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); margin:8px 0 15px; background:var(--card-bg); color:var(--text);" min="1">
                <label style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Description (optional)</label>
                <input type="text" id="cust-pm-desc" placeholder="e.g. Vegetable order" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); margin:8px 0 20px; background:var(--card-bg); color:var(--text);">
                <div style="display: flex; gap: 10px;">
                    <button onclick="submitCustPayment()" style="flex:1; padding:14px; border-radius:12px; font-weight:800; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:white; border:none; cursor:pointer; font-size:15px;">Confirm</button>
                    <button onclick="document.getElementById(\'cust-payment-modal\').style.display=\'none\'" style="flex:1; border:1px solid var(--border); background:var(--bg); color:var(--text); border-radius:12px; cursor:pointer; padding:14px;">Cancel</button>
                </div>
            </div>
        </div>

'''
    
    content = content[:pay_start] + new_section + content[prof_start:]
    with open('customer-dashboard.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Customer payments section replaced!")
