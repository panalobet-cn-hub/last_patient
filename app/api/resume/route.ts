import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashToken, setSessionCookie, newToken } from '@/lib/session';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim().replace(/\s/g, '') : '';
    if (!/^[0-9a-f-]{36}$/i.test(employeeId) || !/^[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/i.test(recoveryCode)) return NextResponse.json({ error: 'Enter the employee profile and recovery code exactly as shown.' }, { status: 400 });
    const { data: session, error } = await supabase.from('game_sessions').select('id').eq('employee_id', employeeId).eq('recovery_code_hash', hashToken(recoveryCode)).eq('active', true).is('completed_at', null).maybeSingle();
    if (error) return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
    if (!session) return NextResponse.json({ error: 'Recovery details did not match an active investigation.' }, { status: 401 });
    const token = newToken();
    const { error: updateError } = await supabase.from('game_sessions').update({ session_token_hash: hashToken(token) }).eq('id', session.id);
    if (updateError) return NextResponse.json({ error: 'Could not resume this investigation.' }, { status: 503 });
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 }); }
}
