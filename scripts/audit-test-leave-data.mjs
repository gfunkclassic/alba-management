// scripts/audit-test-leave-data.mjs
//
// READ-ONLY 테스트 연차 데이터 감사 스크립트.
// PR #106 ~ #113 작업 중 leave_requests / approvals / notifications / leave_balance 에
// 남은 테스트 데이터를 식별하고, leave_balance.used_days 원복 필요성을 분석.
//
// 안전 규약:
//   - getDoc / getDocs / query / where 만 사용.
//   - setDoc/addDoc/updateDoc/deleteDoc/writeBatch/runTransaction 절대 미사용.
//   - 실제 데이터 변경 일체 없음. deploy / commit / push / PR 없음.
//   - 비밀번호는 stdin 비표시 입력 (커맨드 인자 금지 — PowerShell 히스토리 보호).
//   - Firebase config는 src/firebase.js 재사용 (하드코딩 금지).
//   - 실행 admin은 sys_admin 또는 approver_final 권한 권장
//     (leave_balance 및 타인 leave_requests 전체 read 위해).
//
// 실행:
//   node scripts/audit-test-leave-data.mjs
//   (실행 후 admin email + password 프롬프트가 표시됩니다)
//
// 출력:
//   - 콘솔: console.table 로 분류된 후보 목록
//   - JSON: scripts/output/audit-test-leave-data-YYYYMMDD-HHmmss.json 전체 dump

import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDoc, getDocs, doc } from 'firebase/firestore';
import { auth, db } from '../src/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 입력 helper ───────────────────────────────────────────────────
function questionPlain(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, (answer) => { rl.close(); resolve(answer); });
    });
}
function questionHidden(prompt) {
    return new Promise((resolve, reject) => {
        process.stdout.write(prompt);
        let buf = '';
        const stdin = process.stdin;
        const wasRaw = stdin.isRaw;
        if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        const onData = (chunk) => {
            for (const ch of chunk) {
                const code = ch.charCodeAt(0);
                if (ch === '\n' || ch === '\r' || code === 4) {
                    if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw || false);
                    stdin.pause();
                    stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    return resolve(buf);
                } else if (code === 3) {
                    if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw || false);
                    stdin.pause();
                    stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    return reject(new Error('aborted by user'));
                } else if (code === 8 || code === 127) {
                    buf = buf.slice(0, -1);
                } else if (code >= 32) {
                    buf += ch;
                }
            }
        };
        stdin.on('data', onData);
    });
}

// ─── 분류 helper ───────────────────────────────────────────────────
const TEST_KEYWORDS = ['테스트', '테스트 신청', '테스트신청', '테스트용', '테스트 사용', '테스트통', '테스트 반려'];
const TEST_USER_NAMES = ['전지영', '최홍석', '김기해', '김혜준', '천영균', '이형주'];

function matchesTestKeyword(text) {
    const s = String(text || '');
    return TEST_KEYWORDS.some(k => s.includes(k));
}

function classifyStatus(status) {
    switch (status) {
        case 'CANCELLED':       return { deletable: true,  needsRollback: false, note: '이미 취소됨 — 단순 삭제 가능' };
        case 'REJECTED':        return { deletable: true,  needsRollback: false, note: '반려됨 — 단순 삭제 가능' };
        case 'SUBMITTED':       return { deletable: true,  needsRollback: false, note: '팀장 승인 전 — 단순 삭제 가능' };
        case 'TEAM_APPROVED':   return { deletable: true,  needsRollback: false, note: '팀장 승인 완료/skipTeamApproval — 단순 삭제 가능 (used_days 미차감)' };
        case 'FINAL_PENDING':   return { deletable: true,  needsRollback: false, note: '실장 병렬 승인 중 — 단순 삭제 가능 (used_days 미차감)' };
        case 'CEO_PENDING':     return { deletable: true,  needsRollback: false, note: '대표 승인 대기 — 단순 삭제 가능 (used_days 미차감)' };
        case 'FINAL_APPROVED':  return { deletable: false, needsRollback: true,  note: '대표 최종승인 완료 — leave_balance.used_days 원복 필요 후 삭제' };
        default:                return { deletable: false, needsRollback: false, note: `미분류 상태(${status}) — 수동 확인 필요` };
    }
}

const shortId = (id) => id ? (id.length > 12 ? id.slice(0, 8) + '…' : id) : '';

// timestamp helper: 파일명용 YYYYMMDD-HHmmss
function tsForFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ─── main ─────────────────────────────────────────────────────────
(async () => {
    console.log('[audit-test-leave-data] READ-ONLY 테스트 데이터 감사 시작');
    console.log('  키워드:', TEST_KEYWORDS.join(', '));
    console.log('  사용자 이름:', TEST_USER_NAMES.join(', '));
    console.log('  (이름만 일치하는 케이스는 "수동 확인 필요" 로 분류, 키워드+이름 동시 일치 또는 키워드 단독 일치만 자동 삭제 후보)\n');

    const adminEmail = (await questionPlain('admin email: ')).trim();
    if (!adminEmail) { console.error('email이 비어 있습니다.'); process.exit(1); }
    const adminPassword = await questionHidden('admin password (숨김 입력): ');
    if (!adminPassword) { console.error('password가 비어 있습니다.'); process.exit(1); }

    console.log('\n[audit] 로그인 중...');
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    console.log('[audit] 로그인 성공');

    // ── 1) users → name/team_id 매핑
    console.log('\n[audit] users 컬렉션 read-only 조회 (이름/팀 매핑)...');
    const usersSnap = await getDocs(collection(db, 'users'));
    const userById = {};
    const userByName = {};
    usersSnap.docs.forEach(d => {
        const u = { uid: d.id, ...d.data() };
        userById[d.id] = u;
        if (u.name) userByName[u.name] = u;
    });
    const TEST_USER_UIDS = new Set(
        TEST_USER_NAMES.map(n => userByName[n]?.uid).filter(Boolean)
    );
    console.log(`  users 총 ${usersSnap.size}건, 테스트 사용자 매핑 ${TEST_USER_UIDS.size}/${TEST_USER_NAMES.length}건`);

    // ── 2) leave_requests 전체 조회 → 테스트 후보 분류
    console.log('\n[audit] leave_requests 컬렉션 read-only 조회...');
    const reqSnap = await getDocs(collection(db, 'leave_requests'));
    const allReqs = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`  leave_requests 총 ${allReqs.length}건`);

    const candidates = [];
    for (const r of allReqs) {
        const reasonHit = matchesTestKeyword(r.reason) || matchesTestKeyword(r.memo)
                        || matchesTestKeyword(r.message) || matchesTestKeyword(r.title);
        const userHit = TEST_USER_UIDS.has(r.user_id);
        if (!reasonHit && !userHit) continue;

        const userName = userById[r.user_id]?.name || '(unknown)';
        const cls = classifyStatus(r.status);
        const reasons = [];
        if (reasonHit) reasons.push('사유에 테스트 키워드');
        if (userHit) reasons.push('테스트 사용자 명단');

        // 자동 삭제 후보 vs 수동 확인 필요 판정
        // - 키워드 일치 시: 자동 후보 OK
        // - 이름만 일치 (키워드 미일치): 수동 확인 필요
        const _judgement = reasonHit
            ? (cls.needsRollback ? 'used_days 원복 후 삭제 필요' : '삭제만 가능')
            : '수동 확인 필요 (이름만 일치)';

        candidates.push({
            id: r.id,
            user_name: userName,
            user_id: r.user_id,
            team_id: r.team_id,
            date: r.date,
            start_date: r.start_date,
            end_date: r.end_date,
            day_count: r.day_count,
            type: r.type,
            reason: r.reason,
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
            team_approver_uid: r.team_approver_uid,
            team_approver_name: r.team_approver_name,
            final_approvals_keys: r.final_approvals ? Object.keys(r.final_approvals) : [],
            ceo_decision: r.ceo_decision,
            approval_line_version: r.approval_line_version,
            _classify_reasons: reasons,
            _deletable: cls.deletable,
            _needs_rollback: cls.needsRollback,
            _policy_note: cls.note,
            _judgement,
        });
    }
    candidates.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    // ── 3) approvals 전체 조회 → 후보 leave_request_id 와 연결된 것만 추출
    console.log('\n[audit] approvals 컬렉션 read-only 조회...');
    const apprSnap = await getDocs(collection(db, 'approvals'));
    const candReqIds = new Set(candidates.map(c => c.id));
    const candAppr = [];
    apprSnap.docs.forEach(d => {
        const a = { id: d.id, ...d.data() };
        if (candReqIds.has(a.leave_request_id)) candAppr.push(a);
    });
    console.log(`  approvals 총 ${apprSnap.size}건, 후보 연결 ${candAppr.length}건`);

    // ── 4) notifications 전체 조회 → 후보와 연결된 알림 추출
    //    권한 부족(rules가 to_user_id == request.auth.uid 등으로 제한된 경우) 시
    //    스크립트가 중단되지 않도록 try/catch 로 감싸 빈 결과로 진행.
    console.log('\n[audit] notifications 컬렉션 read-only 조회...');
    let candNotifs = [];
    let notificationsReadable = true;
    let notificationsError = null;
    let notificationsTotalCount = 0;
    try {
        const notifSnap = await getDocs(collection(db, 'notifications'));
        notificationsTotalCount = notifSnap.size;
        notifSnap.docs.forEach(d => {
            const n = { id: d.id, ...d.data() };
            const refId = n.data?.leave_request_id || n.leave_request_id || n.request_id;
            const refHit = refId && candReqIds.has(refId);
            const titleHit = matchesTestKeyword(n.title) || matchesTestKeyword(n.message)
                           || matchesTestKeyword(n.data?.user_name);
            if (refHit || titleHit) {
                candNotifs.push({
                    id: n.id,
                    recipient_user_id: n.to_user_id || n.recipient_user_id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    data_user_name: n.data?.user_name,
                    ref_leave_request_id: refId || '',
                    is_read: n.is_read,
                    created_at: n.created_at,
                    _connected_to_candidate: refHit,
                    _title_keyword_hit: titleHit,
                });
            }
        });
        console.log(`  notifications 총 ${notificationsTotalCount}건, 후보 연결/키워드 ${candNotifs.length}건`);
    } catch (e) {
        notificationsReadable = false;
        notificationsError = `${e?.code || ''} ${e?.message || e}`.trim();
        candNotifs = [];
        console.warn(`[audit] notifications 조회 실패 — 권한 부족으로 건너뜀 (${notificationsError})`);
        console.warn('       이후 단계(leave_requests/approvals/leave_balance/대표 처리완료 후보)는 정상 진행');
    }

    // ── 5) leave_balance 분석 (FINAL_APPROVED 후보가 있을 때만)
    const finalApprovedCands = candidates.filter(c => c.status === 'FINAL_APPROVED');
    const balanceAnalysis = [];
    if (finalApprovedCands.length > 0) {
        console.log(`\n[audit] FINAL_APPROVED 테스트 후보 ${finalApprovedCands.length}건 발견 — leave_balance read-only 조회`);
        const sumByKey = {};
        for (const c of finalApprovedCands) {
            const year = (c.date || c.start_date || c.created_at || '').slice(0, 4);
            const key = `${c.user_id}_${year}`;
            sumByKey[key] = (sumByKey[key] || 0) + Number(c.day_count || 0);
        }
        for (const [key, sum] of Object.entries(sumByKey)) {
            try {
                const bSnap = await getDoc(doc(db, 'leave_balance', key));
                if (!bSnap.exists()) {
                    balanceAnalysis.push({ leave_balance_id: key, exists: false, _verdict: '미확인 — 문서 없음' });
                    continue;
                }
                const b = bSnap.data();
                const userName = userById[b.user_id || key.split('_')[0]]?.name || '(unknown)';
                const before = Number(b.used_days || 0);
                const after = Math.max(0, before - sum);
                balanceAnalysis.push({
                    leave_balance_id: key,
                    user_name: userName,
                    user_id: b.user_id,
                    year: b.year,
                    total_days: b.total_days,
                    used_days_before: before,
                    test_approved_sum_day_count: sum,
                    used_days_after_rollback: after,
                    remaining_before: Number(b.total_days || 0) - before,
                    remaining_after: Number(b.total_days || 0) - after,
                    balance_updated_at: b.updated_at || b.baseline_updated_at || '',
                    _verdict: '추정 — 실제 차감 시각/approvals CEO acted_at 교차 확인 후 확정',
                });
            } catch (e) {
                balanceAnalysis.push({ leave_balance_id: key, _verdict: `조회 실패: ${e.message}` });
            }
        }
    } else {
        console.log('\n[audit] FINAL_APPROVED 테스트 후보 없음 — leave_balance 원복 분석 스킵');
    }

    // ── 6) 콘솔 출력
    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  1. leave_requests 테스트 후보 (총 ${candidates.length}건)`);
    console.log('══════════════════════════════════════════════════════════');
    if (candidates.length > 0) {
        console.table(candidates.map(c => ({
            id: shortId(c.id),
            name: c.user_name,
            team: c.team_id,
            date: c.date,
            type: c.type,
            status: c.status,
            reason: String(c.reason || '').slice(0, 20),
            created: String(c.created_at || '').slice(0, 19),
            rollback: c._needs_rollback ? '!!필요' : '-',
            judgement: c._judgement,
        })));
    } else {
        console.log('  → 후보 없음');
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  2. approvals 후보 연결 로그 (${candAppr.length}건)`);
    console.log('══════════════════════════════════════════════════════════');
    if (candAppr.length > 0) {
        console.table(candAppr.map(a => ({
            id: shortId(a.id),
            leave_req: shortId(a.leave_request_id),
            stage: a.stage,
            action: a.action,
            actor: userById[a.actor_user_id]?.name || shortId(a.actor_user_id),
            acted_at: String(a.acted_at || '').slice(0, 19),
        })));
    } else {
        console.log('  → 연결된 approvals 없음');
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  3. notifications 후보 (${candNotifs.length}건)`);
    console.log('══════════════════════════════════════════════════════════');
    if (!notificationsReadable) {
        console.log(`  → 권한 부족으로 조회 불가 (${notificationsError})`);
        console.log('     본 admin 계정으로는 notifications 전체 read 가 거부되었습니다.');
        console.log('     cleanup 단계에서 알림 정리가 필요하면 sys_admin 권한 또는 별도 함수 호출 필요.');
    } else if (candNotifs.length > 0) {
        console.table(candNotifs.map(n => ({
            id: shortId(n.id),
            recipient: userById[n.recipient_user_id]?.name || shortId(n.recipient_user_id),
            type: n.type,
            title: String(n.title || '').slice(0, 24),
            ref_req: shortId(n.ref_leave_request_id),
            connected: n._connected_to_candidate ? 'YES' : 'kw',
            created: String(n.created_at || '').slice(0, 19),
        })));
    } else {
        console.log('  → 후보 없음');
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  4. leave_balance 영향 분석 (${balanceAnalysis.length}건)`);
    console.log('══════════════════════════════════════════════════════════');
    if (balanceAnalysis.length > 0) {
        console.table(balanceAnalysis);
    } else {
        console.log('  → 원복 필요 후보 없음 (FINAL_APPROVED 테스트 건 0건)');
    }

    // ── 7) 대표 처리완료 화면 노출 후보 (FINAL_APPROVED + REJECTED)
    const ceoVisible = candidates.filter(c => c.status === 'FINAL_APPROVED' || c.status === 'REJECTED');
    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  5. 대표 최종 결재함 "처리 완료" 노출 후보 (${ceoVisible.length}건)`);
    console.log('══════════════════════════════════════════════════════════');
    if (ceoVisible.length > 0) {
        console.table(ceoVisible.map(c => {
            const linkedApprovals = candAppr.filter(a => a.leave_request_id === c.id).length;
            const linkedNotifs = candNotifs.filter(n => n.ref_leave_request_id === c.id).length;
            return {
                id: shortId(c.id),
                name: c.user_name,
                team: c.team_id,
                date: c.date,
                type: c.type,
                status: c.status,
                reason: String(c.reason || '').slice(0, 24),
                approvals: linkedApprovals,
                notifs: linkedNotifs,
                judgement: c._judgement,
            };
        }));
    } else {
        console.log('  → 후보 없음');
    }

    // ── 8) 요약
    const summary = {
        scanned_at: new Date().toISOString(),
        total_users: usersSnap.size,
        total_leave_requests: allReqs.length,
        total_candidates: candidates.length,
        by_status: candidates.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {}),
        final_approved_count: finalApprovedCands.length,
        ceo_visible_count: ceoVisible.length,
        approvals_linked: candAppr.length,
        notifications_readable: notificationsReadable,
        notifications_error: notificationsError,
        notifications_total_count: notificationsTotalCount,
        notifications_linked: candNotifs.length,
        leave_balance_rollback_needed: balanceAnalysis.some(b => b._verdict?.startsWith('추정')),
    };
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  6. 요약');
    console.log('══════════════════════════════════════════════════════════');
    console.log(JSON.stringify(summary, null, 2));

    // ── 9) JSON dump
    const outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `audit-test-leave-data-${tsForFilename()}.json`);
    fs.writeFileSync(outPath, JSON.stringify({
        summary,
        leave_requests_candidates: candidates,
        approvals_candidates: candAppr,
        notifications_status: {
            readable: notificationsReadable,
            error: notificationsError,
            total_count: notificationsTotalCount,
        },
        notifications_candidates: candNotifs,
        leave_balance_analysis: balanceAnalysis,
        ceo_visible_candidates: ceoVisible,
    }, null, 2), 'utf8');
    console.log(`\n[audit] JSON dump 저장: ${outPath}`);

    await signOut(auth);
    console.log('[audit] 종료 — 데이터 변경 없음 (read-only)');
    process.exit(0);
})().catch((e) => {
    console.error('[audit] 실패:', e?.code || '', e?.message || e);
    process.exit(2);
});
