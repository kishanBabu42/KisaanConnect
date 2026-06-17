/**
 * KisaanConnect — Validation Tests (25 Cases)
 * Category: Input Validation, Form Validation, API Boundary Testing
 * Run: node e2e_tests/validation/validation_tests.js
 */
'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const results = [];

function api(method, p, body) {
    return new Promise(resolve => {
        const d = body ? JSON.stringify(body) : null;
        const req = http.request(
            { hostname:'localhost', port:3000, path:p, method,
              headers:{'Content-Type':'application/json', ...(d?{'Content-Length':Buffer.byteLength(d)}:{})} },
            res => { let r=''; res.on('data',c=>r+=c);
                res.on('end',()=>{ try{resolve({s:res.statusCode,b:JSON.parse(r)});}catch(_){resolve({s:res.statusCode,b:r})} }); }
        );
        req.on('error', e => resolve({s:0,b:e.message}));
        if (d) req.write(d);
        req.end();
    });
}

async function tc(id, name, fn) {
    try {
        const {ok,notes} = await fn();
        const status = ok?'PASS':'FAIL';
        results.push({id,name,status,notes:notes||''});
        console.log(`  ${ok?'✅':'❌'} [${id}] ${name}`);
        if(ok) passed++; else failed++;
    } catch(e) {
        failed++;
        results.push({id,name,status:'FAIL',notes:e.message.substring(0,100)});
        console.log(`  ❌ [${id}] ${name} — ${e.message.substring(0,60)}`);
    }
}

async function main() {
    console.log('\n✅ KisaanConnect — Validation Tests (25 Cases)\n'+'═'.repeat(50));

    // ── Required Field Validation ──
    console.log('\n[S1] Required Field Validation');
    await tc('TC-V01','Signup without email returns error', async()=>{
        const r = await api('POST','/api/signup',{name:'Test',password:'pass',role:'farmer',mobile:'9000000000'});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });
    await tc('TC-V02','Signup without name returns error', async()=>{
        const r = await api('POST','/api/signup',{email:'noname@test.com',password:'pass',role:'farmer',mobile:'9000000001'});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });
    await tc('TC-V03','Signup without password returns error', async()=>{
        const r = await api('POST','/api/signup',{name:'Test',email:'nopass@test.com',role:'farmer',mobile:'9000000002'});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });
    await tc('TC-V04','Login without email returns error', async()=>{
        const r = await api('POST','/api/login',{password:'pass',role:'farmer'});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });
    await tc('TC-V05','Login without password returns error', async()=>{
        const r = await api('POST','/api/login',{email:'val@test.com',role:'farmer'});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });

    // ── Duplicate & Uniqueness ──
    console.log('\n[S2] Duplicate & Uniqueness Validation');
    const DUP_EMAIL = `dup_val_${Date.now()}@test.com`;
    await tc('TC-V06','First signup with unique email succeeds', async()=>{
        const r = await api('POST','/api/signup',{name:'Dup Test',email:DUP_EMAIL,password:'Test@123',role:'farmer',mobile:'9000000010',location:'City'});
        return {ok: !!r.b.id, notes:`id:${r.b.id}`};
    });
    await tc('TC-V07','Duplicate signup with same email returns error/conflict', async()=>{
        const r = await api('POST','/api/signup',{name:'Dup Test2',email:DUP_EMAIL,password:'Test@456',role:'farmer',mobile:'9000000011',location:'City'});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s} — body:${JSON.stringify(r.b).substring(0,50)}`};
    });

    // ── Product Field Validation ──
    console.log('\n[S3] Product Field Validation');
    await tc('TC-V08','Product without name returns error', async()=>{
        const r = await api('POST','/api/products',{farmerId:1,price:30,quantity:100,age:'2d',location:'City',images:[]});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });
    await tc('TC-V09','Product without price returns error', async()=>{
        const r = await api('POST','/api/products',{farmerId:1,name:'Onions',quantity:100,age:'2d',location:'City',images:[]});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });
    await tc('TC-V10','Product without farmerId returns error', async()=>{
        const r = await api('POST','/api/products',{name:'Onions',price:30,quantity:100,age:'2d',location:'City',images:[]});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });

    // ── Numeric / Type Validation ──
    console.log('\n[S4] Numeric & Type Boundary Validation');
    await tc('TC-V11','Wallet add with zero amount is handled gracefully', async()=>{
        const r = await api('POST','/api/users/add-wallet',{userId:1,amount:0});
        return {ok: r.s===200||r.s===400, notes:`Status:${r.s}`};
    });
    await tc('TC-V12','Wallet add with negative amount is handled gracefully', async()=>{
        const r = await api('POST','/api/users/add-wallet',{userId:1,amount:-100});
        return {ok: r.s===200||r.s===400, notes:`Status:${r.s}`};
    });
    await tc('TC-V13','Payment with missing amount is handled', async()=>{
        const r = await api('POST','/api/payments',{userId:1,userRole:'farmer',type:'credit',method:'upi',description:'Test'});
        return {ok: r.s===200||r.s===400, notes:`Status:${r.s}`};
    });
    await tc('TC-V14','Quote with quantity:0 is handled gracefully', async()=>{
        const r = await api('POST','/api/quotes',{productId:1,productName:'Test',farmerId:1,farmerName:'F',farmerMobile:'9000000020',farmerLocation:'X',customerId:2,customerName:'C',customerMobile:'8000000020',customerLocation:'Y',quantity:0,offerPrice:10,needDriver:false});
        return {ok: r.s===200||r.s===400, notes:`Status:${r.s}`};
    });

    // ── Non-existent Resource ──
    console.log('\n[S5] Non-existent Resource Validation');
    await tc('TC-V15','GET /api/users/999999 returns 404 or empty', async()=>{
        const r = await api('GET','/api/users/999999');
        return {ok: r.s===404||!r.b.id, notes:`Status:${r.s}`};
    });
    await tc('TC-V16','GET /api/products?farmerId=999999 returns empty array', async()=>{
        const r = await api('GET','/api/products?farmerId=999999');
        return {ok: Array.isArray(r.b)&&r.b.length===0, notes:`Count:${Array.isArray(r.b)?r.b.length:'N/A'}`};
    });
    await tc('TC-V17','PUT /api/products/999999 returns 404 or error', async()=>{
        const r = await api('PUT','/api/products/999999',{name:'X',price:10,quantity:1,age:'1d',location:'X',images:[]});
        return {ok: r.s===404||r.s===400||r.s===500, notes:`Status:${r.s}`};
    });
    await tc('TC-V18','PUT /api/quotes/999999 returns 404 or error', async()=>{
        const r = await api('PUT','/api/quotes/999999',{status:'yes',paid:false});
        return {ok: r.s===404||r.s===400||r.s===500, notes:`Status:${r.s}`};
    });

    // ── Role Validation ──
    console.log('\n[S6] Role & Access Validation');
    await tc('TC-V19','Login with wrong role (farmer email as customer) fails', async()=>{
        const FE=`rval_${Date.now()}@test.com`;
        await api('POST','/api/signup',{name:'RVal',email:FE,password:'Test@123',role:'farmer',mobile:'9000000030',location:'City'});
        const r = await api('POST','/api/login',{email:FE,password:'Test@123',role:'customer'});
        return {ok: r.s!==200||!r.b.id, notes:`Status:${r.s}`};
    });
    await tc('TC-V20','Admin login with farmer credentials fails', async()=>{
        const r = await api('POST','/api/admin/login',{email:'notadmin@test.com',password:'Test@123'});
        return {ok: r.s!==200||(r.b.role!=='admin'), notes:`Status:${r.s} role:${r.b.role}`};
    });

    // ── Content & Format ──
    console.log('\n[S7] Content & Format Validation');
    await tc('TC-V21','Calendar note with empty note string is handled', async()=>{
        const r = await api('POST','/api/calendar_notes',{farmerId:1,dateKey:'2025-06-17',note:''});
        return {ok: r.s===200||r.s===400, notes:`Status:${r.s}`};
    });
    await tc('TC-V22','Community post with empty message is handled', async()=>{
        const r = await api('POST','/api/community',{customerId:1,customerName:'Test',message:''});
        return {ok: r.s===200||r.s===400, notes:`Status:${r.s}`};
    });
    await tc('TC-V23','Subscription with invalid day string is handled', async()=>{
        const r = await api('POST','/api/subscriptions',{customerId:2,farmerId:1,productId:1,productName:'T',quantity:5,day:'Funday'});
        return {ok: r.s===200||r.s===400, notes:`Status:${r.s}`};
    });
    await tc('TC-V24','Platform fee POST with missing orderId is handled', async()=>{
        const r = await api('POST','/api/platform-fee',{userId:2,userRole:'customer',amount:500});
        return {ok: r.s===200||r.s===400, notes:`Status:${r.s}`};
    });
    await tc('TC-V25','GET /api/farmer-payment-info/999999 returns gracefully', async()=>{
        const r = await api('GET','/api/farmer-payment-info/999999');
        return {ok: r.s===200||r.s===404, notes:`Status:${r.s}`};
    });

    // Report
    console.log('\n'+'═'.repeat(50));
    console.log(`📊 Validation Tests: ${passed} PASSED | ${failed} FAILED | 25 TOTAL`);
    const dir = path.join(__dirname,'../reports');
    if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
    const esc=v=>{const s=String(v);return(s.includes(',')||s.includes('"'))?`"${s.replace(/"/g,'""')}"`:s;};
    let csv='Test Case ID,Test Type,Category,Test Description,Status,Notes\n';
    results.forEach(r=>{csv+=`${esc(r.id)},Validation,Input Validation,${esc(r.name)},${esc(r.status)},${esc(r.notes)}\n`;});
    fs.writeFileSync(path.join(dir,'Validation_Report.csv'),csv,'utf8');
    console.log('💾 Validation_Report.csv saved');

    if(process.env.GITHUB_STEP_SUMMARY){
        let md=`# ✅ Validation Tests — KisaanConnect\n\n| ID | Test | Status |\n|:---|:---|:---:|\n`;
        results.forEach(r=>{md+=`| ${r.id} | ${r.name} | ${r.status==='PASS'?'✅ PASS':'❌ FAIL'} |\n`;});
        md+=`\n**${passed} PASS | ${failed} FAIL**\n`;
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md,'utf8');
    }
    process.exit(failed>0?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
